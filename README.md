# SWH Upload Image API

Node.js + Express + MongoDB 圖片上傳 API。上傳後回傳圖片 URL 與 QR Code URL，檔案僅保留 **2 小時**。需 JWT 登入（access token **7 天**，過期用 refresh token 換新）。

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 複製環境變數（已有 .env 可略過）
cp .env.example .env

# 3. 確認 MongoDB 已啟動，然後建立測試帳號
npm run seed
# 或自訂：node src/scripts/seedUser.js myuser mypassword

# 4. 啟動
npm run dev
```

## API

### Auth

| Method | Path | Auth | 說明 |
|--------|------|------|------|
| POST | `/api/auth/register` | 否 | 註冊 |
| POST | `/api/auth/login` | 否 | 登入 |
| POST | `/api/auth/refresh` | 否 | Access token 過期後刷新 |
| POST | `/api/auth/logout` | Bearer | 登出（撤銷 refresh token） |

**Login**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

回應：

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "admin" },
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": "7d"
  }
}
```

**Refresh（access token 過期時）**

當 API 回傳 `code: "TOKEN_EXPIRED"`，client 應呼叫：

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<your-refresh-token>"}'
```

### Upload

| Method | Path | Auth | 說明 |
|--------|------|------|------|
| POST | `/api/upload` | Bearer | 上傳圖片（form field: `image`） |
| GET | `/api/upload/:id` | Bearer | 查詢上傳記錄 |

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "image=@./photo.jpg"
```

回應：

```json
{
  "success": true,
  "data": {
    "id": "...",
    "imageUrl": "http://localhost:3000/files/<uuid>.jpg",
    "qrcodeUrl": "http://localhost:3000/files/<uuid>-qr.png",
    "expiresAt": "2026-10-13T09:54:00.000Z",
    "ttlHours": 2
  }
}
```

靜態檔案路徑：`GET /files/<filename>`（公開，但 2 小時後會被清理）。

## 時限設計

| 項目 | 時限 |
|------|------|
| Access Token (JWT) | 7 天 |
| Refresh Token | 30 天 |
| 圖片 / QR Code | 2 小時 |

- MongoDB 對 `Upload.expiresAt` 使用 TTL index，過期自動刪 DB 記錄。
- 背景 job 每 10 分鐘清理磁碟上的過期／孤立檔案。

## 環境變數

見 `.env.example`。Production 請設：

```env
BASE_URL=https://swhimage.ice-solution.hk
```

## Apache2 + Cloudflare Flexible

Domain: `swhimage.ice-solution.hk`  
Cloudflare SSL/TLS mode: **Flexible**（瀏覽器 HTTPS → Cloudflare → origin HTTP :80）

```bash
sudo a2enmod proxy proxy_http headers rewrite
sudo cp deploy/apache/swhimage.ice-solution.hk.conf /etc/apache2/sites-available/
sudo a2ensite swhimage.ice-solution.hk.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Node 需 listen `127.0.0.1:3000`（可用 pm2 / systemd）。VirtualHost 會設 `X-Forwarded-Proto: https`，App 已 `trust proxy`。

## Postman

匯入：

- `postman/SWH_Upload_Image.postman_collection.json`
- `postman/SWH_Upload_Image.postman_environment.json`（production）
- 或 `postman/SWH_Upload_Image.local.postman_environment.json`（本機）

建議順序：`Login` → `Upload Image`（選檔案欄位 `image`）→ `Open Image URL` / `Open QR Code URL`。  
若收到 `TOKEN_EXPIRED`，先跑 `Refresh Token` 再重試。
