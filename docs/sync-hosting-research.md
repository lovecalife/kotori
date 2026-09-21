# デッキ同期バックエンドのホスティング調査

調査日: 2026-09-21

## 結論

身内の数人で使うなら、既に実装されている **Cloudflare Workers + D1 を無料プランで運用する**のが最も素直です。月額は通常 **$0** で、独自ドメインも不要です。Cloudflare アカウントを作り、D1 を作成して Worker をデプロイすれば、`*.workers.dev` の URL をそのまま利用できます。

このリポジトリには、同期クライアント、Worker、D1 スキーマ、CORS、データ量・回数制限、デプロイ手順まで既にあります。Supabase や Firebase に変えるとバックエンドを書き直すことになるため、料金上も実装工数上も利点がありません。

## 現在の実装との適合

- [クライアント](../js/sync.js) は 160 bit のランダムなシンクキーを生成し、正規化したキーの SHA-256 だけを `/sync` に送ります。
- [Worker](../server/src/index.js) は D1 にデッキを保存し、更新時刻による LWW（last write wins）で差分同期します。ログインやユーザー登録 API はありません。
- [D1 スキーマ](../server/migrations/0001_init.sql) は `key_hash` と同期時刻にインデックスがあり、今回の小規模用途に合っています。
- 1キーあたり有効なデッキは200件、1デッキは64 KiB、1リクエストは256 KiB、1キーあたり毎分60リクエストにアプリ側で制限されています。
- [server/README.md](../server/README.md) に D1 作成、マイグレーション、デプロイ、疎通確認の手順があります。本番用 URL を [js/constants.js](../js/constants.js) の `SYNC_API_BASE` に設定すれば同期 UI が有効になります。

## Cloudflare の料金と無料枠

2026-09-21 時点の公式料金です。

| 項目 | 無料プラン | 有料プラン |
| --- | ---: | ---: |
| Workers リクエスト | 100,000回/日 | 月1,000万回込み、超過は100万回あたり $0.30 |
| Workers CPU | 1回10 msまで | 月3,000万 CPU-ms込み、超過は100万 CPU-msあたり $0.02 |
| D1 読み取り | 500万行/日 | 月250億行込み、超過は100万行あたり $0.001 |
| D1 書き込み | 10万行/日 | 月5,000万行込み、超過は100万行あたり $1.00 |
| D1 ストレージ | アカウント合計5 GB | 5 GB込み、超過は $0.75/GB・月 |
| D1 転送量 | 課金なし | 課金なし |
| 有料プランの最低料金 | $0 | Workers Paid はアカウントあたり最低 $5/月 |

出典: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

D1 無料プランには、料金表とは別に **1データベース500 MB、1アカウント10 DB** の構成上限があります。したがって、リポジトリの手順どおり本番用とプレビュー用の2 DBを作っても無料枠内です。無料版でも7日分の Time Travel（分単位のポイントインタイム復元）が常時有効です。出典: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

無料枠を超えたときに自動で従量課金されるのではなく、Workers は上限エラー、D1 はその日のクエリがエラーになります。D1 の日次枠は 00:00 UTC に回復します。D1 は 2026-09-01 から無料枠の上限を実際に強制するようになったため、障害時は「請求」ではなく「同期が翌日まで止まる」点に注意が必要です。出典: [D1 free-tier limit enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)

