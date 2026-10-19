// ローカルの配信ファイル生成のみ。Cloudflare / GitHub への通信・デプロイは行わない。
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist-pages');

// ディレクトリ全体をコピーしない。画面が参照する JS と固定の配信設定だけを選ぶ。
const html = (await readSource('index.html')).toString('utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
  .map(match => match[1]).filter(src => !src.startsWith('https://'));
if (scripts.length === 0) throw new Error('index.html にローカル JS がありません');
const files = new Map();
for (const src of new Set(scripts)) {
  if (!/^js\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(src)) {
    throw new Error(`配信対象にできないスクリプト: ${src}`);
  }
  files.set(src, await readSource(src));
}
for (const name of ['_headers', 'robots.txt', '404.html']) {
  files.set(name, await readSource(`pages/${name}`));
}
if (!/<head\b[^>]*>/i.test(html) || /<meta\b[^>]*\bname=["']robots["']/i.test(html)) {
  throw new Error('index.html の head / robots 設定を確認してください');
}
// 元の index.html は変えず、Cloudflare 用の HTML にだけ追加する。
files.set('index.html', html.replace(/<head\b[^>]*>/i, '$&\n    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">'));

// 再生成時は古い配信ファイルも除去する。削除先は固定の生成ディレクトリに限定する。
const realRoot = await realpath(root);
if (output !== resolve(root, 'dist-pages') || !output.startsWith(root + sep)) {
  throw new Error('生成先がリポジトリの外です');
}
try {
  const stat = await lstat(output);
  if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(output) !== resolve(realRoot, 'dist-pages')) {
    throw new Error('dist-pages は通常の生成ディレクトリである必要があります');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(output, { recursive: true, force: true });
for (const [name, body] of files) {
  const path = resolve(output, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}
console.log(`Cloudflare Pages 用に ${files.size} ファイルを dist-pages/ に生成しました（デプロイなし）。`);

async function readSource(relative) {
  const path = resolve(root, relative);
  // 親ディレクトリのリンクも検証し、外部のファイルを配信物へ混入させない。
  const resolved = await realpath(path);
  if (resolved !== path || !(await lstat(path)).isFile()) {
    throw new Error(`通常ファイル以外は配信できません: ${relative}`);
  }
  return readFile(path);
}
