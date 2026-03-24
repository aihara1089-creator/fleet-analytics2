#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
船事開 引合管理システム v3.0 - 完全スタンドアロン版
データをHTML内に埋め込み、localStorageで永続化
"""
import json, os

with open('/home/user/webapp/cases_data.json', encoding='utf-8') as f:
    cases = json.load(f)

# Assign sequential IDs
for i, c in enumerate(cases):
    c['id'] = i + 1

data_json = json.dumps(cases, ensure_ascii=False, separators=(',', ':'))

html = '''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>船事開 引合い管理システム v3.0</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --primary:#667eea;--primary-dark:#5a67d8;--secondary:#764ba2;
  --success:#27ae60;--warning:#f39c12;--danger:#e74c3c;--info:#3498db;
  --light:#f8f9fa;--dark:#2c3e50;--muted:#7f8c8d;--border:#ecf0f1;
  --shadow:0 4px 15px rgba(0,0,0,.12);--shadow-hover:0 8px 25px rgba(0,0,0,.2);
  --radius:12px;--radius-sm:8px
}
body{font-family:'Segoe UI','Hiragino Sans','Meiryo',Arial,sans-serif;
  background:linear-gradient(135deg,var(--primary) 0%,var(--secondary) 100%);
  min-height:100vh;padding:16px;color:var(--dark)}
.container{max-width:1920px;margin:0 auto}

/* HEADER */
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.header h1{color:white;font-size:26px;font-weight:700;text-shadow:1px 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px}
.version-badge{background:rgba(255,255,255,.25);color:white;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:.5px}
.header-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.alert-badge{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;transition:transform .2s;display:none}
.alert-badge:hover{transform:scale(1.05)}
.alert-overdue{background:#ffe0e0;color:#c0392b}
.alert-neardue{background:#fff3cd;color:#856404}
.refresh-info{background:rgba(255,255,255,.2);color:white;padding:8px 14px;border-radius:20px;font-size:12px}

/* DASHBOARD */
.dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:18px}
.card{background:white;padding:16px 18px;border-radius:var(--radius);box-shadow:var(--shadow);text-align:center;transition:transform .25s,box-shadow .25s;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--primary),var(--secondary))}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow-hover)}
.card-total{background:linear-gradient(135deg,var(--primary),var(--secondary));color:white}
.card-total::before{background:rgba(255,255,255,.3)}
.card h3{font-size:12px;color:var(--muted);margin-bottom:10px;font-weight:600;letter-spacing:.5px}
.card-total h3{color:rgba(255,255,255,.85)}
.card-stat-row{display:flex;justify-content:space-around;gap:6px}
.card-stat{flex:1}
.stat-label{font-size:11px;color:var(--muted);margin-bottom:3px}
.card-total .stat-label{color:rgba(255,255,255,.7)}
.stat-value{font-size:20px;font-weight:800;color:var(--info)}
.card-total .stat-value{color:white}
.stat-sub{font-size:11px;color:var(--muted);margin-top:2px}
.card-total .stat-sub{color:rgba(255,255,255,.7)}
.prog-wrap{margin-top:8px;background:rgba(0,0,0,.08);border-radius:4px;height:5px;overflow:hidden}
.prog{height:100%;background:linear-gradient(90deg,var(--success),#2ecc71);border-radius:4px;transition:width .8s}
.card-total .prog-wrap{background:rgba(255,255,255,.25)}
.card-total .prog{background:rgba(255,255,255,.8)}

/* CONTROL PANEL */
.control-panel{background:white;padding:14px 18px;border-radius:var(--radius);margin-bottom:16px;box-shadow:var(--shadow)}
.ctrl-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.ctrl-row:last-child{margin-bottom:0}
.dept-btns{display:flex;gap:8px;flex-wrap:wrap}
.dept-btn{padding:9px 16px;border:2px solid var(--info);border-radius:var(--radius-sm);background:white;color:var(--info);cursor:pointer;font-size:13px;font-weight:700;transition:all .25s;white-space:nowrap}
.dept-btn:hover{background:#ebf5fb;transform:translateY(-1px)}
.dept-btn.active{background:var(--info);color:white;box-shadow:0 3px 10px rgba(52,152,219,.4)}
.search-wrap{position:relative;flex:1;min-width:220px}
.search-wrap input{width:100%;padding:10px 12px 10px 36px;border:2px solid #ddd;border-radius:var(--radius-sm);font-size:13px;transition:border-color .2s}
.search-wrap input:focus{outline:none;border-color:var(--info)}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:15px;pointer-events:none}
.status-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sfl{display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:5px 10px;border-radius:20px;border:1.5px solid #ddd;transition:all .2s;white-space:nowrap;user-select:none}
.sfl:hover{border-color:var(--info)}
.sfl input{display:none}
.sfl.ck{border-color:transparent;color:white}
.sfl.ck.sf-引合{background:#1976d2}
.sfl.ck.sf-見積高{background:#f57c00}
.sfl.ck.sf-見積低{background:#e65100}
.sfl.ck.sf-受注{background:var(--success)}
.sfl.ck.sf-逸注{background:var(--danger)}
.action-btns{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.btn{padding:9px 16px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:700;transition:all .25s;box-shadow:0 2px 6px rgba(0,0,0,.12);white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-primary{background:var(--info);color:white}
.btn-success{background:var(--success);color:white}
.btn-warning{background:var(--warning);color:white}
.btn-danger{background:var(--danger);color:white}
.btn-dark{background:var(--dark);color:white}
.btn-outline{background:white;color:var(--dark);border:2px solid #ddd}
.btn-outline:hover:not(:disabled){border-color:var(--info);color:var(--info)}

/* TABLE */
.tbl-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:white;border-radius:var(--radius) var(--radius) 0 0;border-bottom:2px solid var(--border)}
.tbl-meta{font-size:13px;color:var(--muted);font-weight:600}
.bulk-area{display:flex;align-items:center;gap:8px;font-size:13px}
.bulk-area select{padding:6px 10px;border:2px solid #ddd;border-radius:6px;font-size:12px}
.tbl-wrap{background:white;border-radius:0 0 var(--radius) var(--radius);overflow:auto;box-shadow:var(--shadow);margin-bottom:20px}
table{width:100%;border-collapse:collapse;min-width:1200px}
th{background:#f8f9fa;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:var(--dark);border-bottom:2px solid var(--border);white-space:nowrap;cursor:pointer;user-select:none}
th:hover{background:#e9ecef}
th.sort-asc::after{content:' ▲';color:var(--info)}
th.sort-desc::after{content:' ▼';color:var(--info)}
td{padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;vertical-align:middle}
tr:hover td{background:#f8fbff}
tr.hl-red td{background:#fff0f0}
tr.hl-yellow td{background:#fffbe6}
tr.hl-green td{background:#f0fff4}
.empty-state{text-align:center;padding:50px;color:var(--muted)}
.empty-icon{font-size:48px;margin-bottom:12px}

/* BADGES */
.status-badge{display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}
.s-引合{background:#e3f2fd;color:#1565c0}
.s-見積提出高{background:#fff3e0;color:#e65100}
.s-見積提出低{background:#fbe9e7;color:#bf360c}
.s-受注{background:#e8f5e9;color:#1b5e20}
.s-逸注{background:#fce4ec;color:#880e4f}
.priority-badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700}
.p-高{background:#ff6b6b;color:white}
.p-中{background:#4ecdc4;color:white}
.p-低{background:#bdc3c7;color:white}
.dept-badge{font-size:11px;background:#f0f4ff;color:var(--primary-dark);padding:2px 7px;border-radius:8px;white-space:nowrap}
.due-badge{font-size:11px;padding:2px 6px;border-radius:8px;white-space:nowrap}
.due-overdue{background:#ffe0e0;color:#c0392b;font-weight:700}
.due-near{background:#fff3cd;color:#856404;font-weight:700}
.notes-cell{cursor:pointer;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notes-cell.has-notes{color:var(--info);text-decoration:underline dotted}
.hl-btns{display:flex;gap:3px;align-items:center}
.hl-btn{width:16px;height:16px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .2s}
.hl-btn.red{background:#e74c3c}.hl-btn.red.active{border-color:#c0392b;transform:scale(1.3)}
.hl-btn.yellow{background:#f1c40f}.hl-btn.yellow.active{border-color:#d4ac0d;transform:scale(1.3)}
.hl-btn.green{background:#27ae60}.hl-btn.green.active{border-color:#1e8449;transform:scale(1.3)}
.hl-clear{background:none;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:10px;padding:1px 4px;color:var(--muted)}
.hl-clear:hover{border-color:var(--danger);color:var(--danger)}
.row-actions{display:flex;gap:4px}
.btn-sm{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;transition:all .2s}
.btn-edit{background:#e8f4f8;color:var(--info)}.btn-edit:hover{background:var(--info);color:white}
.btn-del{background:#fde8e8;color:var(--danger)}.btn-del:hover{background:var(--danger);color:white}
.select-col{width:36px;text-align:center}

/* PAGINATION */
.pagination{display:flex;align-items:center;gap:4px;padding:12px 16px;background:white;border-top:1px solid var(--border)}
.page-btn{padding:6px 11px;border:1.5px solid #ddd;border-radius:6px;background:white;cursor:pointer;font-size:13px;transition:all .2s}
.page-btn:hover:not(:disabled){border-color:var(--info);color:var(--info)}
.page-btn.active{background:var(--info);color:white;border-color:var(--info)}
.page-btn:disabled{opacity:.4;cursor:not-allowed}
.page-size-sel{padding:6px 8px;border:1.5px solid #ddd;border-radius:6px;font-size:12px}

/* MODAL */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:16px}
.modal-overlay.active{display:flex}
.modal{background:white;border-radius:var(--radius);max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:2px solid var(--border);background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:var(--radius) var(--radius) 0 0}
.modal-header h2{color:white;font-size:18px}
.modal-close{background:none;border:none;color:white;font-size:22px;cursor:pointer;padding:0 4px;line-height:1}
.modal-close:hover{opacity:.7}
.modal-body{padding:20px 24px}
.modal-footer{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-group.full{grid-column:1/-1}
.form-label{font-size:13px;font-weight:700;color:var(--dark)}
.form-label .req{color:var(--danger);margin-left:2px}
.form-control{padding:10px 12px;border:2px solid #ddd;border-radius:var(--radius-sm);font-size:13px;transition:border-color .2s;width:100%;font-family:inherit}
.form-control:focus{outline:none;border-color:var(--info)}
textarea.form-control{min-height:80px;resize:vertical}
.modal-wide{max-width:900px}
.modal-narrow{max-width:480px}

/* TOAST */
.toast-container{position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px}
.toast{padding:12px 20px;border-radius:var(--radius-sm);font-size:14px;font-weight:600;box-shadow:0 4px 15px rgba(0,0,0,.2);animation:slideIn .3s ease;max-width:350px;word-break:break-all}
.toast-success{background:#d4edda;color:#155724;border-left:4px solid var(--success)}
.toast-error{background:#f8d7da;color:#721c24;border-left:4px solid var(--danger)}
.toast-info{background:#d1ecf1;color:#0c5460;border-left:4px solid var(--info)}
.toast-warning{background:#fff3cd;color:#856404;border-left:4px solid var(--warning)}
@keyframes slideIn{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}

/* STATS MODAL */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.stats-card{background:#f8f9fa;border-radius:var(--radius-sm);padding:14px}
.stats-card h4{font-size:14px;color:var(--dark);margin-bottom:10px;border-bottom:2px solid var(--border);padding-bottom:6px}
.stats-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px dotted #ddd}
.stats-row:last-child{border:none}
.stats-row-value{font-weight:700;color:var(--info)}

/* RESPONSIVE */
@media(max-width:768px){
  .form-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:1fr}
  .header h1{font-size:20px}
}
</style>
</head>
<body>
<div class="container">

<!-- HEADER -->
<div class="header">
  <h1>⚓ 船事開 引合管理システム <span class="version-badge">v3.0</span></h1>
  <div class="header-right">
    <div class="alert-badge alert-overdue" id="alertOverdue" onclick="filterByAlert('overdue')">
      ⚠️ 期限超過 <strong id="overdueNum">0</strong>件
    </div>
    <div class="alert-badge alert-neardue" id="alertNearDue" onclick="filterByAlert('neardue')">
      ⏰ 7日以内 <strong id="nearDueNum">0</strong>件
    </div>
    <div class="refresh-info" id="lastSaved">💾 自動保存: 有効</div>
  </div>
</div>

<!-- DASHBOARD -->
<div class="dashboard">
  <div class="card card-total">
    <h3>📊 全体サマリー</h3>
    <div class="card-stat-row">
      <div class="card-stat"><div class="stat-label">総件数</div><div class="stat-value" id="totalCount">—</div></div>
      <div class="card-stat"><div class="stat-label">受注件数</div><div class="stat-value" id="totalReceivedCount">—</div></div>
      <div class="card-stat"><div class="stat-label">受注金額(千円)</div><div class="stat-value" id="totalReceivedAmount">—</div></div>
    </div>
    <div class="prog-wrap"><div class="prog" id="totalProg" style="width:0%"></div></div>
  </div>
  <div class="card">
    <h3>📡 モニタリング</h3>
    <div class="card-stat-row">
      <div class="card-stat"><div class="stat-label">件数</div><div class="stat-value" id="monCount">—</div></div>
      <div class="card-stat"><div class="stat-label">受注</div><div class="stat-value" id="monReceivedCount">—</div></div>
      <div class="card-stat"><div class="stat-label">金額(千円)</div><div class="stat-value" id="monAmount">—</div></div>
    </div>
    <div class="prog-wrap"><div class="prog" id="monProg" style="width:0%"></div></div>
  </div>
  <div class="card">
    <h3>🚢 操船装置</h3>
    <div class="card-stat-row">
      <div class="card-stat"><div class="stat-label">件数</div><div class="stat-value" id="ctlCount">—</div></div>
      <div class="card-stat"><div class="stat-label">受注</div><div class="stat-value" id="ctlReceivedCount">—</div></div>
      <div class="card-stat"><div class="stat-label">金額(千円)</div><div class="stat-value" id="ctlAmount">—</div></div>
    </div>
    <div class="prog-wrap"><div class="prog" id="ctlProg" style="width:0%"></div></div>
  </div>
  <div class="card">
    <h3>🤖 自律</h3>
    <div class="card-stat-row">
      <div class="card-stat"><div class="stat-label">件数</div><div class="stat-value" id="autCount">—</div></div>
      <div class="card-stat"><div class="stat-label">受注</div><div class="stat-value" id="autReceivedCount">—</div></div>
      <div class="card-stat"><div class="stat-label">金額(千円)</div><div class="stat-value" id="autAmount">—</div></div>
    </div>
    <div class="prog-wrap"><div class="prog" id="autProg" style="width:0%"></div></div>
  </div>
</div>

<!-- CONTROL PANEL -->
<div class="control-panel">
  <div class="ctrl-row">
    <div class="dept-btns">
      <button class="dept-btn active" onclick="setDept('all',this)">🌐 全部署</button>
      <button class="dept-btn" onclick="setDept('ship_monitoring',this)">📡 モニタリング</button>
      <button class="dept-btn" onclick="setDept('ship_control',this)">🚢 操船装置</button>
      <button class="dept-btn" onclick="setDept('ship_autonomous',this)">🤖 自律</button>
    </div>
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input type="text" id="searchInput" placeholder="検索: 案件No / 顧客名 / 案件名 / 担当者 ... (Ctrl+K)" oninput="onSearch()">
    </div>
  </div>
  <div class="ctrl-row">
    <div class="status-filters">
      <label class="sfl sf-引合"><input type="checkbox" class="sf" value="引合" checked onchange="onSF()">引合</label>
      <label class="sfl sf-見積高"><input type="checkbox" class="sf" value="見積提出（高）" checked onchange="onSF()">見積(高)</label>
      <label class="sfl sf-見積低"><input type="checkbox" class="sf" value="見積提出（低）" checked onchange="onSF()">見積(低)</label>
      <label class="sfl sf-受注"><input type="checkbox" class="sf" value="受注" checked onchange="onSF()">受注</label>
      <label class="sfl sf-逸注"><input type="checkbox" class="sf" value="逸注" onchange="onSF()">逸注</label>
    </div>
    <div class="action-btns">
      <button class="btn btn-success" onclick="openAddModal()">＋ 新規案件</button>
      <button class="btn btn-outline" onclick="openStatsModal()">📊 統計</button>
      <button class="btn btn-outline" onclick="exportCSV()">📥 CSV出力</button>
      <button class="btn btn-outline" onclick="resetData()" title="初期データに戻す">🔄 データリセット</button>
    </div>
  </div>
  <div class="ctrl-row" style="gap:12px">
    <label style="font-size:12px;color:var(--muted)">表示件数:
      <select class="page-size-sel" id="pageSizeSel" onchange="onPageSize()">
        <option value="25">25件</option>
        <option value="50" selected>50件</option>
        <option value="100">100件</option>
        <option value="200">200件</option>
        <option value="9999">全件</option>
      </select>
    </label>
    <div class="bulk-area">
      <span>一括操作:</span>
      <select id="bulkAction">
        <option value="">選択...</option>
        <option value="status_受注">→ 受注</option>
        <option value="status_引合">→ 引合</option>
        <option value="status_見積提出（高）">→ 見積(高)</option>
        <option value="status_見積提出（低）">→ 見積(低)</option>
        <option value="status_逸注">→ 逸注</option>
        <option value="hl_赤">HL: 赤</option>
        <option value="hl_黄">HL: 黄</option>
        <option value="hl_緑">HL: 緑</option>
        <option value="hl_">HL: 解除</option>
        <option value="delete">削除</option>
      </select>
      <button class="btn btn-dark" onclick="applyBulk()">実行</button>
      <button class="btn btn-outline" onclick="selectAllVisible()">全選択</button>
      <button class="btn btn-outline" onclick="clearSel()">選択解除</button>
    </div>
  </div>
</div>

<!-- TABLE -->
<div class="tbl-header">
  <div class="tbl-meta" id="tblMeta">読み込み中...</div>
</div>
<div class="tbl-wrap">
  <table id="mainTable">
    <thead>
      <tr>
        <th class="select-col"><input type="checkbox" id="selAllCb" onchange="toggleSelAll(this)"></th>
        <th onclick="sortBy('deptName')">部署</th>
        <th onclick="sortBy('caseNo')">案件No</th>
        <th onclick="sortBy('customer')">顧客名</th>
        <th onclick="sortBy('projectName')">案件名</th>
        <th onclick="sortBy('estimate')">見積額(千円)</th>
        <th onclick="sortBy('status')">ステータス</th>
        <th onclick="sortBy('priority')">優先度</th>
        <th onclick="sortBy('person')">担当者</th>
        <th>備考</th>
        <th onclick="sortBy('expectedDate')">受注予定日</th>
        <th onclick="sortBy('updateTime')">更新日時</th>
        <th>HL</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="pagination" id="pagination"></div>
</div>

<!-- ADD MODAL -->
<div class="modal-overlay" id="addModal">
  <div class="modal">
    <div class="modal-header">
      <h2>➕ 新規案件登録</h2>
      <button class="modal-close" onclick="closeModal('addModal')">✕</button>
    </div>
    <div class="modal-body">
      <form id="addForm" onsubmit="return submitAdd(event)">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">部署<span class="req">*</span></label>
            <select id="aDept" class="form-control" required>
              <option value="ship_monitoring">📡 モニタリング</option>
              <option value="ship_control">🚢 操船装置</option>
              <option value="ship_autonomous">🤖 自律</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">案件No <span style="font-size:11px;color:var(--muted)">(空で自動採番)</span></label>
            <input type="text" id="aCaseNo" class="form-control" placeholder="例: MON-2026-0001">
          </div>
          <div class="form-group">
            <label class="form-label">顧客名<span class="req">*</span></label>
            <input type="text" id="aCustomer" class="form-control" required placeholder="顧客名を入力">
          </div>
          <div class="form-group">
            <label class="form-label">担当者</label>
            <input type="text" id="aPerson" class="form-control" placeholder="担当者名">
          </div>
          <div class="form-group full">
            <label class="form-label">案件名<span class="req">*</span></label>
            <input type="text" id="aProject" class="form-control" required placeholder="案件名を入力">
          </div>
          <div class="form-group">
            <label class="form-label">見積額(千円)</label>
            <input type="text" id="aEstimate" class="form-control" placeholder="例: 1,500" oninput="fmtEst(this)">
          </div>
          <div class="form-group">
            <label class="form-label">ステータス<span class="req">*</span></label>
            <select id="aStatus" class="form-control" required>
              <option value="引合">引合</option>
              <option value="見積提出（高）">見積提出（高）</option>
              <option value="見積提出（低）">見積提出（低）</option>
              <option value="受注">受注</option>
              <option value="逸注">逸注</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">優先度</label>
            <select id="aPriority" class="form-control">
              <option value="高">高</option>
              <option value="中" selected>中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">受注予定日</label>
            <input type="date" id="aDate" class="form-control">
          </div>
          <div class="form-group full">
            <label class="form-label">備考</label>
            <textarea id="aNotes" class="form-control" placeholder="備考・進捗メモ等を入力"></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:14px 0 0 0">
          <button type="button" class="btn btn-outline" onclick="closeModal('addModal')">キャンセル</button>
          <button type="submit" class="btn btn-success">💾 登録</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- EDIT MODAL -->
<div class="modal-overlay" id="editModal">
  <div class="modal">
    <div class="modal-header">
      <h2>✏️ 案件編集</h2>
      <button class="modal-close" onclick="closeModal('editModal')">✕</button>
    </div>
    <div class="modal-body">
      <form id="editForm" onsubmit="return submitEdit(event)">
        <input type="hidden" id="eId">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">部署<span class="req">*</span></label>
            <select id="eDept" class="form-control" required>
              <option value="ship_monitoring">📡 モニタリング</option>
              <option value="ship_control">🚢 操船装置</option>
              <option value="ship_autonomous">🤖 自律</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">案件No</label>
            <input type="text" id="eCaseNo" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">顧客名<span class="req">*</span></label>
            <input type="text" id="eCustomer" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">担当者</label>
            <input type="text" id="ePerson" class="form-control">
          </div>
          <div class="form-group full">
            <label class="form-label">案件名<span class="req">*</span></label>
            <input type="text" id="eProject" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">見積額(千円)</label>
            <input type="text" id="eEstimate" class="form-control" oninput="fmtEst(this)">
          </div>
          <div class="form-group">
            <label class="form-label">ステータス<span class="req">*</span></label>
            <select id="eStatus" class="form-control" required>
              <option value="引合">引合</option>
              <option value="見積提出（高）">見積提出（高）</option>
              <option value="見積提出（低）">見積提出（低）</option>
              <option value="受注">受注</option>
              <option value="逸注">逸注</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">優先度</label>
            <select id="ePriority" class="form-control">
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">受注予定日</label>
            <input type="date" id="eDate" class="form-control">
          </div>
          <div class="form-group full">
            <label class="form-label">備考</label>
            <textarea id="eNotes" class="form-control"></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:14px 0 0 0">
          <button type="button" class="btn btn-outline" onclick="closeModal('editModal')">キャンセル</button>
          <button type="submit" class="btn btn-primary">💾 更新</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- NOTES MODAL -->
<div class="modal-overlay" id="notesModal">
  <div class="modal modal-narrow">
    <div class="modal-header">
      <h2>📝 備考詳細</h2>
      <button class="modal-close" onclick="closeModal('notesModal')">✕</button>
    </div>
    <div class="modal-body">
      <div id="notesContent" style="white-space:pre-wrap;line-height:1.7;font-size:14px;color:var(--dark)"></div>
    </div>
  </div>
</div>

<!-- STATS MODAL -->
<div class="modal-overlay" id="statsModal">
  <div class="modal modal-wide">
    <div class="modal-header">
      <h2>📊 統計・サマリー</h2>
      <button class="modal-close" onclick="closeModal('statsModal')">✕</button>
    </div>
    <div class="modal-body">
      <div id="statsContent"></div>
    </div>
  </div>
</div>

<!-- TOAST -->
<div class="toast-container" id="toastContainer"></div>

<script>
// ===== 初期データ（CSVより転記済み） =====
var INITIAL_DATA = ''' + data_json + ''';

// ===== LocalStorage キー =====
var LS_KEY = 'funajikai_cases_v3';
var LS_NEXT_ID = 'funajikai_next_id_v3';

// ===== アプリ状態 =====
var APP = {
  allCases: [],
  filtered: [],
  dept: 'all',
  sortKey: 'priority',
  sortDir: 1,
  page: 1,
  ps: 50,
  searchTimer: null,
  sel: new Set(),
  nextId: 1000
};

// ===== 初期化 =====
window.addEventListener('load', function() {
  loadFromStorage();
  refreshUI();
  updateSFStyles();
});

function loadFromStorage() {
  try {
    var saved = localStorage.getItem(LS_KEY);
    var nid = localStorage.getItem(LS_NEXT_ID);
    if (saved) {
      APP.allCases = JSON.parse(saved);
      APP.nextId = nid ? parseInt(nid, 10) : (APP.allCases.length + 1);
      toast('保存データを読み込みました（' + APP.allCases.length + '件）', 'success', 2500);
    } else {
      APP.allCases = JSON.parse(JSON.stringify(INITIAL_DATA));
      APP.nextId = APP.allCases.length + 1;
      saveToStorage();
    }
  } catch(e) {
    APP.allCases = JSON.parse(JSON.stringify(INITIAL_DATA));
    APP.nextId = APP.allCases.length + 1;
    saveToStorage();
  }
  recalcDates();
}

function saveToStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(APP.allCases));
    localStorage.setItem(LS_NEXT_ID, String(APP.nextId));
    var now = new Date();
    var ts = (now.getMonth()+1)+'/'+now.getDate()+' '+pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
    document.getElementById('lastSaved').textContent = '💾 保存: ' + ts;
  } catch(e) {
    toast('保存失敗: ストレージ容量不足の可能性があります', 'error');
  }
}

function resetData() {
  if (!confirm('初期データ（CSVデータ）に戻します。\\n現在の変更はすべて失われます。\\n\\nよろしいですか？')) return;
  APP.allCases = JSON.parse(JSON.stringify(INITIAL_DATA));
  APP.nextId = APP.allCases.length + 1;
  saveToStorage();
  recalcDates();
  refreshUI();
  toast('初期データに戻しました', 'info');
}

function recalcDates() {
  var today = new Date(); today.setHours(0,0,0,0);
  APP.allCases.forEach(function(c) {
    if (c.expectedDate) {
      var d = new Date(c.expectedDate.replace(/\\//g, '-'));
      if (!isNaN(d.getTime())) {
        c.daysUntilDue = Math.ceil((d - today) / 86400000);
        c.isOverdue = c.daysUntilDue < 0;
      } else {
        c.daysUntilDue = null; c.isOverdue = false;
      }
    } else {
      c.daysUntilDue = null; c.isOverdue = false;
    }
    if (!c.highlight) c.highlight = '';
    if (!c.priority) c.priority = '中';
  });
}

// ===== UI更新 =====
function refreshUI() {
  updateDashboard();
  applyFilter();
}

function updateDashboard() {
  var dt={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var rc={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var am={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var od=0,nd=0;
  APP.allCases.forEach(function(c){
    if(dt.hasOwnProperty(c.dept)) dt[c.dept]++;
    if(c.status==='受注'){rc[c.dept]++;am[c.dept]+=(parseFloat(c.estimate)||0);}
    if(c.isOverdue) od++;
    else if(c.daysUntilDue!==null&&c.daysUntilDue<=7) nd++;
  });
  var tot=APP.allCases.length;
  var trc=rc.ship_monitoring+rc.ship_control+rc.ship_autonomous;
  var tra=am.ship_monitoring+am.ship_control+am.ship_autonomous;
  var rate=tot>0?Math.round(trc/tot*100):0;
  setText('totalCount',tot+'件');
  setText('totalReceivedCount',trc+'件');
  setText('totalReceivedAmount',Math.round(tra).toLocaleString());
  setSW('totalProg',rate+'%');
  [['ship_monitoring','mon'],['ship_control','ctl'],['ship_autonomous','aut']].forEach(function(x){
    var t=dt[x[0]]||0,r=rc[x[0]]||0,a=am[x[0]]||0;
    var rt=t>0?Math.round(r/t*100):0;
    setText(x[1]+'Count',t+'件');
    setText(x[1]+'ReceivedCount',r+'件');
    setText(x[1]+'Amount',Math.round(a).toLocaleString());
    setSW(x[1]+'Prog',rt+'%');
  });
  var od_el=document.getElementById('alertOverdue');
  var nd_el=document.getElementById('alertNearDue');
  if(od>0){od_el.style.display='flex';setText('overdueNum',od);}else od_el.style.display='none';
  if(nd>0){nd_el.style.display='flex';setText('nearDueNum',nd);}else nd_el.style.display='none';
}

function applyFilter() {
  var dept=APP.dept;
  var sfs=Array.from(document.querySelectorAll('.sf:checked')).map(function(cb){return cb.value;});
  var q=(document.getElementById('searchInput').value||'').trim();
  var cases=APP.allCases.slice();
  if(dept!=='all') cases=cases.filter(function(c){return c.dept===dept;});
  if(sfs.length>0) cases=cases.filter(function(c){return sfs.indexOf(c.status)!==-1;});
  if(q){
    var tks=q.split(/\\s+/).filter(Boolean).map(function(t){return t.toLowerCase();});
    cases=cases.filter(function(c){
      var hay=[c.deptName||'',c.caseNo||'',c.customer||'',c.projectName||'',c.status||'',c.person||'',c.priority||'',c.notes||''].join(' ').toLowerCase();
      return tks.every(function(t){return hay.indexOf(t)!==-1;});
    });
  }
  sortArr(cases);
  APP.filtered=cases;
  APP.page=1;
  APP.sel.clear();
  renderPage();
}

function sortArr(cases) {
  var k=APP.sortKey,d=APP.sortDir;
  var pR={高:1,中:2,低:3};
  var sR={引合:1,'見積提出（高）':2,'見積提出（低）':3,受注:4,逸注:5};
  cases.sort(function(a,b){
    var av,bv;
    if(k==='priority'){av=pR[a.priority]||99;bv=pR[b.priority]||99;}
    else if(k==='status'){av=sR[a.status]||99;bv=sR[b.status]||99;}
    else if(k==='estimate'){av=parseFloat(a.estimate)||0;bv=parseFloat(b.estimate)||0;}
    else if(k==='expectedDate'||k==='updateTime'){
      av=a[k]?new Date(a[k].replace(/\\//g,'-')).getTime():0;
      bv=b[k]?new Date(b[k].replace(/\\//g,'-')).getTime():0;
    }
    else{av=(a[k]||'').toLowerCase();bv=(b[k]||'').toLowerCase();}
    return av<bv?-d:av>bv?d:0;
  });
}

function renderPage() {
  var all=APP.filtered,tot=all.length,ps=APP.ps,page=APP.page;
  var tp=Math.max(1,Math.ceil(tot/ps));
  if(page>tp) page=APP.page=1;
  var s=(page-1)*ps,e=Math.min(s+ps,tot);
  var dn=APP.dept==='all'?'全部署':getDN(APP.dept);
  document.getElementById('tblMeta').textContent=dn+' | '+tot+'件中 '+(tot?s+1:0)+'〜'+e+'件表示'+(APP.sel.size?' | '+APP.sel.size+'件選択':'');
  renderTbody(all.slice(s,e),s);
  renderPaging(page,tp,tot);
}

function renderTbody(cases,offset) {
  var tbody=document.getElementById('tbody');
  if(!cases||!cases.length){
    tbody.innerHTML='<tr><td colspan="14"><div class="empty-state"><div class="empty-icon">📭</div><div>条件に合う案件がありません</div></div></td></tr>';
    return;
  }
  var rows='';
  cases.forEach(function(c,i){
    var gi=offset+i;
    var hlCls=c.highlight==='赤'?'hl-red':c.highlight==='黄'?'hl-yellow':c.highlight==='緑'?'hl-green':'';
    var ck=APP.sel.has(gi)?'checked':'';
    var sBadge='<span class="status-badge '+({'引合':'s-引合','見積提出（高）':'s-見積提出高','見積提出（低）':'s-見積提出低','受注':'s-受注','逸注':'s-逸注'}[c.status]||'')+'">'+ E(c.status||'')+'</span>';
    var pBadge='<span class="priority-badge p-'+(c.priority||'中')+'">'+E(c.priority||'中')+'</span>';
    var dueD=E(c.expectedDate||'');
    if(c.expectedDate){
      if(c.isOverdue) dueD='<span class="due-badge due-overdue">⚠️'+E(c.expectedDate)+'</span>';
      else if(c.daysUntilDue!==null&&c.daysUntilDue<=7) dueD='<span class="due-badge due-near">⏰'+E(c.expectedDate)+'('+c.daysUntilDue+'日)</span>';
    }
    var hasN=c.notes&&c.notes.trim()!=='';
    var noteShort=hasN?(c.notes.length>28?c.notes.substring(0,28)+'…':c.notes):'';
    var hlR=c.highlight?({'赤':'red','黄':'yellow','緑':'green'}[c.highlight]||''):'';
    rows+='<tr class="'+hlCls+'">';
    rows+='<td class="select-col"><input type="checkbox" class="row-ck" data-gi="'+gi+'" '+ck+' onchange="onRowCk(this)"></td>';
    rows+='<td><span class="dept-badge">'+E(c.deptName||'')+'</span></td>';
    rows+='<td style="font-family:monospace;font-size:11px;white-space:nowrap">'+E(c.caseNo||'')+'</td>';
    rows+='<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+E(c.customer||'')+'">'+E(c.customer||'')+'</td>';
    rows+='<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+E(c.projectName||'')+'">'+E(c.projectName||'')+'</td>';
    rows+='<td style="text-align:right;font-weight:700">'+(c.estimate?(parseFloat(c.estimate)||0).toLocaleString():'')+'</td>';
    rows+='<td>'+sBadge+'</td>';
    rows+='<td>'+pBadge+'</td>';
    rows+='<td style="white-space:nowrap">'+E(c.person||'')+'</td>';
    rows+='<td class="notes-cell'+(hasN?' has-notes':'')+'" onclick="openNotes('+gi+')" title="'+(hasN?E(c.notes):'備考なし')+'">'+E(noteShort)+'</td>';
    rows+='<td style="white-space:nowrap">'+dueD+'</td>';
    rows+='<td style="font-size:11px;color:var(--muted);white-space:nowrap">'+E(c.updateTime||'')+'</td>';
    rows+='<td><div class="hl-btns">';
    rows+='<button class="hl-btn red'+(hlR==='red'?' active':'')+'" onclick="setHL('+gi+',\'赤\')" title="赤マーク"></button>';
    rows+='<button class="hl-btn yellow'+(hlR==='yellow'?' active':'')+'" onclick="setHL('+gi+',\'黄\')" title="黄マーク"></button>';
    rows+='<button class="hl-btn green'+(hlR==='green'?' active':'')+'" onclick="setHL('+gi+',\'緑\')" title="緑マーク"></button>';
    rows+='<button class="hl-clear" onclick="setHL('+gi+',\'\')" title="解除">✕</button>';
    rows+='</div></td>';
    rows+='<td><div class="row-actions"><button class="btn-sm btn-edit" onclick="openEdit('+gi+')">編集</button><button class="btn-sm btn-del" onclick="delCase('+gi+')">削除</button></div></td>';
    rows+='</tr>';
  });
  tbody.innerHTML=rows;
}

function renderPaging(page,tp,tot) {
  var el=document.getElementById('pagination');
  if(tp<=1){el.innerHTML='';return;}
  var h='<button class="page-btn" onclick="goPage('+(page-1)+')" '+(page<=1?'disabled':'')+'>‹ 前</button>';
  var s=Math.max(1,page-2),e=Math.min(tp,page+2);
  if(s>1){h+='<button class="page-btn" onclick="goPage(1)">1</button>';if(s>2)h+='<span style="padding:0 4px">…</span>';}
  for(var p=s;p<=e;p++) h+='<button class="page-btn'+(p===page?' active':'')+'" onclick="goPage('+p+')">'+p+'</button>';
  if(e<tp){if(e<tp-1)h+='<span style="padding:0 4px">…</span>';h+='<button class="page-btn" onclick="goPage('+tp+')">'+tp+'</button>';}
  h+='<button class="page-btn" onclick="goPage('+(page+1)+')" '+(page>=tp?'disabled':'')+'>次 ›</button>';
  h+='<span style="font-size:12px;color:var(--muted);padding:0 10px">全'+tot+'件</span>';
  el.innerHTML=h;
}

function goPage(p){APP.page=p;APP.sel.clear();renderPage();}

// ===== フィルター =====
function setDept(d,btn){
  APP.dept=d;
  document.querySelectorAll('.dept-btn').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');
  applyFilter();
}

function onSearch(){clearTimeout(APP.searchTimer);APP.searchTimer=setTimeout(applyFilter,200);}
function onSF(){updateSFStyles();applyFilter();}
function updateSFStyles(){
  document.querySelectorAll('.sfl').forEach(function(l){
    l.classList.toggle('ck',l.querySelector('input').checked);
  });
}

function filterByAlert(type){
  document.querySelectorAll('.sf').forEach(function(cb){cb.checked=cb.value!=='逸注';});
  updateSFStyles();
  APP.dept='all';
  document.querySelectorAll('.dept-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelector('.dept-btn').classList.add('active');
  recalcDates();
  if(type==='overdue') APP.filtered=APP.allCases.filter(function(c){return c.isOverdue;});
  else APP.filtered=APP.allCases.filter(function(c){return !c.isOverdue&&c.daysUntilDue!==null&&c.daysUntilDue<=7;});
  APP.page=1;renderPage();
}

// ===== ソート =====
function sortBy(key){
  if(APP.sortKey===key) APP.sortDir=-APP.sortDir; else{APP.sortKey=key;APP.sortDir=1;}
  document.querySelectorAll('th').forEach(function(th){th.classList.remove('sort-asc','sort-desc');});
  var ths=document.querySelectorAll('#mainTable th');
  var keyMap={deptName:1,caseNo:2,customer:3,projectName:4,estimate:5,status:6,priority:7,person:8,expectedDate:10,updateTime:11};
  if(keyMap[key]){ths[keyMap[key]].classList.add(APP.sortDir===1?'sort-asc':'sort-desc');}
  applyFilter();
}

// ===== 選択 =====
function onRowCk(el){var gi=parseInt(el.getAttribute('data-gi'),10);if(el.checked)APP.sel.add(gi);else APP.sel.delete(gi);updateSelCount();}
function toggleSelAll(cb){
  var s=(APP.page-1)*APP.ps,e=Math.min(s+APP.ps,APP.filtered.length);
  for(var i=s;i<e;i++){if(cb.checked)APP.sel.add(i);else APP.sel.delete(i);}
  document.querySelectorAll('.row-ck').forEach(function(c){c.checked=cb.checked;});
  updateSelCount();
}
function selectAllVisible(){for(var i=0;i<APP.filtered.length;i++)APP.sel.add(i);document.querySelectorAll('.row-ck').forEach(function(c){c.checked=true;});document.getElementById('selAllCb').checked=true;updateSelCount();}
function clearSel(){APP.sel.clear();document.querySelectorAll('.row-ck').forEach(function(c){c.checked=false;});document.getElementById('selAllCb').checked=false;updateSelCount();}
function updateSelCount(){
  var dn=APP.dept==='all'?'全部署':getDN(APP.dept);
  var tot=APP.filtered.length,s=(APP.page-1)*APP.ps,e=Math.min(s+APP.ps,tot);
  document.getElementById('tblMeta').textContent=dn+' | '+tot+'件中 '+(tot?s+1:0)+'〜'+e+'件表示'+(APP.sel.size?' | '+APP.sel.size+'件選択':'');
}

// ===== 一括操作 =====
function applyBulk(){
  var act=document.getElementById('bulkAction').value;
  if(!act){toast('操作を選択してください','warning');return;}
  if(APP.sel.size===0){toast('案件を選択してください','warning');return;}
  var idxArr=Array.from(APP.sel);
  var msg='';
  if(act==='delete'){
    if(!confirm(APP.sel.size+'件を削除しますか？'))return;
    var toDelIds=idxArr.map(function(i){return APP.filtered[i]&&APP.filtered[i].id;}).filter(Boolean);
    APP.allCases=APP.allCases.filter(function(c){return toDelIds.indexOf(c.id)===-1;});
    msg=APP.sel.size+'件を削除しました';
  } else if(act.startsWith('status_')){
    var newStat=act.replace('status_','');
    idxArr.forEach(function(i){
      var c=APP.filtered[i];
      if(!c)return;
      var orig=APP.allCases.find(function(x){return x.id===c.id;});
      if(orig){orig.status=newStat;orig.updateTime=now();}
    });
    msg=APP.sel.size+'件のステータスを変更しました';
  } else if(act.startsWith('hl_')){
    var col=act.replace('hl_','');
    idxArr.forEach(function(i){
      var c=APP.filtered[i];
      if(!c)return;
      var orig=APP.allCases.find(function(x){return x.id===c.id;});
      if(orig) orig.highlight=col;
    });
    msg=APP.sel.size+'件のハイライトを変更しました';
  }
  saveToStorage();
  recalcDates();
  refreshUI();
  document.getElementById('bulkAction').value='';
  clearSel();
  toast(msg,'success');
}

// ===== CRUD =====
function submitAdd(event) {
  event.preventDefault();
  var dept=document.getElementById('aDept').value;
  var dN={ship_monitoring:'モニタリング',ship_control:'操船装置',ship_autonomous:'自律'};
  var pfx={ship_monitoring:'MON',ship_control:'CTL',ship_autonomous:'AUT'};
  var yr=new Date().getFullYear();
  var cNo=document.getElementById('aCaseNo').value||(pfx[dept]+'-'+yr+'-'+String(APP.nextId).padStart(4,'0'));
  var estRaw=document.getElementById('aEstimate').value.replace(/,/g,'');
  var c={
    id:APP.nextId++,rowNumber:APP.nextId,dept:dept,deptName:dN[dept]||dept,sheetName:dN[dept]||dept,
    caseNo:cNo,customer:document.getElementById('aCustomer').value,
    projectName:document.getElementById('aProject').value,
    estimate:estRaw?parseFloat(estRaw):null,
    estimateDisplay:estRaw?(parseInt(estRaw)||0).toLocaleString():'',
    status:document.getElementById('aStatus').value,
    priority:document.getElementById('aPriority').value,
    person:document.getElementById('aPerson').value,
    expectedDate:document.getElementById('aDate').value.replace(/-/g,'/'),
    notes:document.getElementById('aNotes').value,
    updateTime:now(),highlight:'',isOverdue:false,daysUntilDue:null,isLocked:false,lockedBy:''
  };
  APP.allCases.unshift(c);
  saveToStorage();
  recalcDates();
  closeModal('addModal');
  refreshUI();
  toast('案件を登録しました: '+c.caseNo,'success');
  return false;
}

function openEdit(gi) {
  var c=APP.filtered[gi];
  if(!c){toast('案件が見つかりません','error');return;}
  document.getElementById('eId').value=c.id;
  document.getElementById('eDept').value=c.dept||'ship_monitoring';
  document.getElementById('eCaseNo').value=c.caseNo||'';
  document.getElementById('eCustomer').value=c.customer||'';
  document.getElementById('ePerson').value=c.person||'';
  document.getElementById('eProject').value=c.projectName||'';
  document.getElementById('eEstimate').value=c.estimate?(parseFloat(c.estimate)||0).toLocaleString():'';
  document.getElementById('eStatus').value=c.status||'引合';
  document.getElementById('ePriority').value=c.priority||'中';
  var ed=c.expectedDate?c.expectedDate.replace(/\\//g,'-'):'';
  document.getElementById('eDate').value=ed;
  document.getElementById('eNotes').value=c.notes||'';
  document.getElementById('editModal').classList.add('active');
}

function submitEdit(event) {
  event.preventDefault();
  var id=parseInt(document.getElementById('eId').value,10);
  var c=APP.allCases.find(function(x){return x.id===id;});
  if(!c){toast('案件が見つかりません','error');return false;}
  var dept=document.getElementById('eDept').value;
  var dN={ship_monitoring:'モニタリング',ship_control:'操船装置',ship_autonomous:'自律'};
  var estRaw=document.getElementById('eEstimate').value.replace(/,/g,'');
  c.dept=dept; c.deptName=dN[dept]||dept; c.sheetName=dN[dept]||dept;
  c.caseNo=document.getElementById('eCaseNo').value;
  c.customer=document.getElementById('eCustomer').value;
  c.projectName=document.getElementById('eProject').value;
  c.estimate=estRaw?parseFloat(estRaw):null;
  c.estimateDisplay=estRaw?(parseInt(estRaw)||0).toLocaleString():'';
  c.status=document.getElementById('eStatus').value;
  c.priority=document.getElementById('ePriority').value;
  c.person=document.getElementById('ePerson').value;
  c.expectedDate=document.getElementById('eDate').value.replace(/-/g,'/');
  c.notes=document.getElementById('eNotes').value;
  c.updateTime=now();
  saveToStorage();
  recalcDates();
  closeModal('editModal');
  refreshUI();
  toast('案件を更新しました','success');
  return false;
}

function delCase(gi) {
  var c=APP.filtered[gi];
  if(!c)return;
  if(!confirm('「'+c.projectName+'」を削除しますか？\\n\\nこの操作は取り消せません。'))return;
  APP.allCases=APP.allCases.filter(function(x){return x.id!==c.id;});
  saveToStorage();
  recalcDates();
  refreshUI();
  toast('案件を削除しました','success');
}

// ===== ハイライト =====
function setHL(gi,col){
  var c=APP.filtered[gi];
  if(!c)return;
  var orig=APP.allCases.find(function(x){return x.id===c.id;});
  if(orig) orig.highlight=col;
  saveToStorage();
  renderPage();
}

// ===== 備考モーダル =====
function openNotes(gi){
  var c=APP.filtered[gi];
  document.getElementById('notesContent').textContent=(c&&c.notes)?c.notes:'備考なし';
  document.getElementById('notesModal').classList.add('active');
}

// ===== 統計モーダル =====
function openStatsModal(){
  document.getElementById('statsModal').classList.add('active');
  var cases=APP.allCases;
  var dt={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var rc={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var am={ship_monitoring:0,ship_control:0,ship_autonomous:0};
  var bs={},bp={},totalE=0,recvE=0;
  cases.forEach(function(c){
    if(dt.hasOwnProperty(c.dept)) dt[c.dept]++;
    if(c.status==='受注'){rc[c.dept]++;am[c.dept]+=(parseFloat(c.estimate)||0);}
    bs[c.status]=(bs[c.status]||0)+1;
    bp[c.priority||'中']=(bp[c.priority||'中']||0)+1;
    if(c.estimate){var v=parseFloat(c.estimate);if(!isNaN(v)){totalE+=v;if(c.status==='受注')recvE+=v;}}
  });
  var rr=totalE>0?Math.round(recvE/totalE*100):0;
  var h='<div class="stats-grid">';
  h+='<div class="stats-card"><h4>📁 部署別件数</h4>';
  [['ship_monitoring','モニタリング'],['ship_control','操船装置'],['ship_autonomous','自律']].forEach(function(d){
    h+='<div class="stats-row"><span>'+d[1]+'</span><span class="stats-row-value">'+(dt[d[0]]||0)+'件 (受注'+(rc[d[0]]||0)+'件)</span></div>';
  });
  h+='</div>';
  h+='<div class="stats-card"><h4>📊 ステータス別件数</h4>';
  ['引合','見積提出（高）','見積提出（低）','受注','逸注'].forEach(function(s){
    h+='<div class="stats-row"><span>'+s+'</span><span class="stats-row-value">'+(bs[s]||0)+'件</span></div>';
  });
  h+='</div>';
  h+='<div class="stats-card"><h4>🔥 優先度別件数</h4>';
  ['高','中','低'].forEach(function(p){
    h+='<div class="stats-row"><span>'+p+'</span><span class="stats-row-value">'+(bp[p]||0)+'件</span></div>';
  });
  h+='</div>';
  h+='<div class="stats-card"><h4>💰 金額サマリー</h4>';
  h+='<div class="stats-row"><span>総見積金額</span><span class="stats-row-value">'+Math.round(totalE).toLocaleString()+'千円</span></div>';
  h+='<div class="stats-row"><span>受注金額合計</span><span class="stats-row-value">'+Math.round(recvE).toLocaleString()+'千円</span></div>';
  h+='<div class="stats-row"><span>受注金額率</span><span class="stats-row-value">'+rr+'%</span></div>';
  [['ship_monitoring','モニタリング'],['ship_control','操船装置'],['ship_autonomous','自律']].forEach(function(d){
    h+='<div class="stats-row"><span>　'+d[1]+'受注</span><span class="stats-row-value">'+Math.round(am[d[0]]||0).toLocaleString()+'千円</span></div>';
  });
  h+='</div></div>';
  document.getElementById('statsContent').innerHTML=h;
}

// ===== CSV出力 =====
function exportCSV(){
  var cases=APP.filtered.length?APP.filtered:APP.allCases;
  var header=['部署','案件No','顧客名','案件名','見積額(千円)','ステータス','優先度','担当者','受注予定日','備考','更新日時'];
  var rows=[header.join(',')];
  cases.forEach(function(c){
    var cols=[c.deptName||'',c.caseNo||'',c.customer||'',c.projectName||'',c.estimate||'',c.status||'',c.priority||'',c.person||'',c.expectedDate||'',c.notes||'',c.updateTime||''];
    rows.push(cols.map(function(v){return '"'+String(v).replace(/"/g,'""').replace(/\\n/g,' ')+'"';}).join(','));
  });
  var bom='\\uFEFF';
  var blob=new Blob([bom+rows.join('\\n')],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='引合リスト_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast(cases.length+'件をCSV出力しました','success');
}

// ===== ページサイズ =====
function onPageSize(){APP.ps=parseInt(document.getElementById('pageSizeSel').value,10)||50;applyFilter();}

// ===== モーダル =====
function openAddModal(){
  document.getElementById('addModal').classList.add('active');
  document.getElementById('addForm').reset();
  document.getElementById('aPriority').value='中';
}
function closeModal(id){document.getElementById(id).classList.remove('active');}

// ===== TOAST =====
function toast(msg,type,dur){
  type=type||'info';dur=dur||3000;
  var ct=document.getElementById('toastContainer');
  var el=document.createElement('div');
  el.className='toast toast-'+type;
  el.textContent=msg;
  ct.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(50px)';el.style.transition='all .3s';setTimeout(function(){if(el.parentNode)ct.removeChild(el);},300);},dur);
}

// ===== UTILS =====
function setText(id,t){var el=document.getElementById(id);if(el)el.textContent=t;}
function setSW(id,w){var el=document.getElementById(id);if(el)el.style.width=w;}
function getDN(k){return{ship_monitoring:'モニタリング',ship_control:'操船装置',ship_autonomous:'自律'}[k]||k;}
function E(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\'/g,'&#39;');}
function fmtEst(el){var v=el.value.replace(/,/g,'').replace(/[^0-9]/g,'');el.value=v?parseInt(v,10).toLocaleString():'';}
function now(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}
function pad(n){return n<10?'0'+n:String(n);}

// ===== KEYBOARD =====
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(function(m){m.classList.remove('active');});
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();document.getElementById('searchInput').focus();}
});
</script>
</body>
</html>'''

with open('/home/user/webapp/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Written: {len(html)} chars")
print("Done!")
