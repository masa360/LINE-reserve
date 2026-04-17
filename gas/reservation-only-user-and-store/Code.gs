/**
 * ============================================================
 * 予約専用 GAS（ユーザー LIFF・店舗 store-booking どちらからも利用可）
 *
 * リポジトリ上の配置: gas/reservation-only-user-and-store/Code.gs
 * （店舗アプリ用の説明は store-booking/gas/README.md、目印は gas/Code_reservation_only*.gs）
 *
 * LINE Webhook・メモリー・Gemini チャットは含みません。
 * Git 上はこの 1 ファイルが正本。Google 上では「ユーザー用」「店舗用」で
 * GAS プロジェクトやデプロイ URL を分けてもよい（貼る中身は同じで可）。
 *
 * 機能:
 * - getAvailability: 空き枠取得
 * - createReservation: 予約作成（1 カレンダーへ登録 + Reservations シート）
 * - listStoreCustomers: 店舗用・顧客一覧（StoreCustomers + 前回来店）
 * - registerStoreCustomer: 店舗用・新規顧客 1 行追加
 * - health: ヘルスチェック
 * - setupSpreadsheetHeader: ログシート初期化（1 枚目シート用）
 * - setupStoreBookingSheets: StoreCustomers / Reservations ヘッダ準備
 *
 * 必須スクリプトプロパティ:
 * - CALENDAR_ID
 *
 * 任意スクリプトプロパティ:
 * - SPREADSHEET_ID（予約ログ・店舗顧客を使う場合）
 * ============================================================
 */

var TZ = 'Asia/Tokyo';

var PROP_KEYS = {
  CALENDAR_ID: 'CALENDAR_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
};

var BUSINESS_START_HOUR = 10;
var BUSINESS_CLOSE_HOUR = 20;
var RESERVE_MARKER = 'reserve-app-v1';

var STAFF_IDS = {
  ANY: 'staff-00',
  YAMAMOTO: 'staff-01',
  OGAWA: 'staff-02',
};

/** スタッフ勤務シフト（早番/遅番） */
var STAFF_SHIFTS = {
  'staff-00': { start: '10:00', end: '20:00' }, // 指名なし
  'staff-01': { start: '10:00', end: '17:00' }, // 早番
  'staff-02': { start: '13:00', end: '20:00' }, // 遅番
};

// ------------------------------------------------------------
// エントリポイント
// ------------------------------------------------------------

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action) {
    return HtmlService.createTemplateFromFile('StoreBookingPage')
      .evaluate()
      .setTitle('店舗予約入力')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return handleRequest_(e && e.parameter, null);
}

function doPost(e) {
  var payload = null;
  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return jsonResponse_(400, { success: false, error: 'JSONの解析に失敗しました' });
  }
  return handleRequest_(e && e.parameter, payload);
}

