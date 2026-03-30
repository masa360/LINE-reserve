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
 * - LINE Webhook: Gemini は質問分類のみ。返答本文はスプレッドシートの定型文（憶測で店舗案内を生成しない）
 * - メモリー: 画像をDriveへ保存し、同じGASの MemoryPage.html でLIFF表示（Webhook・トークンは共通）
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

/** 予約可能時間（開始は10:00〜、終了時刻はこの時間を超えないこと） */
var BUSINESS_START_HOUR = 10;
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

/** スタッフ勤務シフト（早番/遅番） */
var STAFF_SHIFTS = {
  'staff-00': { start: '10:00', end: '20:00' }, // 指名なし
  'staff-01': { start: '10:00', end: '17:00' }, // 早番
  'staff-02': { start: '13:00', end: '20:00' }, // 遅番
};

// ------------------------------------------------------------
// エントリポイント
// ------------------------------------------------------------

/**
 * GET: ?action=getAvailability&date=YYYY-MM-DD&staffId=staff-01&durationMinutes=60
 * （テスト用。本番は POST 推奨）
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  /**
   * メモリー履歴API（LIFF内 fetch 用）
   * GET ?action=photos&lineUserId=Uxxxx
   */
  if (p.action === 'photos') {
    var lineUserId = String(p.lineUserId || '');
    if (!lineUserId) {
      return jsonResponse_(400, { success: false, error: 'lineUserId が必要です' });
    }
    try {
      var photos = getMemberPhotosForUser_(lineUserId);
      return jsonResponse_(200, { success: true, photos: photos });
    } catch (err) {
      return jsonResponse_(500, { success: false, error: err.message || String(err) });
    }
  }
  /**
   * action なし → メモリーLIFF画面（LINE Developers のエンドポイントにこの /exec を指定）
   * action あり → 予約API（getAvailability 等）
   */
  if (!p.action) {
    var template = HtmlService.createTemplateFromFile('MemoryPage');
    template.liffId = String(PropertiesService.getScriptProperties().getProperty('MEMORY_LIFF_ID') || '');
    template.webAppUrl = ScriptApp.getService().getUrl();
    return template
      .evaluate()
      .setTitle('メモリー')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return handleRequest_(p, null);
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

  // LINE Messaging API のWebhook（events配列がある）なら別処理
  if (payload && payload.events && Object.prototype.toString.call(payload.events) === '[object Array]') {
    return handleLineWebhook_(payload);
  }

  // それ以外は予約API
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

    if (action === 'getReservations') {
      var lineUserId = (body && body.lineUserId) || (query && query.lineUserId) || '';
      var customerName = (body && body.customerName) || (query && query.customerName) || '';
      var limit = parseInt((body && body.limit) || (query && query.limit) || '30', 10);
      var reservations = getReservations_(lineUserId, customerName, limit);
      return jsonResponse_(200, { success: true, reservations: reservations });
    }

    if (action === 'cancelReservation') {
      if (!body) {
        return jsonResponse_(400, { success: false, error: 'POST本文が空です' });
      }
      var cancelResult = cancelReservation_(body);
      return jsonResponse_(200, cancelResult);
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

    if (staffId !== STAFF_IDS.ANY && !isWithinStaffShift_(staffId, slotStart, slotEnd)) {
      slots.push({ time: formatTime_(slotStart), available: false });
      continue;
    }

    var available = isSlotAvailable_(events, staffId, slotStart, slotEnd);
    slots.push({ time: formatTime_(slotStart), available: available });
  }

  return slots;
}

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

  var lineUserId = body.lineUserId || '';
  var lineDisplayName = resolveReservationLineDisplayName_(lineUserId, body.lineDisplayName || '');
  var customerName = body.customerName || '';
  var menuName = body.menuName || '';
  var durationMinutes = parseInt(body.durationMinutes || '60', 10);
  var price = body.price != null ? body.price : '';
  var staffId = body.staffId || STAFF_IDS.ANY;
  var staffName = body.staffName || '';
  var dateStr = body.date;
  var timeStr = body.time;
  var notes = body.notes || '';

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
    if (!isWithinStaffShift_(staffId, start, end)) {
      throw new Error('担当スタッフの勤務時間外のため予約できません');
    }
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
    lineDisplayName: lineDisplayName,
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
    lineDisplayName: lineDisplayName,
  });

  return {
    success: true,
    eventId: event.getId(),
    assignedStaffId: assignedStaffId,
    assignedStaffName: assignedStaffName,
  };
}

/**
 * 予約ログ用の LINE表示名を決定する。
 * - フロントから受けた lineDisplayName を優先
 * - 無い場合で lineUserId があるときは Messaging API で取得
 */
function resolveReservationLineDisplayName_(lineUserId, rawLineDisplayName) {
  var fromClient = String(rawLineDisplayName || '').trim();
  if (fromClient) return fromClient;
  if (!lineUserId) return '';
  var displayName = qaGetLineDisplayName_(lineUserId);
  if (!displayName || displayName === '未登録' || displayName === '名前未取得') return '';
  return displayName;
}

