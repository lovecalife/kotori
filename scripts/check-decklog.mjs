// デプロイ後の疎通確認。実際のDeckLogへ1回アクセスする。
import assert from 'node:assert/strict';

const base = process.argv[2] || 'https://kotori-sync.lovecalife-kotori.workers.dev';
const code = process.argv[3] || '19ATNY';
const origin = process.argv[4] || 'https://lovecalife.github.io';
assert.equal(new URL(origin).origin, origin, 'Origin は末尾の / やパスを含めず指定してください');
const response = await fetch(`${base}/decklog/${code}`, {
    headers: { Origin: origin }, signal: AbortSignal.timeout(20000)
});
const data = await response.json();
assert.equal(response.status, 200, JSON.stringify(data));
assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
assert.equal(data.code, code);
assert.ok(Array.isArray(data.cards) && data.cards.length > 0);
const counts = { member: 0, live: 0 };
for (const card of data.cards) {
    assert.ok(Object.hasOwn(counts, card.type));
    assert.ok(Number.isSafeInteger(card.count) && card.count > 0);
    counts[card.type] += card.count;
}
console.log(JSON.stringify({ code, status: response.status, counts }));
