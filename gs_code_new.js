// ============================================================
// 船事開専用 引合い管理システム v2.0（完全リビルド版）
// 部署: モニタリング / 操船装置 / 自律
// 受注/逸注: _受注 / _逸注
// 修正内容:
//   - getSnapshot()の堅牢化（エラー時も空配列を返す）
//   - 競合チェックを無効化オプション付きに変更
//   - 全関数にtry-catchを追加
//   - Spreadsheet API呼び出しの最小化（バッチ処理）
//   - 案件No自動採番機能追加
//   - CSV/Excel エクスポート対応
//   - 優先度フィールド追加
//   - 受注予定日アラート機能
// ============================================================

var SPREADSHEET_ID = '1Fl03YvlRJbsbDva7ibY-2AOtew_9MSmDWbIykkRCNao';

var DEPT_SHEETS = {
  ship_monitoring: 'モニタリング',
  ship_control: '操船装置',
  ship_autonomous: '自律'
};

var SUMMARY_SHEET_NAME = '全件一覧';
var SUFFIX_RECEIVED = '_受注';
var SUFFIX_LOST = '_逸注';

// カラム定義（v2: 優先度を追加）
var COLUMNS = [
  '案件No', '顧客名', '案件名', '見積額(千円)', 'ステータス',
  '担当者', '受注予定日', '備考', '更新日時', '優先度'
];
var COL_COUNT = COLUMNS.length; // 10

// 優先度定義
var PRIORITY_HIGH   = '高';
var PRIORITY_MEDIUM = '中';
var PRIORITY_LOW    = '低';