function pickAvailableStaff_(events, rangeStart, rangeEnd) {
  var tryOrder = [STAFF_IDS.YAMAMOTO, STAFF_IDS.OGAWA];
  for (var i = 0; i < tryOrder.length; i++) {
    var sid = tryOrder[i];
    if (!isWithinStaffShift_(sid, rangeStart, rangeEnd)) continue;
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
    'lineDisplayName:' + (data.lineDisplayName || ''),
  ];
  return lines.join('\n');
}

function extractDescField_(ev, fieldName) {
  var desc = ev.getDescription() || '';
  var lines = desc.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(fieldName + ':') === 0) {
      return lines[i].substring((fieldName + ':').length).trim();
    }
  }
  return '';
}

function buildReservationFromEvent_(ev) {
  var start = ev.getStartTime();
  var title = ev.getTitle() || '';
  var menuName = extractDescField_(ev, 'menuName');
  var customerName = extractDescField_(ev, 'customerName');
  var priceRaw = extractDescField_(ev, 'price');
  var price = parseInt(priceRaw || '0', 10);
  if (isNaN(price)) price = 0;
  var staffName = '';
  if (title.indexOf(' / ') !== -1) {
    var t = title.replace('[予約] ', '').replace('[キャンセル] ', '');
    var parts = t.split(' / ');
    // 形式: menu / staff / customer
    if (parts.length >= 2) staffName = parts[1];
    if (!menuName && parts.length >= 1) menuName = parts[0];
    if (!customerName && parts.length >= 3) customerName = parts[2];
  }

  var status = 'upcoming';
  if (title.indexOf('[キャンセル]') === 0 || extractDescField_(ev, 'status') === 'cancelled') {
    status = 'cancelled';
  } else if (start.getTime() < new Date().getTime()) {
    status = 'completed';
  }

  return {
    id: ev.getId(),
    date: Utilities.formatDate(start, TZ, 'yyyy-MM-dd'),
    time: Utilities.formatDate(start, TZ, 'HH:mm'),
    menuName: menuName || 'メニュー未設定',
    staffName: staffName || '担当未設定',
    customerName: customerName || '',
    price: price,
    status: status,
  };
}

function getReservations_(lineUserId, customerName, limit) {
  var calendar = getCalendar_();
  var from = new Date();
  from.setMonth(from.getMonth() - 6); // 過去6か月
  var to = new Date();
  to.setMonth(to.getMonth() + 6); // 未来6か月
  var events = calendar.getEvents(from, to);

  var uid = String(lineUserId || '').trim();
  var cname = String(customerName || '').trim();
  var rows = [];

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!isReserveEvent_(ev)) continue;

    var evLineUserId = extractDescField_(ev, 'lineUserId');
    var evCustomerName = extractDescField_(ev, 'customerName');
    if (uid && evLineUserId && evLineUserId !== uid) continue;
    if (!uid && cname && evCustomerName && evCustomerName !== cname) continue;
    rows.push(buildReservationFromEvent_(ev));
  }

  rows.sort(function (a, b) {
    var ad = a.date + ' ' + a.time;
    var bd = b.date + ' ' + b.time;
    if (ad < bd) return 1;
    if (ad > bd) return -1;
    return 0;
  });

  var n = parseInt(limit || 30, 10);
  if (isNaN(n) || n <= 0) n = 30;
  return rows.slice(0, n);
}

// ------------------------------------------------------------
// 予約キャンセル
// ------------------------------------------------------------

function cancelReservation_(body) {
  var dateStr = String(body.date || '').trim();
  var timeStr = String(body.time || '').trim();
  var eventId = String(body.eventId || '').trim();
  var staffName = String(body.staffName || '').trim();
  var menuName = String(body.menuName || '').trim();
  var customerName = String(body.customerName || '').trim();

  if (!dateStr || !timeStr) {
    throw new Error('date と time は必須です');
  }

  // 当日9:00を過ぎたらオンライン取消不可
  var now = new Date();
  var cancelDeadline = parseDateTime_(dateStr, '09:00');
  if (now.getTime() > cancelDeadline.getTime()) {
    return {
      success: false,
      error: '当日9:00を過ぎているため、オンラインでは取消できません。店舗へお電話ください。',
      requirePhoneCall: true,
    };
  }

  var calendar = getCalendar_();
  var dayRange = getDayRange_(dateStr);
  var events = filterReserveEvents_(calendar.getEvents(dayRange.start, dayRange.end));
  var target = null;

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (eventId && ev.getId() === eventId) {
      target = ev;
      break;
    }
    if (formatTime_(ev.getStartTime()) !== timeStr) continue;
    var title = ev.getTitle() || '';
    if (staffName && title.indexOf(staffName) === -1) continue;
    if (menuName && title.indexOf(menuName) === -1) continue;
    if (customerName && title.indexOf(customerName) === -1) continue;
    target = ev;
    break;
  }

  if (!target) {
    throw new Error('取消対象の予約が見つかりませんでした');
  }

  var prevTitle = target.getTitle() || '';
  if (prevTitle.indexOf('[キャンセル]') !== 0) {
    target.setTitle('[キャンセル] ' + prevTitle);
  }
  var prevDesc = target.getDescription() || '';
  if (prevDesc.indexOf('status:cancelled') === -1) {
    var cancelledAt = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
    target.setDescription(prevDesc + '\nstatus:cancelled\ncancelledAt:' + cancelledAt);
  }

  return { success: true, eventId: target.getId() };
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
    row.lineDisplayName || '',
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

