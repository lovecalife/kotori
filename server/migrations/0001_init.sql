-- 保存デッキ本体。
-- payload はサーバ側で一切パースしない。KOTRI 側のデッキ形式が変わっても
-- サーバを改修せずに済ませるための意図的な設計。
CREATE TABLE decks (
  key_hash    TEXT    NOT NULL,   -- シンクキーの SHA-256（hex 64文字）
  deck_id     TEXT    NOT NULL,   -- クライアント生成のデッキID（UUID）
  payload     TEXT    NOT NULL,   -- デッキ本体の JSON 文字列
  updated_at  INTEGER NOT NULL,   -- クライアントの更新時刻（ミリ秒）。競合解決（LWW）に使う
  -- サーバがこの行を書いた時刻。差分取得のカーソルにはこちらを使う。
  -- updated_at で絞ると「端末Bがオフライン中に作った（=古い updated_at の）デッキを
  -- あとからサーバへ上げた」場合に、既に同期済みの端末Aが二度と取得できなくなる。
  -- 端末の時計に依存しない単調な基準が別途必要になる
  server_updated_at INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, deck_id)
);

-- 差分取得（key_hash が一致し server_updated_at >= since）用
CREATE INDEX idx_decks_sync ON decks (key_hash, server_updated_at);

-- シンクキーの台帳。登録APIは設けず、初回の /sync で自動的に行が作られる。
-- window_start / window_count はレート制限のカウンタ。専用テーブルや KV を
-- 増やさずに済ませるため、この行に同居させている。
CREATE TABLE sync_keys (
  key_hash     TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  deck_count   INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0,
  window_count INTEGER NOT NULL DEFAULT 0
);
