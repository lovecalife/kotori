# KOTRI

ラブライブ！シリーズのカードゲーム向けカード検索・デッキ作成ツールです。

## ローカルで起動

Node.js を用意し、リポジトリのルートで次を実行します。フロントエンドに npm インストールやビルドは不要です。

```powershell
node scripts/serve.mjs
```

`http://localhost:3333/` を開きます。ポートを変える場合は `PORT` 環境変数を設定します。このサーバーは `index.html` と `js/` のファイルだけを配信します。

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
| `server/` | 任意の端末間同期 API。Cloudflare Workers + D1 |
| `scripts/serve.mjs` | 依存パッケージなしのローカル静的サーバー |

ブラウザー側は ES module / bundler を使わず、`index.html` の順序でグローバルスクリプトを読み込みます。JSX ファイルはブラウザー内の Babel で変換されます。ファイルを追加するときは読み込み順とグローバル名の衝突に注意してください。

## データと同期

カード原本は `js/constants.js` の `SPREADSHEET_ID` と `GID_MEMBER` / `GID_LIVE` が指す公開シートです。CSV の列名対応は同ファイルの `COLUMN_MAP` にあります。保存中のデッキ、編集中のデッキ、お気に入り、フィルター設定はブラウザーごとの `localStorage` に入ります。リポジトリには利用者のデッキデータは含まれません。

保存デッキは `deckId`、`updatedAt`、`deleted` と、メンバー・ライブ別のカード番号を収めた `favorites` を持ちます。お気に入りは保存デッキの読み込み時に一緒に切り替わり、編集中はデッキとともに自動保存されます。星を押すかデッキから最後の1枚を外すとお気に入りに登録され、デッキに1枚でもあるカードは一覧に表示しません。旧検討リストは編集中デッキのお気に入りへ移行します。デッキタブの「お気に入りカードを表示」で一覧を切り替えられます。削除は同期のため墓標として記録し、新しい更新を採用する方式でバックアップや同期データをマージします。バックアップの形式は `js/deckStore.js` を参照してください。

同期を使わない場合、デッキはローカルに保存されます。同期を使う場合は [server/README.md](server/README.md) に従って Workers と D1 を設定し、`js/constants.js` の `SYNC_API_BASE` に API の URL を設定します。現状、本番用 URL は空で、公開ページの同期 UI は表示されません。ローカルでは `http://127.0.0.1:8787` が設定されていますが、API を別途起動する必要があります。シンクキーを失うと同じ同期領域へ戻れないため、利用者側で保管します。

## 開発時の確認

```powershell
node --check scripts/serve.mjs
node --check js/deckStore.js
node --check js/sync.js
node --check server/src/index.js
```

画面を変更したらローカルサーバーでブラウザー確認します。フロントエンドに自動テストやビルド手順はまだありません。サーバー側の依存関係とローカル実行手順は [server/README.md](server/README.md) を参照してください。
