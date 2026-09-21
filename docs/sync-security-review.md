# KOTRI 同期サーバー セキュリティレビュー

調査日: 2026-09-22
対象: `kotori-sync.<account-subdomain>.workers.dev`、Cloudflare D1、現在の KOTRI フロントエンド

## 結論

**身内数人で、公開されても致命的でないデッキ情報を同期する用途なら、現在の Cloudflare Workers + D1 構成は概ね妥当です。** Cloudflare の基盤は全プランで自動 DDoS 防御の対象となり、D1 は保存時・通信時に暗号化されます。一方で、`workers.dev` は公開 URL であり、**KOTRI アプリだけが接続できる専用回線ではありません**。

守りの中心は、Cloudflare そのものより次の4点です。

1. シンクキーをパスワード同様に秘密として扱う
2. Cloudflare アカウントを 2FA で守る
3. アプリ層の乱用で無料枠を枯渇させられないようにする
4. クライアントと D1 の両方について復旧手段を持つ

銀行情報、住所、本人確認情報、業務秘密などを置く用途には、現状のままでは勧めません。デッキ内容は D1 内でアプリレベル暗号化されておらず、シンクキーを知る人は同じ同期領域を読み書き・削除できるためです。

## 「KOTRI を使う人しか使えない」のか

いいえ。Cloudflare 公式ドキュメントにも、`workers.dev` を有効にした URL は公開されると明記されています。URLを知った第三者も `/health` や `/sync` へ HTTP リクエストを送れます。

