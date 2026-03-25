/**
 * ============================================================
 * メモリー専用（別チャネル用の参考実装）
 *
 * 通常の「もりもり」運用では、`gas/Code.gs` にメモリーが統合済みのため
 * このファイルは必須ではありません（Webhook二重化を避けるため）。
 * ============================================================
 * ファイル名: Code.gs（メモリー専用GASへ貼り付けるとき）
 * ============================================================
 *
 * 機能:
 * - LINE webhook で画像受信
 * - lineUserId ごとに Google Drive 保存（ユーザー別フォルダ）
 * - LIFF で過去履歴を表示
 * - 1年保持・最大4枚
 *
 * 必須スクリプトプロパティ:
 * - MEMORY_LINE_ACCESS_TOKEN
 * - MEMORY_DRIVE_FOLDER_ID
 * - MEMORY_SPREADSHEET_ID
 * - MEMORY_LIFF_ID
 * ============================================================
 */

var TZ = 'Asia/Tokyo';
var SHEET_NAME = 'PhotoLog';
var RETENTION_DAYS = 365;
var MAX_PHOTOS_PER_USER = 4;

function doGet(e) {
  e = e || {};
  var action = (e.parameter && e.parameter.action) || '';

  if (action === 'photos') {
    var lineUserId = (e.parameter && e.parameter.lineUserId) || '';
    if (!lineUserId) return jsonResponse_(400, { success: false, error: 'lineUserId が必要です' });
    var photos = getPhotosByUser_(lineUserId);
    return jsonResponse_(200, { success: true, photos: photos });
  }

  var template = HtmlService.createTemplateFromFile('MemoryPage');
  template.liffId = String(PropertiesService.getScriptProperties().getProperty('MEMORY_LIFF_ID') || '');
  template.webAppUrl = ScriptApp.getService().getUrl();
  return template
    .evaluate()
    .setTitle('メモリー')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var events = body.events || [];

    for (var i = 0; i < events.length; i++) {
      handleLineEvent_(events[i]);
    }

    return jsonResponse_(200, { success: true });
  } catch (err) {
    logError_('doPost', err);
    return jsonResponse_(500, { success: false, error: String(err) });
  }
}

function handleLineEvent_(event) {
  if (!event || event.type !== 'message') return;
  if (!event.message || event.message.type !== 'image') return;

  var userId = (event.source && event.source.userId) || '';
  if (!userId) return;

  var replyToken = event.replyToken || '';
  var messageId = event.message.id;
  var displayName = getLineDisplayName_(userId);

  var sheet = getOrCreatePhotoSheet_();
  cleanupExpired_(sheet);

  var count = countActivePhotos_(sheet, userId);
  if (count >= MAX_PHOTOS_PER_USER) {
    if (replyToken) {
      replyText_(replyToken, '写真は最大' + MAX_PHOTOS_PER_USER + '枚まで保存できます。1年後に古い写真は自動削除されます。');
    }
    return;
  }

  var blob = fetchLineImageBlob_(messageId);
  var savedAt = new Date();
  var expiresAt = new Date(savedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  var folder = getOrCreateUserFolder_(userId, displayName);
  var fileName = Utilities.formatDate(savedAt, TZ, 'yyyyMMdd_HHmmss') + '.jpg';
  var file = folder.createFile(blob).setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var viewUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  var thumbUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';

  sheet.appendRow([
    userId,
    displayName,
    Utilities.formatDate(savedAt, TZ, 'yyyy/MM/dd HH:mm:ss'),
    Utilities.formatDate(expiresAt, TZ, 'yyyy/MM/dd HH:mm:ss'),
    file.getId(),
    file.getName(),
    viewUrl,
    thumbUrl,
    String(messageId || ''),
    'ACTIVE',
  ]);

  if (replyToken) {
    replyText_(replyToken, '写真を保存しました。リッチメニューの「メモリー」から履歴を確認できます。');
  }
}

function getPhotosByUser_(userId) {
  var sheet = getOrCreatePhotoSheet_();
  var values = sheet.getDataRange().getValues();
  var nowMs = new Date().getTime();
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[0] || '') !== String(userId)) continue;
    if (String(r[9] || '') !== 'ACTIVE') continue;

    var expiresAt = parseDate_(r[3]);
    if (expiresAt && expiresAt.getTime() <= nowMs) continue;

    rows.push({
      savedAt: String(r[2] || ''),
      fileId: String(r[4] || ''),
      viewUrl: String(r[6] || ''),
      thumbnailUrl: String(r[7] || ''),
    });
  }

  rows.sort(function (a, b) {
    if (a.savedAt < b.savedAt) return 1;
    if (a.savedAt > b.savedAt) return -1;
    return 0;
  });

  return rows;
}

