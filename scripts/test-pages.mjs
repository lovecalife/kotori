import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import worker from '../server/src/index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'kotori-pages-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'js'));
  await cp(new URL('./prepare-pages.mjs', import.meta.url), join(root, 'scripts/prepare-pages.mjs'));
  await cp(new URL('../pages/', import.meta.url), join(root, 'pages'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<html><head></head><body><script src="https://example.invalid/lib.js"></script><script src="js/app.js"></script></body></html>');
  await writeFile(join(root, 'js/app.js'), 'console.log("fixture");');
  return { root, build: () => execFileSync(process.execPath, [join(root, 'scripts/prepare-pages.mjs')], { stdio: 'pipe' }) };
}

async function linkOrSkip(t, target, path) {
  try {
    await symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (error) {
    if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
    t.skip('この実行環境ではディレクトリリンクの作成が許可されていません');
    return false;
  }
}

test('必要な JS だけを配信し、秘密・設定・過去の生成物を混入させない', async t => {
  const { root, build } = await fixture(t);
  await writeFile(join(root, '.env'), 'PRIVATE_FIXTURE=not-a-real-secret');
  await writeFile(join(root, 'js/private.txt'), 'private fixture');
  await writeFile(join(root, 'js/unused.js'), 'not referenced');
  await mkdir(join(root, 'server'));
  await writeFile(join(root, 'server/wrangler.toml'), 'private fixture');
  const original = await readFile(join(root, 'index.html'), 'utf8');
  build();
  await writeFile(join(root, 'dist-pages/stale.txt'), 'stale fixture');
  build();
  assert.deepEqual((await readdir(join(root, 'dist-pages'))).sort(), ['404.html', '_headers', 'index.html', 'js', 'robots.txt']);
  assert.deepEqual(await readdir(join(root, 'dist-pages/js')), ['app.js']);
  assert.equal(await readFile(join(root, 'index.html'), 'utf8'), original);
  assert.match(await readFile(join(root, 'dist-pages/index.html'), 'utf8'), /name="robots" content="noindex/);
});

test('JS が欠けたら生成失敗し、直前の配信物を壊さない', async t => {
  const { root, build } = await fixture(t);
  build();
  const previous = await readFile(join(root, 'dist-pages/index.html'), 'utf8');
  await rm(join(root, 'js/app.js'));
  assert.throws(build);
  assert.equal(await readFile(join(root, 'dist-pages/index.html'), 'utf8'), previous);
});

test('親ディレクトリへの参照を配信対象にできない', async t => {
  const { root, build } = await fixture(t);
  await writeFile(join(root, 'index.html'), '<head></head><script src="js/../scripts/prepare-pages.mjs"></script>');
  assert.throws(build);
});

test('生成先がリンクの場合、リンク先を削除・上書きしない', async t => {
  const { root, build } = await fixture(t);
  const target = join(root, 'keep');
  await mkdir(target);
  await writeFile(join(target, 'keep.txt'), 'keep');
  if (!await linkOrSkip(t, target, join(root, 'dist-pages'))) return;
  assert.throws(build);
  assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'keep');
});

test('JS の親が別ディレクトリへのリンクなら配信しない', async t => {
  const { root, build } = await fixture(t);
  await mkdir(join(root, 'private'));
  await writeFile(join(root, 'private/secret.js'), 'private fixture');
  if (!await linkOrSkip(t, join(root, 'private'), join(root, 'js/linked'))) return;
  await writeFile(join(root, 'index.html'), '<head></head><script src="js/linked/secret.js"></script>');
  assert.throws(build);
});

test('移行期間の新旧オリジンを個別に許可し、第三者と旧URL除去後を拒否する', async () => {
  const oldOrigin = 'https://lovecalife.github.io';
  const nextOrigin = 'https://migration-fixture.pages.dev';
  for (const allowed of [`${oldOrigin},${nextOrigin}`, nextOrigin]) {
    for (const origin of [oldOrigin, nextOrigin, 'https://untrusted.invalid']) {
      for (const path of ['/sync', '/decklog/19ATNY']) {
        const response = await worker.fetch(new Request(`https://api.invalid${path}`, {
          method: 'OPTIONS', headers: { Origin: origin }
        }), { ALLOWED_ORIGINS: allowed });
        const expected = allowed.split(',').includes(origin);
        assert.equal(response.status, expected ? 204 : 403);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), expected ? origin : null);
      }
    }
  }
});
