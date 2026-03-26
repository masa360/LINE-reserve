# Vercel デプロイ × LINE（LIFF）連携手順

このプロジェクトは [Next.js](https://nextjs.org/) と [LINE LIFF](https://developers.line.biz/ja/docs/liff/overview/) を組み合わせて使います。

---

## 全体の流れ

1. **GitHub** にコードを push（済みならスキップ）
2. **Vercel** で GitHub リポジトリをインポートしてデプロイ
3. **Vercel** に環境変数を設定
4. **LINE Developers** で LIFF アプリを作成し、Vercel の URL を登録
5. **LINE** のリッチメニュー等から LIFF URL を開いて動作確認

---

## 1. Vercel でデプロイする

1. [Vercel](https://vercel.com/) にログイン（GitHub アカウント連携推奨）
2. **Add New… → Project**
3. **Import** でリポジトリ `masa360/LINE-reserve`（あなたのリポジトリ名）を選択
4. **Framework Preset**: Next.js のまま
5. **Environment Variables** で次を追加（値は後からでも可）

| Name | 値の例 | 説明 |
|------|--------|------|
| `GAS_WEBAPP_URL` | `https://script.google.com/macros/s/.../exec` | GAS ウェブアプリ URL（**秘密**） |
| `NEXT_PUBLIC_LIFF_ID` | `1234567890-xxxx` | LIFF ID（**公開されてよい**） |

6. **Deploy** をクリック

デプロイ完了後、**Production URL**（例: `https://line-reserve-xxxxx.vercel.app`）をメモします。次の LINE 設定で使います。

---

## 2. LINE Developers の準備

### 2.1 プロバイダー・チャネル

1. [LINE Developers コンソール](https://developers.line.biz/console/) にログイン
2. まだなら **プロバイダー** を作成
3. **チャネル** を作成する場合は **LINEログイン**（または Messaging API と兼用）を選択  
   - LIFF だけなら **LINEログイン** チャネルで可

### 2.2 LIFF アプリの作成

1. 対象チャネルの **LIFF** タブを開く
2. **追加** で LIFF アプリを作成

| 項目 | 設定例 |
|------|--------|
| LIFF アプリ名 | 予約（任意） |
| サイズ | **Full** 推奨 |
| Endpoint URL | `https://あなたのプロジェクト.vercel.app` （**末尾スラッシュなし**で統一） |
| Scope | `profile`, `openid`（必要に応じて） |

3. 保存後、表示される **LIFF ID** をコピー

### 2.3 友だち追加・テスト

- チャネル用の QR や URL から **公式アカウント／ボットを友だち追加** しておくと、LIFF からの動作確認がしやすいです（設定による）。

---

## 3. Vercel に環境変数を入れる（再設定）

1. Vercel → 該当プロジェクト → **Settings** → **Environment Variables**
2. 追加または更新:

```
GAS_WEBAPP_URL = （GAS のデプロイ URL）
NEXT_PUBLIC_LIFF_ID = （LINE Developers に表示された LIFF ID）
```

3. **Save** 後、**Deployments** で **Redeploy**（環境変数変更後は再デプロイが必要）

---

## 4. LINE 側の URL 確認

- LIFF の **Endpoint URL** は、必ず **Vercel の本番 URL（https）** と一致させる
- パス付きで公開する場合は `https://xxx.vercel.app/reservation` のように **実際に開く URL** を登録する

---

## 5. 動作確認のしかた

1. スマホの **LINE** で、リッチメニューやメッセージに設定した **LIFF URL** を開く  
   - LIFF URL の形式: `https://liff.line.me/＜LIFF_ID＞`
2. 予約フローで **予約確定** → GAS のスプレッドシートの **`LINEユーザーID`** 列に値が入れば連携成功

※ PC ブラウザで Vercel の URL を直接開いた場合、LIFF ではないため `profile` は取れないことがあります（`NEXT_PUBLIC_LIFF_ID` 未設定時と同様に、予約だけは可能）。

---

## トラブルシューティング

| 現象 | 確認すること |
|------|----------------|
| 真っ白・LIFF エラー | Endpoint URL が Vercel の URL と完全一致しているか |
| 401 / Invalid LIFF | LIFF ID の typo、別チャネルの ID になっていないか |
| GAS に届かない | `GAS_WEBAPP_URL` が Vercel に設定されているか、再デプロイしたか |
| ローカルでは動くが本番で失敗 | 環境変数が **Production** に入っているか |

---

## 参考リンク

- [Vercel に Next.js をデプロイする](https://vercel.com/docs/frameworks/nextjs)
- [LIFF アプリを作成する](https://developers.line.biz/ja/docs/liff/registering-liff-apps/)
- GitHub リポジトリ例: [masa360/LINE-reserve](https://github.com/masa360/LINE-reserve)