function setupMemorySheet_() {
  getOrCreatePhotoSheet_();
}

function getOrCreatePhotoSheet_() {
  var ssId = mustProp_('MEMORY_SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(ssId);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (sh) return sh;

  sh = ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, 10).setValues([[
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
  ]]);
  return sh;
}

function getOrCreateUserFolder_(userId, displayName) {
  var parent = DriveApp.getFolderById(mustProp_('MEMORY_DRIVE_FOLDER_ID'));
  var safeName = sanitize_(userId + '_' + (displayName || 'user'));
  var it = parent.getFoldersByName(safeName);
  return it.hasNext() ? it.next() : parent.createFolder(safeName);
}

function cleanupExpired_(sheet) {
  var values = sheet.getDataRange().getValues();
  var now = new Date().getTime();

  for (var i = 1; i < values.length; i++) {
    var status = String(values[i][9] || '');
    if (status !== 'ACTIVE') continue;

    var expiresAt = parseDate_(values[i][3]);
    if (!expiresAt || expiresAt.getTime() > now) continue;

    var fileId = String(values[i][4] || '');
    if (fileId) {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (err) {
        logError_('cleanupExpired_file', err);
      }
    }
    sheet.getRange(i + 1, 10).setValue('EXPIRED');
  }
}

function countActivePhotos_(sheet, userId) {
  var values = sheet.getDataRange().getValues();
  var now = new Date().getTime();
  var count = 0;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '') !== String(userId)) continue;
    if (String(values[i][9] || '') !== 'ACTIVE') continue;
    var expiresAt = parseDate_(values[i][3]);
    if (expiresAt && expiresAt.getTime() > now) count++;
  }
  return count;
}

function fetchLineImageBlob_(messageId) {
  var token = mustProp_('MEMORY_LINE_ACCESS_TOKEN');
  var url = 'https://api-data.line.me/v2/bot/message/' + messageId + '/content';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error('画像取得失敗: ' + res.getResponseCode());
  }
  return res.getBlob();
}

function getLineDisplayName_(userId) {
  try {
    var token = mustProp_('MEMORY_LINE_ACCESS_TOKEN');
    var url = 'https://api.line.me/v2/bot/profile/' + encodeURIComponent(userId);
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return '';
    var body = JSON.parse(res.getContentText() || '{}');
    return String(body.displayName || '');
  } catch (err) {
    logError_('getLineDisplayName_', err);
    return '';
  }
}

function replyText_(replyToken, text) {
  var token = mustProp_('MEMORY_LINE_ACCESS_TOKEN');
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }],
    }),
    muteHttpExceptions: true,
  });
}

function jsonResponse_(status, obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function mustProp_(key) {
  var val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error('スクリプトプロパティ未設定: ' + key);
  return String(val);
}

function sanitize_(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|#%{}~]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function parseDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var s = String(v).trim();
  if (!s) return null;
  var d = new Date(s.replace(/\//g, '-'));
  return isNaN(d.getTime()) ? null : d;
}

function logError_(at, err) {
  console.error(at + ': ' + (err && err.message ? err.message : String(err)));
}
