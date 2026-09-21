# GitHub Pages から Cloudflare への移行調査

調査日: 2026-09-21

## 結論

KOTRI の公開ページは Cloudflare へ移行でき、GitHub リポジトリは Private のまま運用できる。Cloudflare Pages の Git 連携は GitHub の Public / Private リポジトリを正式にサポートしている。

KOTRI では次の2案が現実的である。

1. **Cloudflare Pages + 既存の同期 Worker**（推奨）
   - Pages が `index.html` と `js/` を配信する。
   - 既存の `kotori-sync` Worker + D1 が `/sync` API を担当する。
   - GitHub の `main` への push で自動デプロイできる。
2. **既存 Worker に Static Assets を追加して一体化**
   - ページと `/sync` を同じ `workers.dev` オリジンで配信できる。
   - デプロイ先が1つになり CORS も単純になるが、現在の Worker 設定と公開用ディレクトリを変更する実装作業が必要になる。

どちらも静的アセットへのリクエストは無料かつ無制限で、独自ドメインは不要である。

出典: [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)、[Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)

## 推奨: Cloudflare Pages の Git 連携

Cloudflare Dashboard で次のように作成する。

1. `Workers & Pages` を開く。
2. `Create application` → `Pages` → `Connect to Git` を選ぶ。
3. GitHub の `Cloudflare Workers & Pages` App を認可する。
4. Repository access は `Only select repositories` を選び、KOTRI のリポジトリだけを許可する。
5. KOTRI の Private リポジトリと本番ブランチ（通常は `main`）を選ぶ。
6. フレームワークは静的サイト相当（`None`）にする。
7. 公開用ファイルだけを生成するビルドコマンドと、その出力ディレクトリを設定する。

Private リポジトリの内容が GitHub 上で一般公開されることはない。ただし、ビルドのため Cloudflare GitHub App には選択したリポジトリの読み取り権限を与える。Cloudflare はアプリの対象を必要なリポジトリだけに限定することを推奨している。

出典: [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)、[GitHub integration / Manage access](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)

## 公開対象を限定する

リポジトリのルート `.` をそのまま Pages の出力ディレクトリにしてはいけない。KOTRI のルートには `server/`、`scripts/`、`README.md`、`AGENTS.md` などがあるため、それらも静的ファイルとして公開される可能性がある。

Pages へ渡す専用ディレクトリ（例: `dist-pages/`）をビルド時に作り、次だけをコピーする。

```text
dist-pages/
├── index.html
└── js/
```

実装時には、リポジトリに `scripts/prepare-pages.mjs` のようなコピー用スクリプトを追加し、Pages を次のように設定するのが安全である。

```text
Build command:          node scripts/prepare-pages.mjs
Build output directory: dist-pages
```

現在の KOTRI はフロントエンドのビルド工程を持たないため、この処理は変換ではなく公開ファイルの選別だけを行う。

## 無料枠

- 静的アセットへのリクエスト: 無料・無制限
- Free プランの Git ビルド: 月500回
- 同時ビルド: 1回
- 1サイトのファイル数: 20,000
- 1ファイル: 最大25 MiB
- Pages プロジェクト: 1アカウント100個
- `https://<project>.pages.dev` を利用でき、独自ドメインは不要

KOTRI の規模と更新頻度では無料枠で十分である。

出典: [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)、[Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)

## Git連携を使わない方法

Cloudflare に GitHub リポジトリへのアクセスを与えたくない場合、Pages の Direct Upload を利用できる。ローカルで公開用ディレクトリを作り、Wrangler からアップロードする。

```powershell
npx wrangler pages project create
npx wrangler pages deploy dist-pages
```

この方法でもリポジトリは Private のままだが、更新のたびに手動デプロイが必要になる。Direct Upload と Git 連携は同じ Pages プロジェクト内で後から自由に切り替えられないため、最初に運用方法を決める。

出典: [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## KOTRI 側で必要な変更

Pages と同期 Worker を分ける場合:

- `js/constants.js` の `SYNC_API_BASE` に同期 Worker の `workers.dev` URLを設定する。
- `server/wrangler.toml` の `ALLOWED_ORIGINS` を、新しい Pages URL（例: `https://kotori.pages.dev`）へ変更する。
- プレビューURLからも同期テストするなら、そのオリジンを追加する。ただし無制限なワイルドカードにはしない。

ページと API を同じ Worker に一体化する場合:

- Worker Static Assets 用の専用出力ディレクトリを作る。
- `server/wrangler.toml` に assets directory を設定する。
- 本番の `SYNC_API_BASE` を `location.origin` 相当にする。
- 静的ファイルを優先配信し、`/sync` と `/health` のみ Worker コードへ流す構成を確認する。

Workers Static Assets も静的リクエストは無料・無制限である。出典: [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## 最重要: 保存済みデッキの移行

ブラウザーの `localStorage` はオリジン（スキーム・ホスト・ポート）ごとに分離される。`https://lovecalife.github.io` から `https://kotori.pages.dev` へ移ると、新しいページから旧ページの保存デッキを読むことはできない。

安全な移行順は次のとおり。

1. 旧 GitHub Pages をまだ公開した状態で、利用者全員が「全件バックアップ」をダウンロードする。
2. Cloudflare Pages と同期 Worker を公開する。
3. 新しい Pages URL でバックアップを取り込む、または旧ページで同期済みなら同じシンクキーを入力して取得する。
4. デッキ、名前、お気に入り、削除状態が揃っていることを確認する。
5. 確認後に GitHub Pages を停止し、GitHub リポジトリを Private に変更する。

この確認前にリポジトリを Private にして旧 GitHub Pages を止めると、旧オリジンの `localStorage` へアクセスする手段を失う可能性がある。

## URLと公開範囲

- GitHub リポジトリを Private にしても、Cloudflare Pages のWebページ自体は公開される。
- `pages.dev` のURLは通常、誰でもアクセスできる。
- シンクキーはページの公開・非公開とは別の認証情報として扱う。
- URL変更に伴い、ブックマークや共有リンクも新URLへ差し替える。

## 推奨判断

まずは **Cloudflare PagesのGit連携 + 既存Worker/D1** で移行する。構成が明確で、自動デプロイとプレビューが使え、変更量も少ない。公開対象を `index.html` と `js/` だけに限定し、保存デッキのバックアップ移行を済ませた後にGitHubリポジトリをPrivateへ変更する。

ページとAPIを同じURLにまとめたくなった場合は、その後にWorkers Static Assetsへの統合を検討する。
