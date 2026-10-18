// DeckLog の公開デッキを必要な項目だけに変換する。Node / Workers 共通。
const CODE_RE = /^[A-Z0-9]{4,10}$/;
const ORIGIN = 'https://decklog.bushiroad.com';

class DecklogError extends Error {
    constructor(code, message, status = 502) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

const invalidResponse = () => new DecklogError('invalid_response', 'DeckLogの応答形式を確認できませんでした。');

export function normalizeDecklog(data, code) {
    if (Array.isArray(data) && data.length === 0) {
        throw new DecklogError('deck_not_found', 'デッキが見つからないか、公開コードで取得できません。', 404);
    }
    if (!data || data.deck_id !== code || !Array.isArray(data.list) || !data.list.length) throw invalidResponse();
    if (data.game_title_id !== 11) {
        throw new DecklogError('unsupported_game', 'ラブライブ！シリーズのデッキコードを入力してください。', 422);
    }
    if (!Array.isArray(data.sub_list)) throw invalidResponse();
    const cards = new Map();
    let energyCount = 0;
    for (const [rows, energy] of [[data.list, false], [data.sub_list, true]]) {
        for (const row of rows) {
            if (!row || typeof row.card_number !== 'string' || !row.card_number.trim() ||
                row.card_number.length > 100 || !Number.isSafeInteger(row.num) || row.num <= 0 || row.num > 999) {
                throw invalidResponse();
            }
            if (energy) {
                if (row.card_kind !== 'E') throw invalidResponse();
                energyCount += row.num;
                continue;
            }
            const type = row.card_kind === 'M' ? 'member' : row.card_kind === 'L' ? 'live' : null;
            if (!type) throw invalidResponse();
            const existing = cards.get(row.card_number);
            if (existing && existing.type !== type) throw invalidResponse();
            const count = (existing?.count || 0) + row.num;
            if (!Number.isSafeInteger(count) || count > 999) throw invalidResponse();
            cards.set(row.card_number, { cardId: row.card_number, count, type });
        }
    }
    return {
        code,
        title: typeof data.title === 'string' ? data.title.slice(0, 200) : '',
        cards: [...cards.values()],
        energyCount
    };
}

export async function fetchDecklog(code, fetcher = fetch) {
    if (!CODE_RE.test(code)) throw new DecklogError('invalid_code', 'デッキコードは半角英数字4〜10文字で入力してください。', 400);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        // 公式の閲覧画面で使われるPOST。ログインやCookieは使用しない。
        const response = await fetcher(`${ORIGIN}/system/app/api/view/${code}`, {
            method: 'POST',
            headers: { Referer: `${ORIGIN}/view/${code}`, Accept: 'application/json' },
            redirect: 'error',
            signal: controller.signal
        });
        if (response.status === 404) throw new DecklogError('deck_not_found', 'デッキが見つかりません。', 404);
        if (response.status === 403) throw new DecklogError('upstream_forbidden', 'DeckLog側で取得が許可されませんでした。');
        if (response.status === 429) throw new DecklogError('upstream_rate_limited', 'DeckLogが混み合っています。しばらく待ってから取得してください。', 429);
        if (!response.ok) throw new DecklogError('upstream_unavailable', 'DeckLogから取得できませんでした。時間をおいてお試しください。');
        if (!response.headers.get('content-type')?.includes('application/json')) throw invalidResponse();
        // ストリーム中もタイムアウトとサイズ制限を適用する。
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let size = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1024 * 1024) {
                await reader.cancel();
                throw invalidResponse();
            }
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        let data;
        try { data = JSON.parse(text); } catch { throw invalidResponse(); }
        return normalizeDecklog(data, code);
    } catch (error) {
        if (error instanceof DecklogError) throw error;
        if (controller.signal.aborted) throw new DecklogError('timeout', 'DeckLogの応答がありません。時間をおいてお試しください。', 504);
        throw new DecklogError('network_error', 'DeckLogに接続できませんでした。');
    } finally {
        clearTimeout(timer);
    }
}

// インスタンス内で短時間キャッシュ・取得回数制限。永続データは持たない。
const cache = new Map();
const requests = new Map();
export async function handleDecklog(code, client = 'local', fetcher = fetch) {
    const now = Date.now();
    for (const [key, item] of cache) if (item.expires <= now) cache.delete(key);
    for (const [key, item] of requests) if (item.expires <= now) requests.delete(key);
    const reply = (body, status) => new Response(JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
    if (!CODE_RE.test(code)) return reply({ error: 'invalid_code', message: 'デッキコードは半角英数字4〜10文字で入力してください。' }, 400);
    const rate = requests.get(client) || { count: 0, expires: now + 60000 };
    if (rate.count >= 20) return reply({ error: 'rate_limited', message: '取得回数が多いため、1分ほど待ってからお試しください。' }, 429);
    if (requests.size >= 1000 && !requests.has(client)) requests.delete(requests.keys().next().value);
    requests.set(client, { ...rate, count: rate.count + 1 });
    const cached = cache.get(code);
    if (cached) return reply(cached.data, 200);
    try {
        const data = await fetchDecklog(code, fetcher);
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(code, { data, expires: Date.now() + 30000 });
        return reply(data, 200);
    } catch (error) {
        return reply({ error: error.code || 'internal_error', message: error.message }, error.status || 500);
    }
}
