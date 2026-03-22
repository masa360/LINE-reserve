/**
 * ============================================================
 * 【コピペ用：このファイル1つだけでOK（分割不要）】
 * Google Apps Script の「コード.gs」に、以下をすべて貼り付けてください。
 * ============================================================
 *
 * 美容室予約バックエンド（Google Apps Script）
 * - Googleカレンダーに予約を登録
 * - （任意）スプレッドシートに予約ログを追記
 * - 空き状況API（スタッフ別・指名なし対応）
 *
 * デプロイ: 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *   次のユーザーとして実行: 自分
 *   アクセスできるユーザー: 全員（※テスト時は自分のみでも可）
 *
 * 設定: スクリプトのプロパティに CALENDAR_ID（必須）、SPREADSHEET_ID（任意）
 * 詳細: 同フォルダの README.md
 * ============================================================
 */

/** タイムゾーン（カレンダー・日付計算に使用） */
var TZ = 'Asia/Tokyo';

/** スクリプトプロパティのキー（「プロジェクトの設定」→「スクリプトのプロパティ」で登録） */
var PROP_KEYS = {
  CALENDAR_ID: 'CALENDAR_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
};

/** 予約可能時間（開始は9:00〜、終了時刻はこの時間を超えないこと） */
var BUSINESS_START_HOUR = 9;
/** 営業終了（例: 20:00）。これより後に終わる予約は不可 */
var BUSINESS_CLOSE_HOUR = 20;

/** イベント本文に埋め込む識別子（他の予約と区別するため） */
var RESERVE_MARKER = 'reserve-app-v1';

/** スタッフID（フロントの dummyData と一致させる） */
var STAFF_IDS = {
  ANY: 'staff-00',
  YAMAMOTO: 'staff-01',
  OGAWA: 'staff-02',
};

// ------------------------------------------------------------
// エントリポイント
// ------------------------------------------------------------

/**
 * GET: ?action=getAvailability&date=YYYY-MM-DD&staffId=staff-01&durationMinutes=60
 * （テスト用。本番は POST 推奨）
 */
function doGet(e) {
  return handleRequest_(e && e.parameter, null);
}

/**
 * POST: JSON body { action, ... }
 */
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
        return jsonResponse_(400, {
          success: false,
          error: 'date と staffId は必須です',
        });
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

    if (action === 'health') {
      return jsonResponse_(200, { success: true, message: 'ok', ts: new Date().toISOString() });
    }

    return jsonResponse_(400, { success: false, error: '不明な action です: ' + action });
  } catch (err) {
    return jsonResponse_(500, {
      success: false,
      error: err.message || String(err),
    });
  }
}

// ------------------------------------------------------------
// 設定: カレンダー・スプレッドシート
// ------------------------------------------------------------

function getCalendarId_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.CALENDAR_ID);
  if (!id || id === '') {
    throw new Error(
      'スクリプトのプロパティに CALENDAR_ID が設定されていません。READMEを参照してください。'
    );
  }
  return id;
}

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SPREADSHEET_ID) || '';
}

function getCalendar_() {
  return CalendarApp.getCalendarById(getCalendarId_());
}

// ------------------------------------------------------------
// 空き状況
// ------------------------------------------------------------

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} staffId staff-00 / staff-01 / staff-02
 * @param {number} durationMinutes 所要時間（分）
 * @returns {Array<{time:string, available:boolean}>}
 */
function getAvailability_(dateStr, staffId, durationMinutes) {
  var calendar = getCalendar_();
  var dayRange = getDayRange_(dateStr);
  var events = calendar.getEvents(dayRange.start, dayRange.end);

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

    var available = isSlotAvailable_(events, staffId, slotStart, slotEnd);
    slots.push({ time: formatTime_(slotStart), available: available });
  }

  return slots;
}

/**
 * 予約開始枠（30分刻み）フロントと揃える: 9:00〜19:00（19:30開始はなし）
 */
