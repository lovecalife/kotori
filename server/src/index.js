// ==========================================
// KOTRI デッキ同期 API
//
// 認証はシンクキーの SHA-256（keyHash）のみ。平文のキーはサーバに届かない。
// payload はパースせず不透明な文字列として扱う。
// ログには payload と keyHash を出さない（漏洩時にデッキ内容へ到達させないため）。
// ==========================================

// --- ガードレールの上限値 ---
const MAX_BODY_BYTES = 256 * 1024;   // 1リクエスト全体
const MAX_PAYLOAD_BYTES = 64 * 1024; // デッキ1件
const MAX_DECKS_PER_KEY = 200;
const MAX_CHANGES_PER_REQUEST = 200;
const MAX_DECK_ID_LENGTH = 128;

// --- レート制限 ---
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 60;

// 端末の時計は平気でずれる。未来に飛びすぎた updatedAt は他端末の更新を
// 恒久的に食い潰すので、サーバ時刻に丸める
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const KEY_HASH_RE = /^[0-9a-f]{64}$/;

// ------------------------------------------
// CORS
// ------------------------------------------

// 許可オリジンは環境変数 ALLOWED_ORIGINS（カンマ区切り）で与える。
// ワイルドカードは使わない
const allowedOrigins = (env) =>
    (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const corsHeaders = (origin) => ({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
});

const json = (body, status, origin) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(origin ? corsHeaders(origin) : {})
    }
});

// ------------------------------------------
// バリデーション
// ------------------------------------------

const byteLength = (s) => new TextEncoder().encode(s).length;

const isSafeInteger = (v) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);

// changes を検証しつつ正規化する。{ error } を返したら 4xx で打ち切る
const validateChanges = (raw, serverTime) => {
    if (raw === undefined || raw === null) return { changes: [] };
    if (!Array.isArray(raw)) return { error: { status: 400, code: 'invalid_changes' } };
    if (raw.length > MAX_CHANGES_PER_REQUEST) return { error: { status: 413, code: 'too_many_changes' } };

    const changes = [];
    for (const c of raw) {
        if (!c || typeof c !== 'object') return { error: { status: 400, code: 'invalid_change' } };
        if (typeof c.deckId !== 'string' || !c.deckId || c.deckId.length > MAX_DECK_ID_LENGTH) {
            return { error: { status: 400, code: 'invalid_deck_id' } };
        }
        if (typeof c.payload !== 'string') return { error: { status: 400, code: 'invalid_payload' } };
        if (byteLength(c.payload) > MAX_PAYLOAD_BYTES) {
            return { error: { status: 413, code: 'payload_too_large' } };
        }
        if (!isSafeInteger(c.updatedAt) || c.updatedAt < 0) {
            return { error: { status: 400, code: 'invalid_updated_at' } };
        }
        changes.push({
            deckId: c.deckId,
            payload: c.payload,
            // 未来に飛びすぎた値はサーバ時刻に丸める
            updatedAt: Math.min(c.updatedAt, serverTime + MAX_CLOCK_SKEW_MS),
            deleted: c.deleted === true ? 1 : 0
        });
    }
    return { changes };
};

// ------------------------------------------
// レート制限
// sync_keys の行を読み書きして固定ウィンドウで数える。
// 行が無ければここで作る（＝明示的な登録APIが不要）
// ------------------------------------------
const checkRateLimit = async (db, keyHash, now) => {
    const row = await db
        .prepare('SELECT window_start, window_count FROM sync_keys WHERE key_hash = ?')
        .bind(keyHash)
        .first();

    if (!row) {
        await db
            .prepare(`INSERT INTO sync_keys (key_hash, created_at, last_seen_at, deck_count, window_start, window_count)
                      VALUES (?, ?, ?, 0, ?, 1)
                      ON CONFLICT(key_hash) DO UPDATE SET window_count = sync_keys.window_count + 1`)
            .bind(keyHash, now, now, now)
            .run();
        return { ok: true };
    }

    const withinWindow = (now - row.window_start) < RATE_WINDOW_MS;
    if (withinWindow && row.window_count >= RATE_MAX_REQUESTS) {
        const retryAfter = Math.ceil((row.window_start + RATE_WINDOW_MS - now) / 1000);
        return { ok: false, retryAfter: Math.max(retryAfter, 1) };
    }

    if (withinWindow) {
        await db.prepare('UPDATE sync_keys SET window_count = window_count + 1 WHERE key_hash = ?')
            .bind(keyHash).run();
    } else {
        await db.prepare('UPDATE sync_keys SET window_start = ?, window_count = 1 WHERE key_hash = ?')
            .bind(now, keyHash).run();
    }
    return { ok: true };
};