// ------------------------------------------------------------
// LINE Messaging API（Gemini=分類器 / シート=回答本文 + スプレッドシートログ）
// ------------------------------------------------------------

/** チャットフローの初期ステップID（ChatState / ChatRules の onlyWhenStep と対応） */
var CHAT_DEFAULT_STEP = 'START';

/** どのルールにも当てはまらないときの返答（スクリプトプロパティ CHAT_FALLBACK_REPLY で上書き可） */
var CHAT_FALLBACK_DEFAULT =
  '該当する定型案内が見つかりませんでした。担当者が内容を確認し、順番にご返信します。お急ぎの場合はお電話でお問い合わせください。';

/** メモリー写真: 1ユーザーあたり直近1年での保持枚数上限 */
var MEMBER_PHOTO_MAX_PER_YEAR = 4;
/** メモリー写真: 保持日数 */
var MEMBER_PHOTO_RETENTION_DAYS = 365;


function handleLineWebhook_(payload) {
  var events = payload.events || [];
  for (var i = 0; i < events.length; i++) {
    try {
      handleLineEvent_(events[i]);
    } catch (err) {
      // 1イベント単位で失敗しても全体は継続
      logLineError_(events[i], err);
    }
  }
  return textResponse_('ok');
}

function handleLineEvent_(event) {
  if (!event || event.type !== 'message' || !event.message) return;
  var messageType = event.message.type;
  var replyToken = event.replyToken;
  var userId = event.source && event.source.userId ? event.source.userId : '';
  if (!replyToken || !userId) return;

  if (messageType === 'image') {
    var imageReply = handleMemberCardImage_(event, userId);
    lineReplyText_(replyToken, imageReply);
    saveQaLogHorizontally_(userId, '【画像送信】', imageReply);
    return;
  }

  if (messageType !== 'text') return;
  var userMessage = String(event.message.text || '').trim();
  if (!userMessage) return;

  var customerInfo = getQaCustomerInfo_(userId);
  var currentStep = getChatStateStep_(userId);
  var matchResult = chatResolveRule_(userMessage, currentStep);

  var finalText = '';
  var matchedIntent = '';

  if (matchResult) {
    matchedIntent = matchResult.intentId || '';
    finalText = resolveChatReplyPlaceholders_(String(matchResult.replyText || '').trim());
    if (matchResult.alertStaff) {
      sendQaAlertToStaff_(customerInfo.name || '未登録ユーザー', userMessage, matchedIntent);
    }
    if (matchResult.nextStep) {
      setChatStateStep_(userId, matchResult.nextStep);
    }
  } else {
    finalText = getScriptProp_('CHAT_FALLBACK_REPLY', false) || CHAT_FALLBACK_DEFAULT;
  }

  if (!finalText) {
    finalText = getScriptProp_('CHAT_FALLBACK_REPLY', false) || CHAT_FALLBACK_DEFAULT;
  }

  lineReplyText_(replyToken, finalText);
  saveQaLogHorizontally_(userId, userMessage, finalText);
}

/**
 * ① Gemini で intentId 分類（キーワード群を意訳・照合のヒントとして利用）
 * ② 失敗時・未設定時は従来どおりキーワード部分一致
 */
function chatResolveRule_(userMessage, currentStep) {
  var useGemini = chatShouldUseGeminiClassifier_();
  if (useGemini) {
    var forGemini = chatFilterRulesForClassifier_(chatReadChatRulesRows_(), currentStep);
    if (forGemini.length > 0) {
      var classified = chatClassifyIntentWithGemini_(userMessage, currentStep, forGemini);
      if (classified && classified !== 'NONE') {
        var byIntent = chatMatchRuleByIntentId_(classified, currentStep);
        if (byIntent) return byIntent;
      }
    }
  }
  return chatMatchRule_(userMessage, currentStep);
}

/** スクリプトプロパティ LINE_USE_GEMINI_CLASSIFIER が FALSE でなければ、GEMINI_API_KEY があるとき分類に使う */
function chatShouldUseGeminiClassifier_() {
  var apiKey = getScriptProp_('GEMINI_API_KEY', false);
  if (!apiKey || String(apiKey).trim() === '') return false;
  var flag = getScriptProp_('LINE_USE_GEMINI_CLASSIFIER', false);
  if (flag && String(flag).trim().toUpperCase() === 'FALSE') return false;
  return true;
}

/**
 * ChatRules をシートから読み、priority 昇順（同順位は行順）
 */
function chatReadChatRulesRows_() {
  var sheet = qaGetOrCreateSheet_('ChatRules', [
    'priority',
    'intentId',
    'keywords',
    'replyText',
    'onlyWhenStep',
    'nextStep',
    'alertStaff',
  ]);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var pr = parseInt(data[r][0], 10);
    if (isNaN(pr)) pr = 9999;
    rows.push({
      rowIndex: r,
      priority: pr,
      intentId: String(data[r][1] || '').trim(),
      keywordsCell: data[r][2],
      replyText: data[r][3],
      onlyWhenStep: String(data[r][4] || '').trim(),
      nextStep: String(data[r][5] || '').trim(),
      alertStaff: chatParseBool_(data[r][6]),
    });
  }
  rows.sort(function (a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.rowIndex - b.rowIndex;
  });
  return rows;
}

