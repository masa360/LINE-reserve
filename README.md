# LINE LIFF 予約アプリ（美容室）

Next.js（App Router）+ Tailwind CSS + Google Apps Script（カレンダー／スプレッドシート）+ **LINE LIFF**。

## 開発

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 環境変数

`.env.example` をコピーして `.env.local` を作成してください。

| 変数 | 必須 | 説明 |
|------|------|------|
| `GAS_WEBAPP_URL` | 本番では推奨 | GAS ウェブアプリの URL（`/exec`） |
| `NEXT_PUBLIC_LIFF_ID` | LINE 連携時 | LINE Developers の LIFF ID |

## Vercel デプロイ × LINE 連携

**手順の全文は [`docs/DEPLOY_VERCEL_LINE.md`](./docs/DEPLOY_VERCEL_LINE.md) を参照してください。**

ざっくり流れ:

1. GitHub に push 済みのリポジトリを [Vercel](https://vercel.com/) で Import
2. 環境変数 `GAS_WEBAPP_URL` と `NEXT_PUBLIC_LIFF_ID` を設定してデプロイ
3. LINE Developers で LIFF を作成し、**Endpoint URL** に Vercel の URL（`https://...`）を登録
4. LIFF URL（`https://liff.line.me/＜LIFF_ID＞`）を LINE のメニュー等に貼る

## その他

- GAS コード: `gas/Code.gs`
- プロキシ API: `app/api/reservations/route.ts`
