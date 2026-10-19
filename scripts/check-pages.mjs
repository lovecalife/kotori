// 配信確認。GET / OPTIONS のみで、同期データの送信・変更は行わない。
import assert from 'node:assert/strict';

const [siteInput, apiInput] = process.argv.slice(2);
if (!siteInput) throw new Error('Usage: node scripts/check-pages.mjs <site-origin> [sync-api-origin]');
const site = parseOrigin(siteInput);
const api = apiInput ? parseOrigin(apiInput) : null;
const get = (url, options = {}) => fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
const hasNoindex = response => assert.match(response.headers.get('X-Robots-Tag') || '', /\bnoindex\b/i);

const home = await get(`${site}/`);
assert.equal(home.status, 200, 'トップページが表示できません');
hasNoindex(home);
assert.equal(home.headers.get('Referrer-Policy'), 'no-referrer');
const html = await home.text();
assert.match(html, /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i);
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["'](js\/[^"']+)["']/gi)].map(match => match[1]);
assert.ok(scripts.length > 0, '画面の JS がありません');
for (const src of scripts) {
  const response = await get(`${site}/${src}`);
  assert.equal(response.status, 200, `${src} が取得できません`);
  assert.match(response.headers.get('Content-Type') || '', /javascript/);
  hasNoindex(response);
}
const robots = await get(`${site}/robots.txt`);
assert.equal(robots.status, 200);
assert.doesNotMatch(await robots.text(), /^\s*(?:Disallow:\s*\/|Sitemap:)/im);
for (const path of ['README.md', 'AGENTS.md', 'server/wrangler.toml', 'server/src/index.js',
  'scripts/prepare-pages.mjs', '.git/config', '.env', 'missing-page']) {
  const response = await get(`${site}/${path}`);
  assert.equal(response.status, 404, `${path} が 404 になりません`);
}
if (api) {
  const health = await get(`${api}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  for (const [origin, expected] of [[site, 204], ['https://untrusted.invalid', 403]]) {
    for (const [path, method] of [['/sync', 'POST'], ['/decklog/19ATNY', 'GET']]) {
      const response = await get(`${api}${path}`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'Content-Type' }
      });
      assert.equal(response.status, expected, `${path} の CORS 設定を確認してください: ${origin}`);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), expected === 204 ? site : null);
      if (expected === 204) {
        assert.ok((response.headers.get('Access-Control-Allow-Methods') || '').split(',').map(value => value.trim()).includes(method));
        assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /\bcontent-type\b/i);
      }
    }
  }
}
console.log(`Pages の配信・検索抑制・非配信ファイルの確認 OK（JS ${scripts.length}件）${api ? '、API の疎通・CORS 確認 OK' : ''}`);

function parseOrigin(input) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('パスや認証情報を含まないオリジンを指定してください');
  }
  return url.origin;
}