function handleRequest_(query, body) {
  var action = (body && body.action) || (query && query.action);
  if (!action) {
    return jsonResponse_(400, { success: false, error: 'action が指定されていません' });
  }

  try {
    if (action === 'getAvailability') {
      var date = (body && body.date) || (query && query.date);
      var staffId = (body && body.staffId) || (query && query.staffId);
      var durationMinutes = parseInt(
        (body && body.durationMinutes) || (query && query.durationMinutes) || '60',
        10
      );
      if (!date || !staffId) {
        return jsonResponse_(400, { success: false, error: 'date と staffId は必須です' });
      }
      var slots = getAvailability_(date, staffId, durationMinutes);
      return jsonResponse_(200, { success: true, slots: slots });
    }

    if (action === 'createReservation') {
      if (!body) {
        return jsonResponse_(400, { success: false, error: 'POST本文が空です' });
      }
      var result = createReservation_(body);
      return jsonResponse_(200, result);
    }

    if (action === 'listStoreCustomers') {
      try {
        var listResult = listStoreCustomers_();
        return jsonResponse_(200, listResult);
      } catch (errList) {
        return jsonResponse_(500, { success: false, error: errList.message || String(errList) });
      }
    }

    if (action === 'registerStoreCustomer') {
      if (!body) {
        return jsonResponse_(400, { success: false, error: 'POST本文が空です' });
      }
      try {
        var regResult = registerStoreCustomer_(body);
        return jsonResponse_(200, regResult);
      } catch (errReg) {
        return jsonResponse_(500, { success: false, error: errReg.message || String(errReg) });
      }
    }

    if (action === 'getCancellableReservations') {
      if (!body) {
        return jsonResponse_(400, { success: false, error: 'POST本文が空です' });
      }
      try {
        var cancelResult = getCancellableReservations_(body);
        return jsonResponse_(200, cancelResult);
      } catch (errCancel) {
        return jsonResponse_(500, { success: false, error: errCancel.message || String(errCancel) });
      }
    }

    if (action === 'cancelReservation') {
      if (!body) {
        return jsonResponse_(400, { success: false, error: 'POST本文が空です' });
      }
      try {
        var cancelRes = cancelReservation_(body);
        return jsonResponse_(200, cancelRes);
      } catch (errCancel) {
        return jsonResponse_(500, { success: false, error: errCancel.message || String(errCancel) });
      }
    }

    if (action === 'health') {
      return jsonResponse_(200, { success: true, message: 'ok', ts: new Date().toISOString() });
    }

    return jsonResponse_(400, { success: false, error: '不明な action です: ' + action });
  } catch (err) {
    return jsonResponse_(500, { success: false, error: err.message || String(err) });
  }
}

// ------------------------------------------------------------
// 設定取得
// ------------------------------------------------------------

function getCalendarId_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.CALENDAR_ID);
  if (!id || id === '') {
    throw new Error('CALENDAR_ID が未設定です');
  }
  return id;
}

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SPREADSHEET_ID) || '';
}

function getCalendar_() {
  var id = getCalendarId_();
  var cal = CalendarApp.getCalendarById(id);
  if (!cal) {
    throw new Error('カレンダーが見つかりません（ID: ' + id + '）。カレンダーの共有設定を確認してください');
  }
  return cal;
}

// ------------------------------------------------------------
// 空き状況
// ------------------------------------------------------------

function getAvailability_(dateStr, staffId, durationMinutes) {
  var calendar = getCalendar_();
  var dayRange = getDayRange_(dateStr);
  var events = calendar.getEvents(dayRange.start, dayRange.end);
  // 枠ごとに全イベントを走査しない（1回だけ有効予約を数値化 → 各枠は比較のみ）
  var blocks = buildActiveReserveBlocks_(events);

  var slotStarts = buildSlotStarts_(dateStr);
  var slots = [];

  for (var i = 0; i < slotStarts.length; i++) {
    var slotStart = slotStarts[i];
    var slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    // 営業時間外に終了する枠は不可
    if (slotEnd.getHours() * 60 + slotEnd.getMinutes() > BUSINESS_CLOSE_HOUR * 60) {
      slots.push({ time: formatTime_(slotStart), available: false });
      continue;
    }

    // スタッフのシフト時間外は不可
    if (staffId !== STAFF_IDS.ANY && !isWithinStaffShift_(staffId, slotStart, slotEnd)) {
      slots.push({ time: formatTime_(slotStart), available: false });
      continue;
    }

    var rs = slotStart.getTime();
    var re = slotEnd.getTime();
    var available = isRangeFreeFromBlocks_(blocks, staffId, rs, re);
    slots.push({ time: formatTime_(slotStart), available: available });
  }
  return slots;
}

/**
 * 予約開始枠（30分刻み）10:00〜19:00（19:30開始はなし）
 */
function buildSlotStarts_(dateStr) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0], 10);
  var mo = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  var list = [];

  for (var hour = BUSINESS_START_HOUR; hour <= 19; hour++) {
    for (var min = 0; min < 60; min += 30) {
      if (hour === 19 && min === 30) break;
      list.push(new Date(y, mo - 1, d, hour, min, 0));
    }
  }
  return list;
}

