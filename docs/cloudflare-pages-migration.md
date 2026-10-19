# Cloudflare Pages の並行公開・移行手順

更新日: 2026-10-19。方針は「URL を知っている人がログインなしで利用し、検索への掲載を抑える」。

**2026-10-19 の追加指示: Cloudflare 側の並行公開を進める。バックアップはまだのため、旧 GitHub Pages の停止とリポジトリの Private 化は実施しない。** 以下の標準手順にある旧サイト停止・非公開化は保留し、Cloudflare の構築・動作確認を先行する。Public リポジトリとの連携中は GitHub のビルド・デプロイ履歴から新 URL が見える可能性があり、完全に公開範囲を絞る作業は後日となる。

## 現在の状態（2026-10-19: 並行公開完了）

- Cloudflare Pages の初回 Git ビルド・本番公開が成功。GitHub App は利用者の承認により `lovecalife/kotori` 1件だけを対象に導入。
- Framework は None、ビルドは `node scripts/prepare-pages.mjs`、出力は `dist-pages`、Root はリポジトリのルート。本番 `main` の自動更新は有効、本番以外の自動プレビューと PR へのビルドコメントは無効。
- 静的配信のみで、Pages Functions / DB binding / 独自ドメイン / 有料契約は追加していない。
- 既存 Worker の本番 CORS に新オリジンを追加し、旧 GitHub オリジンも維持。D1 ID・スキーマはそのまま。
- Worker の変更前バージョン: `11ff1a21-27db-4775-9f53-4d02dc364940`。変更後: `91a87248-c5d1-43c0-8903-82f23f3ffd25`。
- Pages の公開 URL は Dashboard から確認する。API の許可オリジンは `server/wrangler.toml` が正。ハッシュ付き本番デプロイ URL も存在するが、通常の利用・同期にはプロジェクトの本番 URL を使う。
- 旧 GitHub Pages は HTTP 200 と既存 DeckLog API の正常動作を確認済み。リポジトリは Public のままで、停止・非公開化・転送は行っていない。

### 本番で確認した内容

- HTML / JS14件の配信、noindex のヘッダーと meta、参照元 URL の送信抑制、設定ファイル・不明パスの404。
- 新サイトのメンバー966件・ライブ237件、画像、キーワード検索、デッキ画面。
- 新オリジン・旧オリジンそれぞれの DeckLog `19ATNY` 取得（メンバー48枚・ライブ12枚）。
- 利用者のキーとは独立した使い捨て同期領域で、新旧オリジン間の作成・取得・更新・削除が成功。確認用デッキは削除済み（既存プロトコルどおり墓標は残る）。既存利用者のキー・デッキは参照していない。

### 残っている切り替え

各端末のバックアップと新サイトでの復元・同じキーでの同期確認を行う。**旧サイトの停止は利用者から改めて明示指示を受けるまで行わない。** 停止・リポジトリの Private 化・旧 CORS オリジンの削除は後日の作業である。以下の標準手順は参考資料であり、今回の実施状態はこの冒頭記録を優先する。

## 採用する構成

- 画面: Cloudflare Pages Free、GitHub の Private リポジトリと Git 連携。
- URL: `https://<project>.pages.dev/`。独自ドメインの購入は不要。
- 同期・DeckLog: 既存の `kotori-sync` Worker と既存 D1 を継続利用。
- 画面は静的配信だけにし、Pages Functions、認証機能、有料プランは追加しない。
- 新 URL は非公開化後に決める。公開 README、旧サイトの転送先、公開 issue などには記載しない。