/** 分類プロンプトに載せる行（ステップ一致・intentId 必須） */
function chatFilterRulesForClassifier_(rows, currentStep) {
  var step = String(currentStep || '').trim();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var rule = rows[i];
    if (!rule.intentId) continue;
    if (rule.onlyWhenStep && rule.onlyWhenStep !== step) continue;
    out.push(rule);
  }
  return out;
}

/** intentId が一致し、かつ現在ステップで有効な最初の行（優先度順） */
function chatMatchRuleByIntentId_(intentId, currentStep) {
  var id = String(intentId || '').trim();
  if (!id) return null;
  var step = String(currentStep || '').trim();
  var rows = chatReadChatRulesRows_();
  for (var i = 0; i < rows.length; i++) {
    var rule = rows[i];
    if (rule.intentId !== id) continue;
    if (rule.onlyWhenStep && rule.onlyWhenStep !== step) continue;
    return {
      replyText: rule.replyText,
      intentId: rule.intentId,
      alertStaff: rule.alertStaff,
      nextStep: rule.nextStep,
    };
  }
  return null;
}

/**
 * Gemini に JSON のみで intentId を返させ、パースする。失敗時は null。
 */
function chatClassifyIntentWithGemini_(userMessage, currentStep, rules) {
  var lines = [];
  for (var i = 0; i < rules.length; i++) {
    var hint = String(rules[i].keywordsCell || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, ' ')
      .trim();
    if (!hint) hint = '（キーワード列は空。intentId の意味から推測してよいが、返答文は生成しないこと）';
    lines.push('- intentId: ' + rules[i].intentId + '\n  店主が登録したキーワード・類似表現のヒント: ' + hint);
  }
  var catalog = lines.join('\n');

  var prompt =
    'あなたは美容室LINEの「質問分類器」です。ユーザー発言の意図を、次の intentId のいずれか1つに割り当てます。\n' +
    '\n【絶対禁止】\n' +
    '- ユーザーへの返答文・挨拶・店舗情報の説明を書くこと\n' +
    '- JSON 以外の文字を出力すること（前後に説明文や ``` を付けない）\n' +
    '\n【出力形式】次のいずれか1行の JSON のみ:\n' +
    '{"intentId":"<下記リストの intentId のいずれかと完全一致>"}\n' +
    'または、どれにも明確に当てはまらない場合のみ:\n' +
    '{"intentId":"NONE"}\n' +
    '\n【現在の会話ステップ】' +
    String(currentStep || '').trim() +
    '\n\n【分類候補】\n' +
    catalog +
    '\n\n【ユーザー発言】\n' +
    userMessage;

  var raw = qaGeminiGenerateText_(prompt);
  return chatParseIntentIdFromClassifierOutput_(raw, rules);
}

/**
 * Gemini generateContent（テキスト1本返却）。失敗時は null。
 */
function qaGeminiGenerateText_(userPrompt) {
  var apiKey = getScriptProp_('GEMINI_API_KEY', false);
  if (!apiKey) return null;
  var model = getScriptProp_('GEMINI_MODEL', false) || 'gemini-1.5-flash';
  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    model +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  var payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  try {
    var json = JSON.parse(res.getContentText());
    if (json.error) return null;
    var parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
    if (!parts || !parts[0] || !parts[0].text) return null;
    return parts[0].text;
  } catch (e) {
    return null;
  }
}

/**
 * モデル出力から intentId を取り出し、候補リストに存在するものだけ通す。
 */
function chatParseIntentIdFromClassifierOutput_(rawText, rules) {
  if (!rawText) return null;
  var t = String(rawText).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  var intentId = null;
  try {
    var m = t.match(/\{[\s\S]*\}/);
    if (m) {
      var j = JSON.parse(m[0]);
      if (j && j.intentId !== undefined && j.intentId !== null) {
        intentId = String(j.intentId).trim();
      }
    }
  } catch (e1) {
    intentId = null;
  }

  if (!intentId) {
    var rm = t.match(/"intentId"\s*:\s*"([^"]+)"/);
    if (rm) intentId = rm[1].trim();
  }

  if (!intentId) return null;
  if (intentId === 'NONE') return 'NONE';

  for (var i = 0; i < rules.length; i++) {
    if (rules[i].intentId === intentId) return intentId;
  }
  return null;
}

/**
 * 比較用に文字列を正規化（前後空白除去・連続空白圧縮・英字小文字化）
 */
function normalizeChatText_(text) {
  var s = String(text || '')
    .replace(/[\s　]+/g, ' ')
    .trim()
    .toLowerCase();
  return s;
}

/**
 * キーワードを分割（カンマ・読点・縦棒）
 */
function splitChatKeywords_(cell) {
  if (cell === null || cell === undefined) return [];
  var raw = String(cell);
  var parts = raw.split(/[,、｜|]/);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var k = String(parts[i] || '').trim();
    if (k) out.push(k);
  }
  return out;
}

/**
 * Knowledge シートを key → rule のマップで取得（{{KNOW:キー}} 用）
 */
function qaGetKnowledgeMap_() {
  var sheet = qaGetOrCreateSheet_('Knowledge', ['key', 'rule']);
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (key) map[key] = String(data[i][1] || '');
  }
  return map;
}

