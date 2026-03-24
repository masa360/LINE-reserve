/**
 * ============================================================
 * 予約システム専用ベース（LINE機能なし）
 * ファイル名: Code.gs（GASへ貼り付けるときはこの名前でOK）
 * ============================================================
 *
 * 機能:
 * - getAvailability: 空き枠取得
 * - createReservation: 予約作成
 * - health: ヘルスチェック
 * - setupSpreadsheetHeader: ログシート初期化
 *
 * 必須スクリプトプロパティ:
 * - CALENDAR_ID
 *
 * 任意スクリプトプロパティ:
 * - SPREADSHEET_ID（予約ログを残す場合）
 * ============================================================
 */

var TZ = 'Asia/Tokyo';

var PROP_KEYS = {
  CALENDAR_ID: 'CALENDAR_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
};

var BUSINESS_START_HOUR = 9;
var BUSINESS_CLOSE_HOUR = 20;
var RESERVE_MARKER = 'reserve-app-v1';

var STAFF_IDS = {
  ANY: 'staff-00',
  YAMAMOTO: 'staff-01',
  OGAWA: 'staff-02',
};

// ------------------------------------------------------------
// エントリポイント
// ------------------------------------------------------------

function doGet(e) {
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
  return CalendarApp.getCalendarById(getCalendarId_());
}

// ------------------------------------------------------------
// 空き状況
// ------------------------------------------------------------

function getAvailability_(dateStr, staffId, durationMinutes) {
  var calendar = getCalendar_();
  var dayRange = getDayRange_(dateStr);
  var events = calendar.getEvents(dayRange.start, dayRange.end);

  var slotStarts = buildSlotStarts_(dateStr);
  var slots = [];

  for (var i = 0; i < slotStarts.length; i++) {
    var slotStart = slotStarts[i];
    var slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

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
 * 9:00〜19:00（30分刻み、19:30開始はなし）
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
  var reserveEvents = filterReserveEvents_(events);

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
    if (es < rangeEnd && ee > rangeStart) return true;
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
    if (lines[i].indexOf('staffId:') === 0) {
      return lines[i].replace('staffId:', '').trim();
    }
  }
  return '';
}

function filterReserveEvents_(events) {
  var out = [];
  for (var i = 0; i < events.length; i++) {
    if (isReserveEvent_(events[i])) out.push(events[i]);
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
  } else if (!isSlotAvailable_(events, staffId, start, end)) {
    throw new Error('この時間帯はすでに予約が入っています');
  }

  var assignedStaffName = staffName;
  if (staffId === STAFF_IDS.ANY) {
    assignedStaffName = assignedStaffId === STAFF_IDS.YAMAMOTO ? '山本 宏美' : '小川 あずさ';
  }

  var title = '[予約] ' + menuName + ' / ' + assignedStaffName + ' / ' + customerName;
  var description = buildDescription_({
    staffId: assignedStaffId,
    customerName: customerName,
    menuName: menuName,
    price: price,
    notes: notes,
    lineUserId: lineUserId,
    lineDisplayName: lineDisplayName,
    durationMinutes: durationMinutes,
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
  });

  return {
    success: true,
    eventId: event.getId(),
    assignedStaffId: assignedStaffId,
    assignedStaffName: assignedStaffName,
  };
}

function pickAvailableStaff_(events, rangeStart, rangeEnd) {
  var reserveEvents = filterReserveEvents_(events);
  var tryOrder = [STAFF_IDS.YAMAMOTO, STAFF_IDS.OGAWA];
  for (var i = 0; i < tryOrder.length; i++) {
    var sid = tryOrder[i];
    if (!hasOverlapForStaff_(reserveEvents, sid, rangeStart, rangeEnd)) return sid;
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
  return [
    RESERVE_MARKER,
    'staffId:' + data.staffId,
    'customerName:' + data.customerName,
    'menuName:' + data.menuName,
    'price:' + data.price,
    'durationMinutes:' + data.durationMinutes,
    'notes:' + data.notes,
    'lineUserId:' + data.lineUserId,
    'lineDisplayName:' + data.lineDisplayName,
  ].join('\n');
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

