# kotori-sync

KOTRI のデッキ同期 API（Cloudflare Workers + D1）。

シンクキーの SHA-256（`keyHash`）だけで識別する。平文のキーはサーバに届かない。
`payload` はパースせず不透明な文字列として保存するため、KOTRI 側のデッキ形式が
変わってもこのサーバは改修不要。

## エンドポイント

### `GET /health`

`{"ok": true}` を返すだけ。オリジン制限なし。

### `POST /sync`

```jsonc
// リクエスト
{
  "keyHash": "…64文字のhex…",
  "since": 1735689600000,          // 最後に同期した serverTime。初回は 0
  "changes": [                     // 前回同期以降のローカル変更のみ。無ければ []
    { "deckId": "…", "payload": "…", "updatedAt": 1735689600000, "deleted": false }
  ]
}

// レスポンス
{
  "serverTime": 1735689700000,     // 次回の since に使う
  "changes": [ /* server_updated_at >= since のレコード */ ]
}
```

`changes` は既存レコードより `updatedAt` が新しい場合のみ反映される（LWW）。
古い更新は黙って無視され、エラーにはならない。

差分取得のカーソルは、クライアント時刻の `updated_at` ではなくサーバが書いた時刻
（`server_updated_at`）を使う。`updated_at` で絞ると、端末Bがオフライン中に作った
（＝古い `updated_at` を持つ）デッキをあとからサーバへ上げたとき、既に同期済みの
端末Aが二度と取得できなくなるため。`updated_at` は競合解決だけに使う。

### エラー

| status | error | 条件 |
|---|---|---|
| 400 | `invalid_key_hash` | `keyHash` が 64文字の小文字 hex でない |
| 400 | `invalid_json` / `invalid_since` / `invalid_updated_at` ほか | 形式不正 |
| 403 | `origin_not_allowed` | `ALLOWED_ORIGINS` にないオリジンからの呼び出し |
| 409 | `deck_limit_exceeded` | 1キーあたり 200 デッキを超える |
| 413 | `payload_too_large` | デッキ1件が 64KB 超 |
| 413 | `body_too_large` | リクエスト全体が 256KB 超 |
| 413 | `too_many_changes` | `changes` が 201 件以上 |
| 429 | `rate_limited` | 同一 `keyHash` で 60リクエスト/分 を超過（`Retry-After` 付き） |

---

## デプロイ手順（人手が必要）

### 1. Cloudflare アカウントと wrangler のログイン

```bash
npx wrangler login
```

無料プランで足りる。独自ドメインは不要で、`kotori-sync.<subdomain>.workers.dev` が払い出される。

### 2. D1 データベースを本番・プレビューの2つ作る

```bash
npx wrangler d1 create kotori-sync
```

```bash
npx wrangler d1 create kotori-sync-preview
```

それぞれの出力に `database_id` が表示されるので、`wrangler.toml` の
`REPLACE_WITH_PRODUCTION_DATABASE_ID` / `REPLACE_WITH_PREVIEW_DATABASE_ID`
を置き換える。

### 3. マイグレーションを適用

```bash
npx wrangler d1 migrations apply kotori-sync-preview --remote
```

```bash
npx wrangler d1 migrations apply kotori-sync --remote
```

スキーマ変更は必ず `migrations/` にファイルを足して行う。手動 SQL は使わない。

### 4. デプロイ

```bash
npx wrangler deploy
```

払い出された URL（`https://kotori-sync.<subdomain>.workers.dev`）を控えて、
KOTRI 側の `js/constants.js` の `SYNC_API_BASE` に設定する。

### 5. 疎通確認

```bash
curl https://kotori-sync.<subdomain>.workers.dev/health
```

---

## ローカル開発

```bash
npx wrangler d1 migrations apply kotori-sync --local
```

```bash
npx wrangler dev --local --port 8787
```

ローカルの D1 は `.wrangler/state/` に置かれる sqlite ファイルで、
Cloudflare アカウントは不要。

## 設定

`ALLOWED_ORIGINS`（`wrangler.toml` の `[vars]`）に CORS 許可オリジンを
カンマ区切りで書く。ワイルドカードは使わない。
KOTRI は GitHub Pages の `https://lovecalife.github.io/kotori/` で公開されて
いるので、オリジンは `https://lovecalife.github.io`（パスは含めない）。
