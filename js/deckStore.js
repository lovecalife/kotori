// ==========================================
// Deck Store
// 保存デッキの localStorage 永続化・スキーマ移行・バックアップ入出力を担う層
//
// 保存デッキは将来の端末間同期を見据えて、以下のメタ情報を持つ。
//   deckId    : 端末をまたいで一意な ID（localStorage 上のキーと同じ値）
//   updatedAt : 最終更新時刻（Unix ミリ秒）。競合時は新しい方を採用する（LWW）
//   deleted   : 削除済みフラグ。物理削除すると同期時に復活してしまうため墓標を残す
// ==========================================

const DECKS_STORAGE_KEY = 'card_viewer_saved_decks';
const DECKS_SCHEMA_KEY = 'card_viewer_decks_schema';
const DECKS_SCHEMA_VERSION = 1;

// 墓標を無限に溜めないよう、削除から一定期間経過したものは掃除する
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180日

// ------------------------------------------
// ID 生成
// ------------------------------------------
const generateDeckId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // randomUUID 非対応ブラウザ向けのフォールバック（getRandomValues は広くサポートされている）
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const b = crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// ------------------------------------------
// 正規化
// ------------------------------------------

// 1件のデッキを新スキーマへ正規化する。壊れたレコードは null を返して捨てる
const normalizeDeckRecord = (raw, fallbackId, now) => {
    if (!raw || typeof raw !== 'object') return null;
    const deckId = (typeof raw.deckId === 'string' && raw.deckId) ? raw.deckId : fallbackId;
    if (!deckId) return null;
    const counts = (dict) => {
        const out = {};
        if (!dict || typeof dict !== 'object') return out;
        Object.entries(dict).forEach(([num, count]) => {
            const n = parseInt(count, 10);
            if (Number.isFinite(n) && n > 0) out[num] = n;
        });
        return out;
    };
    const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : now;
    return {
        deckId,
        name: typeof raw.name === 'string' ? raw.name : '',
        member: counts(raw.member),
        live: counts(raw.live),
        updatedAt,
        deleted: raw.deleted === true
    };
};

// 旧形式（{ [id]: { name, member, live } }）を含む任意の入力を新スキーマの Map にそろえる。
// 旧形式ではキーが Date.now() ベースで端末間衝突の恐れがあるため、deckId を採番して振り直す。
const migrateSavedDecks = (rawMap) => {
    const now = Date.now();
    const out = {};
    if (!rawMap || typeof rawMap !== 'object') return out;
    Object.entries(rawMap).forEach(([key, raw]) => {
        // 旧レコードには deckId が無い。その場合はここで新規採番する
        const hasDeckId = raw && typeof raw.deckId === 'string' && raw.deckId;
        const record = normalizeDeckRecord(raw, hasDeckId ? raw.deckId : generateDeckId(), now);
        if (!record) return;
        // 同じ deckId が二重に現れた場合は新しい方を残す
        const existing = out[record.deckId];
        if (!existing || record.updatedAt >= existing.updatedAt) out[record.deckId] = record;
    });
    return out;
};

// 期限切れの墓標を落とす
const pruneTombstones = (decks, now = Date.now()) => {
    const out = {};
    Object.entries(decks).forEach(([id, d]) => {
        if (d.deleted && (now - d.updatedAt) > TOMBSTONE_TTL_MS) return;
        out[id] = d;
    });
    return out;
};

// 画面に出す（＝削除されていない）デッキだけを返す
const visibleDecks = (decks) => {
    const out = {};
    Object.entries(decks || {}).forEach(([id, d]) => { if (!d.deleted) out[id] = d; });
    return out;
};

// ------------------------------------------
// 永続化
// ------------------------------------------

const loadSavedDecks = () => {
    let parsed = null;
    try {
        const saved = localStorage.getItem(DECKS_STORAGE_KEY);
        if (saved) parsed = JSON.parse(saved);
    } catch (e) {
        console.error('Failed to load saved decks', e);
        return {};
    }
    if (!parsed) return {};

    let version = 0;
    try { version = parseInt(localStorage.getItem(DECKS_SCHEMA_KEY), 10) || 0; } catch (e) {}

    const decks = pruneTombstones(migrateSavedDecks(parsed));

    // 移行が起きた場合のみ書き戻す（毎回書き戻すと updatedAt の意味が薄れるため）
    if (version < DECKS_SCHEMA_VERSION) {
        persistSavedDecks(decks);
    }
    return decks;
};

const persistSavedDecks = (decks) => {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks));
    try { localStorage.setItem(DECKS_SCHEMA_KEY, String(DECKS_SCHEMA_VERSION)); } catch (e) {}
};

// ------------------------------------------
// マージ（LWW）
// バックアップのインポートと、将来のサーバ同期の両方から使う
// ------------------------------------------
const mergeDeckRecords = (current, incoming) => {
    const out = { ...current };
    let applied = 0;
    incoming.forEach(raw => {
        const record = normalizeDeckRecord(raw, raw && raw.deckId, Date.now());
        if (!record) return;
        const existing = out[record.deckId];
        // 同時刻なら既存を優先する（取り込みで無用に上書きしない）
        if (existing && existing.updatedAt >= record.updatedAt) return;
        out[record.deckId] = record;
        applied++;
    });
    return { decks: out, applied };
};

// ------------------------------------------
// バックアップ入出力（全デッキ）
// ------------------------------------------
const DECK_BACKUP_KIND = 'kotori-deck-backup';
const DECK_BACKUP_VERSION = 1;

const buildDeckBackup = (decks) => ({
    kind: DECK_BACKUP_KIND,
    version: DECK_BACKUP_VERSION,
    exportedAt: Date.now(),
    // 墓標はバックアップに含めない。復元は「戻す」操作であって削除を再現する必要はない
    decks: Object.values(decks).filter(d => !d.deleted)
});

// バックアップ JSON をパースしてデッキ配列を取り出す。形式不正なら null
const parseDeckBackup = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.kind !== DECK_BACKUP_KIND || !Array.isArray(parsed.decks)) return null;
    return parsed.decks;
};

const downloadJson = (filename, obj) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

const backupFilename = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `kotori-decks-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
};