function getDayRange_(dateStr) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59),
  };
}

function formatTime_(date) {
  return pad2_(date.getHours()) + ':' + pad2_(date.getMinutes());
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function isSlotAvailable_(events, staffId, rangeStart, rangeEnd) {
  var blocks = buildActiveReserveBlocks_(events);
  return isRangeFreeFromBlocks_(blocks, staffId, rangeStart.getTime(), rangeEnd.getTime());
}

// ------------------------------------------------------------
// シフト判定
// ------------------------------------------------------------

function getStaffShift_(staffId) {
  return STAFF_SHIFTS[staffId] || STAFF_SHIFTS[STAFF_IDS.ANY];
}

function parseTimeToMinutes_(timeStr) {
  var p = String(timeStr || '00:00').split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function isWithinStaffShift_(staffId, rangeStart, rangeEnd) {
  var shift = getStaffShift_(staffId);
  var startMin = parseTimeToMinutes_(shift.start);
  var endMin = parseTimeToMinutes_(shift.end);
  var slotStartMin = rangeStart.getHours() * 60 + rangeStart.getMinutes();
  var slotEndMin = rangeEnd.getHours() * 60 + rangeEnd.getMinutes();
  return slotStartMin >= startMin && slotEndMin <= endMin;
}

/**
 * カレンダーイベントから有効予約のみを一度パースし、ms 時刻で保持する
 */
function buildActiveReserveBlocks_(events) {
  var blocks = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!isActiveReserveEvent_(ev)) continue;
    var sid = extractStaffId_(ev);
    if (!sid) continue;
    blocks.push({
      staffId: sid,
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime(),
    });
  }
  return blocks;
}

function hasOverlapBlocksForStaff_(blocks, staffId, rangeStartMs, rangeEndMs) {
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.staffId !== staffId) continue;
    if (b.start < rangeEndMs && b.end > rangeStartMs) return true;
  }
  return false;
}

/** 指名なしは両スタッフ枠がともに埋まっているとき不可 */
function isRangeFreeFromBlocks_(blocks, staffId, rangeStartMs, rangeEndMs) {
  if (staffId === STAFF_IDS.ANY) {
    var busy1 = hasOverlapBlocksForStaff_(
      blocks,
      STAFF_IDS.YAMAMOTO,
      rangeStartMs,
      rangeEndMs,
    );
    var busy2 = hasOverlapBlocksForStaff_(blocks, STAFF_IDS.OGAWA, rangeStartMs, rangeEndMs);
    return !(busy1 && busy2);
  }
  return !hasOverlapBlocksForStaff_(blocks, staffId, rangeStartMs, rangeEndMs);
}

function isReserveEvent_(ev) {
  var desc = ev.getDescription() || '';
  return desc.indexOf(RESERVE_MARKER) !== -1;
}

function extractStaffId_(ev) {
  var desc = ev.getDescription() || '';
  var lines = desc.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('staffId:') === 0) {
      return lines[i].replace('staffId:', '').trim();
    }
  }
  return '';
}

/** 説明欄の `fieldName:値` 形式を読む（本家 Code.gs と同型） */
function extractDescField_(ev, fieldName) {
  var desc = ev.getDescription() || '';
  var lines = desc.split(/\r?\n/);
  var prefix = fieldName + ':';
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(prefix) === 0) {
      return lines[i].substring(prefix.length).trim();
    }
  }
  return '';
}

/**
 * オンライン取消などで無効化された予約（枠は空きとして扱う）
 * タイトル [キャンセル] または description の status:cancelled
 */
function isCancelledReserveEvent_(ev) {
  var title = ev.getTitle() || '';
  if (title.indexOf('[キャンセル]') !== -1) return true;
  if (extractDescField_(ev, 'status') === 'cancelled') return true;
  return false;
}

/** 空き判定・重複チェック用（キャンセル済みは含めない） */
function isActiveReserveEvent_(ev) {
  return isReserveEvent_(ev) && !isCancelledReserveEvent_(ev);
}