Cloudflare Pages は Private リポジトリに対応する。GitHub App の権限は `Only select repositories` でこのリポジトリだけに限定する。[Git 連携](https://developers.cloudflare.com/pages/get-started/git-integration/)

### 「URL だけで共有」の限界

リポジトリの Private 化はソースの閲覧制限。Web ページはログインなしで誰でも開ける。URL の転送・流出・推測を防ぐ仕組みにはならず、ブラウザーに配信する HTML / JS とその中の API URL・シート ID は閲覧できる。過去に公開したソースのコピーも取り消せない。

`noindex` は対応する検索エンジンへの依頼であり、アクセス制御ではない。限定メンバーだけにしたくなった場合は別途 Cloudflare Access などで認証を導入する。今回は利用者の希望により認証を付けない。

カード CSV と画像は引き続き Google の公開 URL、ライブラリは CDN を使う。この移行で取得元まで非公開になるわけではない。CORS も API の一般的な認証を代替しない。同期領域の認証情報は引き続きシンクキー（API が受け取るハッシュ値も認証に使える値）である。

## 準備済みのファイル

| ファイル | 役割 |
| --- | --- |
| `scripts/prepare-pages.mjs` | 画面が読み込む JS と配信設定だけを `dist-pages/` に選別。元ファイルの書き換え・外部通信なし |
| `pages/_headers` | 全配信物に検索抑制の `X-Robots-Tag`、外部へ参照元 URL を送らない `Referrer-Policy: no-referrer` などを設定 |
| `pages/robots.txt` | noindex を読み取れるようクロールを許可。サイトマップは載せない |
| `pages/404.html` | 存在しないパスを404にする。Pages の自動 SPA フォールバックを防ぐ |
| `scripts/test-pages.mjs` | 不要ファイルの混入、参照切れ、古い配信物、ディレクトリリンクの境界を検証 |
| `scripts/check-pages.mjs` | 配信 URL の JS・検索抑制・404、任意で API の疎通・CORS を GET / OPTIONS だけで確認 |
| `scripts/check-decklog.mjs` | 第4引数に新しい画面のオリジンを指定可能。既定値は従来どおり |

生成 HTML に robots meta を追加する。元の `index.html`、JS の読み込み順、デッキ形式、保存キー、API URL、本番 Worker 設定、D1 は変更しない。`dist-pages/` は生成物として Git の対象外。

`robots.txt` に `Disallow: /` は追加しない。クローラーが noindex を読めなくなり、URL だけが検索結果に残る場合がある。[Google: noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

## ローカルでの準備確認（公開操作なし）

リポジトリのルートで実行する。

```powershell
node scripts/prepare-pages.mjs
node --test scripts/test-pages.mjs scripts/test-decklog.mjs
node --check scripts/prepare-pages.mjs
node --check scripts/check-pages.mjs
node --check scripts/check-decklog.mjs
```

通常の開発は引き続き `node scripts/serve.mjs`。フロントエンドに npm インストール・JSX の事前変換は不要。

Cloudflare と同じヘッダー・404 の扱いまで確認する場合、既存の `server` 依存関係でプレビューを起動する。依存関係がない環境では先に `server` 内で `npm ci` を実行する。

```powershell
node server/node_modules/wrangler/bin/wrangler.js pages dev dist-pages --ip 127.0.0.1 --port 8789 --compatibility-date 2025-01-01
```

別ターミナルで確認する。

```powershell
node scripts/check-pages.mjs http://127.0.0.1:8789
```

これは PC 内のプレビューで、Cloudflare にサイトは作成しない。ローカル画面の同期先は `http://127.0.0.1:8787`、DeckLog は `/api` であり、Pages の静的プレビューだけでは動かない。通常の開発サーバーとローカル Worker、または移行当日の新 URL で確認する。

## 無料枠（公式資料を 2026-10-19 に確認）

| 対象 | Free の主な制限 |
| --- | --- |
| Pages 静的配信 | 静的リクエストは無料・無制限 |
| Git ビルド | 月500回、同時1回、1回20分まで |
| 配信ファイル | 20,000ファイル、1ファイル25 MiBまで |
| 既存 Worker | アカウントで100,000リクエスト/日、CPU 10 ms/呼び出し |
| 既存 D1 | 読み取り500万行/日、書き込み10万行/日、保存合計5 GB（1 DB は500 MBまで） |

今回の生成物は18ファイルで、ページ配信に Worker を追加しない。API / D1 の枠は同一アカウントの他の利用分と共有する。実際の使用量は未取得なので、移行当日にダッシュボードで確認する。無料枠内で運用し、Workers Paid などを契約しない。D1 の無料枠超過ではクエリが失敗するため、同期間隔や利用状況を確認する。

出典: [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)、[Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)、[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

## 標準の移行手順（並行公開済みの箇所は再実行不要）

### 1. 旧サイトで全員のデータを退避する

利用者ごと・ブラウザーごと・端末ごとに行う。`localStorage` はオリジン単位で、Cloudflare の画面から GitHub Pages のデータを直接読めない。

1. 旧 URL `https://lovecalife.github.io/kotori/` を開く。
2. 編集中のデッキと検討中のカードを残す場合、「デッキデータの保存 / 読み込み / 出力」から名前を付けて**新規保存**する。自動保存だけでは全件バックアップに入らない。
3. 「全件バックアップ」を取得し、JSON のデッキ件数と名前を確認する。ファイルをリポジトリ外の安全な場所に保管する。
4. 同期利用者はシンクキーを別途控え、「今すぐ同期」で成功を確認する。シンクキーはバックアップ JSON に含まれない。既存のキーを使い、新規発行しない。
5. 端末にしかないデッキも退避済みか確認し、全員の完了後に次へ進む。

バックアップは保存済みの有効なデッキ（メンバー・ライブ・検討中）が対象で、削除済みの墓標を含まない。同期には墓標も含まれる。編集中の自動保存、フィルター、表示設定、同期時刻は JSON の対象外。必要な画面設定は別途控えて新サイトで設定する。

### 2. GitHub 側の公開を停止する

**バックアップ確認前には行わない。** 旧画面が止まると旧オリジンのデータを通常の画面から取り出せなくなる可能性がある。

新 URL の公開履歴を増やさないため、バックアップ完了後に GitHub Pages の公開を停止し、リポジトリを Private に変更してから Cloudflare と接続する。GitHub 側の設定・契約によって公開継続条件は変わるため、Private 化だけに頼らず旧 URL の停止も確認する。この順番では新サイトの準備中に一時的な停止時間が生じる。

公開リポジトリや旧サイトに新 URL のリダイレクトを置かない。既に公開済みのソース・URL・フォーク・キャッシュの回収はできない。新 URL は利用者へ個別に共有する。

### 3. Pages の設定値を確定する

Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git。Workers の作成画面を選ばない。メニュー表記は変わる場合がある。

| 設定 | 値 |
| --- | --- |
| GitHub App 権限 | この Private リポジトリのみ |
| Project name | 推測されにくい名前。非公開化後に決める |
| Production branch | `main`（今回確認した作業ブランチ。実施時に再確認） |
| Framework preset | `None` |
| Root directory | リポジトリのルート（空欄） |
| Build command | `node scripts/prepare-pages.mjs` |
| Build output directory | `dist-pages`（`.` や `server` は指定しない） |
| Preview branch deployments | `None`。作成直後に設定を確認 |
| Pages Functions / D1 binding | 追加しない |
| Web Analytics / 独自ドメイン / 有料機能 | 今回は追加しない |

プレビューは既定で公開される。自動プレビューを無効にしても、既に作成済みの URL は消えない。ハッシュ付き URL / ブランチ別名の残存も確認する。プレビューを使う場合は必要な範囲に制限し、API のオリジンは個別に許可する。`*.pages.dev` 全体を許可しない。[ブランチ制御](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)、[プレビューの公開範囲](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

Git 連携と Direct Upload のプロジェクト種別は後から自由に切り替えられない。Git 連携プロジェクトでも自動ビルドを止めて Wrangler からデプロイする方法はあるが、今回は Git 連携で統一する。[Git 連携](https://developers.cloudflare.com/pages/get-started/git-integration/)

### 4. 既存 API に新オリジンを追加する

既存 Worker の URL と D1 はそのまま使う。**新しい D1 の作成、既存 D1 の置き換え、マイグレーションは不要。** `server/README.md` の初回構築手順をやり直さない。

新 URL が確定したら、`server/wrangler.toml` の本番 `[vars]` だけに移行期間の旧・新オリジンを設定する。以下は説明用の値。`<project>` は実際の名前に置き換える。オリジンにパス・末尾の `/` を含めない。

```toml
[vars]
ALLOWED_ORIGINS = "https://lovecalife.github.io,https://<project>.pages.dev"
```

D1 ID、Worker 名、`env.preview` / `env.dev` は維持する。デプロイ前に現在のリリースと設定を控え、必要なら既存 D1 をリポジトリ外へバックアップする。画面用の `js/constants.js` は現状の本番 Worker URL を使えるため変更不要。

**以下は移行当日だけ実行する公開操作。** `server` ディレクトリで正しいアカウントを確認してから実行する。

```powershell
npx wrangler whoami
npx wrangler deploy
```

DeckLog 機能を含む現在の Worker ソースが本番に未反映の場合もこのとき反映する。今回の準備では本番コードの版やデプロイ状態は確認していない。

### 5. Pages を初回公開して動作確認する

Private リポジトリに準備用ファイルを反映し、ビルド設定を確認したうえで `Save and Deploy` を実行する。以降 `main` への push は公開の更新になる。

公開後、ルートで次を実行する。実際の新 URL に置き換える。

```powershell
node scripts/check-pages.mjs https://<project>.pages.dev https://kotori-sync.lovecalife-kotori.workers.dev
node scripts/check-decklog.mjs https://kotori-sync.lovecalife-kotori.workers.dev 19ATNY https://<project>.pages.dev
```

前者は GET / OPTIONS のみで同期領域を変更しない。後者は公開 DeckLog へ実際に取得通信する。`/health` と CORS の確認だけでは D1 の同期動作を保証できないため以下も行う。

- [ ] ログインなし・プライベートブラウズで新 URL を開ける
- [ ] メンバー / ライブ両方の件数・カード名・画像・検索・絞り込みが表示される
- [ ] デッキの追加・保存・再読み込み・検討中のカードが維持される
- [ ] 各利用者の JSON を「バックアップから復元」で読み込み、件数・名前・枚数・検討中を照合する
- [ ] 同期利用者は旧キーを入力し、既存デッキを取得できる（新オリジンの初回同期時刻は0から）
- [ ] 使い捨ての確認用デッキで、別端末の取得・更新・削除の同期を確認する
- [ ] DeckLog の ID / 共有 URL 入力、内容プレビュー、取り込みを確認する
- [ ] PC / スマートフォンで一覧・デッキ・同期の画面が使える
- [ ] 全員の確認が完了するまでバックアップと旧ブラウザーの保存データを削除しない

### 6. 切り替え後に整理する

全員が新サイトで使えることを確認したら、本番 `ALLOWED_ORIGINS` から旧 GitHub オリジンを除き、新オリジンだけにする。Worker を更新し、疎通確認を再実行する。新 URL を個別に共有してブックマークを更新する。新 URL とシンクキーは別々の共有情報として扱う。

旧サイト停止、Private 設定、不要なプレビューの停止、無料プランのままであることを再確認する。

## 失敗した場合

- 画面だけの問題: Pages で直前の正常な本番デプロイに戻す。初回ならローカルで修正して再デプロイする。[Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- CORS の問題: 新オリジンの完全一致、Worker のデプロイ先・本番環境、`SYNC_API_BASE` を確認する。`*` で解決しない。
- デッキが見つからない: バックアップの件数とキー、接続先が既存 Worker / D1 かを確認する。キーや D1 を新規作成しない。残っているデータは削除しない。
- CDN / Google の読み込み不良: 既存と同じ外部依存があるため、該当サービスとブラウザーの通信状況を確認する。
- 旧サイトへ戻すために自動で Public に戻さない。再公開は別の判断になる。Cloudflare 内で復旧し、バックアップから復元する。

## 初回準備時の検証記録（公開前の履歴）

2026-10-19 の最初の準備段階では PC 内だけで確認し、その時点では Cloudflare の作成・デプロイ・リモート D1 操作は行わなかった。その後の並行公開と本番確認の結果は冒頭に記録している。

- 配信物18ファイルの生成、元 HTML の保持、JS14件の配信。
- 検索抑制ヘッダー / meta、参照元を送らないヘッダー、非配信ファイルと不明パスの404。
- ローカルブラウザーでメンバー966件・ライブ237件の一覧、ライブ画像の読み込み、デッキ画面の表示。
- 本番と同じ Worker ソースを PC 内で動かし、配信確認スクリプトの API 疎通・CORS 検証も成功。DB が呼ばれたら失敗させる設定で、DB アクセスがないことも確認。
- 自動テスト14件中12件成功。リンク作成権限が必要な2件は実行環境の制限でスキップ。

並行公開時に Pages の本番 URL、アカウントの使用量、GitHub の公開継続、新オリジンの CORS・同期・DeckLog を確認済み。利用者ごとのバックアップ・復元確認と旧サイト停止の判断は未実施。