function buildSlotStarts_(dateStr) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0], 10);
  var mo = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  var list = [];
  var hour;
  var min;
  for (hour = BUSINESS_START_HOUR; hour <= 19; hour++) {
    for (min = 0; min < 60; min += 30) {
      if (hour === 19 && min === 30) {
        break;
      }
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
  var start = new Date(y, m - 1, d, 0, 0, 0);
  var end = new Date(y, m - 1, d, 23, 59, 59);
  return { start: start, end: end };
}

function formatTime_(date) {
  var h = date.getHours();
  var m = date.getMinutes();
  return pad2_(h) + ':' + pad2_(m);
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * 予約イベントのみを対象に重なり判定
 */
function isSlotAvailable_(events, staffId, rangeStart, rangeEnd) {
  var reserveEvents = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (isReserveEvent_(ev)) {
      reserveEvents.push(ev);
    }
  }

  if (staffId === STAFF_IDS.ANY) {
    var busy1 = hasOverlapForStaff_(reserveEvents, STAFF_IDS.YAMAMOTO, rangeStart, rangeEnd);
    var busy2 = hasOverlapForStaff_(reserveEvents, STAFF_IDS.OGAWA, rangeStart, rangeEnd);
    return !(busy1 && busy2);
  }

  return !hasOverlapForStaff_(reserveEvents, staffId, rangeStart, rangeEnd);
}

function hasOverlapForStaff_(events, staffId, rangeStart, rangeEnd) {
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var sid = extractStaffId_(ev);
    if (sid !== staffId) continue;
    var es = ev.getStartTime();
    var ee = ev.getEndTime();
    if (es < rangeEnd && ee > rangeStart) {
      return true;
    }
  }
  return false;
}

function isReserveEvent_(ev) {
  var desc = ev.getDescription() || '';
  return desc.indexOf(RESERVE_MARKER) !== -1;
}

function extractStaffId_(ev) {
  var desc = ev.getDescription() || '';
  var lines = desc.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('staffId:') === 0) {
      return line.replace('staffId:', '').trim();
    }
  }
  return '';
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

  if (!dateStr || !timeStr || !menuName) {
    throw new Error('date, time, menuName は必須です');
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
    if (!isSlotAvailable_(events, staffId, start, end)) {
      throw new Error('この時間帯はすでに予約が入っています');
    }
  }

  var assignedStaffName = staffName;
  if (staffId === STAFF_IDS.ANY) {
    assignedStaffName =
      assignedStaffId === STAFF_IDS.YAMAMOTO ? '山本 宏美' : '小川 あずさ';
  }

  var title =
    '[予約] ' + menuName + ' / ' + assignedStaffName + ' / ' + customerName;

  var description = buildDescription_({
    staffId: assignedStaffId,
    customerName: customerName,
    menuName: menuName,
    price: price,
    notes: notes,
    lineUserId: lineUserId,
    durationMinutes: durationMinutes,
  });

  var event = calendar.createEvent(title, start, end, { description: description });

  appendToSpreadsheet_({
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
  });

  return {
    success: true,
    eventId: event.getId(),
    assignedStaffId: assignedStaffId,
    assignedStaffName: assignedStaffName,
  };
}

function pickAvailableStaff_(events, rangeStart, rangeEnd) {
  var tryOrder = [STAFF_IDS.YAMAMOTO, STAFF_IDS.OGAWA];
  for (var i = 0; i < tryOrder.length; i++) {
    var sid = tryOrder[i];
    if (!hasOverlapForStaff_(filterReserveEvents_(events), sid, rangeStart, rangeEnd)) {
      return sid;
    }
  }
  return null;
}

function filterReserveEvents_(events) {
  var out = [];
  for (var i = 0; i < events.length; i++) {
    if (isReserveEvent_(events[i])) out.push(events[i]);
  }
  return out;
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
  var lines = [
    RESERVE_MARKER,
    'staffId:' + data.staffId,
    'customerName:' + data.customerName,
    'menuName:' + data.menuName,
    'price:' + data.price,
    'durationMinutes:' + data.durationMinutes,
    'notes:' + data.notes,
    'lineUserId:' + data.lineUserId,
  ];
  return lines.join('\n');
}

// ------------------------------------------------------------
// スプレッドシート（任意）
// ------------------------------------------------------------

function appendToSpreadsheet_(row) {
  var ssId = getSpreadsheetId_();
  if (!ssId) return;

  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheets()[0];

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
  ]);
}

function formatSheetsDateTime_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss');
}

// ------------------------------------------------------------
// レスポンス（JSON）
// ------------------------------------------------------------

function jsonResponse_(status, obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  // ブラウザからの fetch 用（CORS はブラウザ側でブロックされる場合がある → README参照）
  return output;
}

// ------------------------------------------------------------
// 初回セットアップ用（エディタから手動実行）
// ------------------------------------------------------------

/**
 * スプレッドシートにヘッダー行を1行目に書き込む（初回のみ実行）
 * ※スクリプトプロパティ SPREADSHEET_ID を設定したあと実行
 */
function setupSpreadsheetHeader() {
  var ssId = getSpreadsheetId_();
  if (!ssId) {
    throw new Error('SPREADSHEET_ID が未設定です');
  }
  var sheet = SpreadsheetApp.openById(ssId).getSheets()[0];
  sheet.getRange(1, 1, 1, 11).setValues([
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
    ],
  ]);
}