/**
 * 返答文内の {{KNOW:キー}} を Knowledge シートの rule に置換（未定義キーはプレースホルダごと削除＋ログ用に目印）
 */
function resolveChatReplyPlaceholders_(replyText) {
  var know = qaGetKnowledgeMap_();
  return String(replyText || '').replace(/\{\{KNOW:([^}]+)\}\}/g, function (_m, key) {
    var k = String(key || '').trim();
    if (know.hasOwnProperty(k) && know[k]) return know[k];
    return '【要設定:Knowledgeのキー「' + k + '」】';
  });
}

function getChatStateStep_(userId) {
  if (!userId) return CHAT_DEFAULT_STEP;
  var sheet = qaGetOrCreateSheet_('ChatState', ['userId', 'step', 'updatedAt']);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId) {
      var st = String(data[i][1] || '').trim();
      return st || CHAT_DEFAULT_STEP;
    }
  }
  return CHAT_DEFAULT_STEP;
}

function setChatStateStep_(userId, step) {
  if (!userId) return;
  var next = String(step || '').trim();
  if (!next) next = CHAT_DEFAULT_STEP;
  var sheet = qaGetOrCreateSheet_('ChatState', ['userId', 'step', 'updatedAt']);
  var data = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[next, now]]);
      return;
    }
  }
  sheet.appendRow([userId, next, now]);
}

/**
 * ChatRules を優先度順に見て、キーワード部分一致の最初の1件を返す（Gemini 未使用・フォールバック用）。
 * 戻り: { replyText, intentId, alertStaff, nextStep } または null
 */