// ------------------------------------------
// POST /sync
// ------------------------------------------
const handleSync = async (request, env, origin) => {
    const db = env.DB;
    const serverTime = Date.now();

    // 本文サイズ。Content-Length は詐称されうるので実際に読んだ長さでも確認する
    const declared = parseInt(request.headers.get('Content-Length') || '', 10);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return json({ error: 'body_too_large' }, 413, origin);
    }
    const text = await request.text();
    if (byteLength(text) > MAX_BODY_BYTES) {
        return json({ error: 'body_too_large' }, 413, origin);
    }

    let body;
    try { body = JSON.parse(text); } catch (e) {
        return json({ error: 'invalid_json' }, 400, origin);
    }
    if (!body || typeof body !== 'object') {
        return json({ error: 'invalid_body' }, 400, origin);
    }

    const keyHash = body.keyHash;
    if (typeof keyHash !== 'string' || !KEY_HASH_RE.test(keyHash)) {
        return json({ error: 'invalid_key_hash' }, 400, origin);
    }

    const since = body.since === undefined ? 0 : body.since;
    if (!isSafeInteger(since) || since < 0) {
        return json({ error: 'invalid_since' }, 400, origin);
    }

    const validated = validateChanges(body.changes, serverTime);
    if (validated.error) {
        return json({ error: validated.error.code }, validated.error.status, origin);
    }
    const changes = validated.changes;

    const rate = await checkRateLimit(db, keyHash, serverTime);
    if (!rate.ok) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Retry-After': String(rate.retryAfter),
                ...corsHeaders(origin)
            }
        });
    }

    if (changes.length > 0) {
        // デッキ数の上限。既存にない deck_id かつ削除でないものだけが純増になる
        const existing = await db
            .prepare(`SELECT deck_id FROM decks WHERE key_hash = ? AND deleted = 0`)
            .bind(keyHash)
            .all();
        const existingIds = new Set((existing.results || []).map(r => r.deck_id));
        let projected = existingIds.size;
        for (const c of changes) {
            if (c.deleted) {
                if (existingIds.has(c.deckId)) projected--;
            } else if (!existingIds.has(c.deckId)) {
                projected++;
            }
        }
        if (projected > MAX_DECKS_PER_KEY) {
            return json({ error: 'deck_limit_exceeded', limit: MAX_DECKS_PER_KEY }, 409, origin);
        }

        // 既存より新しいものだけ上書きする（古い更新は無視。エラーにはしない）
        const upsert = db.prepare(
            `INSERT INTO decks (key_hash, deck_id, payload, updated_at, deleted)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(key_hash, deck_id) DO UPDATE SET
               payload    = excluded.payload,
               updated_at = excluded.updated_at,
               deleted    = excluded.deleted
             WHERE excluded.updated_at > decks.updated_at`
        );
        await db.batch(changes.map(c =>
            upsert.bind(keyHash, c.deckId, c.payload, c.updatedAt, c.deleted)
        ));
    }

    const rows = await db
        .prepare(`SELECT deck_id, payload, updated_at, deleted
                  FROM decks WHERE key_hash = ? AND updated_at > ?
                  ORDER BY updated_at ASC`)
        .bind(keyHash, since)
        .all();

    const deckCount = await db
        .prepare('SELECT COUNT(*) AS n FROM decks WHERE key_hash = ? AND deleted = 0')
        .bind(keyHash)
        .first();

    await db
        .prepare('UPDATE sync_keys SET last_seen_at = ?, deck_count = ? WHERE key_hash = ?')
        .bind(serverTime, deckCount ? deckCount.n : 0, keyHash)
        .run();

    return json({
        serverTime,
        changes: (rows.results || []).map(r => ({
            deckId: r.deck_id,
            payload: r.payload,
            updatedAt: r.updated_at,
            deleted: r.deleted === 1
        }))
    }, 200, origin);
};

// ------------------------------------------
// エントリポイント
// ------------------------------------------
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');
        const allowed = allowedOrigins(env);
        const isAllowedOrigin = origin !== null && allowed.includes(origin);

        // /health は監視用なのでオリジン制限をかけない
        if (request.method === 'GET' && url.pathname === '/health') {
            return json({ ok: true }, 200, isAllowedOrigin ? origin : null);
        }

        if (request.method === 'OPTIONS') {
            if (!isAllowedOrigin) return new Response(null, { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (url.pathname !== '/sync') {
            return json({ error: 'not_found' }, 404, isAllowedOrigin ? origin : null);
        }
        if (request.method !== 'POST') {
            return json({ error: 'method_not_allowed' }, 405, isAllowedOrigin ? origin : null);
        }

        // ブラウザ以外（curl 等）は Origin を送らない。許可オリジン付きの
        // リクエストか、Origin なしのリクエストのみ通す。
        // 別オリジンのページからの呼び出しは弾く
        if (origin !== null && !isAllowedOrigin) {
            return json({ error: 'origin_not_allowed' }, 403, null);
        }

        try {
            return await handleSync(request, env, isAllowedOrigin ? origin : null);
        } catch (e) {
            // payload / keyHash は決してログに出さない
            console.error('sync failed:', e && e.message);
            return json({ error: 'internal_error' }, 500, isAllowedOrigin ? origin : null);
        }
    }
};
