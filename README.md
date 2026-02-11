# BookMe SaaS - オンライン予約システム

Google カレンダー連携のオンライン予約システム。Cloudflare Workers + D1 で動作するマルチテナント SaaS。

## アーキテクチャ

- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **認証**: Google OAuth 2.0
- **カレンダー**: Google Calendar API（ユーザー OAuth トークン）
- **メール**: Resend API
- **フロントエンド**: Vanilla HTML/CSS/JS（静的ファイル）

## URL 構成

| パス | 説明 |
|------|------|
| `/` | ランディングページ |
| `/dashboard` | ダッシュボード（ログイン必須） |
| `/:slug` | ユーザーの公開予約ページ |
| `/auth/google` | Google OAuth 開始 |
| `/auth/callback` | OAuth コールバック |
| `/api/u/:slug/*` | 公開 API |
| `/api/dashboard/*` | ダッシュボード API（認証必須） |

## セットアップ

### 1. 前提条件

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare アカウント](https://dash.cloudflare.com/)
- [Google Cloud Console](https://console.cloud.google.com/) アカウント
- [Resend](https://resend.com/) アカウント

### 2. 依存関係のインストール

```bash
cd bookme-v2
npm install
```

### 3. Google Cloud Console の設定

#### OAuth 同意画面
1. [Google Cloud Console](https://console.cloud.google.com/) → 「APIs & Services」→「OAuth consent screen」
2. ユーザーの種類: **外部**
3. アプリ名: `BookMe`
4. スコープを追加:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar`
5. テストユーザーにあなたの Google アカウントを追加

#### OAuth クライアント ID
1. 「APIs & Services」→「Credentials」→「+ CREATE CREDENTIALS」→「OAuth 2.0 Client ID」
2. アプリケーションの種類: **ウェブアプリケーション**
3. 名前: `BookMe`
4. 承認済みリダイレクト URI: `https://あなたのドメイン/auth/callback`
5. **クライアント ID** と **クライアント シークレット** をメモ

#### Google Calendar API の有効化
1. 「APIs & Services」→「Library」→「Google Calendar API」→「有効にする」

### 4. D1 データベースの作成とマイグレーション

```bash
# D1 データベースの作成（初回のみ）
npx wrangler d1 create bookme-db

# wrangler.toml の database_id を更新

# マイグレーションの実行
npx wrangler d1 execute bookme-db --remote --file=migrations/0001_init.sql
npx wrangler d1 execute bookme-db --remote --file=migrations/0002_saas.sql
```

### 5. シークレットの設定

```bash
# Google OAuth
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# セッション署名用（ランダムな32文字以上の文字列）
npx wrangler secret put JWT_SECRET

# refresh_token 暗号化用（ランダムな32文字以上の文字列）
npx wrangler secret put ENCRYPTION_KEY

# Resend API キー
npx wrangler secret put RESEND_API_KEY
```

### 6. BASE_URL の設定

`wrangler.toml` の `[vars]` セクションで `BASE_URL` を設定:

```toml
[vars]
BASE_URL = "https://あなたのドメイン"
```

### 7. デプロイ

```bash
npx wrangler deploy
```

## ローカル開発

```bash
# .dev.vars.example をコピーして .dev.vars を作成
cp .dev.vars.example .dev.vars

# .dev.vars に実際の値を入力

# ローカルサーバーの起動
npx wrangler dev
```

## ファイル構成

```
src/
  index.ts              -- エントリーポイント / ルーター
  types.ts              -- TypeScript 型定義
  routes/
    auth.ts             -- Google OAuth フロー
    settings.ts         -- 設定 API
    events.ts           -- カレンダーイベント API
    slots.ts            -- 空き時間スロット API
    bookings.ts         -- 予約 API
  services/
    calendar.ts         -- Google Calendar API
    crypto.ts           -- refresh_token 暗号化
    db.ts               -- D1 データベース操作
    email.ts            -- Resend メール送信
    oauth.ts            -- Google OAuth ヘルパー
    session.ts          -- JWT セッション管理
  utils/
    timezone.ts         -- タイムゾーンユーティリティ
public/
  index.html            -- ランディングページ
  booking.html          -- 公開予約ページ
  dashboard.html        -- ダッシュボード
migrations/
  0001_init.sql         -- 初期スキーマ
  0002_saas.sql         -- SaaS マイグレーション
```

## コスト

- Cloudflare Workers + D1: **$0**（無料枠内）
- Google OAuth: **$0**
- Resend: **$0**（100通/日まで無料）
- 独自ドメイン: ~$10/年

---

BookMe by Shinno