- 公式: [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- 現在の Worker は `/health` を無条件で公開し、`/sync` は `POST` を受け付ける: [`server/src/index.js`](../server/src/index.js#L252)

ただし、「URLへ到達できること」と「既存デッキを読めること」は別です。既存デッキへ到達するには、その領域の `keyHash` が必要です。サーバーには同期領域を一覧取得する API もありません。

### CORS は認証ではない

現在の実装は、ブラウザーから許可外オリジンで送られたリクエストを 403 にします。これは、悪意ある別サイトをブラウザーで開いただけで KOTRI API を操作されるリスクを下げる有効な防御です。

しかし、CORS はブラウザーの制約であり、接続元アプリの身元証明ではありません。現在の実装も、`Origin` がない `curl` 等のリクエストを意図的に許可しています。またブラウザー外のクライアントは `Origin` ヘッダー自体を偽装できます。

- 許可元判定: [`server/src/index.js:253-256`](../server/src/index.js#L253)
- `Origin` なしを許可する処理とコメント: [`server/src/index.js:274-281`](../server/src/index.js#L274)
- 本番の許可元: [`server/wrangler.toml:9`](../server/wrangler.toml#L9)

したがって、**CORS は補助防御であり、シンクキーの代わりにはなりません**。Cloudflare Pages へ移行したら、`ALLOWED_ORIGINS` を実際の `https://....pages.dev` に更新しないと、正規の KOTRI からも同期できません。

## シンクキーの安全性

### 推測には十分強い

シンクキーはブラウザーの暗号学的乱数 `crypto.getRandomValues` で20バイト（160 bit）生成されます。この強度なら、正常に生成されたキーを総当たりで当てることは現実的ではありません。

- 生成: [`js/sync.js:17-50`](../js/sync.js#L17)
- SHA-256 化: [`js/sync.js:72-75`](../js/sync.js#L72)

### `keyHash` 自体が bearer credential

平文キーを SHA-256 にしてサーバーへ送る設計は、D1 に平文キーを保存しない点では有益です。ただしサーバーは `keyHash` を提示した相手をそのまま正当な利用者として扱います。そのため、**API 通信や D1 から `keyHash` が漏れた場合、ハッシュを元のキーへ戻さなくても、その値を再送するだけでアクセスできます**。

- クライアントが `keyHash` をリクエスト本文に送る: [`js/sync.js:155-162`](../js/sync.js#L155)
- サーバーは形式だけを確認して認証・検索に利用: [`server/src/index.js:152-169`](../server/src/index.js#L152)
- D1 は `key_hash` とデッキ JSON `payload` を保存: [`server/migrations/0001_init.sql:4-15`](../server/migrations/0001_init.sql#L4)

つまり平文シンクキーだけでなく `keyHash` も秘密です。シンクキーはブラウザーの `localStorage` に保存されるため、同じブラウザープロファイルを使う人、強い権限を持つ拡張機能、KOTRI のオリジン上で実行された悪意ある JavaScript からは読み取られ得ます。

- 保存箇所: [`js/sync.js:82-93`](../js/sync.js#L82)

キーが漏れた場合、第三者はその同期領域のデッキを読めるだけでなく、更新や削除もできます。現状は閲覧専用権限、端末ごとの権限、キー失効 API、変更履歴監査がありません。漏洩時は新しいシンクキーを作り、正しいデータをそちらへ移すのが実質的なローテーションになります。

## D1 に保存されるデータ

D1 には、`key_hash`、デッキ ID、デッキ JSON、更新時刻、削除フラグ等が保存されます。デッキ JSON は KOTRI 側で暗号化していないため、Cloudflare アカウントの D1 クエリ権限を持つ管理者や、アカウントを乗っ取った攻撃者には内容を読まれます。

一方で Cloudflare は、D1 の全オブジェクトを AES-256-GCM で保存時暗号化し、Worker・D1・Wrangler 間の通信を TLS で暗号化すると説明しています。これはディスク盗難や通信盗聴への防御ですが、正規権限を奪われた場合やアプリ経由のアクセスを防ぐものではありません。

- 公式: [D1 Data security](https://developers.cloudflare.com/d1/reference/data-security/)
- スキーマ: [`server/migrations/0001_init.sql`](../server/migrations/0001_init.sql)
- `payload` と `keyHash` をログ出力しない実装: [`server/src/index.js:283-288`](../server/src/index.js#L283)

## リスク評価

「重大度」は起きたときの深刻さ、「可能性」は身内数人で URL を広く宣伝しない前提の目安です。

| 脅威 | 重大度 | 可能性 | 主な影響 | 現状の防御と残る問題 |
|---|---:|---:|---|---|
| シンクキーまたは `keyHash` の漏洩 | 高 | 低〜中 | 該当同期領域の閲覧・改ざん・削除 | 160 bit のため推測は困難。ただし漏れた値を持つ者は全面アクセスでき、失効機能がない |
| Cloudflare アカウント乗っ取り | 高 | 低〜中 | Worker 改変、全 D1 データ閲覧・破壊、設定変更 | Cloudflare 側の基盤防御はあるが、管理者ログインの安全性は利用者の責任。2FA 未設定なら可能性が上がる |
| ランダムな `keyHash` による無料枠・DBの乱用 | 高（可用性） | 中 | 当日の同期停止、不要行・ストレージ増加 | キー単位で60回/分だが、攻撃者は毎回別の64桁 hex を使える。総量/IP単位の制限はない |
| 大規模 DDoS | 中 | 低 | 一時的な停止 | Cloudflare は全プランで L3/L4/L7 DDoS を自動緩和。ただし正規形式の低速なアプリ層乱用まで全て防ぐ保証ではない |
| D1 の誤削除・アプリ不具合 | 中 | 中 | デッキ消失・巻き戻り | D1 Time Travel は常時有効。ただし Free は7日で、復元はDB全体を上書きする操作。利用者の JSON バックアップも必要 |
| 外部 CDN JavaScript の改ざん・供給元侵害 | 高 | 低 | シンクキーとデッキの窃取、利用者ブラウザー上で任意コード実行 | 6本の外部スクリプトを SRI なしで実行し、CSP もない。`react@18` と Tailwind CDN は厳密な不変バージョンでもない |
| 公開フロントエンドの閲覧・コピー | 低 | 高 | 実装やAPI URLの把握 | Webアプリでは正常。GitHubリポジトリをPrivateにしても、配信済みHTML/JSは閲覧可能 |

### 無料枠乱用が現状の技術的な弱点

現在のレート制限は `keyHash` ごとに1分60回です。未登録の `keyHash` は最初の `/sync` で自動登録されます。そのため攻撃者は、64桁のランダムな16進数を毎回変えて送れば、キー単位制限を回避しながら `sync_keys` 行を増やせます。

- キー単位レート制限: [`server/src/index.js:15-18`](../server/src/index.js#L15)、[`server/src/index.js:92-125`](../server/src/index.js#L92)
- 未登録キーの自動作成: [`server/src/index.js:101-109`](../server/src/index.js#L101)
- 1リクエスト256 KiB、変更200件、1キー200デッキの上限は実装済み: [`server/src/index.js:9-14`](../server/src/index.js#L9)

Workers Free は1日100,000リクエスト、D1 Free は1日500万行読み取り・10万行書き込みです。上限に達すると Free プランでは処理が失敗し、通常は意図しない請求よりも「その日の同期が止まる」形になります。ただし DDoS と判定・除外されない正規形式の乱用は、利用量として数えられる可能性があります。

- 公式: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- 公式: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- 公式: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

Cloudflare の全プラン向け DDoS 防御は大きな安心材料ですが、Cloudflare 自身も WAF やレート制限を組み合わせる多層防御を推奨しています。

- 公式: [DDoS Protection](https://developers.cloudflare.com/ddos-protection/about/)
- 公式: [Proactive DDoS defense](https://developers.cloudflare.com/ddos-protection/best-practices/proactive-defense/)

## 外部 CDN とサプライチェーン

現在の `index.html` は React、ReactDOM、Babel、Tailwind、QRコード生成、PapaParse を外部 CDN から直接実行します。

- 読み込み箇所: [`index.html:9-22`](../index.html#L9)

これらの配信元または対象ファイルが侵害・意図せず変更されると、その JavaScript は KOTRI と同じオリジン権限で動き、`localStorage` のシンクキーや画面上のデッキを読み取れます。現在は `integrity` 属性（SRI）と Content Security Policy がありません。[W3C の SRI 仕様](https://www.w3.org/TR/SRI/)では、外部リソースの内容を暗号学的ハッシュで検証できます。

特に `react@18` はパッチバージョンまで固定されず、`https://cdn.tailwindcss.com` も不変ファイル指定ではありません。身内の非機密用途では直ちに危険というほどではありませんが、シンクキーを守る観点では優先して減らしたい依存です。

## バックアップと復旧

D1 Time Travel は自動・常時有効で追加料金はかかりません。Workers Free では過去7日まで、分単位の状態へ戻せます。ただし復元はデータベース全体をその時点へ上書きします。

- 公式: [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- 長期保管用の手動エクスポート: [D1 Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

Time Travel は操作ミスへの短期保険で、利用者単位のバックアップの代替ではありません。KOTRI の JSON バックアップを定期的に別の場所へ保存すると、キー紛失、誤同期、7日を超えて発覚した破損にも対応できます。

## 対策の優先順位

### 必須（今すぐ）

1. **Cloudflare アカウントで2FAを有効化する。** Cloudflare は異なる2方式とバックアップコードの安全な保管を推奨しています。可能なら Windows Hello やセキュリティキーを主方式にします。公式: [Two-factor authentication](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)
2. **シンクキーをパスワードとして扱う。** 公開チャット、SNS、Issue、スクリーンショットへ載せない。共有は相手を限定し、紛失・漏洩時は新しいキーへ移行する。
3. **機密情報をデッキ名やメモへ入れない。** 現状はエンドツーエンド暗号化ではない。
4. **定期的に KOTRI の JSON バックアップを保存する。** 少なくとも大きな編集前と、月1回程度を目安にする。

### 推奨（公開ページ移行と同時、または近いうち）

1. **総量または送信元IP単位のレート制限を `/sync` の D1 アクセス前に追加する。** Cloudflare Workers の [Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) などを使い、毎回異なる `keyHash` でも制限できるようにする。これは現在もっとも実益の大きいサーバー側改善。
2. **未使用の `sync_keys` 行を定期削除するか、キー作成を招待方式にする。** 後者は運用が増えるため、身内用途ではまずIP/総量制限が現実的。
3. **外部スクリプトを自己ホストする。** 難しければ厳密なバージョン固定と SRI を行い、合わせて CSP の導入を検討する。Tailwind CDN とブラウザー内 Babel は将来的にビルド済み静的資産へ置き換える。
4. **Cloudflare の使用量を時々確認する。** 普段数人しか使わないのにリクエスト数や D1 書き込みが急増していないか、Workers & Pages と D1 のメトリクスを見る。
5. **Cloudflare Pages移行時に `ALLOWED_ORIGINS` を新URLへ変更する。** 古いGitHub Pages URLを不要になった時点で外す。

### 将来（機密性や利用者数を増やす場合）

1. シンクキーから直接導く暗号鍵で `payload` をクライアント側暗号化し、サーバーには暗号文だけを保存する。ただし鍵紛失時の復旧不可、共有・ローテーション設計が複雑になる。
2. 読み取り用・書き込み用の権限分離、キー失効、端末管理、監査ログを追加する。
3. 長期の自動 D1 エクスポートと復元手順の定期テストを行う。
4. 本当に利用者を限定したい場合は Cloudflare Access やログインを導入する。ただし「ログイン不要」という現在の要件とはトレードオフになる。公式: [Protect Workers with Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Cloudflare 管理者としての運用

- Wrangler の OAuth や将来作る API token を Git、チャット、スクリーンショットへ載せない。
- CI/CD を導入する場合は、Global API Key ではなく必要最小権限・対象限定・期限付きの API token を使う。公式: [Create API tokens](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/)
- 不審な変更があれば、パスワード変更、セッション失効、トークンのローテーション、Audit Log確認を行う。公式: [Secure a compromised account](https://developers.cloudflare.com/fundamentals/account/account-security/secure-a-compromised-account/)
- `database_id` は接続パスワードではない。D1への操作権限は Cloudflare の認証と Worker binding で管理される。

## 最終判断

今の構成を「絶対にハッキングされない」と考えるのは適切ではありませんが、**非機密のカードデッキを身内数人で共有するリスク水準としては、上記の必須対策を行えば十分現実的**です。

誤解しないための一文にすると、次のとおりです。

> API入口は全世界へ公開されているが、既存デッキの鍵は160 bitのランダムなシンクキーで守られている。Cloudflareが大規模DDoSと基盤暗号化を担当し、利用者側はキー漏洩・アカウント乗っ取り・アプリ層の無料枠乱用・バックアップに備える。
