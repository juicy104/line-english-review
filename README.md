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
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NGROK_AUTHTOKEN=
```

- `PORT`: NestJSの待受ポート
- `DATABASE_URL`: PostgreSQL接続URL。ローカルではCompose内の `postgres` サービスに接続します
- `LINE_CHANNEL_SECRET`: LINE Webhook署名検証用のChannel Secret
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging API用のChannel Access Token
- `NGROK_AUTHTOKEN`: ローカルWebhook確認用のngrok Authtoken

Mac側のDBクライアントから接続する場合は、ホスト名だけ `localhost` に変えて接続します。

```text
postgresql://postgres:postgres@localhost:5432/line_english_app?schema=public
```

`LINE_CHANNEL_SECRET` が未設定の場合、ローカル疎通用にWebhook署名検証はスキップされます。設定済みの場合は `x-line-signature` を検証します。

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