function filterReserveEvents_(events) {
  var out = [];
  for (var i = 0; i < events.length; i++) {
    if (isActiveReserveEvent_(events[i])) out.push(events[i]);
  }
  return out;
}

// ------------------------------------------------------------
// 予約作成
// ------------------------------------------------------------

function createReservation_(body) {
  var calendar = getCalendar_();

  var customerName = body.customerName || '';
  var menuName = body.menuName || '';
  var durationMinutes = parseInt(body.durationMinutes || '60', 10);
  var price = body.price != null ? body.price : '';
  var staffId = body.staffId || STAFF_IDS.ANY;
  var staffName = body.staffName || '';
  var dateStr = body.date;
  var timeStr = body.time;
  var notes = body.notes || '';
  var lineUserId = body.lineUserId || '';
  var lineDisplayName = body.lineDisplayName || '';
  var customerId = String(body.customerId || '').trim();
  var birthday = String(body.birthday || '').trim();

  if (!dateStr || !timeStr || !menuName || !customerName) {
    throw new Error('customerName, date, time, menuName は必須です');
  }

  var start = parseDateTime_(dateStr, timeStr);
  var end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  var dayRange = getDayRange_(dateStr);
  var events = calendar.getEvents(dayRange.start, dayRange.end);

  var assignedStaffId = staffId;
  if (staffId === STAFF_IDS.ANY) {
    assignedStaffId = pickAvailableStaff_(events, start, end);
    if (!assignedStaffId) {
      throw new Error('この時間帯は指名なしでも空きがありません');
    }
  } else {
    if (!isWithinStaffShift_(staffId, start, end)) {
      throw new Error('担当スタッフの勤務時間外のため予約できません');
    }
    if (!isSlotAvailable_(events, staffId, start, end)) {
      throw new Error('この時間帯はすでに予約が入っています');
    }
  }

  var assignedStaffName = staffName;
  if (staffId === STAFF_IDS.ANY) {
    assignedStaffName = assignedStaffId === STAFF_IDS.YAMAMOTO ? '山本 宏美' : '小川 あずさ';
  }

  var title = '[予約] ' + menuName + ' / ' + assignedStaffName + ' / ' + customerName;
  var description = buildDescription_({
    staffId: assignedStaffId,
    staffName: assignedStaffName,
    customerName: customerName,
    menuName: menuName,
    price: price,
    notes: notes,
    lineUserId: lineUserId,
    lineDisplayName: lineDisplayName,
    durationMinutes: durationMinutes,
    customerId: customerId,
    birthday: birthday,
  });

  var event = calendar.createEvent(title, start, end, { description: description });

  appendToReservationsSheet_({
    createdAt: new Date(),
    eventId: event.getId(),
    date: dateStr,
    time: timeStr,
    customerName: customerName,
    menuName: menuName,
    staffId: assignedStaffId,
    staffName: assignedStaffName,
    price: price,
    notes: notes,
    lineUserId: lineUserId,
    lineDisplayName: lineDisplayName,
    customerId: customerId,
    birthday: birthday,
  });

  return {
    success: true,
    eventId: event.getId(),
    assignedStaffId: assignedStaffId,
    assignedStaffName: assignedStaffName,
  };
}

function pickAvailableStaff_(events, rangeStart, rangeEnd) {
  var blocks = buildActiveReserveBlocks_(events);
  var rs = rangeStart.getTime();
  var re = rangeEnd.getTime();
  var tryOrder = [STAFF_IDS.YAMAMOTO, STAFF_IDS.OGAWA];
  for (var i = 0; i < tryOrder.length; i++) {
    var sid = tryOrder[i];
    if (!isWithinStaffShift_(sid, rangeStart, rangeEnd)) continue;
    if (!hasOverlapBlocksForStaff_(blocks, sid, rs, re)) return sid;
  }
  return null;
}

