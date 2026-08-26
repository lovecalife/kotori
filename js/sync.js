// ==========================================
// Deck Sync
// シンクキーの発行・正規化・ハッシュ化と、/sync API との通信を担う層。
//
// シンクキーそのものが認証情報を兼ねる。サーバへ送るのは SHA-256 した
// key_hash だけで、平文のキーはこの端末から出ない。
// ==========================================

const SYNC_KEY_STORAGE_KEY = 'card_viewer_sync_key';
const LAST_SYNCED_STORAGE_KEY = 'card_viewer_last_synced_at';

// Crockford Base32。誤読しやすい I / L / O / U を含まない
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// 20バイト = 160bit。Base32 でちょうど 32 文字になり、4文字 x 8 グループに
// 割り切れる（16バイトだと 26 文字で端数が出る）。要求の 128bit は満たす
const SYNC_KEY_BYTES = 20;
const SYNC_KEY_LENGTH = 32;

const SYNC_KEY_PREFIX = 'KOTRI';

// ------------------------------------------
// キーの発行・正規化
// ------------------------------------------

const encodeBase32 = (bytes) => {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
};

// 表示用に KOTRI-XXXX-XXXX-… の形へ整える
const formatSyncKey = (raw) => {
    const groups = raw.match(/.{1,4}/g) || [];
    return [SYNC_KEY_PREFIX, ...groups].join('-');
};

const generateSyncKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(SYNC_KEY_BYTES));
    return formatSyncKey(encodeBase32(bytes).slice(0, SYNC_KEY_LENGTH));
};

// 手入力・QR・コピペのゆらぎを吸収して正規形（ハイフンなし32文字）に直す。
// 不正なら null。Crockford の読み替え規則に従い I/L は 1、O は 0 とみなす
const normalizeSyncKey = (input) => {
    if (typeof input !== 'string') return null;
    let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (s.startsWith(SYNC_KEY_PREFIX)) s = s.slice(SYNC_KEY_PREFIX.length);
    s = s.replace(/[IL]/g, '1').replace(/O/g, '0');
    if (s.length !== SYNC_KEY_LENGTH) return null;
    for (const ch of s) {
        if (BASE32_ALPHABET.indexOf(ch) === -1) return null;
    }
    return s;
};

// 正規形（ハイフンなし）から表示用の形へ
const displaySyncKey = (normalized) => formatSyncKey(normalized);

// 正規形の SHA-256 を hex で返す。両端末で同じ値になる必要があるので
// ハイフンや接頭辞を含まない正規形を対象にする
const syncKeyToHash = async (normalized) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

// ------------------------------------------
// キー・最終同期時刻の永続化
// ------------------------------------------

const loadSyncKey = () => {
    try { return normalizeSyncKey(localStorage.getItem(SYNC_KEY_STORAGE_KEY) || ''); }
    catch (e) { return null; }
};

const saveSyncKey = (normalized) => {
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, normalized);
};

const clearSyncKey = () => {
    try {
        localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
        localStorage.removeItem(LAST_SYNCED_STORAGE_KEY);
    } catch (e) {}
};

const loadLastSyncedAt = () => {
    try { return parseInt(localStorage.getItem(LAST_SYNCED_STORAGE_KEY), 10) || 0; }
    catch (e) { return 0; }
};

const saveLastSyncedAt = (t) => {
    try { localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(t)); } catch (e) {}
};

// ------------------------------------------
// デッキ ⇔ payload の変換
// payload の中身はサーバが解釈しない。形式を変えるならここだけ直せばよい
// ------------------------------------------

const deckToPayload = (deck) => JSON.stringify({
    name: deck.name,
    member: deck.member,
    live: deck.live
});

// サーバから来た1件をローカルのデッキレコード形へ。壊れていたら null
const changeToDeckRecord = (change) => {
    if (!change || typeof change.deckId !== 'string' || !change.deckId) return null;
    const base = { deckId: change.deckId, updatedAt: change.updatedAt, deleted: change.deleted === true };
    if (base.deleted) return { ...base, name: '', member: {}, live: {} };
    let parsed;
    try { parsed = JSON.parse(change.payload); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...base, name: parsed.name, member: parsed.member, live: parsed.live };
};

// ------------------------------------------
// 通信
// ------------------------------------------

class SyncError extends Error {
    constructor(code, status) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

// 同期の失敗理由をユーザー向けの文言にする。分からないものはまとめて扱う
const syncErrorMessage = (err) => {
    switch (err && err.code) {
        case 'rate_limited':         return '同期の回数が多すぎます。しばらく待ってから試してください';
        case 'deck_limit_exceeded':  return 'デッキ数が上限に達しています。不要なデッキを削除してください';
        case 'payload_too_large':
        case 'body_too_large':
        case 'too_many_changes':     return 'データが大きすぎて同期できませんでした';
        case 'origin_not_allowed':   return 'このページからは同期できません（サーバ設定を確認してください）';
        case 'invalid_key_hash':     return 'シンクキーが正しくありません';
        default:                     return '同期に失敗しました。ネットワークを確認してください';
    }
};

const postSync = async (apiBase, keyHash, since, changes) => {
    let res;
    try {
        res = await fetch(`${apiBase}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyHash, since, changes })
        });
    } catch (e) {
        // オフラインや DNS 失敗。次回リトライに委ねる
        throw new SyncError('network_error', 0);
    }
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
        throw new SyncError((body && body.error) || 'http_error', res.status);
    }
    return body;
};

// ------------------------------------------
// 同期本体
// localStorage を「正」、サーバを「ミラー」として扱う。
// 失敗しても lastSyncedAt を進めないので、次回に持ち越される
// ------------------------------------------
const runSync = async ({ apiBase, keyHash, since, decks }) => {
    // 前回同期以降に変更されたデッキのみ送る（墓標も「変更」として送る）
    const changes = Object.values(decks)
        .filter(d => d.updatedAt > since)
        .map(d => ({
            deckId: d.deckId,
            payload: d.deleted ? '' : deckToPayload(d),
            updatedAt: d.updatedAt,
            deleted: !!d.deleted
        }));

    const res = await postSync(apiBase, keyHash, since, changes);

    const incoming = (res.changes || [])
        .map(changeToDeckRecord)
        .filter(Boolean);

    return {
        serverTime: res.serverTime,
        incoming,
        // 呼び出し側が「送れたもの / 送れていないもの」を判定できるようにする
        pushedIds: new Set(changes.map(c => c.deckId))
    };
};