// ===== SpreadSheet 取得 =====
function getSs_() {
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 未設定');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ===== Web UI =====
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('船事開 引合い管理システム v2.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('船事開 引合管理 v2')
    .addItem('初期セットアップ（シート作成）', 'initShipSystem')
    .addItem('全件一覧を更新', 'rebuildSummarySheet_')
    .addItem('スプレッドシートIDを確認', 'showSpreadsheetInfo_')
    .addToUi();
}

// ===== デバッグ用: スプレッドシート情報表示 =====
function showSpreadsheetInfo_() {
  try {
    var ss = getSs_();
    var names = ss.getSheets().map(function(s){ return s.getName(); });
    SpreadsheetApp.getUi().alert(
      'スプレッドシート: ' + ss.getName() + '\nシート数: ' + names.length + '\nシート一覧:\n' + names.join('\n')
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert('エラー: ' + e.message);
  }
}

// ===== 日付フォーマット（安全版）=====
function safeFormatDate_(val, fmt) {
  try {
    if (val === '' || val === null || val === undefined) return '';
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return (typeof val === 'string') ? val : '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), fmt);
  } catch (e) {
    return '';
  }
}

// ===== ロック（スタブ互換）=====
function acquireLock(dept, rowNumber) { return { success: true }; }
function releaseLock(dept, rowNumber) { return { success: true }; }

// ===== ハイライト適用 =====
function applyHighlightToSheet(sheet, rowNumber, color) {
  var bgColor = '#ffffff';
  if (color === '赤') bgColor = '#ffe6e6';
  else if (color === '黄') bgColor = '#fff9e6';
  else if (color === '緑') bgColor = '#e6ffe6';
  sheet.getRange(rowNumber, 1, 1, COL_COUNT).setBackground(bgColor);
}

function setHighlight(dept, rowNumber, color, sheetName) {
  try {
    var ss = getSs_();
    var targetSheetName = sheetName || sheetNameFor_(dept, '');
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) throw new Error('シートが見つかりません: ' + targetSheetName);

    applyHighlightToSheet(sheet, rowNumber, color || '');
    sheet.getRange(rowNumber, 9).setValue(new Date()); // 更新日時(col9)
    sortSheetByPriorityAndStatus_(sheet);
    rebuildSummarySheet_();
    return { success: true };
  } catch(e) {
    Logger.log('[setHighlight] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function clearAllHighlights(dept) {
  try {
    var ss = getSs_();
    var base = DEPT_SHEETS[dept];
    if (!base) throw new Error('無効な部署: ' + dept);

    [base, base + SUFFIX_RECEIVED, base + SUFFIX_LOST].forEach(function(name){
      var s = ss.getSheetByName(name);
      if (s && s.getLastRow() > 1) {
        s.getRange(2, 1, s.getLastRow() - 1, COL_COUNT).setBackground('#ffffff');
      }
    });

    SpreadsheetApp.flush();
    rebuildSummarySheet_();
    return { success: true, message: 'ハイライトをクリアしました' };
  } catch(e) {
    Logger.log('[clearAllHighlights] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== シート名 =====
function sheetNameFor_(deptKey, status) {
  var base = DEPT_SHEETS[deptKey];
  if (!base) throw new Error('無効な部署: ' + deptKey);
  if (status === '受注') return base + SUFFIX_RECEIVED;
  if (status === '逸注') return base + SUFFIX_LOST;
  return base;
}

function statusFromSheetName_(sheetName) {
  if (sheetName.indexOf(SUFFIX_RECEIVED) >= 0) return '受注';
  if (sheetName.indexOf(SUFFIX_LOST) >= 0) return '逸注';
  return '';
}

// ===== 案件No 自動採番 =====
function generateCaseNo_(deptKey) {
  try {
    var ss = getSs_();
    var base = DEPT_SHEETS[deptKey];
    var prefix = '';
    if (deptKey === 'ship_monitoring') prefix = 'MON';
    else if (deptKey === 'ship_control') prefix = 'CTL';
    else if (deptKey === 'ship_autonomous') prefix = 'AUT';

    var maxNo = 0;
    [base, base + SUFFIX_RECEIVED, base + SUFFIX_LOST].forEach(function(name){
      var s = ss.getSheetByName(name);
      if (!s || s.getLastRow() <= 1) return;
      var data = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
      data.forEach(function(r){
        var v = String(r[0]);
        var m = v.match(new RegExp('^' + prefix + '-(\\d+)$'));
        if (m) {
          var n = parseInt(m[1], 10);
          if (n > maxNo) maxNo = n;
        }
      });
    });

    var year = new Date().getFullYear();
    return prefix + '-' + year + '-' + String(maxNo + 1).padStart(4, '0');
  } catch(e) {
    Logger.log('[generateCaseNo_] error: ' + e.message);
    return '';
  }
}

function getNextCaseNo(deptKey) {
  return { caseNo: generateCaseNo_(deptKey) };
}

// ===== 全案件取得 =====
function getAllCasesWithLocks() {
  var allCases = [];
  try {
    var ss = getSs_();

    Object.keys(DEPT_SHEETS).forEach(function(deptKey){
      var base = DEPT_SHEETS[deptKey];
      var sheetNames = [base, base + SUFFIX_RECEIVED, base + SUFFIX_LOST];

      sheetNames.forEach(function(name){
        var sh = ss.getSheetByName(name);
        if (!sh) return;
        try {
          allCases = allCases.concat(getCasesFromSheet_(sh, deptKey));
        } catch (e2) {
          Logger.log('[getAllCases] getCasesFromSheet error ' + name + ': ' + e2.message);
        }
      });
    });

  } catch (e) {
    Logger.log('[getAllCases] error: ' + e.message);
  }
  return allCases;
}

function getCasesFromSheet_(sheet, deptKey) {
  var cases = [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return cases;

  var numRows = lastRow - 1;
  var data        = sheet.getRange(2, 1, numRows, COL_COUNT).getValues();
  var backgrounds = sheet.getRange(2, 1, numRows, COL_COUNT).getBackgrounds();
  var sheetNameVal = sheet.getName();

  data.forEach(function(row, index){
    var allEmpty = row.every(function(c){ return c === '' || c === null || c === undefined; });
    if (allEmpty) return;

    var rowNumber = index + 2;
    var bg = backgrounds[index][0];
    var highlight = '';
    if (bg === '#ffe6e6') highlight = '赤';
    else if (bg === '#fff9e6') highlight = '黄';
    else if (bg === '#e6ffe6') highlight = '緑';

    var estimateValue = row[3];
    var estimateDisplay = '';
    if (estimateValue !== '' && estimateValue !== null && estimateValue !== undefined) {
      var nv = parseFloat(String(estimateValue).replace(/,/g,''));
      if (!isNaN(nv)) estimateDisplay = nv.toLocaleString();
    }

    var statusVal = row[4];
    if (!statusVal || statusVal === '') {
      var auto = statusFromSheetName_(sheetNameVal);
      if (auto) statusVal = auto;
    }

    // 優先度（col10, index=9）
    var priority = row[9] || PRIORITY_MEDIUM;

    // 受注予定日のアラート判定
    var expectedDateRaw = row[6];
    var daysUntilDue = null;
    var isOverdue = false;
    if (expectedDateRaw) {
      try {
        var d = (expectedDateRaw instanceof Date) ? expectedDateRaw : new Date(expectedDateRaw);
        if (!isNaN(d.getTime())) {
          var today = new Date();
          today.setHours(0, 0, 0, 0);
          daysUntilDue = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isOverdue = daysUntilDue < 0;
        }
      } catch(e2) { /* ignore */ }
    }

    cases.push({
      rowNumber:      rowNumber,
      dept:           deptKey,
      deptName:       DEPT_SHEETS[deptKey],
      sheetName:      sheetNameVal,
      caseNo:         row[0],
      customer:       row[1],
      projectName:    row[2],
      estimate:       estimateValue,
      estimateDisplay: estimateDisplay,
      status:         statusVal,
      person:         row[5],
      expectedDate:   safeFormatDate_(row[6], 'yyyy/MM/dd'),
      notes:          row[7],
      updateTime:     safeFormatDate_(row[8], 'yyyy-MM-dd HH:mm:ss'),
      priority:       priority,
      highlight:      highlight,
      daysUntilDue:   daysUntilDue,
      isOverdue:      isOverdue,
      isLocked:       false,
      lockedBy:       ''
    });
  });

  return cases;
}

// ===== 受注金額・件数（部署別）=====
function getReceivedAmounts() {
  var amounts = {};
  var counts  = {};
  Object.keys(DEPT_SHEETS).forEach(function(k){ amounts[k] = 0; counts[k] = 0; });

  try {
    var ss = getSs_();

    Object.keys(DEPT_SHEETS).forEach(function(deptKey){
      var sh = ss.getSheetByName(DEPT_SHEETS[deptKey] + SUFFIX_RECEIVED);
      if (!sh) return;
      var lastRow = sh.getLastRow();
      if (lastRow <= 1) return;
      var data = sh.getRange(2, 4, lastRow - 1, 1).getValues();
      var total = 0;
      var cnt = 0;
      data.forEach(function(r){
        var v = parseFloat(String(r[0]).replace(/,/g,''));
        if (!isNaN(v)) { total += v; cnt++; }
      });
      amounts[deptKey] = total;
      counts[deptKey]  = cnt;
    });

  } catch (e) {
    Logger.log('[getReceivedAmounts] error: ' + e.message);
  }

  return { amounts: amounts, counts: counts };
}

// ===== 追加 =====
function addCase(caseData) {
  try {
    var ss = getSs_();
    var targetSheetName = sheetNameFor_(caseData.dept, caseData.status);
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) throw new Error('シート「' + targetSheetName + '」が見つかりません');

    var estimateValue = parseEstimate_(caseData.estimate);

    // 案件No未入力なら自動採番
    var caseNo = caseData.caseNo || '';
    if (!caseNo) caseNo = generateCaseNo_(caseData.dept);

    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, COL_COUNT).setValues([[
      caseNo,
      caseData.customer || '',
      caseData.projectName || '',
      estimateValue,
      caseData.status || '',
      caseData.person || '',
      caseData.expectedDate ? new Date(caseData.expectedDate) : '',
      caseData.notes || '',
      new Date(),
      caseData.priority || PRIORITY_MEDIUM
    ]]);

    if (caseData.highlight) applyHighlightToSheet(sheet, newRow, caseData.highlight);

    sortSheetByPriorityAndStatus_(sheet);
    rebuildSummarySheet_();
    return { success: true, message: '案件を追加しました（No: ' + caseNo + '）', caseNo: caseNo };
  } catch(e) {
    Logger.log('[addCase] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== 更新（移動含む）=====
function updateCaseWithConflictCheck(caseData) {
  try {
    var ss = getSs_();
    var currentSheetName = caseData.sheetName || sheetNameFor_(caseData.dept, '');
    var currentSheet = ss.getSheetByName(currentSheetName);
    if (!currentSheet) throw new Error('シート「' + currentSheetName + '」が見つかりません');

    var rowNumber = parseInt(caseData.rowNumber, 10);

    // 存在チェック
    if (rowNumber > currentSheet.getLastRow()) {
      return { success: false, error: 'この案件は既に削除されているか、行番号が変わっています。再読み込みしてください。' };
    }

    var currentData = currentSheet.getRange(rowNumber, 1, 1, COL_COUNT).getValues()[0];
    var currentUpdateTime = currentData[8];

    // 競合検知（スキップオプション付き）
    if (!caseData.forceUpdate && caseData.updateTime && currentUpdateTime) {
      var clientTime = new Date(caseData.updateTime).getTime();
      var serverTime = new Date(currentUpdateTime).getTime();
      if (Math.abs(serverTime - clientTime) > 2000) {
        return {
          success: false,
          conflict: true,
          message: '他のユーザーが更新しています。最新データで上書きしますか？',
          serverData: {
            caseNo:       currentData[0],
            customer:     currentData[1],
            projectName:  currentData[2],
            estimate:     currentData[3],
            status:       currentData[4],
            person:       currentData[5],
            expectedDate: safeFormatDate_(currentData[6], 'yyyy/MM/dd'),
            notes:        currentData[7],
            updateTime:   safeFormatDate_(currentData[8], 'yyyy-MM-dd HH:mm:ss'),
            priority:     currentData[9] || PRIORITY_MEDIUM
          }
        };
      }
    }

    var estimateValue = parseEstimate_(caseData.estimate);
    var targetSheetName = sheetNameFor_(caseData.dept, caseData.status);
    var needMove = (targetSheetName !== currentSheetName);

    var rowData = [
      caseData.caseNo || '',
      caseData.customer || '',
      caseData.projectName || '',
      estimateValue,
      caseData.status || '',
      caseData.person || '',
      caseData.expectedDate ? new Date(caseData.expectedDate) : '',
      caseData.notes || '',
      new Date(),
      caseData.priority || PRIORITY_MEDIUM
    ];

    if (needMove) {
      var targetSheet = ss.getSheetByName(targetSheetName);
      if (!targetSheet) throw new Error('移動先シート「' + targetSheetName + '」が見つかりません');

      var newRow = targetSheet.getLastRow() + 1;
      targetSheet.getRange(newRow, 1, 1, COL_COUNT).setValues([rowData]);
      if (caseData.highlight) applyHighlightToSheet(targetSheet, newRow, caseData.highlight);

      currentSheet.deleteRow(rowNumber);

      sortSheetByPriorityAndStatus_(targetSheet);
      sortSheetByPriorityAndStatus_(currentSheet);
      rebuildSummarySheet_();
      return { success: true, moved: true, message: '案件を「' + targetSheetName + '」に移動しました' };
    }

    // 同シート内更新
    currentSheet.getRange(rowNumber, 1, 1, COL_COUNT).setValues([rowData]);
    if (caseData.highlight) applyHighlightToSheet(currentSheet, rowNumber, caseData.highlight);

    sortSheetByPriorityAndStatus_(currentSheet);
    rebuildSummarySheet_();
    return { success: true, message: '案件を更新しました' };

  } catch(e) {
    Logger.log('[updateCase] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== 削除 =====
function deleteCase(dept, rowNumber, sheetName) {
  try {
    var ss = getSs_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('シート「' + sheetName + '」が見つかりません');

    rowNumber = parseInt(rowNumber, 10);
    if (rowNumber > sheet.getLastRow()) {
      return { success: false, error: 'この案件は既に削除されています' };
    }

    sheet.deleteRow(rowNumber);
    SpreadsheetApp.flush();
    rebuildSummarySheet_();
    return { success: true, message: '案件を削除しました' };
  } catch(e) {
    Logger.log('[deleteCase] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== 部署変更 =====
function changeDepartment(caseData) {
  caseData.dept = caseData.newDept;
  return updateCaseWithConflictCheck(caseData);
}

// ===== 一括ステータス変更 =====
function bulkUpdateStatus(caseList, newStatus) {
  try {
    var ss = getSs_();
    var count = 0;
    var errors = [];

    caseList.forEach(function(c){
      try {
        var sheet = ss.getSheetByName(c.sheetName);
        if (!sheet) return;
        var rowNumber = parseInt(c.rowNumber, 10);
        if (rowNumber > sheet.getLastRow()) return;

        var targetSheetName = sheetNameFor_(c.dept, newStatus);
        if (targetSheetName === c.sheetName) {
          // 同シート → ステータス列だけ更新
          sheet.getRange(rowNumber, 5).setValue(newStatus);
          sheet.getRange(rowNumber, 9).setValue(new Date());
        } else {
          // 移動が必要
          var rowData = sheet.getRange(rowNumber, 1, 1, COL_COUNT).getValues()[0];
          rowData[4] = newStatus;
          rowData[8] = new Date();
          var targetSheet = ss.getSheetByName(targetSheetName);
          if (!targetSheet) return;
          var newRow = targetSheet.getLastRow() + 1;
          targetSheet.getRange(newRow, 1, 1, COL_COUNT).setValues([rowData]);
          sheet.deleteRow(rowNumber);
          sortSheetByPriorityAndStatus_(targetSheet);
        }
        count++;
      } catch(e2) {
        errors.push(e2.message);
      }
    });

    SpreadsheetApp.flush();
    rebuildSummarySheet_();
    return {
      success: true,
      count: count,
      errors: errors,
      message: count + '件のステータスを「' + newStatus + '」に変更しました'
    };
  } catch(e) {
    Logger.log('[bulkUpdateStatus] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== 並び替え（優先度→ハイライト→ステータス→更新日時）=====
function sortSheetByPriorityAndStatus_(sheet) {
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) return;

    var range = sheet.getRange(2, 1, lastRow - 1, COL_COUNT);
    var values = range.getValues();
    var bgs    = range.getBackgrounds();

    function hRank(bg) {
      return bg === '#ffe6e6' ? 1 : bg === '#fff9e6' ? 2 : bg === '#e6ffe6' ? 3 : 99;
    }
    function sRank(s) {
      return ({'引合':1,'見積提出（高）':2,'見積提出（低）':3,'受注':4,'逸注':5}[s] || 99);
    }
    function pRank(p) {
      return ({'高':1,'中':2,'低':3}[p] || 99);
    }

    var rows = values.map(function(v,i){ return {v:v, bg:bgs[i]}; });

    rows.sort(function(a, b){
      var dP = pRank(a.v[9]) - pRank(b.v[9]); if (dP !== 0) return dP;
      var dH = hRank(a.bg[0]) - hRank(b.bg[0]); if (dH !== 0) return dH;
      var dS = sRank(a.v[4]) - sRank(b.v[4]); if (dS !== 0) return dS;
      var aT = a.v[8] ? new Date(a.v[8]).getTime() : 0;
      var bT = b.v[8] ? new Date(b.v[8]).getTime() : 0;
      return bT - aT;
    });

    range.setValues(rows.map(function(r){ return r.v; }));
    range.setBackgrounds(rows.map(function(r){ return r.bg; }));
    SpreadsheetApp.flush();
  } catch(e) {
    Logger.log('[sortSheet] error: ' + e.message);
  }
}

// ===== 全件一覧シート再構築 =====
function rebuildSummarySheet_() {
  try {
    var ss = getSs_();
    var sheet = ss.getSheetByName(SUMMARY_SHEET_NAME) || ss.insertSheet(SUMMARY_SHEET_NAME);

    sheet.clearContents();
    sheet.clearFormats();

    var headers = ['部署', '元シート', '行番号'].concat(COLUMNS);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold')
      .setBackground('#667eea')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    var cases = getAllCasesWithLocks();

    function hR(h){ return h==='赤'?1:h==='黄'?2:h==='緑'?3:99; }
    function sR(s){ return ({'引合':1,'見積提出（高）':2,'見積提出（低）':3,'受注':4,'逸注':5}[s] || 99); }
    function pR(p){ return ({'高':1,'中':2,'低':3}[p] || 99); }

    cases.sort(function(a,b){
      var dP = pR(a.priority) - pR(b.priority); if (dP !== 0) return dP;
      var dH = hR(a.highlight) - hR(b.highlight); if (dH !== 0) return dH;
      var dS = sR(a.status) - sR(b.status); if (dS !== 0) return dS;
      var aT = a.updateTime ? new Date(a.updateTime).getTime() : 0;
      var bT = b.updateTime ? new Date(b.updateTime).getTime() : 0;
      return bT - aT;
    });

    if (cases.length > 0) {
      var rows = cases.map(function(c){
        return [
          c.deptName||'', c.sheetName||'', c.rowNumber||'',
          c.caseNo||'', c.customer||'', c.projectName||'',
          c.estimate||'', c.status||'', c.person||'',
          c.expectedDate||'', c.notes||'', c.updateTime||'',
          c.priority||''
        ];
      });
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

      // ハイライト色を全件一覧にも反映
      cases.forEach(function(c, i){
        if (c.highlight) {
          var bg = c.highlight === '赤' ? '#ffe6e6' : c.highlight === '黄' ? '#fff9e6' : '#e6ffe6';
          sheet.getRange(i + 2, 1, 1, headers.length).setBackground(bg);
        }
      });
    }

    sheet.autoResizeColumns(1, Math.min(headers.length, 15));
  } catch(e) {
    Logger.log('[rebuildSummarySheet_] error: ' + e.message);
  }
}

// ===== 初期セットアップ =====
function initShipSystem() {
  try {
    var ss = getSs_();

    function ensureSheet_(name) {
      var s = ss.getSheetByName(name);
      if (!s) s = ss.insertSheet(name);

      var header = s.getRange(1, 1, 1, COL_COUNT).getValues()[0];
      var empty = header.every(function(c){ return c === '' || c === null; });
      if (empty) {
        s.getRange(1, 1, 1, COL_COUNT).setValues([COLUMNS])
          .setFontWeight('bold')
          .setBackground('#667eea')
          .setFontColor('#ffffff');
        s.setFrozenRows(1);
        s.setColumnWidth(1, 140);   // 案件No
        s.setColumnWidth(2, 180);   // 顧客名
        s.setColumnWidth(3, 220);   // 案件名
        s.setColumnWidth(4, 110);   // 見積額
        s.setColumnWidth(5, 130);   // ステータス
        s.setColumnWidth(6, 100);   // 担当者
        s.setColumnWidth(7, 120);   // 受注予定日
        s.setColumnWidth(8, 250);   // 備考
        s.setColumnWidth(9, 160);   // 更新日時
        s.setColumnWidth(10, 80);   // 優先度
      }
    }

    Object.keys(DEPT_SHEETS).forEach(function(k){
      var base = DEPT_SHEETS[k];
      ensureSheet_(base);
      ensureSheet_(base + SUFFIX_RECEIVED);
      ensureSheet_(base + SUFFIX_LOST);
    });

    rebuildSummarySheet_();
    SpreadsheetApp.flush();

    SpreadsheetApp.getUi().alert(
      '✅ 初期セットアップ完了\n\n' +
      '作成されたシート:\n' +
      Object.keys(DEPT_SHEETS).map(function(k){
        var b = DEPT_SHEETS[k];
        return '・' + b + '  ・' + b + '_受注  ・' + b + '_逸注';
      }).join('\n') + '\n\n' +
      'v2.0 新機能: 優先度フィールド(高/中/低)が追加されました'
    );
    return { success: true, message: '初期セットアップ完了' };
  } catch(e) {
    Logger.log('[initShipSystem] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== CSV エクスポート =====
function exportCsv(deptKey) {
  try {
    var cases = getAllCasesWithLocks();
    if (deptKey && deptKey !== 'all') {
      cases = cases.filter(function(c){ return c.dept === deptKey; });
    }

    var headers = ['部署', '案件No', '顧客名', '案件名', '見積額(千円)',
                   'ステータス', '担当者', '受注予定日', '備考', '更新日時', '優先度'];

    var lines = [headers.join(',')];
    cases.forEach(function(c){
      var row = [
        '"' + (c.deptName||'').replace(/"/g,'""') + '"',
        '"' + (c.caseNo||'').replace(/"/g,'""') + '"',
        '"' + (c.customer||'').replace(/"/g,'""') + '"',
        '"' + (c.projectName||'').replace(/"/g,'""') + '"',
        c.estimate || '',
        '"' + (c.status||'').replace(/"/g,'""') + '"',
        '"' + (c.person||'').replace(/"/g,'""') + '"',
        '"' + (c.expectedDate||'').replace(/"/g,'""') + '"',
        '"' + (c.notes||'').replace(/\n/g,' ').replace(/"/g,'""') + '"',
        '"' + (c.updateTime||'').replace(/"/g,'""') + '"',
        '"' + (c.priority||'').replace(/"/g,'""') + '"'
      ];
      lines.push(row.join(','));
    });

    return { success: true, csv: lines.join('\n'), count: cases.length };
  } catch(e) {
    Logger.log('[exportCsv] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== 統計データ取得 =====
function getStatistics() {
  try {
    var cases = getAllCasesWithLocks();
    var stats = {
      totalCases: cases.length,
      byDept: {},
      byStatus: {},
      byPriority: {},
      overdueCount: 0,
      nearDueCount: 0,   // 7日以内
      totalEstimate: 0,
      receivedEstimate: 0
    };

    Object.keys(DEPT_SHEETS).forEach(function(k){
      stats.byDept[k] = { total: 0, received: 0, amount: 0 };
    });

    ['引合','見積提出（高）','見積提出（低）','受注','逸注'].forEach(function(s){
      stats.byStatus[s] = 0;
    });

    ['高','中','低'].forEach(function(p){
      stats.byPriority[p] = 0;
    });

    cases.forEach(function(c){
      if (stats.byDept[c.dept]) {
        stats.byDept[c.dept].total++;
        if (c.status === '受注') stats.byDept[c.dept].received++;
        if (c.estimate) {
          var v = parseFloat(c.estimate);
          if (!isNaN(v)) stats.byDept[c.dept].amount += v;
        }
      }
      if (stats.byStatus.hasOwnProperty(c.status)) stats.byStatus[c.status]++;
      if (stats.byPriority.hasOwnProperty(c.priority)) stats.byPriority[c.priority]++;
      if (c.isOverdue) stats.overdueCount++;
      if (c.daysUntilDue !== null && c.daysUntilDue >= 0 && c.daysUntilDue <= 7) stats.nearDueCount++;
      if (c.estimate) {
        var ev = parseFloat(c.estimate);
        if (!isNaN(ev)) {
          stats.totalEstimate += ev;
          if (c.status === '受注') stats.receivedEstimate += ev;
        }
      }
    });

    return { success: true, stats: stats };
  } catch(e) {
    Logger.log('[getStatistics] error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===== ★ メインスナップショット（Index側が1回だけ呼ぶ）=====
function getSnapshot() {
  try {
    var ss = getSs_();
    var sheetNames = ss.getSheets().map(function(s){ return s.getName(); });

    var cases   = getAllCasesWithLocks() || [];
    var rawAmounts = getReceivedAmounts() || { amounts: {}, counts: {} };

    // 期限アラート件数
    var overdueCount = 0;
    var nearDueCount = 0;
    cases.forEach(function(c){
      if (c.isOverdue) overdueCount++;
      else if (c.daysUntilDue !== null && c.daysUntilDue <= 7) nearDueCount++;
    });

    return {
      ok: true,
      spreadsheetName: ss.getName(),
      sheetNames: sheetNames,
      cases: Array.isArray(cases) ? cases : [],
      amounts: rawAmounts.amounts || {},
      counts:  rawAmounts.counts  || {},
      overdueCount: overdueCount,
      nearDueCount: nearDueCount
    };
  } catch (e) {
    Logger.log('[getSnapshot] FATAL error: ' + e.message + '\n' + e.stack);
    return {
      ok: false,
      error: String(e),
      spreadsheetName: '',
      sheetNames: [],
      cases: [],
      amounts: {},
      counts: {},
      overdueCount: 0,
      nearDueCount: 0
    };
  }
}

// ===== ユーティリティ =====
function parseEstimate_(val) {
  if (val === '' || val === null || val === undefined) return '';
  var n = parseFloat(String(val).replace(/,/g,''));
  return isNaN(n) ? '' : n;
}
