# line-english-app

LINE Messaging APIを利用した英語復習サービスのNestJSバックエンドです。

## 技術スタック

- Node.js 22
- NestJS
- TypeScript
- npm
- Docker / Docker Compose
- Prisma
- PostgreSQL
- Fly.io想定のDockerデプロイ

## 初回セットアップ

ローカルのNode.js / npmは使わず、Docker経由で操作します。

```bash
cp .env.example .env
docker compose build
```

`.env` の値は必要に応じて設定してください。初期状態ではLINE Pushはまだ行いません。
ローカルDBはDocker ComposeのPostgreSQLを使います。

## 起動方法

```bash
docker compose up
```

PostgreSQLと開発モードのNestJSが起動し、ソースコード変更時にホットリロードされます。

## 環境変数

```dotenv
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/line_english_app?schema=public
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=local-session-secret-change-me
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LINE_MESSAGING_CHANNEL_SECRET=
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=
DELIVERY_SNOOZE_MINUTES=60
NGROK_AUTHTOKEN=
```

- `PORT`: NestJSの待受ポート
- `DATABASE_URL`: PostgreSQL接続URL。ローカルではCompose内の `postgres` サービスに接続します
- `APP_BASE_URL`: LINE Login callbackに使うアプリの公開URL
- `SESSION_SECRET`: 管理画面ログインCookie署名用の秘密文字列
- `LINE_LOGIN_CHANNEL_ID`: LINE Login Channel ID
- `LINE_LOGIN_CHANNEL_SECRET`: LINE Login Channel Secret
- `LINE_MESSAGING_CHANNEL_SECRET`: LINE Messaging API Channel Secret。Webhook署名検証に使います
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`: LINE Messaging API Channel Access Token。返信やPush配信に使います
- `DELIVERY_SNOOZE_MINUTES`: 配信後に同じカードを再配信しないため先送りする分数
- `NGROK_AUTHTOKEN`: ローカルWebhook確認用のngrok Authtoken

Mac側のDBクライアントから接続する場合は、ホスト名だけ `localhost` に変えて接続します。

```text
postgresql://postgres:postgres@localhost:5432/line_english_app?schema=public
```

`LINE_MESSAGING_CHANNEL_SECRET` が未設定の場合、ローカル疎通用にWebhook署名検証はスキップされます。設定済みの場合は `x-line-signature` を検証します。

## Health Check

```bash
curl http://localhost:3000/health
```

レスポンス:

```json
{
  "status": "ok"
}
```

## LINE Webhook疎通確認

```bash
curl -i -X POST http://localhost:3000/line/webhook \
  -H 'Content-Type: application/json' \
  -d '{"events":[]}'
```

ngrokもDocker Composeで一緒に起動します。公開URLは http://localhost:4040 で確認できます。LINE DevelopersのWebhook URLには次の形式で設定してください。

```text
https://<ngrokのURL>/line/webhook
```

## Admin

カード管理画面は次のURLで開きます。

```text
http://localhost:3000/admin
```

未ログインの場合はLINE Loginへリダイレクトします。LINE DevelopersのLINE Login Channelに、次のcallback URLを登録してください。

```text
http://localhost:3000/auth/line/callback
```

スマホからngrok経由で確認する場合は、`APP_BASE_URL` をngrokのURLに変えて、LINE Developersにも同じcallback URLを追加します。

```text
https://<ngrokのURL>/auth/line/callback
```

Fly.ioにデプロイする場合は、必ず `APP_BASE_URL`, `SESSION_SECRET`, `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_SECRET` をsecretに設定してください。LINEへの返信やPush配信を使う場合は `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` も設定します。

## Delivery Job

外部cronから次のエンドポイントを叩くと、各LINEユーザーに未復習の期限到来カードを最大1件ずつFlex MessageでPush配信します。配信内容はカード表面だけです。送信後はそのカードを `ASKED` に更新し、次の配信対象から外します。Flex Messageの「答えを見る」を押すと、Webhookのpostbackで裏面を返信し、カードを `ANSWERED` に更新します。

```bash
curl -X POST http://localhost:3000/internal/jobs/deliver-due-cards \
  -H 'Content-Type: application/json' \
  -d '{}'
```

送信せず対象確認だけ行う場合は `dryRun` を指定します。

```bash
curl -X POST http://localhost:3000/internal/jobs/deliver-due-cards \
  -H 'Content-Type: application/json' \
  -d '{"dryRun":true}'
```

## npm scripts

すべてDocker / Docker Compose経由で実行します。

```bash
docker compose exec app npm run start:dev
docker compose exec app npm run build
docker compose exec app npm run start:prod
docker compose exec app npm run lint
docker compose exec app npm run test
```

コンテナを起動していない場合は、次のように一時コンテナで実行できます。

```bash
docker compose run --rm app npm run build
docker compose run --rm app npm run test
```

## Prisma

Schemaは `prisma/schema.prisma` にあります。
ローカルのPostgreSQLは `docker compose up` で一緒に起動します。

PrismaコマンドもDocker内で実行します。

```bash
docker compose run --rm app npx prisma generate
docker compose run --rm app npx prisma migrate dev
```

`migrate dev` を実行する前に、`.env` またはCompose環境変数の `DATABASE_URL` にPostgreSQL接続URLを設定してください。