function chatMatchRule_(userMessage, currentStep) {
  var rows = chatReadChatRulesRows_();
  if (rows.length === 0) return null;

  var normUser = normalizeChatText_(userMessage);

  for (var i = 0; i < rows.length; i++) {
    var rule = rows[i];
    if (rule.onlyWhenStep && rule.onlyWhenStep !== String(currentStep || '').trim()) {
      continue;
    }
    var kws = splitChatKeywords_(rule.keywordsCell);
    if (kws.length === 0) continue;

    var hit = false;
    for (var j = 0; j < kws.length; j++) {
      var nk = normalizeChatText_(kws[j]);
      if (nk && chatKeywordMatches_(normUser, nk)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;

    return {
      replyText: rule.replyText,
      intentId: rule.intentId,
      alertStaff: rule.alertStaff,
      nextStep: rule.nextStep,
    };
  }
  return null;
}

function chatParseBool_(cell) {
  if (cell === true) return true;
  var s = String(cell || '')
    .trim()
    .toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'はい';
}

/**
 * キーワードがユーザー文に含まれるか。1桁の数字だけのキーワードは「12」の中の「1」のような誤一致を避ける。
 */
function chatKeywordMatches_(normUser, normKw) {
  if (!normKw || normUser.indexOf(normKw) === -1) return false;
  if (/^\d$/.test(normKw)) {
    var idx = 0;
    while ((idx = normUser.indexOf(normKw, idx)) !== -1) {
      var before = idx > 0 ? normUser.charAt(idx - 1) : ' ';
      var after = idx + normKw.length < normUser.length ? normUser.charAt(idx + normKw.length) : ' ';
      if (!/\d/.test(before) && !/\d/.test(after)) return true;
      idx += 1;
    }
    return false;
  }
  return true;
}

function textResponse_(text) {
  return ContentService.createTextOutput(text || 'ok');
}

function getScriptProp_(key, required) {
  var val = PropertiesService.getScriptProperties().getProperty(key);
  if (required && (!val || String(val).trim() === '')) {
    throw new Error('スクリプトプロパティが未設定です: ' + key);
  }
  return val || '';
}

function lineReplyText_(replyToken, text) {
  var token = getScriptProp_('LINE_ACCESS_TOKEN', true);
  var payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }],
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function linePushText_(toUserId, text) {
  if (!toUserId) return;
  var token = getScriptProp_('LINE_ACCESS_TOKEN', true);
  var payload = {
    to: toUserId,
    messages: [{ type: 'text', text: text }],
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

/**
 * LINE画像をメモリーとしてDriveへ保存（Webhook共通・LINE_ACCESS_TOKEN使用）
 * スクリプトプロパティ: MEMBER_PHOTO_DRIVE_FOLDER_ID（必須）
 */
function handleMemberCardImage_(event, userId) {
  var messageId = event && event.message ? String(event.message.id || '') : '';
  if (!messageId) return '画像IDを取得できませんでした。時間をおいて再送してください。';

  try {
    var photoSheet = qaGetOrCreateSheet_('MemberPhotoLog', [
      'lineUserId',
      'lineDisplayName',
      'savedAt',
      'expiresAt',
      'driveFileId',
      'driveFileName',
      'driveViewUrl',
      'thumbnailUrl',
      'lineMessageId',
      'status',
    ]);

    cleanupExpiredMemberPhotos_(photoSheet);

    var currentCount = countActiveMemberPhotosInLastYear_(photoSheet, userId);
    if (currentCount >= MEMBER_PHOTO_MAX_PER_YEAR) {
      return (
        '保存上限に達しています。メモリー写真は1年で最大' +
        MEMBER_PHOTO_MAX_PER_YEAR +
        '枚まで保存できます。'
      );
    }

    var blob = lineGetMessageContentBlob_(messageId);
    if (!blob) {
      return '画像の取得に失敗しました。時間をおいて再送してください。';
    }

    var userDisplayName = qaGetLineDisplayName_(userId);
    var folder = getOrCreateMemberPhotoUserFolder_(userId, userDisplayName);
    var savedAt = new Date();
    var expiresAt = new Date(savedAt.getTime() + MEMBER_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    var timestamp = Utilities.formatDate(savedAt, TZ, 'yyyyMMdd-HHmmss');
    var fileName = 'memory-' + userId + '-' + timestamp + '.jpg';
    blob.setName(fileName);

    var file = folder.createFile(blob);
    file.setName(fileName);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
    var viewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';

    photoSheet.appendRow([
      userId,
      userDisplayName,
      Utilities.formatDate(savedAt, TZ, 'yyyy/MM/dd HH:mm:ss'),
      Utilities.formatDate(expiresAt, TZ, 'yyyy/MM/dd HH:mm:ss'),
      file.getId(),
      file.getName(),
      viewUrl,
      thumbnailUrl,
      messageId,
      'ACTIVE',
    ]);

    var remain = MEMBER_PHOTO_MAX_PER_YEAR - (currentCount + 1);
    return (
      '写真をメモリーに保存しました。\n' +
      '保存日: ' +
      Utilities.formatDate(savedAt, TZ, 'yyyy/MM/dd') +
      '\n有効期限: ' +
      Utilities.formatDate(expiresAt, TZ, 'yyyy/MM/dd') +
      '\n残り保存可能枚数(直近1年): ' +
      remain +
      '枚\nリッチメニュー「メモリー」から履歴を確認できます。'
    );
  } catch (err) {
    logLineError_(event, err);
    return '画像の保存中にエラーが発生しました。時間をおいて再送してください。';
  }
}

/**
 * メモリー一覧（LIFF用・新しい順）
 *
 * MemberPhotoLog の行形式:
 * - 新10列: userId, displayName, savedAt, expiresAt, fileId, name, viewUrl, thumb, msgId, status(列J)
 * - 旧8列: userId, savedAt, expiresAt, fileId, name, driveLink, msgId, status(列H)
 */
function memberPhotoStatus_(cell) {
  return String(cell || '')
    .trim()
    .toUpperCase();
}

function getMemberPhotosForUser_(userId) {
  var uid = String(userId || '').trim();
  if (!uid) return [];

  var ssId = getSpreadsheetId_();
  if (!ssId) return [];
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheetByName('MemberPhotoLog');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0] || '').trim() !== uid) continue;

    var st9 = memberPhotoStatus_(row[9]);
    var st7 = memberPhotoStatus_(row[7]);
    var isNew = st9 === 'ACTIVE';
    var isLegacy = !isNew && st7 === 'ACTIVE';
    if (!isNew && !isLegacy) continue;

    var expiresAt;
    var savedAt;
    var fileId;
    var viewUrl;
    var thumbUrl;

    if (isNew) {
      expiresAt = parseSheetDateTime_(row[3]);
      if (expiresAt && expiresAt.getTime() <= now) continue;
      savedAt = String(row[2] || '');
      fileId = String(row[4] || '');
      viewUrl = String(row[6] || '');
      thumbUrl = String(row[7] || '');
    } else {
      expiresAt = parseSheetDateTime_(row[2]);
      if (expiresAt && expiresAt.getTime() <= now) continue;
      savedAt = String(row[1] || '');
      fileId = String(row[3] || '');
      viewUrl = String(row[5] || '');
      thumbUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
    }

    if (!thumbUrl && fileId) {
      thumbUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
    }

    results.push({
      savedAt: savedAt,
      fileId: fileId,
      viewUrl: viewUrl,
      thumbnailUrl: thumbUrl,
    });
  }

  results.sort(function (a, b) {
    return a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0;
  });
  return results;
}

/**
 * MemoryPage.html（LIFF）から google.script.run で呼ぶ（fetch/CORS を避ける）
 */
function memoryPageGetPhotos(lineUserId) {
  try {
    var uid = String(lineUserId || '').trim();
    if (!uid) return { success: false, error: 'lineUserId が必要です' };
    var photos = getMemberPhotosForUser_(uid);
    return { success: true, photos: photos };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getMemberPhotoFolder_() {
  var folderId = getScriptProp_('MEMBER_PHOTO_DRIVE_FOLDER_ID', true);
  return DriveApp.getFolderById(folderId);
}

function getOrCreateMemberPhotoUserFolder_(userId, displayName) {
  var parent = getMemberPhotoFolder_();
  var safeName = sanitizeDriveFolderName_(displayName || 'no-name');
  var folderName = String(userId || 'unknown-user') + '_' + safeName;
  var it = parent.getFoldersByName(folderName);
  if (it.hasNext()) return it.next();
  return parent.createFolder(folderName);
}

function sanitizeDriveFolderName_(name) {
  var s = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!s) return 'no-name';
  return s;
}

function lineGetMessageContentBlob_(messageId) {
  var token = getScriptProp_('LINE_ACCESS_TOKEN', true);
  var res = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return null;
  return res.getBlob();
}

function countActiveMemberPhotosInLastYear_(sheet, userId) {
  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();
  var from = now - MEMBER_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '') !== String(userId)) continue;
    if (String(data[i][9] || '') !== 'ACTIVE') continue;
    var savedAt = parseSheetDateTime_(data[i][2]);
    if (!savedAt) continue;
    var t = savedAt.getTime();
    if (t >= from && t <= now) count++;
  }
  return count;
}

