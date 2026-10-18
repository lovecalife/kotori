import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import { fetchDecklog, normalizeDecklog, handleDecklog } from '../server/src/decklog.mjs';
import worker from '../server/src/index.js';

const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout });
vm.runInContext(`${await readFile(new URL('../js/decklog.js', import.meta.url), 'utf8')}\nthis.api = Decklog;`, context);
const { parseCode, buildDeck } = context.api;
const row = (card_number, num, card_kind = 'M') => ({ card_number, num, card_kind });
const payload = (list = [row('PL!-pb1-019-N', 2)]) => ({ deck_id: '19ATNY', game_title_id: 11, title: 'テスト', list, sub_list: [] });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('IDと共有URLの検証', () => {
    assert.equal(parseCode(' 19atny '), '19ATNY');
    assert.equal(parseCode('https://decklog.bushiroad.com/view/19atny/?x=1#deck'), '19ATNY');
    for (const input of ['', 'abc', 'D-123456', 'https://example.com/view/19ATNY', 'http://decklog.bushiroad.com/view/19ATNY',
        'https://decklog.bushiroad.com:999/view/19ATNY', 'https://user@decklog.bushiroad.com/view/19ATNY', '../19ATNY']) assert.throws(() => parseCode(input));
});

test('カード種別と重複集計', () => {
    const data = payload([row('PL!-pb1-019-N', 1), row('PL!-pb1-019-N', 2), row('PL!-bp6-019-L', 4, 'L')]);
    data.sub_list = [row('LL-E-001-SD', 12, 'E')];
    const result = normalizeDecklog(data, '19ATNY');
    assert.deepEqual(result.cards, [{ cardId: 'PL!-pb1-019-N', count: 3, type: 'member' }, { cardId: 'PL!-bp6-019-L', count: 4, type: 'live' }]);
    assert.equal(result.energyCount, 12);
});

test('不完全・形式違い・別ゲームを成功扱いしない', () => {
    for (const num of ['2', 0, -1, 1.5, null, true, 1000]) assert.throws(() => normalizeDecklog(payload([row('CARD', num)]), '19ATNY'));
    for (const data of [{}, payload([]), payload([row('', 1)]), payload([row('CARD', 1, 'E')]), { ...payload(), sub_list: null }, { ...payload(), deck_id: '1AH20Q' }]) {
        assert.throws(() => normalizeDecklog(data, '19ATNY'), { code: 'invalid_response' });
    }
    assert.throws(() => normalizeDecklog([], '19ATNY'), { code: 'deck_not_found' });
    assert.throws(() => normalizeDecklog({ ...payload(), game_title_id: 2 }, '19ATNY'), { code: 'unsupported_game' });
});

test('固定ホストへのPOSTとHTTP異常', async () => {
    await fetchDecklog('19ATNY', async (url, options) => {
        assert.equal(url, 'https://decklog.bushiroad.com/system/app/api/view/19ATNY');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Referer, 'https://decklog.bushiroad.com/view/19ATNY');
        assert.equal(options.redirect, 'error');
        return json(payload());
    });
    for (const [status, code] of [[403, 'upstream_forbidden'], [404, 'deck_not_found'], [429, 'upstream_rate_limited'], [500, 'upstream_unavailable']]) {
        await assert.rejects(fetchDecklog('19ATNY', async () => json({}, status)), { code });
    }
    await assert.rejects(fetchDecklog('19ATNY', async () => new Response('<html>error</html>')), { code: 'invalid_response' });
    await assert.rejects(fetchDecklog('19ATNY', async () => json({})), { code: 'invalid_response' });
    await assert.rejects(fetchDecklog('19ATNY', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } })), { code: 'invalid_response' });
    await assert.rejects(fetchDecklog('19ATNY', async () => new Response('x'.repeat(1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } })), { code: 'invalid_response' });
    await assert.rejects(fetchDecklog('../other', async () => { throw new Error('must not fetch'); }), { code: 'invalid_code' });
    await assert.rejects(fetchDecklog('19ATNY', async () => { throw new TypeError('network'); }), { code: 'network_error' });
});

test('タイムアウトをエラーにする', async () => {
    const original = globalThis.setTimeout;
    try {
        globalThis.setTimeout = callback => original(callback, 1);
        await assert.rejects(fetchDecklog('19ATNY', async (_, options) => new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })), { code: 'timeout' });
    } finally { globalThis.setTimeout = original; }
});

test('レアリティ違いを合算し未知カードは拒否する', () => {
    const card = { number: 'PL!-pb1-019', _type: 'member' };
    const live = { number: 'PL!-bp6-019', _type: 'live' };
    const data = { cards: [{ cardId: 'PL!-pb1-019-N', type: 'member', count: 2 }, { cardId: 'PL!-pb1-019-P', type: 'member', count: 3 }, { cardId: 'PL!-bp6-019-L', type: 'live', count: 4 }] };
    const result = buildDeck(data, { member: [card], live: [live] });
    assert.equal(result.member[card.number].count, 5);
    assert.equal(result.live[live.number].count, 4);
    assert.equal(result.member[card.number].card, card);
    assert.throws(() => buildDeck(data, { member: [], live: [live] }), /PL!-pb1-019-N/);
    assert.throws(() => buildDeck({ cards: [] }, { member: [card], live: [live] }));
});

test('短時間キャッシュと取得回数制限', async () => {
    let calls = 0;
    const fake = async () => { calls++; return json(payload()); };
    assert.equal((await handleDecklog('bad!', 'test', fake)).status, 400);
    assert.equal((await handleDecklog('19ATNY', 'test', fake)).status, 200);
    assert.equal((await handleDecklog('19ATNY', 'test', fake)).status, 200);
    assert.equal(calls, 1);
    for (let i = 0; i < 18; i++) await handleDecklog('19ATNY', 'test', fake);
    assert.equal((await handleDecklog('19ATNY', 'test', fake)).status, 429);
    const failed = await handleDecklog('1AH20Q', 'test-fail', async () => json([], 404));
    assert.equal(failed.status, 404);
    assert.equal((await failed.json()).error, 'deck_not_found');
});

test('WorkersのCORS・HTTPメソッドと既存ルートを維持する', async () => {
    const env = { ALLOWED_ORIGINS: 'https://example.com' };
    const request = (path, method = 'GET', origin = 'https://example.com') => new Request(`https://worker.example${path}`, { method, headers: { Origin: origin } });
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => json({ ...payload(), deck_id: 'TST123' });
        const result = await worker.fetch(request('/decklog/TST123'), env);
        assert.equal(result.status, 200);
        assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
        assert.equal((await result.json()).code, 'TST123');
        assert.equal((await worker.fetch(request('/decklog/TST123', 'GET', 'https://other.example'), env)).status, 403);
        assert.equal((await worker.fetch(request('/decklog/TST123', 'POST'), env)).status, 405);
        assert.equal((await worker.fetch(request('/decklog/TST123', 'OPTIONS'), env)).status, 204);
        assert.equal((await worker.fetch(request('/decklog/abc'), env)).status, 400);
        assert.equal((await worker.fetch(request('/health'), env)).status, 200);
        assert.equal((await worker.fetch(request('/sync'), env)).status, 405);
        const invalidSync = new Request('https://worker.example/sync', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal((await worker.fetch(invalidSync, env)).status, 400);
    } finally { globalThis.fetch = original; }
});