function parseDateTime_(dateStr, timeStr) {
  var dp = dateStr.split('-');
  var tp = timeStr.split(':');
  var y = parseInt(dp[0], 10);
  var mo = parseInt(dp[1], 10);
  var d = parseInt(dp[2], 10);
  var h = parseInt(tp[0], 10);
  var m = parseInt(tp[1], 10);
  return new Date(y, mo - 1, d, h, m, 0);
}

function buildDescription_(data) {
  var isLine = !!data.lineUserId;
  var notesDisplay = data.notes ? data.notes : '（なし）';
  var priceDisplay = data.price ? '¥' + Number(data.price).toLocaleString('ja-JP') : '—';

  // ---- 人間が読むセクション ----
  var human = [];
  if (isLine) {
    human.push('■ LINE予約（自動登録）');
    human.push('');
    human.push('お客様名（予約フォーム）　' + data.customerName);
    human.push('LINEアカウント表示名　　　' + data.lineDisplayName);
    human.push('LINEユーザーID　　　　　　' + data.lineUserId);
  } else {
    human.push('■ 店舗予約（店頭登録）');
    human.push('');
    human.push('お客様名　　　　　　　　　' + data.customerName);
    if (data.customerId) {
      human.push('顧客ID　　　　　　　　　　' + data.customerId);
    }
  }
  human.push('メニュー　　　　　　　　　' + data.menuName);
  human.push('所要時間　　　　　　　　　' + data.durationMinutes + '分');
  human.push('料金（目安）　　　　　　　' + priceDisplay);
  if (data.birthday) {
    human.push('誕生日　　　　　　　　　　' + data.birthday);
  }
  human.push('ご要望・メモ　　　　　　　' + notesDisplay);
  human.push('担当スタッフ　　　　　　　' + (data.staffName || '—'));

  // ---- 機械読み取りセクション ----
  var separator = '────────────────────────';
  var machineNote = '※下記の英字「キー:値」の行は予約アプリ連携用です。削除しないでください。';
  var machine = [
    RESERVE_MARKER,
    'staffId:' + data.staffId,
    'staffName:' + (data.staffName || ''),
    'customerName:' + data.customerName,
    'menuName:' + data.menuName,
    'price:' + (data.price || ''),
    'durationMinutes:' + data.durationMinutes,
    'notes:' + (data.notes || ''),
    'lineUserId:' + (data.lineUserId || ''),
    'lineDisplayName:' + (data.lineDisplayName || ''),
    'customerId:' + (data.customerId || ''),
    'birthday:' + (data.birthday || ''),
  ];

  return human.join('\n') + '\n\n' + separator + '\n' + machineNote + '\n' + machine.join('\n');
}

// ------------------------------------------------------------
// スプレッドシート（任意）
// ------------------------------------------------------------

function getSpreadsheet_() {
  var ssId = getSpreadsheetId_();
  if (!ssId) throw new Error('SPREADSHEET_ID が未設定です');
  return SpreadsheetApp.openById(ssId);
}

function getOrCreateSheet_(name, header) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 && header && header.length > 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sheet;
}

function appendToReservationsSheet_(row) {
  var ssId = getSpreadsheetId_();
  if (!ssId) return;

  var sheet = getOrCreateSheet_('Reservations', [
    '作成日時',
    'イベントID',
    '予約日',
    '開始時刻',
    'お客様名',
    'メニュー',
    'スタッフID',
    'スタッフ名',
    '料金',
    'ご要望',
    'LINEユーザーID',
    'LINE表示名',
    '顧客ID',
    '誕生日',
  ]);

  sheet.appendRow([
    formatSheetsDateTime_(row.createdAt),
    row.eventId,
    row.date,
    row.time,
    row.customerName,
    row.menuName,
    row.staffId,
    row.staffName,
    row.price,
    row.notes,
    row.lineUserId,
    row.lineDisplayName,
    row.customerId || '',
    row.birthday || '',
  ]);
}

function formatSheetsDateTime_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss');
}

// ------------------------------------------------------------
// 共通
// ------------------------------------------------------------