function cleanupExpiredMemberPhotos_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var now = new Date().getTime();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][9] || '') !== 'ACTIVE') continue;
    var expiresAt = parseSheetDateTime_(data[i][3]);
    if (!expiresAt || expiresAt.getTime() > now) continue;

    var fileId = String(data[i][4] || '');
    if (fileId) {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (e) {
        // 手動削除済みでも継続
      }
    }
    sheet.getRange(i + 1, 10).setValue('EXPIRED');
  }
}

function parseSheetDateTime_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  var s = String(value).trim();
  if (!s) return null;
  var normalized = s.replace(/\//g, '-');
  var d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d;
}

function qaGetSpreadsheet_() {
  var ssId = getSpreadsheetId_();
  if (!ssId) throw new Error('SPREADSHEET_ID が未設定です');
  return SpreadsheetApp.openById(ssId);
}

function qaGetOrCreateSheet_(name, header) {
  var ss = qaGetSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 && header && header.length > 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sheet;
}

function getQaCustomerInfo_(userId) {
  var sheet = qaGetOrCreateSheet_('Customer', ['userId', 'name', 'memo', 'updatedAt']);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId) {
      return { name: String(data[i][1] || ''), memo: String(data[i][2] || '') };
    }
  }
  return { name: '', memo: '' };
}

function registerQaCustomerName_(userId, name) {
  var sheet = qaGetOrCreateSheet_('Customer', ['userId', 'name', 'memo', 'updatedAt']);
  var data = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === userId) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[name, data[i][2] || 'LINEから自動更新', now]]);
      return;
    }
  }
  sheet.appendRow([userId, name, 'LINEから自動登録', now]);
}

function saveQaLogHorizontally_(userId, userMessage, aiResponse) {
  var sheet = qaGetOrCreateSheet_('Log', ['userId', 'name', 'timestamp', 'userMessage', 'aiResponse']);
  var customer = getQaCustomerInfo_(userId);
  var userName = customer.name || qaGetLineDisplayName_(userId);
  var timestamp = Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm');

  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === userId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow === -1) {
    sheet.appendRow([userId, userName, timestamp, userMessage, aiResponse]);
    return;
  }

  var rowValues = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastUsed = rowValues.length;
  while (lastUsed > 0 && rowValues[lastUsed - 1] === '') lastUsed--;
  sheet.getRange(targetRow, lastUsed + 1, 1, 3).setValues([[timestamp, userMessage, aiResponse]]);
}

function qaGetLineDisplayName_(userId) {
  if (!userId) return '未登録';
  var token = getScriptProp_('LINE_ACCESS_TOKEN', true);
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/' + userId, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  try {
    var json = JSON.parse(res.getContentText());
    return json.displayName || '名前未取得';
  } catch (e) {
    return '名前未取得';
  }
}

function sendQaAlertToStaff_(userName, message, intentId) {
  var adminLineId = getScriptProp_('ADMIN_LINE_ID', false);
  if (!adminLineId) return;
  var intentLine = intentId ? '\n意図(intentId): ' + intentId : '';
  var text =
    '【スタッフ通知・ChatRules】\n' +
    'お客様名: ' +
    userName +
    intentLine +
    '\n内容: ' +
    message +
    '\n（ChatRules で alertStaff が有効な行に一致しました）';
  linePushText_(adminLineId, text);
}

function logLineError_(event, err) {
  try {
    var sheet = qaGetOrCreateSheet_('ErrorLog', ['timestamp', 'event', 'error']);
    sheet.appendRow([
      Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss'),
      JSON.stringify(event || {}),
      err && err.message ? err.message : String(err),
    ]);
  } catch (e) {
    // 最後の砦: 何もしない
  }
}

/**
 * Messaging API向け初期化
 * Customer / Knowledge / ChatRules / ChatState / Log / ErrorLog を作成し、サンプル行を入れる
 */