Worker は自動付与される `*.workers.dev` で公開でき、独自ドメインの購入・維持費は不要です。Cloudflare はこの URL を個人・ホビー用途向けと位置づけています。出典: [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## 身内利用の概算

例として10人が1日100回ずつ同期しても、Worker は **1,000リクエスト/日**で無料枠の1%です。

D1 は、同期1回ごとにレート制限行と対象キーのデッキを読み、カウンター等を書きます。実際の課金行数は変更件数とインデックス更新で変わりますが、仮に1同期あたり500行を読むというかなり保守的な見積もりでも、1,000同期で50万行/日、無料の500万行/日の10%です。書き込みも、変更のない同期で行う数件の更新と実デッキ変更分なので、身内利用では10万行/日に大きな余裕があります。

容量の理論上限は、1キーにつき有効デッキ200件 × 64 KiB = **12.5 MiB**（DB・インデックスのオーバーヘッドは別）です。通常のデッキ JSON は64 KiBよりかなり小さいため、単一DBの500 MB上限にも十分な余裕があります。

ただし、削除済みデッキは同期用の墓標として残り、有効デッキ200件の制限には数えられません。長期運用で作成・削除を大量に繰り返す場合は、古い墓標や使われなくなったシンクキーの定期削除方針を追加するのが安全です。

## 必要なものと導入時の作業

必要な外部サービスは Cloudflare だけです。フロントエンドは今の GitHub Pages のままで構いません。

1. Cloudflare アカウントを作り、Wrangler でログインする。
2. `kotori-sync` と `kotori-sync-preview` の D1 を作る。
3. 発行された database ID を `server/wrangler.toml` に設定する。
4. D1 マイグレーションを適用し、Worker をデプロイする。
5. `https://kotori-sync.<subdomain>.workers.dev` を `SYNC_API_BASE` に設定し、フロントエンドを再公開する。
6. `/health` と、異なるブラウザー間での作成・更新・削除・競合を確認する。

具体的なコマンドは [server/README.md](../server/README.md) にまとまっています。

## セキュリティ上の注意

この方式では、シンクキーはパスワードと同じ「持っている人が全操作できる」秘密情報です。

- キーを知る人は、その同期領域のデッキを読み、更新し、削除できます。ユーザー別の権限、操作履歴、読み取り専用共有はありません。
- サーバーに平文キーを送らず SHA-256 にする設計は、DBに元のキーを残さない点では良いものです。ただし API は `keyHash` 自体を認証情報として受け付けるため、**漏れたハッシュはそのまま再利用可能**です。HTTPS、ログ非出力、ブラウザー拡張やクリップボード・QRコードからの漏えい防止が重要です。
- payload はサーバーで解釈しませんが、暗号化もしていません。Cloudflare アカウントの管理者やDBを取得した人はデッキ内容を読めます。機密情報や個人情報には使わない前提が妥当です。
- シンクキーを失うと復旧できません。最低1台にローカルデータを残し、既存のバックアップ書き出しも併用します。
- キーが漏れた場合は新しいキーへ切り替えられますが、古い同期領域を無効化・一括削除する API は現状ありません。漏えい対応を重視するなら、管理者用のキー失効・領域削除機能を将来追加します。
- CORS は許可したWebページ以外のブラウザー JavaScriptを抑止するだけで、認証ではありません。現実装は `Origin` のない curl 等を許可しています。また、レート制限はキー単位なので、大量のランダムな `keyHash` を投げる意図的な枠枯渇には十分ではありません。身内利用ではまず Cloudflare の使用量・エラー通知を監視し、公開後に不審な利用があればIP/アカウント全体のレート制限を追加するのが現実的です。
- 競合解決は LWW なので、ほぼ同時に同じデッキを編集すると後の更新が勝ちます。共同リアルタイム編集ではなく「複数端末の保存内容を揃える」用途に適しています。

## 代替案

| サービス | 無料枠の要点 | 今回の評価 |
| --- | --- | --- |
| Cloudflare Workers + D1 | 上記のとおり。休眠停止なし。`workers.dev` 利用可 | **推奨**。実装済みで、無料枠にも十分余裕あり |
| Supabase | $0、DB 500 MB、egress 5 GB、Edge Functions 月50万回。無料プロジェクトは1週間非アクティブで停止し、同時に2プロジェクトまで。Pro は $25/月から | Postgres/Edge Functions向けに書き直しが必要。たまにしか使わない身内用途では休眠停止も不便。出典: [Supabase pricing](https://supabase.com/pricing)、[Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase) |
| Firebase Firestore | 無料で保存1 GiB、読取5万/日、書込2万/日、削除2万/日、送信10 GiB/月 | DBだけなら無料だが、現在のようなHTTP APIを Cloud Functions で置くには従量課金の Blaze プランが必要。請求先登録と全面的な書き直しが増える。出典: [Firestore pricing](https://firebase.google.com/docs/firestore/pricing)、[Cloud Functions get started](https://firebase.google.com/docs/functions/get-started) |

## 推奨判断

まず Cloudflare 無料プランで本番・プレビューをデプロイし、月額 **$0** で開始するのがよいです。身内数人の通常利用で無料枠を超える可能性は非常に低く、有料化を先に行う必要はありません。運用開始後は Cloudflare の D1 Row Metrics と Worker リクエスト数を月に一度確認し、無料枠の半分に近づいた時点でクエリ最適化や $5/月の Paid プランを検討すれば十分です。
