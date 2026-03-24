# Google Apps Script（GAS）予約バックエンド

## コピペするファイル

**`Code.gs` だけ**を Google Apps Script に貼り付ければ動きます（複数ファイルに分割不要）。

手順の短文は `コピペのしかた.txt` も参照してください。

---

## あなたが用意・設定するもの

| 用意するもの | 必須？ | 説明 |
|-------------|--------|------|
| **Googleアカウント** | ✅ 必須 | 店舗用のGoogleアカウント（カレンダー・GASを共有する想定） |
| **GoogleカレンダーID** | ✅ 必須 | 予約を書き込むカレンダー（通常は「店舗用カレンダー」1本） |
| **スプレッドシートID** | 任意 | 予約ログを表で残したいとき。不要なら未設定でOK |
| **GASのウェブアプリURL** | ✅ 必須 | デプロイ後に発行される `https://script.google.com/macros/s/.../exec` |

### カレンダーIDの見つけ方

1. [Googleカレンダー](https://calendar.google.com/) を開く  
2. 左のカレンダー一覧で、予約用に使うカレンダーの **︙** → **設定と共有**  
3. 「カレンダーの統合」付近の **カレンダーID** をコピー  
   - メインカレンダーは `xxxx@gmail.com` の形式のこともあります（そのまま使えます）

### スプレッドシートIDの見つけ方（ログ用・任意）

1. 新しいスプレッドシートを作成  
2. ブラウザのURLが  
   `https://docs.google.com/spreadsheets/d/【ここがID】/edit`  
3. `【ここがID】` をコピー  

初回だけ、GASエディタで `setupSpreadsheetHeader` を実行すると、1行目に見出しが入ります。

---

## スクリプトのプロパティ（重要）

GASエディタで **プロジェクトの設定（歯車）** → **スクリプトのプロパティ** に次を追加します。

| プロパティ | 値の例 |
|-----------|--------|
| `CALENDAR_ID` | `xxxxx@gmail.com` または `xxxxxxxxxxxxx@group.calendar.google.com` |
| `SPREADSHEET_ID` | （任意）スプレッドシートのID。使わない場合は未登録でOK |

※ IDは **ソースコードに直書きせず**、プロパティに入れる運用を推奨します。

---

## GASへの貼り付け手順

1. [script.google.com](https://script.google.com/) で **新しいプロジェクト**  
2. デフォルトの `コード.gs` の中身を **すべて削除**  
3. このリポジトリの `gas/Code.gs` の内容を **そのまま貼り付け**  
4. **保存**（Ctrl+S）  
5. 左の **時計アイコン** で `setupSpreadsheetHeader` を選び、スプレッドシートを使う場合のみ **実行**（初回は権限承認が出ます）  
6. **デプロイ** → **新しいデプロイ**  
   - 種類: **ウェブアプリ**  
   - 説明: 任意（例: `v1`）  
   - **次のユーザーとして実行**: 自分  
   - **アクセスできるユーザー**:  
     - テスト: **自分のみ**  
     - 本番（LIFFから呼ぶ）: **全員**（匿名ユーザーを含む）  
7. **デプロイ** を押し、表示された **ウェブアプリのURL** をメモ  

---

## API（JSON）

### 1. ヘルスチェック

`GET` または `POST` のクエリ:

`?action=health`

### 2. 空き状況

**POST（推奨）** 本文例:

```json
{
  "action": "getAvailability",
  "date": "2026-03-21",
  "staffId": "staff-01",
  "durationMinutes": 60
}
```

`staffId`: `staff-00`（指名なし） / `staff-01`（山本） / `staff-02`（小川）

**GET（テスト用）:**

`?action=getAvailability&date=2026-03-21&staffId=staff-01&durationMinutes=60`

### 3. 予約作成

**POST** 本文例:

```json
{
  "action": "createReservation",
  "customerName": "田中 花子",
  "menuName": "カット",
  "durationMinutes": 45,
  "price": 4500,
  "staffId": "staff-01",
  "staffName": "山本 宏美",
  "date": "2026-03-21",
  "time": "11:00",
  "notes": "",
  "lineUserId": ""
}
```

指名なしのときは `staffId`: `"staff-00"`。空きのあるスタッフに自動割当します。

---

## カレンダー上の予約の見え方

- **タイトル例:** `[予約] カット / 山本 宏美 / 田中 花子`  
- **説明欄:** `reserve-app-v1` と `staffId:` など（空き判定に使用）

このスクリプトで作った予約だけを「予約アプリの予約」として扱います。手入力の予定は、説明に `reserve-app-v1` が無い限り **空き判定に使われません**（手動予定で枠が埋まる挙動にしたい場合は、後からロジック変更が必要です）。

---

## CORS（ブラウザから直接 fetch する場合）

Googleのウェブアプリは、環境によって **ブラウザからの `fetch` がCORSでブロック**されることがあります。

**おすすめ:** Next.js の **Route Handler（`app/api/...`）** でGASをサーバー側から呼び、フロントは自分のAPIだけ叩く。

---

## 次のステップ（Next.js側）— GAS 設定が終わったら

プロジェクトに **`app/api/reservations/route.ts`** と、フロントからの呼び出し **`lib/reservationApi.ts`** を用意済みです。

1. プロジェクト直下に **`.env.local`** を作成（`.env.example` をコピー可）  
2. **`GAS_WEBAPP_URL=`** の後に、デプロイしたウェブアプリのURL（`/exec` で終わるもの）を貼り付け  
3. **開発サーバーを一度止めてから** `npm run dev` を再起動（環境変数を読み直すため）  
4. ブラウザで **予約 → スタッフ・時間** で空き枠がGAS連動になるか確認  
5. **予約確認** で「この内容で予約する」→ **Googleカレンダー** と **スプレッドシート** に反映されるか確認  

接続に失敗したときは、時間選択画面に **黄色い注意** が出てダミー枠にフォールバックします。

これで **ブラウザのCORS** を気にせず呼べます。

---

## Messaging API（Gemini＝分類器／シート＝回答）を同時運用する

この `Code.gs` は、次の2種類のPOSTを自動判別します。

- 予約API: `{"action":"getAvailability" ... }` など
- LINE Webhook: `{"events":[ ... ]}`

つまり、**同じWebアプリURLで予約APIとMessaging APIを併用**できます。

### 返答の考え方（憶測で店舗案内を書かない）

- **Gemini** は「ユーザーが何の用件か」を **`intentId` 1つ** に分類するだけ（質問分類器）。
- **実際にユーザーに送る文章**は、必ず **`ChatRules` の `replyText` 列**（＋ `{{KNOW:…}}` 置換）から取得します。
- Gemini が `NONE` を返した・API失敗・キー未設定のときは、**キーワード列の部分一致**にフォールバックします。

### 追加で必要なスクリプトプロパティ

| プロパティ | 必須 | 用途 |
|-----------|------|------|
| `LINE_ACCESS_TOKEN` | ✅ | Messaging APIのチャネルアクセストークン（長期） |
| `MEMBER_PHOTO_DRIVE_FOLDER_ID` | ✅（写真運用時） | 会員証写真の保存先Google DriveフォルダID |
| `GEMINI_API_KEY` | 推奨 | 分類器として利用（未設定時はキーワード一致のみ） |
| `GEMINI_MODEL` | 任意 | 例: `gemini-1.5-flash`（未設定時は `gemini-1.5-flash`） |
| `LINE_USE_GEMINI_CLASSIFIER` | 任意 | `FALSE` のとき、キーワード一致のみ（APIキーがあっても分類に使わない） |
| `ADMIN_LINE_ID` | 任意 | `ChatRules` の `alertStaff` が TRUE のとき、スタッフへ Push 通知 |
| `CHAT_FALLBACK_REPLY` | 任意 | 分類もキーワードも当たらないときの定型文（未設定時はコード内デフォルト） |

### シート構成（自動作成）

GASエディタで `setupLineQaSheets` を1回実行すると作られます（サンプル行付き）。

| シート | 内容 |
|--------|------|
| `ChatRules` | **優先度**・**intentId（分類のID・一意推奨）**・**keywords（店主用キーワード群。Geminiのヒントにも使う）**・**replyText（返答本文）**・`onlyWhenStep`・`nextStep`・`alertStaff` |
| `ChatState` | ユーザーごとの現在ステップ（チャットフロー用） |
| `Knowledge` | `key` / `rule`。返答に `{{KNOW:キー}}` と書くと `rule` に置換 |
| `Customer` | 顧客名・メモ（手運用・将来拡張用） |
| `Log` | 会話ログ（横持ち） |
| `ErrorLog` | 失敗イベント |
| `MemberPhotoLog` | 会員証写真の保存ログ（LINE userId、保存日、失効日、Drive File ID） |

#### `ChatRules` 列の意味

- **intentId**: Gemini が返す ID。**英数字とアンダースコア推奨**。同じステップ内で重複しないようにしてください。
- **keywords**: 例 `予約したい,枠,空いてるか` のように書くと、**分類プロンプトに「店主の意図のヒント」として載り**、言い換えにも強くなります。フォールバック時は従来どおり **部分一致** にも使います。
- **replyText**: LINE に送る本文（ここに書いたもの以外は、モデルが勝手に生成しません）。
- **priority**: キーワード **フォールバック** のとき、小さい行から評価。
- **onlyWhenStep** / **nextStep** / **alertStaff**: 従来どおり（ステップ付きフロー・スタッフ通知）。

初期ステップは **`START`** です。

### LINE Developers 側設定

1. 対象チャネルで **Messaging API** を有効化
2. Webhook URL に `https://script.google.com/macros/s/.../exec` を設定
3. 「Webhookの利用」をON
4. 「検証」実行で200が返ることを確認

### 動作イメージ

1. ユーザーがテキスト送信
2. `GEMINI_API_KEY` があり無効化されていなければ、**現在ステップで有効な行**の `intentId` と `keywords` を一覧にして Gemini に渡し、**JSON で `intentId` だけ**返させる
3. 返ってきた `intentId` に対応する行の **`replyText`** を送る（`{{KNOW:…}}` を置換）
4. `NONE`・パース失敗・該当行なしのときは、**キーワード部分一致**で再度ルール探索
5. それでも無ければ **フォールバック定型文**
6. `alertStaff` / `nextStep` / `Log` は従来どおり

---

## 会員証写真（LINE画像 -> Drive保存）

お客様がLINEトークで画像を送ると、`lineUserId` に紐づけてGoogle Driveへ保存します。

- 保存上限: **1ユーザーあたり直近1年で4枚**
- 保持期間: **1年（365日）**
- 保存時に `MemberPhotoLog` に記録
- 期限切れは次回画像受信時に自動クリーンアップ（Driveファイルをゴミ箱へ移動し、`status=EXPIRED`）
- 保存先は `MEMBER_PHOTO_DRIVE_FOLDER_ID` で指定した親フォルダ配下に、`lineUserId_表示名` のユーザーフォルダを自動作成

### 運用メモ

- スタッフ操作は不要です。お客様が店内/自宅どちらで撮って送っても保存されます。
- 写真は `MEMBER_PHOTO_DRIVE_FOLDER_ID` で指定したフォルダに保存されます。
- LINE上の「送信者=会員本人」のため、紐づけは自動です。
