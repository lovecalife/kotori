# KOTRI

ラブライブ！シリーズのカードゲーム向けカード検索・デッキ作成ツールです。

## ローカルで起動

Node.js を用意し、リポジトリのルートで次を実行します。フロントエンドに npm インストールやビルドは不要です。

```powershell
node scripts/serve.mjs
```

`http://localhost:3333/` を開きます。ポートを変える場合は `PORT` 環境変数を設定します。このサーバーは `index.html` と `js/` のファイルを配信し、DeckLogの取得も中継します。

ページ表示には React、Babel、Tailwind CSS、PapaParse、QR コードライブラリの CDN への接続が必要です。カードデータは公開 Google スプレッドシートの CSV から取得し、カード画像は Google の画像 URL を使います。ネットワークがない場合、画面やカード一覧は正常に表示できません。

## 構成

| 場所 | 役割 |
| --- | --- |
| `index.html` | CDN ライブラリと JS ファイルの読み込み順、画面の起点 |
| `js/constants.js` | スプレッドシート ID・シート GID・列名対応・同期 API URL |
| `js/utils.js` | CSV 取得、カードデータ正規化、画像 URL |
| `js/app.js` | React の状態、検索・フィルター、デッキ操作、同期の呼び出し |
| `js/components/` | カード表示、フィルター、デッキ管理、比較・計算ツール、同期 UI |
| `js/deckStore.js` | 保存デッキのスキーマ移行、`localStorage`、バックアップ入出力 |
| `js/sync.js` | シンクキー生成・ハッシュ化、同期 API との通信 |
| `js/decklog.js`、`js/components/DecklogImport.js` | DeckLogのID・共有URL入力、カード照合、置き換えプレビュー |
| `server/src/decklog.mjs` | Node / Workers共通のDeckLog取得アダプター |
| `server/` | 任意の端末間同期 API。Cloudflare Workers + D1 |
| `scripts/serve.mjs` | 依存パッケージなしのローカル静的サーバー |

ブラウザー側は ES module / bundler を使わず、`index.html` の順序でグローバルスクリプトを読み込みます。JSX ファイルはブラウザー内の Babel で変換されます。ファイルを追加するときは読み込み順とグローバル名の衝突に注意してください。

## Cloudflare Pages での配信

Cloudflare Pages 側の並行公開が完了しています。旧 GitHub Pages はバックアップ・データ引き継ぎのため公開を継続し、リポジトリの Private 化も保留しています。新サイトはログインなしの URL 共有と検索への掲載抑制を前提とし、URL 自体にアクセス制限はかかりません。公開先は Cloudflare Dashboard の Pages プロジェクトで確認できます。

```powershell
node scripts/prepare-pages.mjs
node --test scripts/test-pages.mjs scripts/test-decklog.mjs
```

`dist-pages/` には画面と配信設定だけを生成します。このコマンド自体は元の画面・保存データ・本番 API 設定を変更せず、デプロイも行いません。Pages は `main` への push で自動更新され、本番以外の自動プレビューと PR へのビルドコメントは無効です。同期 Worker は別途デプロイします。実施記録、無料枠、バックアップと今後の切り替えは [移行手順](docs/cloudflare-pages-migration.md) を参照してください。

## データと同期

カード原本は `js/constants.js` の `SPREADSHEET_ID` と `GID_MEMBER` / `GID_LIVE` が指す公開シートです。両シートとも1行目はメモ、2行目は列名、3行目以降はカードデータです。CSV の列名対応は同ファイルの `COLUMN_MAP` にあります。保存中のデッキ、編集中のデッキ、検討中のカード、フィルター設定はブラウザーごとの `localStorage` に入ります。リポジトリには利用者のデッキデータは含まれません。

保存デッキは `deckId`、`updatedAt`、`deleted` と、メンバー・ライブ別の検討中カード番号を収めた `favorites` を持ちます。検討中のカードは保存デッキの読み込み時に一緒に切り替わり、編集中はデッキとともに自動保存されます。星を押すかデッキから最後の1枚を外すと検討中に登録されます。デッキに1枚でもあるカードでは星を表示せず、検討中の一覧にも表示しません。旧検討リストも編集中デッキへ移行します。デッキタブの「検討中のカードを表示」で一覧を切り替えられます。削除は同期のため墓標として記録し、新しい更新を採用する方式でバックアップや同期データをマージします。バックアップの形式は `js/deckStore.js` を参照してください。

同期を使わない場合、デッキはローカルに保存されます。本番の同期 API は Cloudflare Workers + D1 で公開し、`js/constants.js` の `SYNC_API_BASE` に URL を設定しています。公開ページでは同期 UI が表示されます。ローカルでは `http://127.0.0.1:8787` が設定されていますが、API を別途起動する必要があります。シンクキーを失うと同じ同期領域へ戻れないため、利用者側で保管します。

## 開発時の確認

デッキタブの「デッキデータの保存 / 読み込み / 出力」を開き、「デッキログから読み込み」にID（例：`19ATNY`）か共有URLを入力します。「内容を取得」でデッキ名・枚数を確認し、「この内容でデッキを置き換える」で編集中のメンバー・ライブ全体を置き換えます。エネルギーは対象外です。取得失敗や未知カードがある場合は変更しません。保存済みデッキは変更せず、取り込み後に新規保存できます。

ローカルでは上記の画面用サーバーだけで取得できます。公開ページは既存Workersの更新デプロイも必要です。取得方式と制約は [DeckLog調査メモ](docs/decklog.md) を参照してください。

```powershell
node --check scripts/serve.mjs
node --check js/deckStore.js
node --check js/sync.js
node --check server/src/index.js
node --check server/src/decklog.mjs
node --check js/decklog.js
node --test scripts/test-decklog.mjs
```

画面を変更したらローカルサーバーでブラウザー確認します。DeckLogの自動テストは外部通信なしで実行できます。フロントエンドのビルド手順はありません。サーバー側の依存関係とローカル実行手順は [server/README.md](server/README.md) を参照してください。
