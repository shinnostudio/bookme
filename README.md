# BookMe v2 - Cloudflare Workers + D1

GAS版からの移行版。Cloudflare Workers + D1 (SQLite) で動作する予約システム。

## 構成

- **バックエンド**: Cloudflare Workers (TypeScript)
- **データベース**: Cloudflare D1 (SQLite)
- **カレンダー**: Google Calendar API (サービスアカウント)
- **メール**: Resend API
- **フロントエンド**: 静的HTML (Workers から配信)

## セットアップ手順

### 1. 前提条件

```bash
npm install -g wrangler
wrangler login
```

### 2. D1 データベース作成

```bash
wrangler d1 create bookme-db
```

出力される `database_id` を `wrangler.toml` の `database_id` に設定。

### 3. スキーマ適用

```bash
# ローカル開発用
npm run db:migrate:local

# リモート（本番）
npm run db:migrate:remote
```

### 4. Google Calendar API 設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. **Google Calendar API** を有効化
3. **サービスアカウント** を作成 → JSONキーをダウンロード
4. Google カレンダーの設定で、サービスアカウントのメールアドレスに **カレンダーを共有**（「変更および共有の管理権限」）

### 5. Resend メール設定

1. [Resend](https://resend.com/) でアカウント作成
2. APIキーを取得

### 6. Secrets 設定

```bash
# Google サービスアカウントJSON (ファイルの中身をそのまま貼り付け)
wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON

# Resend APIキー
wrangler secret put RESEND_API_KEY

# 管理者パスワード
wrangler secret put ADMIN_PASSWORD
```

### 7. デプロイ

```bash
npm run deploy
```

## 開発

```bash
# ローカル開発サーバー (Secrets は .dev.vars ファイルに設定)
npm run dev
```

`.dev.vars` ファイル（ローカル開発用）:
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
RESEND_API_KEY=re_xxxxxxxx
ADMIN_PASSWORD=your-password
```

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/settings` | 公開設定取得 |
| GET | `/api/events?year=&month=` | 月のイベント取得 |
| GET | `/api/slots?date=YYYY-MM-DD` | 日の空きスロット |
| POST | `/api/bookings` | 予約作成 |
| POST | `/api/admin/login` | 管理者ログイン |
| GET | `/api/admin/settings` | 管理設定取得 |
| PUT | `/api/admin/settings` | 管理設定更新 |
| GET | `/api/admin/bookings` | 予約一覧 |

## コスト

全て無料枠内: $0/月
