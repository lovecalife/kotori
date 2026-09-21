# Cloudflare 登録ガイド（KOTRI デッキ同期用）

調査日: 2026-09-21

このガイドでは、KOTRI のデッキ同期 API を **Cloudflare Workers + D1 の無料プラン**で動かすために、Cloudflare の新規登録から Wrangler のログイン確認までを説明します。D1 の作成と Worker のデプロイは、このガイドの完了後に [server/README.md](../server/README.md) の手順で行います。

Cloudflare アカウントが必要なのは、同期サーバーをデプロイ・管理する人だけです。KOTRI を使ってシンクキーを共有する家族や友人は、Cloudflare へ登録する必要はありません。

Cloudflare のダッシュボードは更新されるため、ボタン名やメニュー位置が多少変わることがあります。その場合は、ここに記載した名称に近い項目を探し、契約プランや料金が表示された画面では確定前に内容を確認してください。

## 事前に用意するもの

- 受信できるメールアドレス
- Web ブラウザー
- KOTRI のリポジトリを操作する PC
- Node.js と npm（Wrangler の実行に使用）

独自ドメインは不要です。Cloudflare が提供する `*.workers.dev` を利用できます。公式ドキュメントでも、`workers.dev` は独自ドメインを Cloudflare に追加せず Worker を公開できる仕組みで、個人・ホビー用途向けとされています。[Cloudflare: workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## 1. Cloudflare アカウントを作成する

1. Cloudflare 公式の [Sign up](https://dash.cloudflare.com/sign-up) を開きます。
2. メールアドレスとパスワードを入力します。
3. `Create Account`（または同趣旨の登録ボタン）を選びます。

公式の初回登録手順は、メールアドレスとパスワードを入力してアカウントを作成する流れです。[Cloudflare: Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)

このガイドでは、後からログイン方法を迷いにくいように、メールアドレスとパスワードでの登録を前提にしています。画面に Google、GitHub、Apple などのログイン方法が表示される場合もありますが、ソーシャルログインでは最初は Cloudflare 用パスワードが設定されない場合があります。[Cloudflare: Log in to Cloudflare](https://developers.cloudflare.com/fundamentals/user-profiles/login/)

## 2. メールアドレスを確認する

アカウント作成後、Cloudflare から確認メールが自動送信されます。

1. 登録したメールアドレスの受信箱を開きます。
2. Cloudflare から届いた確認メールを開きます。見つからない場合は迷惑メールフォルダーも確認します。
3. メール内の確認リンクを開き、必要に応じて Cloudflare にログインします。
4. ダッシュボードの `My Profile` にあるメールアドレスに `verified` と表示されれば確認済みです。

メールが届かない、またはリンクが期限切れの場合は、ダッシュボードの `My Profile` → `Email Address` 付近にある `Send verification email` から再送できます。表示場所や文言は変更される可能性があります。[Cloudflare: Verify email address](https://developers.cloudflare.com/fundamentals/user-profiles/verify-email-address/)

### 推奨: 2 要素認証を設定する

メール確認後、`My Profile` → `Authentication` から 2 要素認証（2FA）を設定しておくと安全です。Cloudflare は全ユーザーに 2FA を推奨しており、復旧用バックアップコードの安全な保管も案内しています。メール確認前に 2FA を設定するとロックアウトにつながる可能性があるため、必ずメール確認を先に済ませます。[Cloudflare: Two-factor authentication](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)

## 3. 無料プランと支払い情報を確認する

KOTRI の身内利用では、**Workers Free と D1 の無料枠を使うため、先に有料プランへ変更する必要はありません**。

Cloudflare は無料での開始にクレジットカードは不要と明記しており、Workers は既定で Free プランを利用できます。したがって、このガイドの無料構成を始めるだけなら、支払い方法を登録する必要はありません。[Cloudflare: Plans](https://www.cloudflare.com/plans/)、[Cloudflare Workers: Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

支払い方法は Cloudflare の製品やサービスを購入するときに必要です。ダッシュボードで支払い方法の追加、`Workers Paid`、購入、アップグレードなどを勧められても、このガイドでは選びません。支払い情報の入力を求められた場合は、有料製品や有料プランを選択していないか、確定前に画面を戻って確認します。[Cloudflare: Create billing profile](https://developers.cloudflare.com/billing/get-started/create-billing-profile/)

2026-09-21 時点の主な無料枠は次のとおりです。

| 項目 | Workers Free の枠 |
| --- | ---: |
| Worker リクエスト | 100,000 回 / 日 |
| Worker CPU 時間 | 1 呼び出しあたり 10 ms |
| D1 読み取り | 5,000,000 行 / 日 |
| D1 書き込み | 100,000 行 / 日 |
| D1 ストレージ | アカウント合計 5 GB |

出典: [Cloudflare Workers: Pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Cloudflare D1: Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

D1 の無料枠を超えた場合は従量課金へ自動移行するのではなく、無料プランではクエリがエラーになります。日次枠は 00:00 UTC にリセットされます。[Cloudflare D1: Pricing FAQ](https://developers.cloudflare.com/d1/platform/pricing/#frequently-asked-questions)

## 4. `workers.dev` サブドメインを設定する

`workers.dev` の URL は、次の形になります。

```text
https://<Worker名>.<アカウントのサブドメイン>.workers.dev
```

KOTRI の Worker 名は `kotori-sync` なので、例えばアカウントのサブドメインを `example-kotori` にすると、公開 URL は次の形です。

```text
https://kotori-sync.example-kotori.workers.dev
```

設定方法は次のいずれかです。

- Cloudflare ダッシュボードで `Workers & Pages` を開き、`Your subdomain` の横にある `Change` などの項目から設定する。
- 初回の `npx wrangler deploy` でサブドメインが未設定の場合、Wrangler の案内に従って設定する。

Cloudflare 公式ドキュメントでは、アカウント側のサブドメインは `<YOUR_ACCOUNT_SUBDOMAIN>.workers.dev`、個々の Worker は `<YOUR_WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev` という形式です。[Cloudflare: workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[Cloudflare Workers: CLI get started](https://developers.cloudflare.com/workers/get-started/guide/)

サブドメインは、個人名やメールアドレスをそのまま含めず、公開されても問題のない名前にします。後でアカウントのサブドメインを変更すると Worker の URL も変わるため、KOTRI の `SYNC_API_BASE` を設定した後はむやみに変更しない方が安全です。

なお、`workers.dev` を有効にした Worker の URL は公開されます。KOTRI の同期 API はシンクキーを前提にしていますが、URL 自体を非公開にする仕組みではありません。[Cloudflare: Manage access to workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev)

## 5. Wrangler で Cloudflare にログインする

PowerShell を開き、KOTRI の `server` ディレクトリへ移動します。

```powershell
cd D:\Develop\git\kotori\server
npm install
```

次に、Wrangler の認証情報を Windows の資格情報マネージャーで保護するオプションを付けてログインします。

```powershell
npx wrangler login --use-keyring
```

通常は既定のブラウザーが開きます。Cloudflare にログインし、アクセスする Cloudflare アカウントを確認して、Wrangler の認可を承認します。完了後、ターミナルにログイン成功の表示が出ます。Wrangler の `login` は OAuth を使い、通常はブラウザーを自動で開くことが公式ドキュメントに記載されています。[Cloudflare Wrangler: General commands](https://developers.cloudflare.com/workers/wrangler/commands/general/#login)

ログイン状態を確認します。

```powershell
npx wrangler whoami
```

登録したメールアドレスや対象アカウントが表示されれば完了です。複数の Cloudflare アカウントが表示される場合は、今後 D1 と Worker を作るアカウントを取り違えないよう、アカウント名と Account ID を控えてください。

### ブラウザーが開かない、またはログイン完了画面に進まない場合

ブラウザーを自動で開けない環境では、ローカルのコールバックサーバーを使わないデバイス認証を試します。

```powershell
npx wrangler login --device --use-keyring
```

ターミナルに表示される確認 URL とコードを使い、ブラウザーで承認します。コードには有効期限があるため、期限切れになったらコマンドをもう一度実行します。[Cloudflare Wrangler: Login without a local callback server](https://developers.cloudflare.com/workers/wrangler/commands/general/#use-wrangler-login-without-a-local-callback-server)

## 登録完了チェック

- [ ] Cloudflare ダッシュボードへログインできる
- [ ] `My Profile` でメールアドレスが確認済みになっている
- [ ] Workers Paid などの有料契約をしていない
- [ ] `workers.dev` に使う公開可能なサブドメインを決めた、または設定した
- [ ] `npx wrangler whoami` で正しいアカウントを確認できる

ここまで完了したら、[server/README.md](../server/README.md) の「D1 データベースを本番・プレビューの2つ作る」から先へ進みます。

## 公式資料

- [Cloudflare: Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)
- [Cloudflare: Verify email address](https://developers.cloudflare.com/fundamentals/user-profiles/verify-email-address/)
- [Cloudflare: Log in to Cloudflare](https://developers.cloudflare.com/fundamentals/user-profiles/login/)
- [Cloudflare: Two-factor authentication](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)
- [Cloudflare Workers: Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1: Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare: Plans](https://www.cloudflare.com/plans/)
- [Cloudflare: Create billing profile](https://developers.cloudflare.com/billing/get-started/create-billing-profile/)
- [Cloudflare: workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare Workers: CLI get started](https://developers.cloudflare.com/workers/get-started/guide/)
- [Cloudflare Wrangler: General commands](https://developers.cloudflare.com/workers/wrangler/commands/general/)