function jsonResponse_(status, obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ------------------------------------------------------------
// 初期化
// ------------------------------------------------------------

function setupSpreadsheetHeader() {
  var ssId = getSpreadsheetId_();
  if (!ssId) throw new Error('SPREADSHEET_ID が未設定です');
  var sheet = SpreadsheetApp.openById(ssId).getSheets()[0];
  sheet.getRange(1, 1, 1, 12).setValues([
    [
      '作成日時',
      'イベントID',
      '予約日',
      '開始時刻',
      'お客様名',
      'メニュー',
      'スタッフID',
      'スタッフ名',
      '料金',
      'ご要望',
      'LINEユーザーID',
      'LINE表示名',
    ],
  ]);
}

function initApp() {
  CalendarApp.getAllCalendars();
  var ssId = getSpreadsheetId_();
  if (ssId) SpreadsheetApp.openById(ssId);
}

// ------------------------------------------------------------
// 店舗予約（store-booking）用
// ------------------------------------------------------------

/**
 * StoreCustomers シートと Reservations（13列目=顧客ID）のヘッダを用意する
 */
function setupStoreBookingSheets() {
  if (!getSpreadsheetId_()) throw new Error('SPREADSHEET_ID が未設定です');
  getOrCreateSheet_('StoreCustomers', [
    'customerId',
    'displayName',
    'searchKana',
    'phone',
    'createdAt',
    'updatedAt',
  ]);
  getOrCreateSheet_('Reservations', [
    '作成日時',
    'イベントID',
    '予約日',
    '開始時刻',
    'お客様名',
    'メニュー',
    'スタッフID',
    'スタッフ名',
    '料金',
    'ご要望',
    'LINEユーザーID',
    'LINE表示名',
    '顧客ID',
  ]);
}

function normalizeReservationDateCell_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return String(v).replace(/\//g, '-').trim();
}

/**
 * Reservations を下から走査し、顧客 ID 優先、なければ表示名で最新 1 件を返す
 */
function findLastReservationForCustomer_(customerId, displayName) {
  if (!getSpreadsheetId_()) return null;
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName('Reservations');
  if (!sheet || sheet.getLastRow() < 2) return null;
  var lastRow = sheet.getLastRow();
  var numCols = Math.max(sheet.getLastColumn(), 13);
  var data = sheet.getRange(2, 1, lastRow, numCols).getValues();
  var cid = String(customerId || '').trim();
  var dname = String(displayName || '').trim();

  for (var r = data.length - 1; r >= 0; r--) {
    var row = data[r];
    var rowCustId = row.length >= 13 ? String(row[12] || '').trim() : '';
    var name = String(row[4] || '').trim();
    if (cid && rowCustId === cid) {
      return {
        date: normalizeReservationDateCell_(row[2]),
        menuName: String(row[5] || ''),
        staffId: String(row[6] || ''),
      };
    }
    if (!cid && dname && name === dname) {
      return {
        date: normalizeReservationDateCell_(row[2]),
        menuName: String(row[5] || ''),
        staffId: String(row[6] || ''),
      };
    }
  }
  return null;
}

function listStoreCustomers_() {
  if (!getSpreadsheetId_()) {
    throw new Error('SPREADSHEET_ID が未設定です');
  }
  var sheet = getOrCreateSheet_('StoreCustomers', [
    'customerId',
    'displayName',
    'searchKana',
    'phone',
    'createdAt',
    'updatedAt',
  ]);
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    if (!id) continue;
    var displayName = String(data[i][1] || '');
    var searchKana = String(data[i][2] || '');
    var phone = String(data[i][3] || '');
    var last = findLastReservationForCustomer_(id, displayName);
    var lastObj = null;
    if (last && last.date && last.menuName) {
      lastObj = {
        date: last.date,
        menuName: last.menuName,
        staffId: last.staffId || STAFF_IDS.ANY,
      };
    }
    out.push({
      customerId: id,
      displayName: displayName,
      searchKana: searchKana,
      phone: phone,
      lastReservation: lastObj,
    });
  }
  return { success: true, customers: out };
}

