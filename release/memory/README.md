# メモリー専用（予約と完全分離）

予約システムとは統合せず、LINEで送られてきた写真を `lineUserId` で紐づけて Drive に保存し、LIFFで履歴を表示するための独立セットです。

この配布セットは **Vercel不要（GAS単体で画面配信 + webhook + JSON APIを完結）** です。

---

## できること

- LINEトークに送られた `image` を受信
- `lineUserId` ごとに Google Drive フォルダへ保存
- スプレッドシートに保存ログを記録（保持期限・有効状態）
- LIFF画面で日付順に履歴（サムネ表示）
- 保存制限：最大4枚 / 1年（超過は保存しない）

---

## 構成

- GAS: `release/memory/gas/Code.gs`
- LIFF画面（GAS内HTML）: `release/memory/gas/MemoryPage.html`

---

## セットアップ手順（高レベル）

1. 新規 GAS プロジェクトを作成し、`Code.gs` と `MemoryPage.html` を貼り付け
2. スクリプトプロパティを設定（下表）
3. 初回だけ `setupMemorySheet_()` を実行してシート初期化
4. GASをウェブアプリとしてデプロイし `/exec` URL を控える
5. LINE Developers で「メモリー専用チャネル」を作成し
   - Webhook URL → `/exec`
   - LIFFエンドポイント → `/exec`
6. リッチメニューに `https://liff.line.me/{MEMORY_LIFF_ID}` を設定

---

## スクリプトプロパティ（必須）

| Key | 内容 |
| :--- | :--- |
| `MEMORY_LINE_ACCESS_TOKEN` | LINE Messaging API のチャネルアクセストークン（画像取得/返信/プロフィール取得に使用） |
| `MEMORY_DRIVE_FOLDER_ID` | 写真保存の親フォルダID |
| `MEMORY_SPREADSHEET_ID` | 保存ログ記録用スプレッドシートID |
| `MEMORY_LIFF_ID` | 作成したメモリーLIFF ID |

---

## ログ用シート

- シート名: `PhotoLog`
- 1行目はヘッダー（自動作成）