function setupLineQaSheets() {
  qaGetOrCreateSheet_('Customer', ['userId', 'name', 'memo', 'updatedAt']);
  var know = qaGetOrCreateSheet_('Knowledge', ['key', 'rule']);
  qaGetOrCreateSheet_('ChatRules', [
    'priority',
    'intentId',
    'keywords',
    'replyText',
    'onlyWhenStep',
    'nextStep',
    'alertStaff',
  ]);
  qaGetOrCreateSheet_('ChatState', ['userId', 'step', 'updatedAt']);
  qaGetOrCreateSheet_('Log', ['userId', 'name', 'timestamp', 'userMessage', 'aiResponse']);
  qaGetOrCreateSheet_('ErrorLog', ['timestamp', 'event', 'error']);
  qaGetOrCreateSheet_('MemberPhotoLog', [
    'lineUserId',
    'lineDisplayName',
    'savedAt',
    'expiresAt',
    'driveFileId',
    'driveFileName',
    'driveViewUrl',
    'thumbnailUrl',
    'lineMessageId',
    'status',
  ]);
  var ss = qaGetSpreadsheet_();
  if (know.getLastRow() <= 1) {
    know.appendRow(['営業時間', '10:00〜20:00（※この行はサンプルです。実店舗の時間に書き換えてください）']);
  }

  var cr = ss.getSheetByName('ChatRules');
  if (cr && cr.getLastRow() <= 1) {
    cr.appendRow([
      1,
      'complaint',
      '苦情,クレーム,ひどい,最悪',
      'ご不快な思いをおかけしております。担当者が内容を確認のうえ、順番にご連絡いたします。',
      '',
      '',
      'TRUE',
    ]);
    cr.appendRow([
      5,
      'hours',
      '営業時間,何時まで,開店,閉店',
      '{{KNOW:営業時間}}',
      '',
      '',
      '',
    ]);
    cr.appendRow([
      10,
      'change_cancel',
      '変更,日時変更,時間変更,予約変更,キャンセル,取り消し,予約キャンセル,都合が悪い,行けない',
      'ご予約の変更・キャンセルは、リッチメニューの「予約確認・変更」からお手続きください。',
      '',
      '',
      '',
    ]);
    cr.appendRow([
      12,
      'reserve',
      '予約,空き,空いてる,取りたい,予約したい,予約できますか,空きありますか,空いてますか,来週空いてる,今週空いてる,明日空いてる',
      'ご予約はLINEのリッチメニュー「予約する」から、空き状況をご確認のうえお申し込みください。',
      '',
      '',
      '',
    ]);
    cr.appendRow([
      14,
      'menu_price',
      'メニュー,料金,値段,いくら,価格,費用,金額',
      'メニュー・料金は、リッチメニューの「メニュー・料金」からご確認ください。',
      'START',
      'START',
      '',
    ]);
    cr.appendRow([
      18,
      'late',
      '遅刻,遅れます,少し遅れる,間に合わない,5分遅れる,10分遅れる',
      'ご連絡ありがとうございます。到着予定時刻をこのままご返信ください。担当に共有します。',
      '',
      '',
      'TRUE',
    ]);
    cr.appendRow([
      20,
      'coupon',
      'クーポン,割引,特典,キャンペーン',
      'クーポン情報はリッチメニューの「クーポン」からご確認ください。',
      '',
      '',
      '',
    ]);
    cr.appendRow([
      30,
      'greeting',
      'こんにちは,こんばんは,はじめまして,よろしく',
      'お問い合わせありがとうございます。ご用件をお送りください。内容に応じてご案内します。',
      '',
      '',
      '',
    ]);
    cr.appendRow([
      999,
      'other',
      'その他,わからない,不明,教えて',
      '内容を確認のうえご案内します。お急ぎの場合はお電話でお問い合わせください。',
      '',
      '',
      '',
    ]);
  }
}

/**
 * ChatRules のサンプルを上書きする（既存行を全削除して再投入）
 * 使いどころ:
 * - サンプルキーワードを最新に更新したいとき
 */
function resetChatRulesToDefault() {
  var sheet = qaGetOrCreateSheet_('ChatRules', [
    'priority',
    'intentId',
    'keywords',
    'replyText',
    'onlyWhenStep',
    'nextStep',
    'alertStaff',
  ]);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  var rows = [
    [1, 'complaint', '苦情,クレーム,ひどい,最悪', 'ご不快な思いをおかけしております。担当者が内容を確認のうえ、順番にご連絡いたします。', '', '', 'TRUE'],
    [5, 'hours', '営業時間,何時まで,開店,閉店', '{{KNOW:営業時間}}', '', '', ''],
    [10, 'change_cancel', '変更,日時変更,時間変更,予約変更,キャンセル,取り消し,予約キャンセル,都合が悪い,行けない', 'ご予約の変更・キャンセルは、リッチメニューの「予約確認・変更」からお手続きください。', '', '', ''],
    [12, 'reserve', '予約,空き,空いてる,取りたい,予約したい,予約できますか,空きありますか,空いてますか,来週空いてる,今週空いてる,明日空いてる', 'ご予約はLINEのリッチメニュー「予約する」から、空き状況をご確認のうえお申し込みください。', '', '', ''],
    [14, 'menu_price', 'メニュー,料金,値段,いくら,価格,費用,金額', 'メニュー・料金は、リッチメニューの「メニュー・料金」からご確認ください。', 'START', 'START', ''],
    [18, 'late', '遅刻,遅れます,少し遅れる,間に合わない,5分遅れる,10分遅れる', 'ご連絡ありがとうございます。到着予定時刻をこのままご返信ください。担当に共有します。', '', '', 'TRUE'],
    [20, 'coupon', 'クーポン,割引,特典,キャンペーン', 'クーポン情報はリッチメニューの「クーポン」からご確認ください。', '', '', ''],
    [30, 'greeting', 'こんにちは,こんばんは,はじめまして,よろしく', 'お問い合わせありがとうございます。ご用件をお送りください。内容に応じてご案内します。', '', '', ''],
    [999, 'other', 'その他,わからない,不明,教えて', '内容を確認のうえご案内します。お急ぎの場合はお電話でお問い合わせください。', '', '', ''],
  ];
  sheet.getRange(2, 1, rows.length, 7).setValues(rows);
}