function registerStoreCustomer_(body) {
  if (!getSpreadsheetId_()) {
    throw new Error('SPREADSHEET_ID が未設定です');
  }
  var displayName = String(body.displayName || '').trim();
  if (!displayName) {
    throw new Error('displayName は必須です');
  }
  var searchKana = String(body.searchKana || '').trim();
  if (!searchKana) searchKana = displayName;
  var phone = String(body.phone || '').trim();
  var now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
  var id = 'sc-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  var sh = getOrCreateSheet_('StoreCustomers', [
    'customerId',
    'displayName',
    'searchKana',
    'phone',
    'createdAt',
    'updatedAt',
  ]);
  sh.appendRow([id, displayName, searchKana, phone, now, now]);
  return {
    success: true,
    customerId: id,
    displayName: displayName,
    searchKana: searchKana,
    phone: phone,
  };
}

// ------------------------------------------------------------
// キャンセル機能
// ------------------------------------------------------------

/**
 * 顧客ID または 表示名から、キャンセル可能な予約一覧を取得
 * 検索範囲: 前日〜60日後
 */
function getCancellableReservations_(body) {
  var customerId = String(body.customerId || '').trim();
  var displayName = String(body.displayName || '').trim();
  if (!customerId && !displayName) {
    throw new Error('customerId か displayName が必要です');
  }

  var calendar = getCalendar_();
  var now = new Date();
  var rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var rangeEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  var events = calendar.getEvents(rangeStart, rangeEnd);

  var out = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!isReserveEvent_(ev)) continue;
    if (isCancelledReserveEvent_(ev)) continue;

    var evCustId = extractDescField_(ev, 'customerId');
    var evCustName = extractDescField_(ev, 'customerName');
    if (customerId && evCustId !== customerId) continue;
    if (!customerId && displayName && evCustName !== displayName) continue;

    var start = ev.getStartTime();
    out.push({
      eventId: ev.getId(),
      date: Utilities.formatDate(start, TZ, 'yyyy-MM-dd'),
      time: Utilities.formatDate(start, TZ, 'HH:mm'),
      menuName: extractDescField_(ev, 'menuName'),
      staffId: extractStaffId_(ev),
      title: ev.getTitle(),
    });
  }

  out.sort(function(a, b) {
    var da = a.date + ' ' + a.time;
    var db = b.date + ' ' + b.time;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return { success: true, reservations: out };
}

/**
 * 予約をキャンセル
 * - タイトルを [キャンセル]元タイトル に変更
 * - 説明欄に cancelledAt: を追記
 */
function cancelReservation_(body) {
  var eventId = String(body.eventId || '').trim();
  if (!eventId) throw new Error('eventId は必須です');

  var calendar = getCalendar_();
  var ev = calendar.getEventById(eventId);
  if (!ev) throw new Error('イベントが見つかりません: ' + eventId);
  if (!isReserveEvent_(ev)) throw new Error('予約アプリの予約ではありません');
  if (isCancelledReserveEvent_(ev)) throw new Error('すでにキャンセル済みです');

  var currentTitle = ev.getTitle();
  ev.setTitle('[キャンセル]' + currentTitle);

  var desc = ev.getDescription() || '';
  ev.setDescription(desc + '\ncancelledAt:' + formatSheetsDateTime_(new Date()));

  return { success: true, eventId: eventId };
}

// ============================================================
// google.script.run 用パブリック関数
// ============================================================

function gasListStoreCustomers() {
  return listStoreCustomers_();
}

function gasRegisterStoreCustomer(body) {
  return registerStoreCustomer_(body);
}

function gasGetAvailability(body) {
  var durationMinutes = parseInt(body.durationMinutes || '60', 10);
  var slots = getAvailability_(body.date, body.staffId, durationMinutes);
  return { success: true, slots: slots };
}

function gasCreateReservation(body) {
  return createReservation_(body);
}

function gasGetCancellableReservations(body) {
  return getCancellableReservations_(body);
}

function gasCancelReservation(body) {
  return cancelReservation_(body);
}

