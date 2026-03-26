# メモリー表示専用（Vercel）

**保存・Webhook・スプレッドシートはすべて既存の `gas/Code.gs`（1本のGAS）のまま。**  
ここは **写真一覧の LIFF 画面だけ** を載せる薄い Next.js です。

## 役割

| コンポーネント | 役割 |
|----------------|------|
| GAS `Code.gs` | 画像受信・Drive保存・`MemberPhotoLog`・`GET ?action=photos` |
| 本プロジェクト（Vercel） | LIFF でログイン → `/api/photos` が GAS にプロキシ → グリッド表示 |
| スプレッドシート | **新規作成不要**（既存の `SPREADSHEET_ID` の `MemberPhotoLog` をそのまま使用） |

## 環境変数（Vercel）

| 変数 | 必須 | 説明 |
|------|------|------|
| `GAS_WEBAPP_URL` | ✅ | 既存 GAS の `/exec`（予約アプリと同じ URL でよい） |
| `NEXT_PUBLIC_LIFF_ID` | ✅ | **メモリー用** LIFF ID（予約LIFFとは別に作成推奨） |

## LINE Developers

1. **メモリー用 LIFF** を追加  
   - エンドポイントURL: `https://（このプロジェクトのVercelドメイン）/`  
   - スコープ: `profile`
2. リッチメニュー「メモリー」→ `https://liff.line.me/{メモリーLIFF_ID}`

## ローカル

```bash
cd memory-viewer
cp .env.example .env.local
# .env.local を編集
npm install
npm run dev
```

ポートは `3001`（予約アプリと並行しやすいように）

## GAS 側メモ

- メモリーLIFF を **Vercel に切り替えた後**も、`Code.gs` の `doGet` で `action` なしのときは従来どおり `MemoryPage.html` を返します（**LIFFのエンドポイントをVercelに変えれば使われません**）。
- `MEMORY_LIFF_ID` は GAS の `MemoryPage.html` を使うときだけ必要です。**Vercel版メモリーのみなら GAS に無くても動きます**（ただし害はないので残しても可）。

## Vercel プロジェクトの作り方

1. New Project → 同一 GitHub リポジトリを import  
2. **Root Directory** を `memory-viewer` に設定  
3. 環境変数を設定して Deploy  
