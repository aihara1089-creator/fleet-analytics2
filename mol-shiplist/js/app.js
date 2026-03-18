/* ============================================================
   MOL 船舶管理リスト — app.js
   All-in-one: CSV parse, data analysis, charts, gantt, table
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS & CONFIG
// ============================================================
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

const DAYS_90  = 90  * 86400000;
const DAYS_180 = 180 * 86400000;

// Column definitions: [key, label, group]
const COLUMN_DEFS = [
  { key:'VESSEL_NAME',                   label:'船名',             group:'基本',    default:true  },
  { key:'VESSEL_TYPE',                   label:'船種',             group:'基本',    default:true  },
  { key:'BUILDER',                       label:'造船所',           group:'基本',    default:true  },
  { key:'BUILDERS_VESSEL_NUMBER',        label:'建造番号',         group:'基本',    default:true  },
  { key:'OWNERSHIP_TYPE_BEFORE_DELIVERY',label:'所有形態',         group:'基本',    default:true  },
  { key:'VESSEL_FLAG_STATE',             label:'船籍',             group:'基本',    default:false },
  { key:'VESSEL_CLASS_NAME',             label:'船級',             group:'基本',    default:false },
  { key:'CONSTRUCTION_START_DATE',       label:'起工日',           group:'工程',    default:true  },
  { key:'PLANNED_CONSTRUCTION_START_DATE',label:'起工予定日',      group:'工程',    default:true  },
  { key:'LAUNCH_DATE',                   label:'進水日',           group:'工程',    default:true  },
  { key:'PLANNED_LAUNCH_DATE',           label:'進水予定日',       group:'工程',    default:true  },
  { key:'PLANNED_SEA_TRIALS_DATE',       label:'試運転予定日',     group:'工程',    default:true  },
  { key:'PLANNED_DATE_OF_BUILD_DATE',    label:'竣工予定日',       group:'工程',    default:true  },
  { key:'CONTRACT_DELIVERY_DATE_FROM',   label:'契約引渡(From)',   group:'工程',    default:true  },
  { key:'CONTRACT_DELIVERY_DATE_TO',     label:'契約引渡(To)',     group:'工程',    default:true  },
  { key:'LOA',                           label:'LOA(m)',           group:'船型',    default:false },
  { key:'BEAM',                          label:'幅(m)',            group:'船型',    default:false },
  { key:'DRAFT_DESIGN',                  label:'吃水(設計)(m)',    group:'船型',    default:false },
  { key:'GROSS_TON',                     label:'GT',               group:'船型',    default:false },
  { key:'DWT_GUARANTEE_MT',              label:'DWT(MT)',          group:'船型',    default:false },
  { key:'PLANNED_SAILING_SPEED_KTS',     label:'速力(kts)',        group:'船型',    default:false },
  { key:'IMO_NO',                        label:'IMO番号',          group:'その他',  default:false },
  { key:'VESSEL_STATUS_OF_USE',          label:'使用状態',         group:'その他',  default:false },
  { key:'SHIPBUILDING_CONTRUCT_PURCHASER',label:'発注者',          group:'その他',  default:false },
  { key:'REMARKS_TECHNICAL_DIV',         label:'技術部備考',       group:'その他',  default:false },
];

const DATE_KEYS = [
  'SHIPBUILDING_CONTRUCT_DATE','CONSTRUCTION_START_DATE_ON_CERTIFICATE',
  'PLANNED_CONSTRUCTION_START_DATE','CONSTRUCTION_START_DATE',
  'PLANNED_LAUNCH_DATE','LAUNCH_DATE','PLANNED_SEA_TRIALS_DATE',
  'PLANNED_CONSTRUCTION_COMPLETE_DATE','PLANNED_DATE_OF_BUILD_DATE',
  'CONTRACT_DELIVERY_DATE_FROM','CONTRACT_DELIVERY_DATE_TO',
  'VESSEL_NAME_FIX_DEADLINE',
];

// Milestone definition for timeline
const MILESTONES = [
  { key:'CONSTRUCTION_START_DATE',        planned:'PLANNED_CONSTRUCTION_START_DATE', label:'起工',    cls:'keel'     },
  { key:'LAUNCH_DATE',                    planned:'PLANNED_LAUNCH_DATE',             label:'進水',    cls:'launch'   },
  { key:'PLANNED_SEA_TRIALS_DATE',        planned:'PLANNED_SEA_TRIALS_DATE',         label:'試運転',  cls:'trial'    },
  { key:'CONTRACT_DELIVERY_DATE_FROM',    planned:'PLANNED_DATE_OF_BUILD_DATE',      label:'引渡',    cls:'delivery' },
];

// ============================================================
// STATE
// ============================================================
let allData     = [];
let filtered    = [];
let sortKey     = '';
let sortDir     = 1;
let currentPage = 1;
const PAGE_SIZE = 25;
let visibleCols = COLUMN_DEFS.filter(c=>c.default).map(c=>c.key);
let charts      = {};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function parseDate(str) {
  if(!str || str.trim()==='' || str.trim()==='-') return null;
  const s = str.trim().replace(/\//g,'-').replace(/年/g,'-').replace(/月/g,'-').replace(/日/g,'');
  // Try YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  // Try YYYYMMDD
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  // Try MM/DD/YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if(m) return new Date(+m[3], +m[1]-1, +m[2]);
  // Try YYYY-MM
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if(m) return new Date(+m[1], +m[2]-1, 1);
  return null;
}

function formatDate(d, fallback='—') {
  if(!d) return fallback;
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${day}`;
}

function diffDays(d) {
  if(!d) return null;
  return Math.round((d - TODAY) / 86400000);
}

function getNextMilestoneDate(row) {
  for(const m of MILESTONES) {
    const d = row._dates[m.key] || row._dates[m.planned];
    if(d && d >= TODAY) return { date: d, label: m.label, cls: m.cls };
  }
  return null;
}

function getDeliveryDate(row) {
  return row._dates['CONTRACT_DELIVERY_DATE_FROM']
      || row._dates['CONTRACT_DELIVERY_DATE_TO']
      || row._dates['PLANNED_DATE_OF_BUILD_DATE'];
}

function daysLabel(days) {
  if(days === null) return '—';
  if(days < 0) return `${Math.abs(days)}日前`;
  if(days === 0) return '本日';
  return `${days}日後`;
}

function daysStatus(days) {
  if(days === null) return 'normal';
  if(days < 0) return 'done';
  if(days <= 30) return 'urgent';
  if(days <= 90) return 'warning';
  return 'normal';
}

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i>${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

// ============================================================
// CSV PARSER (handles quoted fields, SJIS fallback)
// ============================================================
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if(lines.length < 2) return [];
  
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  
  for(let i=1; i<lines.length; i++) {
    const line = lines[i].trim();
    if(!line) continue;
    const cells = splitCSVLine(line);
    const obj = {};
    headers.forEach((h,j)=>{ obj[h.trim()] = (cells[j]||'').trim(); });
    
    // Parse dates
    obj._dates = {};
    DATE_KEYS.forEach(k=>{
      const d = parseDate(obj[k]);
      if(d) obj._dates[k] = d;
    });
    
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for(let i=0; i<line.length; i++) {
    const c = line[i];
    if(c==='"') {
      if(inQuote && line[i+1]==='"') { cur+='"'; i++; }
      else inQuote = !inQuote;
    } else if(c===',' && !inQuote) {
      result.push(cur); cur='';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ============================================================
// DATA ANALYSIS
// ============================================================
function analyzeData(rows) {
  const now = TODAY.getTime();
  let upcoming90=0, upcoming180=0, delivery90=0;
  const typeCount={}, ownerCount={}, yearCount={};

  rows.forEach(r=>{
    // Count upcoming construction starts
    const keel = r._dates['CONSTRUCTION_START_DATE'] || r._dates['PLANNED_CONSTRUCTION_START_DATE'];
    if(keel) {
      const diff = keel - now;
      if(diff >= 0 && diff <= DAYS_90)  upcoming90++;
      if(diff >= 0 && diff <= DAYS_180) upcoming180++;
    }
    // Delivery
    const del = getDeliveryDate(r);
    if(del) {
      const diff = del - now;
      if(diff >= 0 && diff <= DAYS_90) delivery90++;
    }
    // Vessel type
    const vt = r.VESSEL_TYPE || '不明';
    typeCount[vt] = (typeCount[vt]||0)+1;
    // Ownership
    const ow = r.OWNERSHIP_TYPE_BEFORE_DELIVERY || '不明';
    ownerCount[ow] = (ownerCount[ow]||0)+1;
    // Year
    if(del) {
      const y = del.getFullYear();
      yearCount[y] = (yearCount[y]||0)+1;
    }
  });

  return { upcoming90, upcoming180, delivery90, typeCount, ownerCount, yearCount };
}

// ============================================================
// RENDER KPI
// ============================================================
function renderKPI(rows, stats) {
  document.getElementById('kpiTotalVal').textContent    = rows.length;
  document.getElementById('kpiUpcomingVal').textContent = stats.upcoming90;
  document.getElementById('kpiDeliveryVal').textContent = stats.delivery90;
  document.getElementById('kpiTypesVal').textContent    = Object.keys(stats.typeCount).length;

  document.getElementById('totalCount').innerHTML =
    `<i class="fas fa-ship"></i> ${rows.length} 隻`;
  document.getElementById('lastUpdated').innerHTML =
    `<i class="fas fa-clock"></i> ${formatDate(TODAY)} 現在`;
}

// ============================================================
// RENDER TIMELINE BANNER
// ============================================================
function renderBanner(rows) {
  const banner = document.getElementById('timelineBanner');
  const alerts = [];

  rows.forEach(r=>{
    // Next milestone
    const next = getNextMilestoneDate(r);
    if(!next) return;
    const days = diffDays(next.date);
    if(days===null) return;
    if(days >= 0 && days <= 30) {
      alerts.push({ name: r.VESSEL_NAME||'—', label: next.label, days, cls:'urgent', icon:'fa-exclamation-triangle' });
    } else if(days >= 0 && days <= 90) {
      alerts.push({ name: r.VESSEL_NAME||'—', label: next.label, days, cls:'warning', icon:'fa-clock' });
    }
  });

  alerts.sort((a,b)=>a.days-b.days);
  if(alerts.length===0) { banner.innerHTML=''; return; }

  banner.innerHTML = alerts.slice(0,8).map(a=>
    `<span class="alert-chip ${a.cls}">
      <i class="fas ${a.icon}"></i>
      <strong>${a.name}</strong>&nbsp;${a.label}：${daysLabel(a.days)}
    </span>`
  ).join('');
}

// ============================================================
// RENDER CHARTS
// ============================================================
const CHART_COLORS = [
  '#3b82f6','#22c55e','#f97316','#8b5cf6','#ec4899',
  '#14b8a6','#f59e0b','#64748b','#ef4444','#06b6d4',
];

function renderCharts(stats) {
  // Destroy existing
  Object.values(charts).forEach(c=>c.destroy());
  charts = {};

  // 1. Vessel Type Bar
  const typeLabels = Object.keys(stats.typeCount);
  const typeVals   = typeLabels.map(k=>stats.typeCount[k]);
  charts.type = new Chart(document.getElementById('chartVesselType'), {
    type: 'bar',
    data: {
      labels: typeLabels,
      datasets: [{
        data: typeVals,
        backgroundColor: CHART_COLORS.slice(0, typeLabels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: {
        label: ctx=>`${ctx.parsed.y} 隻`
      }}},
      scales: {
        x: { grid: { display:false }, ticks: { font:{size:11}, color:'#64748b' } },
        y: { grid: { color:'#f1f5f9' }, ticks: { stepSize:1, font:{size:11}, color:'#64748b' } }
      }
    }
  });

  // 2. Ownership Pie
  const ownerLabels = Object.keys(stats.ownerCount);
  const ownerVals   = ownerLabels.map(k=>stats.ownerCount[k]);
  charts.owner = new Chart(document.getElementById('chartOwnership'), {
    type: 'doughnut',
    data: {
      labels: ownerLabels,
      datasets: [{
        data: ownerVals,
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position:'bottom', labels:{ font:{size:10}, color:'#64748b', boxWidth:10, padding:8 } },
        tooltip: { callbacks:{ label: ctx=>`${ctx.label}: ${ctx.parsed} 隻` }}
      }
    }
  });

  // 3. Delivery Year Line
  const years = Object.keys(stats.yearCount).sort();
  const yearVals = years.map(y=>stats.yearCount[y]);
  charts.year = new Chart(document.getElementById('chartDeliveryYear'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        data: yearVals,
        backgroundColor: 'rgba(59,130,246,.15)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        borderRadius: 5,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{
        label: ctx=>`${ctx.parsed.y} 隻`
      }}},
      scales: {
        x: { grid:{display:false}, ticks:{font:{size:11},color:'#64748b'} },
        y: { grid:{color:'#f1f5f9'}, ticks:{stepSize:1,font:{size:11},color:'#64748b'} }
      }
    }
  });
}

// ============================================================
// RENDER GANTT
// ============================================================
function renderGantt(rows) {
  const container = document.getElementById('ganttContainer');

  // Build month headers: today-2 months → today+22 months = 24 cols
  const startMonth = new Date(TODAY.getFullYear(), TODAY.getMonth()-2, 1);
  const MONTHS = 26;
  const months = [];
  for(let i=0; i<MONTHS; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth()+i, 1);
    months.push(d);
  }
  const ganttEnd = new Date(months[months.length-1].getFullYear(), months[months.length-1].getMonth()+1, 1);

  // Filter rows that have any milestone in range
  const ganttRows = rows.filter(r=>{
    return MILESTONES.some(m=>{
      const d = r._dates[m.key] || r._dates[m.planned];
      return d && d >= startMonth && d <= ganttEnd;
    });
  }).slice(0,40); // max 40 rows

  if(ganttRows.length===0) {
    container.innerHTML = '<p class="empty-msg">今後24ヶ月以内に工程予定の船舶がありません</p>';
    return;
  }

  const totalMs = ganttEnd - startMonth;

  // Header
  let headerCells = `<th class="gantt-name-col">船名</th>`;
  months.forEach(m=>{
    const isToday = (m.getFullYear()===TODAY.getFullYear() && m.getMonth()===TODAY.getMonth());
    headerCells += `<th class="month-cell${isToday?' month-today':''}">${m.getFullYear()}/${String(m.getMonth()+1).padStart(2,'0')}</th>`;
  });

  // Rows
  let bodyRows = '';
  ganttRows.forEach(r=>{
    let cells = `<td>
      <div class="gantt-name">${r.VESSEL_NAME||'—'}</div>
      <div class="gantt-yard">${r.BUILDER||''} ${r.BUILDERS_VESSEL_NUMBER||''}</div>
    </td>`;

    months.forEach((m,i)=>{
      const cellStart = m;
      const cellEnd   = months[i+1] || ganttEnd;
      const cellMs    = cellEnd - cellStart;

      let barsHTML = '';
      MILESTONES.forEach(mil=>{
        const d = r._dates[mil.key] || r._dates[mil.planned];
        if(!d) return;
        if(d < cellStart || d >= cellEnd) return;
        // Position within cell
        const pct = ((d - cellStart) / cellMs * 100).toFixed(1);
        const isPast = d < TODAY;
        barsHTML += `<div class="gantt-bar ${mil.cls}${isPast?' past':''}"
          style="left:${pct}%;width:8px;margin-left:-4px;"
          title="${r.VESSEL_NAME||'—'} — ${mil.label}: ${formatDate(d)}"></div>`;
      });

      const isToday = (m.getFullYear()===TODAY.getFullYear() && m.getMonth()===TODAY.getMonth());
      // today line
      let todayLine = '';
      if(isToday) {
        const pct = ((TODAY - cellStart) / cellMs * 100).toFixed(1);
        todayLine = `<div class="gantt-today-line" style="left:${pct}%"></div>`;
      }

      cells += `<td class="gantt-cell month-cell${isToday?' month-today':''}" style="position:relative;">${todayLine}${barsHTML}</td>`;
    });

    bodyRows += `<tr class="gantt-row" data-name="${r.VESSEL_NAME||''}">${cells}</tr>`;
  });

  container.innerHTML = `
    <table class="gantt-table">
      <thead><tr class="gantt-header-row">${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

// ============================================================
// FILTER DROPDOWNS
// ============================================================
function buildFilters(rows) {
  const types  = [...new Set(rows.map(r=>r.VESSEL_TYPE).filter(Boolean))].sort();
  const owners = [...new Set(rows.map(r=>r.OWNERSHIP_TYPE_BEFORE_DELIVERY).filter(Boolean))].sort();
  const years  = [...new Set(rows.map(r=>{ const d=getDeliveryDate(r); return d?d.getFullYear():null; }).filter(Boolean))].sort();

  const fType  = document.getElementById('filterType');
  const fOwner = document.getElementById('filterOwnership');
  const fYear  = document.getElementById('filterYear');

  fType.innerHTML  = '<option value="">すべての船種</option>'  + types.map(t=>`<option>${t}</option>`).join('');
  fOwner.innerHTML = '<option value="">すべての所有形態</option>'+ owners.map(o=>`<option>${o}</option>`).join('');
  fYear.innerHTML  = '<option value="">すべての納期年</option>'  + years.map(y=>`<option>${y}</option>`).join('');
}

// ============================================================
// TABLE RENDERING
// ============================================================
function buildTableHead() {
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));
  const statusCol = `<th data-key="_status" class="status-col">
    ステータス <i class="fas fa-sort sort-icon"></i>
  </th>`;
  const nextCol = `<th data-key="_next">
    次工程 <i class="fas fa-sort sort-icon"></i>
  </th>`;
  return `<tr>${statusCol}${nextCol}${cols.map(c=>`
    <th data-key="${c.key}">
      ${c.label} <i class="fas fa-sort sort-icon"></i>
    </th>`).join('')}</tr>`;
}

function buildTableRows(rows) {
  if(rows.length===0) return `<tr><td colspan="99" class="empty-msg">該当する船舶はありません</td></tr>`;
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));

  return rows.map(r=>{
    // Status: nearest milestone
    const next = getNextMilestoneDate(r);
    const days = next ? diffDays(next.date) : null;
    const st   = daysStatus(days);
    let rowCls = st==='urgent'?'row-urgent':st==='warning'?'row-warning':'';

    // Status badge
    let statusBadge = '';
    if(days===null) statusBadge = `<span class="badge badge-grey">未定</span>`;
    else if(days<0) statusBadge = `<span class="badge badge-done"><i class="fas fa-check"></i> 完了</span>`;
    else if(st==='urgent') statusBadge = `<span class="badge badge-urgent"><i class="fas fa-exclamation"></i> 緊急</span>`;
    else if(st==='warning') statusBadge = `<span class="badge badge-warning"><i class="fas fa-clock"></i> 注意</span>`;
    else statusBadge = `<span class="badge badge-normal">予定</span>`;

    // Next milestone cell
    let nextCell = '—';
    if(next) {
      nextCell = `<span class="badge badge-${daysStatus(days)}">
        ${next.label} ${daysLabel(days)}
      </span>`;
    }

    const cells = cols.map(c=>{
      let val = r[c.key] || '—';
      if(DATE_KEYS.includes(c.key)) {
        const d = r._dates[c.key];
        val = d ? formatDate(d) : (r[c.key]||'—');
      }
      return `<td>${val}</td>`;
    }).join('');

    return `<tr class="${rowCls}" data-uid="${r.VESSEL_UID||''}" data-name="${r.VESSEL_NAME||''}">
      <td>${statusBadge}</td>
      <td>${nextCell}</td>
      ${cells}
    </tr>`;
  }).join('');
}

function renderTable() {
  const start = (currentPage-1)*PAGE_SIZE;
  const pageRows = filtered.slice(start, start+PAGE_SIZE);
  document.getElementById('tableHead').innerHTML = buildTableHead();
  document.getElementById('tableBody').innerHTML = buildTableRows(pageRows);
  document.getElementById('tableCount').textContent = `${filtered.length} 件表示`;
  renderPagination();

  // Sort icons
  document.querySelectorAll('#tableHead th').forEach(th=>{
    th.addEventListener('click',()=>{
      const k = th.dataset.key;
      if(sortKey===k) sortDir*=-1; else { sortKey=k; sortDir=1; }
      applySort();
      renderTable();
    });
    if(th.dataset.key===sortKey) {
      th.classList.add(sortDir===1?'sorted-asc':'sorted-desc');
    }
  });

  // Row click → modal
  document.querySelectorAll('#tableBody tr[data-name]').forEach(tr=>{
    tr.addEventListener('click',()=>{
      const name = tr.dataset.name;
      const row = allData.find(r=>r.VESSEL_NAME===name);
      if(row) openModal(row);
    });
  });
}

function renderPagination() {
  const total = Math.ceil(filtered.length/PAGE_SIZE);
  const pg = document.getElementById('pagination');
  if(total<=1) { pg.innerHTML=''; return; }

  let html = `<button class="page-btn" id="pgPrev" ${currentPage===1?'disabled':''}>
    <i class="fas fa-chevron-left"></i>
  </button>`;

  const range = [];
  for(let i=1;i<=total;i++) {
    if(i===1||i===total||Math.abs(i-currentPage)<=2) range.push(i);
    else if(range[range.length-1]!=='...') range.push('...');
  }
  range.forEach(p=>{
    if(p==='...') html+=`<span class="page-btn" style="border:none;background:none;cursor:default">…</span>`;
    else html+=`<button class="page-btn${p===currentPage?' active':''}" data-p="${p}">${p}</button>`;
  });

  html+=`<button class="page-btn" id="pgNext" ${currentPage===total?'disabled':''}>
    <i class="fas fa-chevron-right"></i>
  </button>`;

  pg.innerHTML = html;
  pg.querySelectorAll('[data-p]').forEach(b=>{
    b.addEventListener('click',()=>{ currentPage=+b.dataset.p; renderTable(); });
  });
  const prev = pg.querySelector('#pgPrev');
  const next = pg.querySelector('#pgNext');
  if(prev) prev.addEventListener('click',()=>{ currentPage--; renderTable(); });
  if(next) next.addEventListener('click',()=>{ currentPage++; renderTable(); });
}

// ============================================================
// SORT & FILTER
// ============================================================
function applySort() {
  if(!sortKey) return;
  filtered.sort((a,b)=>{
    let av, bv;
    if(DATE_KEYS.includes(sortKey)||sortKey.startsWith('_')) {
      if(sortKey==='_status') {
        const an = getNextMilestoneDate(a); av = an?an.date:new Date(9999,0,1);
        const bn = getNextMilestoneDate(b); bv = bn?bn.date:new Date(9999,0,1);
        return (av-bv)*sortDir;
      }
      av = a._dates[sortKey]||new Date(9999,0,1);
      bv = b._dates[sortKey]||new Date(9999,0,1);
      return (av-bv)*sortDir;
    }
    av = (a[sortKey]||'').toLowerCase();
    bv = (b[sortKey]||'').toLowerCase();
    return av<bv?-sortDir:av>bv?sortDir:0;
  });
}

function applyFilters() {
  const q     = document.getElementById('searchInput').value.toLowerCase();
  const type  = document.getElementById('filterType').value;
  const owner = document.getElementById('filterOwnership').value;
  const year  = document.getElementById('filterYear').value;
  const status= document.getElementById('filterStatus').value;

  filtered = allData.filter(r=>{
    if(q && ![r.VESSEL_NAME,r.BUILDER,r.BUILDERS_VESSEL_NUMBER,r.YARD,r.BUILDER_YARD].some(v=>(v||'').toLowerCase().includes(q))) return false;
    if(type  && r.VESSEL_TYPE!==type)  return false;
    if(owner && r.OWNERSHIP_TYPE_BEFORE_DELIVERY!==owner) return false;
    if(year) {
      const d = getDeliveryDate(r);
      if(!d||String(d.getFullYear())!==year) return false;
    }
    if(status) {
      const keel = r._dates['CONSTRUCTION_START_DATE']||r._dates['PLANNED_CONSTRUCTION_START_DATE'];
      const del  = getDeliveryDate(r);
      const now  = TODAY.getTime();
      if(status==='upcoming90'  && !(keel && keel-now>=0 && keel-now<=DAYS_90)) return false;
      if(status==='upcoming180' && !(keel && keel-now>=0 && keel-now<=DAYS_180)) return false;
      if(status==='delivery90'  && !(del  && del-now>=0  && del-now<=DAYS_90)) return false;
    }
    return true;
  });
  applySort();
  currentPage = 1;
  renderTable();
}

// ============================================================
// COLUMN TOGGLE
// ============================================================
function buildColToggle() {
  const menu = document.getElementById('colToggleMenu');
  menu.innerHTML = COLUMN_DEFS.map(c=>`
    <label class="col-toggle-item">
      <input type="checkbox" data-key="${c.key}" ${visibleCols.includes(c.key)?'checked':''} />
      ${c.label}
    </label>`).join('');

  menu.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const k = inp.dataset.key;
      if(inp.checked) { if(!visibleCols.includes(k)) visibleCols.push(k); }
      else             visibleCols = visibleCols.filter(x=>x!==k);
      renderTable();
    });
  });
}

// ============================================================
// DETAIL MODAL
// ============================================================
function openModal(r) {
  document.getElementById('modalHeader').innerHTML = `
    <div class="modal-title">${r.VESSEL_NAME||'（船名未定）'}</div>
    <div class="modal-subtitle">
      ${r.VESSEL_TYPE||''} ｜ ${r.BUILDER||''} ｜ 建造番号: ${r.BUILDERS_VESSEL_NUMBER||'—'} ｜ IMO: ${r.IMO_NO||'—'}
    </div>`;

  // Milestone list
  const milestoneHTML = MILESTONES.map(m=>{
    const actual  = r._dates[m.key];
    const planned = r._dates[m.planned];
    const d = actual || planned;
    const days = d?diffDays(d):null;
    const isDone = d && d < TODAY;
    const isNext = !isDone && d && d >= TODAY;
    const label  = actual ? '実績' : (planned?'予定':'—');
    return `<div class="milestone-item${isDone?' done':''}${isNext?' next':''}">
      <div class="milestone-dot ${m.cls}"></div>
      <div class="milestone-label">${m.label} <small style="color:var(--slate-400)">(${label})</small></div>
      <div class="milestone-date">${formatDate(d)} ${days!==null&&!isDone?`<small>(${daysLabel(days)})</small>`:''}</div>
    </div>`;
  }).join('');

  // Specs grid
  const specs = [
    ['LOA',r.LOA||'—','m'], ['幅',r.BEAM||'—','m'], ['吃水(設計)',r.DRAFT_DESIGN||'—','m'],
    ['GT',r.GROSS_TON?Number(r.GROSS_TON).toLocaleString()+'T':'—',''], ['DWT',r.DWT_GUARANTEE_MT?Number(r.DWT_GUARANTEE_MT).toLocaleString()+'MT':'—',''],
    ['速力',r.PLANNED_SAILING_SPEED_KTS?r.PLANNED_SAILING_SPEED_KTS+' kts':'—',''],
    ['主機出力',r.MAIN_ENGINE_MAX_OUTPUT_KW?Number(r.MAIN_ENGINE_MAX_OUTPUT_KW).toLocaleString()+' kW':'—',''],
  ];

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">基本情報</div>
      <div class="modal-grid">
        ${[
          ['船名',r.VESSEL_NAME||'—',true],
          ['船種',r.VESSEL_TYPE||'—',false],
          ['技術部船種',r.VESSEL_TYPE_FOR_TECHNICAL_DIV||'—',false],
          ['所有形態',r.OWNERSHIP_TYPE_BEFORE_DELIVERY||'—',false],
          ['船籍',r.VESSEL_FLAG_STATE||'—',false],
          ['船級',r.VESSEL_CLASS_NAME||'—',false],
          ['発注者',r.SHIPBUILDING_CONTRUCT_PURCHASER||'—',false],
          ['使用状態',r.VESSEL_STATUS_OF_USE||'—',false],
          ['船名確定期限',formatDate(r._dates['VESSEL_NAME_FIX_DEADLINE']),false],
        ].map(([l,v,hl])=>`<div class="modal-field">
          <div class="modal-field-label">${l}</div>
          <div class="modal-field-value${hl?' highlight':''}">${v}</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">工程マイルストーン</div>
      <div class="milestone-list">${milestoneHTML}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">船型諸元</div>
      <div class="modal-grid">
        ${specs.map(([l,v])=>`<div class="modal-field">
          <div class="modal-field-label">${l}</div>
          <div class="modal-field-value">${v}</div>
        </div>`).join('')}
      </div>
    </div>

    ${r.REMARKS_TECHNICAL_DIV?`
    <div class="modal-section">
      <div class="modal-section-title">技術部備考</div>
      <p style="font-size:.85rem;color:var(--slate-700);line-height:1.7">${r.REMARKS_TECHNICAL_DIV}</p>
    </div>`:''}`;

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ============================================================
// EXPORT CSV
// ============================================================
function exportCSV() {
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));
  const header = ['ステータス','次工程',...cols.map(c=>c.label)].join(',');
  const rows = filtered.map(r=>{
    const next = getNextMilestoneDate(r);
    const days = next?diffDays(next.date):null;
    const st = next?`${next.label} ${daysLabel(days)}`:'—';
    return [
      daysStatus(days), st,
      ...cols.map(c=>{
        let v = r[c.key]||'';
        if(DATE_KEYS.includes(c.key)) v = formatDate(r._dates[c.key]);
        return `"${String(v).replace(/"/g,'""')}"`;
      })
    ].join(',');
  });

  const blob = new Blob(['\uFEFF'+header+'\n'+rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`MOL_船舶管理リスト_${formatDate(TODAY).replace(/\//g,'')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSVをエクスポートしました','success');
}

// ============================================================
// SAMPLE DATA
// ============================================================
function loadSampleData() {
  const today = TODAY;
  const d = (offsetDays) => {
    const dt = new Date(today); dt.setDate(dt.getDate()+offsetDays);
    return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
  };

  const csvLines = [
    'BUILDER_YARD,BUILDER,YARD,BUILDERS_VESSEL_NUMBER,VESSEL_NAME,VESSEL_TYPE,VESSEL_TYPE_FOR_TECHNICAL_DIV,OWNERSHIP_TYPE_BEFORE_DELIVERY,VESSEL_STATUS_OF_USE,VESSEL_NAME_FIX_DEADLINE,VESSEL_FLAG_STATE,VESSEL_CLASS_NAME,PORT_OF_REGISTRY,SHIPBUILDING_CONTRUCT_DATE,CONSTRUCTION_START_DATE_ON_CERTIFICATE,PLANNED_CONSTRUCTION_START_DATE,CONSTRUCTION_START_DATE,PLANNED_LAUNCH_DATE,LAUNCH_DATE,PLANNED_SEA_TRIALS_DATE,PLANNED_CONSTRUCTION_COMPLETE_DATE,PLANNED_DATE_OF_BUILD_DATE,CONTRACT_DELIVERY_DATE_FROM,CONTRACT_DELIVERY_DATE_TO,SHIPBUILDING_CONTRUCT_PURCHASER,REMARKS_TECHNICAL_DIV,LOA,LPP,BEAM,DEPTH,DRAFT_DESIGN,DRAFT_SCANTLING,GROSS_TON,NET_TON,DWT_GUARANTEE_MT,PLANNED_SAILING_SPEED_KTS,MAIN_ENGINE_MAX_OUTPUT_KW,IMO_NO,FLEET_OPTIMIZATION_EXECUTION_EXECTIVE_COMMITTEE_RESOLUTION_NUMBER,FLEET_OPTIMIZATION_EXECUTION_BOARD_RESOLUTION_NUMBER,ORIGINAL_USER,ORIGINAL_STAMP,UPDATE_USER,UPDATE_STAMP,VESSEL_UID',
    `IMABARI-1,今治造船,今治工場,1001,MOL TRIUMPH,コンテナ船,CONT,MOL,建造中,${d(-30)},パナマ,NK,パナマ,${d(-400)},${d(-380)},${d(-380)},${d(-375)},${d(60)},,,${d(120)},${d(150)},${d(140)},${d(160)},MOL Containership Ltd.,,400.0,380.0,59.0,33.5,16.0,16.5,210000,65000,200000,22.0,68000,9000001,,,,MOL,${d(-400)},MOL,${d(-100)},UID001`,
    `IMABARI-2,今治造船,今治工場,1002,MOL COSMOS,コンテナ船,CONT,MOL,建造中,,パナマ,NK,パナマ,${d(-300)},${d(-280)},${d(-280)},${d(-270)},${d(90)},,,${d(150)},${d(180)},${d(170)},${d(190)},MOL Containership Ltd.,,400.0,380.0,59.0,33.5,16.0,16.5,210000,65000,200000,22.0,68000,9000002,,,,MOL,${d(-300)},MOL,${d(-80)},UID002`,
    `JMU-1,Japan Marine United,横浜工場,2001,MOL MATRIX,自動車船,PCC,MOL,契約締結済,,パナマ,NK,東京,${d(-200)},,,${d(20)},${d(200)},,,${d(280)},${d(310)},${d(300)},${d(320)},MOL ACE Ltd.,,199.9,192.0,38.0,14.5,8.5,9.0,71000,21000,,18.5,16000,9000003,,,,MOL,${d(-200)},MOL,${d(-60)},UID003`,
    `JMU-2,Japan Marine United,横浜工場,2002,MOL VECTOR,自動車船,PCC,MOL,契約締結済,,パナマ,NK,東京,${d(-180)},,,${d(45)},${d(220)},,,${d(300)},${d(330)},${d(320)},${d(340)},MOL ACE Ltd.,次世代CO2削減型,199.9,192.0,38.0,14.5,8.5,9.0,71000,21000,,18.5,16000,9000004,,,,MOL,${d(-180)},MOL,${d(-50)},UID004`,
    `NAMURA-1,名村造船,佐世保工場,3001,MOL LEGACY,バルクキャリア,BC,MOL,基本設計中,,パナマ,NK,パナマ,${d(-100)},,,${d(80)},${d(350)},,,${d(420)},${d(450)},${d(440)},${d(460)},MOL Bulk Carriers Ltd.,,299.9,296.0,50.0,25.0,18.1,18.5,90000,54000,180000,14.5,11000,9000005,,,,MOL,${d(-100)},MOL,${d(-30)},UID005`,
    `NAMURA-2,名村造船,佐世保工場,3002,MOL LIBERTY,バルクキャリア,BC,MOL,基本設計中,,パナマ,NK,パナマ,${d(-90)},,,${d(100)},${d(380)},,,${d(450)},${d(480)},${d(470)},${d(490)},MOL Bulk Carriers Ltd.,,299.9,296.0,50.0,25.0,18.1,18.5,90000,54000,180000,14.5,11000,9000006,,,,MOL,${d(-90)},MOL,${d(-20)},UID006`,
    `MHI-1,三菱重工業,長崎工場,4001,MOL WONDER,クルーズ客船,CR,MOL,設計中,,バハマ,LR,ナッソー,${d(-50)},,,${d(150)},${d(500)},,,${d(600)},${d(640)},${d(630)},${d(650)},MOL Ferry Co.,,330.0,310.0,40.0,12.5,8.0,8.5,105000,42000,,22.0,62000,9000007,,,,MOL,${d(-50)},MOL,${d(-10)},UID007`,
    `OSHIMA-1,大島造船,大島工場,5001,MOL BRAVE,タンカー,TC,MOL,契約締結済,,パナマ,NK,パナマ,${d(-120)},,,${d(10)},${d(200)},,,${d(280)},${d(310)},${d(300)},${d(320)},MOL Chemical Tankers Ltd.,,249.9,243.0,43.8,21.0,14.8,15.5,60000,36000,105000,15.0,12000,9000008,,,,MOL,${d(-120)},MOL,${d(-40)},UID008`,
    `IMABARI-3,今治造船,今治工場,1003,MOL SPIRIT,コンテナ船,CONT,MOL,契約締結済,,パナマ,NK,パナマ,${d(-60)},,,${d(5)},${d(180)},,,${d(250)},${d(280)},${d(270)},${d(290)},MOL Containership Ltd.,メタノール対応型,366.0,350.0,51.0,30.0,14.5,15.2,150000,45000,145000,21.0,45000,9000009,,,,MOL,${d(-60)},MOL,${d(-5)},UID009`,
    `IMABARI-4,今治造船,今治工場,1004,MOL FUTURE,コンテナ船,CONT,MOL,基本設計中,,パナマ,NK,パナマ,${d(-30)},,,${d(30)},${d(210)},,,${d(280)},${d(310)},${d(300)},${d(320)},MOL Containership Ltd.,アンモニア対応型,366.0,350.0,51.0,30.0,14.5,15.2,150000,45000,145000,21.0,45000,9000010,,,,MOL,${d(-30)},MOL,${d(-3)},UID010`,
  ];

  loadData(csvLines.join('\n'));
  toast('サンプルデータを読み込みました','success');
}

// ============================================================
// MAIN LOAD FUNCTION
// ============================================================
function loadData(csvText) {
  try {
    allData = parseCSV(csvText);
    if(allData.length===0) { toast('データが見つかりませんでした','error'); return; }

    filtered = [...allData];
    const stats = analyzeData(allData);

    // Switch view
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Render all
    renderKPI(allData, stats);
    renderBanner(allData);
    renderCharts(stats);
    renderGantt(allData);
    buildFilters(allData);
    buildColToggle();

    // Default sort by next milestone date
    sortKey = '_status'; sortDir = 1;
    applySort();
    renderTable();

    toast(`${allData.length} 隻のデータを読み込みました`, 'success');
  } catch(e) {
    console.error(e);
    toast('CSVの読み込みに失敗しました: '+e.message, 'error');
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', ()=>{

  // File input
  const csvInput = document.getElementById('csvInput');
  csvInput.addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadData(ev.target.result);
    reader.onerror = ()=> {
      // Try Shift-JIS
      const r2 = new FileReader();
      r2.onload = ev2 => loadData(ev2.target.result);
      r2.readAsText(file, 'Shift_JIS');
    };
    reader.readAsText(file, 'UTF-8');
  });

  // Drag & Drop
  const dropZone = document.getElementById('dropZone');
  ['dragenter','dragover'].forEach(ev=>{
    dropZone.addEventListener(ev, e=>{ e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(ev=>{
    dropZone.addEventListener(ev, e=>{ e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('drop', e=>{
    const file = e.dataTransfer.files[0];
    if(!file || !file.name.endsWith('.csv')) { toast('CSVファイルを選択してください','error'); return; }
    const reader = new FileReader();
    reader.onload = ev=>loadData(ev.target.result);
    reader.readAsText(file,'UTF-8');
  });

  // Sample data
  document.getElementById('btnSample').addEventListener('click', loadSampleData);

  // Filters
  ['searchInput','filterType','filterOwnership','filterYear','filterStatus'].forEach(id=>{
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  // Export
  document.getElementById('btnExport').addEventListener('click', exportCSV);

  // Reset
  document.getElementById('btnReset').addEventListener('click', ()=>{
    document.getElementById('searchInput').value = '';
    document.getElementById('filterType').value  = '';
    document.getElementById('filterOwnership').value = '';
    document.getElementById('filterYear').value  = '';
    document.getElementById('filterStatus').value = '';
    applyFilters();
    toast('フィルターをリセットしました','info');
  });

  // Back
  document.getElementById('btnBack').addEventListener('click', ()=>{
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('csvInput').value='';
    allData=[]; filtered=[];
    Object.values(charts).forEach(c=>c.destroy()); charts={};
  });

  // Column toggle
  document.getElementById('btnColToggle').addEventListener('click', ()=>{
    document.getElementById('colToggleMenu').classList.toggle('hidden');
  });
  document.addEventListener('click', e=>{
    if(!e.target.closest('.col-toggle-wrap')) {
      document.getElementById('colToggleMenu').classList.add('hidden');
    }
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e=>{
    if(e.target===document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
});
