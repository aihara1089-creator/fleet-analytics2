/* ============================================================
   工事後情報リスト — app.js
   ============================================================ */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

// CSV header keys (trimmed)
const COL = {
  ID:           'ID',
  OWNER:        '船主/ship owner',
  MANAGER:      '管理会社/management company',
  CONTACT:      'コンタクト先/contact information',
  SHIPYARD:     '建造所/shipyard（船番）',
  CONNECTION:   '接続方法/remote connection method',
  WINDOWS:      'Windows version',
  TV_ID:        'TV ID password',
  VDR:          'VDR',
  VDR_IP:       'VDR IP address',
  LOGGER:       'Logger',
  LOGGER_IP:    'Logger IP address',
  EMS:          'EMS　プロトコル',
  IMO:          'IMO No.',
  FT_SERIAL:    'FT Serial number',
  BOX_PC:       'BOX PC Type',
  MAIL_METHOD:  'メール連携先/mail connection method',
  FT_IP:        'FT/FM IP address',
  MAIL_IP:      'mail PC IP address',
  SMTP:         'Autosend setting\n(SMTP Port number)',
  BOX_PLACE:    'FT BOX PC \n設置場所/located place',
  PROVIDER:     'プロバイダ/internet provider',
  INSTALL_DATE: '搭載時期/date of installation',
  NOTES:        '備考/notes',
};

// Normalize key: trim whitespace/newlines for matching
function normKey(s){ return (s||'').replace(/\s+/g,' ').trim(); }

const COLUMN_DEFS = [
  { key: COL.ID,           label: 'ID',             default: true  },
  { key: COL.OWNER,        label: '船主',            default: true  },
  { key: COL.MANAGER,      label: '管理会社',        default: true  },
  { key: COL.SHIPYARD,     label: '建造所（船番）',  default: true  },
  { key: COL.CONNECTION,   label: '接続方法',        default: true  },
  { key: COL.WINDOWS,      label: 'Windows Ver.',   default: true  },
  { key: COL.VDR,          label: 'VDR',            default: true  },
  { key: COL.VDR_IP,       label: 'VDR IP',         default: false },
  { key: COL.LOGGER,       label: 'Logger',         default: true  },
  { key: COL.LOGGER_IP,    label: 'Logger IP',      default: false },
  { key: COL.EMS,          label: 'EMS プロトコル', default: false },
  { key: COL.IMO,          label: 'IMO No.',        default: true  },
  { key: COL.FT_SERIAL,    label: 'FT Serial',      default: false },
  { key: COL.BOX_PC,       label: 'BOX PC Type',    default: true  },
  { key: COL.MAIL_METHOD,  label: 'メール連携',      default: false },
  { key: COL.FT_IP,        label: 'FT/FM IP',       default: false },
  { key: COL.MAIL_IP,      label: 'Mail PC IP',     default: false },
  { key: COL.SMTP,         label: 'SMTP Port',      default: false },
  { key: COL.BOX_PLACE,    label: 'BOX PC 設置場所', default: false },
  { key: COL.PROVIDER,     label: 'プロバイダ',      default: false },
  { key: COL.INSTALL_DATE, label: '搭載時期',        default: true  },
  { key: COL.NOTES,        label: '備考',            default: false },
];

const CHART_COLORS = [
  '#14b8a6','#3b82f6','#8b5cf6','#f97316','#22c55e',
  '#ec4899','#f59e0b','#64748b','#ef4444','#06b6d4',
  '#a78bfa','#34d399','#fb923c','#60a5fa','#f472b6',
];

// ============================================================
// STATE
// ============================================================
let allData     = [];
let filtered    = [];
let sortKey     = '';
let sortDir     = 1;
let currentPage = 1;
const PAGE_SIZE = 30;
let visibleCols = COLUMN_DEFS.filter(c=>c.default).map(c=>c.key);
let charts      = {};
// key map: normalized header → original header used in data
let keyMap      = {};

// ============================================================
// UTILITIES
// ============================================================
function parseInstallDate(str) {
  if(!str||str.trim()===''||str.trim()==='-') return null;
  const s = str.trim();
  // YYYY/MM or YYYY-MM or YYYY年M月
  let m = s.match(/^(\d{4})[\/\-年](\d{1,2})/);
  if(m) return new Date(+m[1], +m[2]-1, 1);
  // YYYY
  m = s.match(/^(\d{4})$/);
  if(m) return new Date(+m[1], 0, 1);
  return null;
}

function formatInstallDate(d, fallback='—') {
  if(!d) return fallback;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function isConnectable(r) {
  const v = (get(r, COL.CONNECTION)||'').trim();
  return v !== '' && v !== '-' && v !== '—';
}

function hasVdr(r) {
  const v = (get(r, COL.VDR)||'').trim().toLowerCase();
  return v && v !== '-' && v !== '—' && v !== 'none' && v !== 'no' && v !== 'なし';
}

function hasLogger(r) {
  const v = (get(r, COL.LOGGER)||'').trim().toLowerCase();
  return v && v !== '-' && v !== '—' && v !== 'none' && v !== 'no' && v !== 'なし';
}

function get(row, col) {
  // Try direct key first, then through keyMap
  if(row[col] !== undefined) return row[col];
  const mapped = keyMap[normKey(col)];
  if(mapped && row[mapped] !== undefined) return row[mapped];
  // fallback: iterate
  for(const k of Object.keys(row)){
    if(normKey(k) === normKey(col)) return row[k];
  }
  return '';
}

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i>${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

// ============================================================
// CSV PARSER
// ============================================================
function parseCSV(text) {
  // normalize line endings
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  if(lines.length < 2) return [];

  const rawHeaders = splitCSVLine(lines[0]);

  // Build key map: normalized → original
  keyMap = {};
  rawHeaders.forEach(h => { keyMap[normKey(h)] = h; });

  const rows = [];
  for(let i=1; i<lines.length; i++){
    const line = lines[i];
    if(!line.trim()) continue;
    const cells = splitCSVLine(line);
    const obj = {};
    rawHeaders.forEach((h,j)=>{ obj[h] = (cells[j]||'').trim(); });
    // Add parsed date
    obj._installDate = parseInstallDate(get(obj, COL.INSTALL_DATE));
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = ''; let inQ = false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){ if(inQ&&line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if(c===','&&!inQ){ result.push(cur); cur=''; }
    else cur+=c;
  }
  result.push(cur);
  return result;
}

// ============================================================
// ANALYSIS
// ============================================================
function analyzeData(rows) {
  const thisYear = TODAY.getFullYear();
  let connected=0, thisYearCount=0, vdrCount=0, loggerCount=0;
  const managerCount={}, connectionCount={}, windowsCount={}, boxPCCount={}, providerCount={}, yearCount={};

  rows.forEach(r=>{
    if(isConnectable(r)) connected++;
    if(r._installDate && r._installDate.getFullYear()===thisYear) thisYearCount++;
    if(hasVdr(r)) vdrCount++;
    if(hasLogger(r)) loggerCount++;

    // Manager
    const mgr = get(r,COL.MANAGER)||'不明';
    managerCount[mgr]=(managerCount[mgr]||0)+1;

    // Connection method
    const conn = get(r,COL.CONNECTION)||'不明';
    const connKey = conn.trim()===''||conn==='-'?'不明':conn;
    connectionCount[connKey]=(connectionCount[connKey]||0)+1;

    // Windows version
    const win = get(r,COL.WINDOWS)||'不明';
    windowsCount[win]=(windowsCount[win]||0)+1;

    // BOX PC
    const box = get(r,COL.BOX_PC)||'不明';
    boxPCCount[box]=(boxPCCount[box]||0)+1;

    // Provider
    const prov = get(r,COL.PROVIDER)||'不明';
    const provKey = prov.trim()===''||prov==='-'?'不明':prov;
    providerCount[provKey]=(providerCount[provKey]||0)+1;

    // Year
    if(r._installDate){
      const y=r._installDate.getFullYear();
      yearCount[y]=(yearCount[y]||0)+1;
    }
  });

  return { connected, thisYearCount, vdrCount, loggerCount,
    managerCount, connectionCount, windowsCount, boxPCCount, providerCount, yearCount };
}

// ============================================================
// RENDER KPI
// ============================================================
function renderKPI(rows, stats) {
  document.getElementById('kpiTotal').textContent    = rows.length;
  document.getElementById('kpiConnected').textContent= stats.connected;
  document.getElementById('kpiThisYear').textContent = stats.thisYearCount;
  document.getElementById('kpiManagers').textContent = Object.keys(stats.managerCount).length;
  document.getElementById('kpiVdr').textContent      = stats.vdrCount;
  document.getElementById('kpiLogger').textContent   = stats.loggerCount;

  document.getElementById('totalCount').innerHTML =
    `<i class="fas fa-database"></i> ${rows.length} 隻`;
  document.getElementById('lastUpdated').innerHTML =
    `<i class="fas fa-clock"></i> ${TODAY.getFullYear()}/${String(TODAY.getMonth()+1).padStart(2,'0')}/${String(TODAY.getDate()).padStart(2,'0')} 現在`;
}

// ============================================================
// RENDER CHARTS
// ============================================================
function renderCharts(stats) {
  Object.values(charts).forEach(c=>c.destroy());
  charts={};

  const chartOpts = (extra={}) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend:{display:false}, ...extra.plugins },
    scales: {
      x: { grid:{display:false}, ticks:{font:{size:10},color:'#64748b'} },
      y: { grid:{color:'#f1f5f9'}, ticks:{stepSize:1,font:{size:10},color:'#64748b'} }
    },
    ...extra
  });

  const doughnutOpts = {
    responsive:true, maintainAspectRatio:false,
    cutout:'58%',
    plugins:{
      legend:{ position:'bottom', labels:{font:{size:10},color:'#64748b',boxWidth:10,padding:8} },
      tooltip:{ callbacks:{ label: ctx=>`${ctx.label}: ${ctx.parsed} 隻` } }
    }
  };

  // 1. Manager bar (horizontal)
  const mgrEntries = Object.entries(stats.managerCount).sort((a,b)=>b[1]-a[1]).slice(0,12);
  charts.manager = new Chart(document.getElementById('chartManager'),{
    type:'bar',
    data:{
      labels: mgrEntries.map(e=>e[0]),
      datasets:[{
        data: mgrEntries.map(e=>e[1]),
        backgroundColor: CHART_COLORS.slice(0,mgrEntries.length),
        borderRadius:5, borderSkipped:false,
      }]
    },
    options: chartOpts({
      indexAxis:'y',
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>`${ctx.parsed.x} 隻` } } },
      scales:{
        x:{ grid:{color:'#f1f5f9'}, ticks:{font:{size:10},color:'#64748b'} },
        y:{ grid:{display:false}, ticks:{font:{size:10},color:'#64748b'} }
      }
    })
  });

  // 2. Connection doughnut
  const connEntries = Object.entries(stats.connectionCount);
  charts.connection = new Chart(document.getElementById('chartConnection'),{
    type:'doughnut',
    data:{
      labels: connEntries.map(e=>e[0]),
      datasets:[{ data:connEntries.map(e=>e[1]), backgroundColor:CHART_COLORS, borderWidth:2, borderColor:'#fff' }]
    },
    options: doughnutOpts
  });

  // 3. Yearly bar
  const yearEntries = Object.entries(stats.yearCount).sort((a,b)=>+a[0]-+b[0]);
  charts.yearly = new Chart(document.getElementById('chartYearly'),{
    type:'bar',
    data:{
      labels: yearEntries.map(e=>e[0]),
      datasets:[{
        data: yearEntries.map(e=>e[1]),
        backgroundColor: 'rgba(20,184,166,.2)',
        borderColor:'#14b8a6', borderWidth:2, borderRadius:5
      }]
    },
    options: chartOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>`${ctx.parsed.y} 隻` } } } })
  });

  // 4. Windows doughnut
  const winEntries = Object.entries(stats.windowsCount);
  charts.windows = new Chart(document.getElementById('chartWindows'),{
    type:'doughnut',
    data:{
      labels: winEntries.map(e=>e[0]),
      datasets:[{ data:winEntries.map(e=>e[1]), backgroundColor:CHART_COLORS, borderWidth:2, borderColor:'#fff' }]
    },
    options: doughnutOpts
  });

  // 5. BOX PC doughnut
  const boxEntries = Object.entries(stats.boxPCCount);
  charts.boxPC = new Chart(document.getElementById('chartBoxPC'),{
    type:'doughnut',
    data:{
      labels: boxEntries.map(e=>e[0]),
      datasets:[{ data:boxEntries.map(e=>e[1]), backgroundColor:CHART_COLORS, borderWidth:2, borderColor:'#fff' }]
    },
    options: doughnutOpts
  });

  // 6. Provider doughnut
  const provEntries = Object.entries(stats.providerCount).sort((a,b)=>b[1]-a[1]);
  charts.provider = new Chart(document.getElementById('chartProvider'),{
    type:'doughnut',
    data:{
      labels: provEntries.map(e=>e[0]),
      datasets:[{ data:provEntries.map(e=>e[1]), backgroundColor:CHART_COLORS, borderWidth:2, borderColor:'#fff' }]
    },
    options: doughnutOpts
  });
}

// ============================================================
// FILTER DROPDOWNS
// ============================================================
function buildFilters(rows) {
  const managers    = [...new Set(rows.map(r=>get(r,COL.MANAGER)).filter(Boolean))].sort();
  const connections = [...new Set(rows.map(r=>get(r,COL.CONNECTION)).filter(v=>v&&v!=='-'))].sort();
  const windows     = [...new Set(rows.map(r=>get(r,COL.WINDOWS)).filter(Boolean))].sort();
  const years       = [...new Set(rows.map(r=>r._installDate?r._installDate.getFullYear():null).filter(Boolean))].sort();

  document.getElementById('filterManager').innerHTML =
    '<option value="">すべての管理会社</option>' + managers.map(v=>`<option>${v}</option>`).join('');
  document.getElementById('filterConnection').innerHTML =
    '<option value="">すべての接続方法</option>' + connections.map(v=>`<option>${v}</option>`).join('');
  document.getElementById('filterWindows').innerHTML =
    '<option value="">すべてのWindows Ver.</option>' + windows.map(v=>`<option>${v}</option>`).join('');
  document.getElementById('filterYear').innerHTML =
    '<option value="">すべての搭載年</option>' + years.map(v=>`<option>${v}</option>`).join('');
}

// ============================================================
// TABLE
// ============================================================
function buildBadge(val, type='default') {
  const v = (val||'').trim();
  if(!v||v==='-'||v==='—') return `<span class="badge badge-no">—</span>`;
  if(type==='yesno') {
    const lo = v.toLowerCase();
    if(lo==='no'||lo==='なし'||lo==='none') return `<span class="badge badge-no">なし</span>`;
    return `<span class="badge badge-yes"><i class="fas fa-check"></i> ${v}</span>`;
  }
  if(type==='connection') return `<span class="badge badge-teal"><i class="fas fa-network-wired"></i> ${v}</span>`;
  if(type==='windows') return `<span class="badge badge-blue"><i class="fab fa-windows"></i> ${v}</span>`;
  if(type==='box') return `<span class="badge badge-purple">${v}</span>`;
  if(type==='ip') return v?`<span class="ip-link">${v}</span>`:'—';
  return v;
}

function buildTableHead() {
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));
  return `<tr>${cols.map(c=>`
    <th data-key="${c.key}">
      ${c.label} <i class="fas fa-sort sort-icon"></i>
    </th>`).join('')}</tr>`;
}

function buildTableRows(rows) {
  if(!rows.length) return `<tr><td colspan="99" class="empty-msg">該当する船舶はありません</td></tr>`;
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));

  return rows.map(r=>{
    const cells = cols.map(c=>{
      const v = get(r, c.key);
      let cell;
      if(c.key===COL.VDR||c.key===COL.LOGGER) cell = buildBadge(v,'yesno');
      else if(c.key===COL.CONNECTION) cell = buildBadge(v,'connection');
      else if(c.key===COL.WINDOWS)    cell = buildBadge(v,'windows');
      else if(c.key===COL.BOX_PC)     cell = buildBadge(v,'box');
      else if(c.key===COL.VDR_IP||c.key===COL.LOGGER_IP||c.key===COL.FT_IP||c.key===COL.MAIL_IP)
                                       cell = buildBadge(v,'ip');
      else if(c.key===COL.INSTALL_DATE) cell = r._installDate ? formatInstallDate(r._installDate) : (v||'—');
      else cell = v||'—';
      return `<td>${cell}</td>`;
    }).join('');
    const id = get(r,COL.ID)||'';
    const owner = get(r,COL.OWNER)||'';
    return `<tr data-id="${id}" data-owner="${owner}">${cells}</tr>`;
  }).join('');
}

function renderTable() {
  const start = (currentPage-1)*PAGE_SIZE;
  const pageRows = filtered.slice(start, start+PAGE_SIZE);
  document.getElementById('tableHead').innerHTML = buildTableHead();
  document.getElementById('tableBody').innerHTML = buildTableRows(pageRows);
  document.getElementById('tableCount').textContent = `${filtered.length} 件表示`;
  renderPagination();

  // Sort
  document.querySelectorAll('#tableHead th').forEach(th=>{
    th.addEventListener('click',()=>{
      const k = th.dataset.key;
      if(sortKey===k) sortDir*=-1; else { sortKey=k; sortDir=1; }
      applySort(); renderTable();
    });
    if(th.dataset.key===sortKey)
      th.classList.add(sortDir===1?'sorted-asc':'sorted-desc');
  });

  // Row click
  document.querySelectorAll('#tableBody tr[data-id]').forEach(tr=>{
    tr.addEventListener('click',()=>{
      const id = tr.dataset.id;
      const owner = tr.dataset.owner;
      const row = allData.find(r=>get(r,COL.ID)===id && get(r,COL.OWNER)===owner);
      if(row) openModal(row);
    });
  });
}

function renderPagination() {
  const total = Math.ceil(filtered.length/PAGE_SIZE);
  const pg = document.getElementById('pagination');
  if(total<=1){ pg.innerHTML=''; return; }
  let html=`<button class="page-btn" id="pgPrev" ${currentPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  const range=[];
  for(let i=1;i<=total;i++){
    if(i===1||i===total||Math.abs(i-currentPage)<=2) range.push(i);
    else if(range[range.length-1]!=='...') range.push('...');
  }
  range.forEach(p=>{
    if(p==='...') html+=`<span class="page-btn" style="border:none;background:none;cursor:default">…</span>`;
    else html+=`<button class="page-btn${p===currentPage?' active':''}" data-p="${p}">${p}</button>`;
  });
  html+=`<button class="page-btn" id="pgNext" ${currentPage===total?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
  pg.innerHTML=html;
  pg.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{ currentPage=+b.dataset.p; renderTable(); }));
  const prev=pg.querySelector('#pgPrev'), next=pg.querySelector('#pgNext');
  if(prev) prev.addEventListener('click',()=>{ currentPage--; renderTable(); });
  if(next) next.addEventListener('click',()=>{ currentPage++; renderTable(); });
}

// ============================================================
// SORT & FILTER
// ============================================================
function applySort() {
  if(!sortKey) return;
  filtered.sort((a,b)=>{
    if(sortKey===COL.INSTALL_DATE){
      const av=a._installDate||new Date(9999,0,1), bv=b._installDate||new Date(9999,0,1);
      return (av-bv)*sortDir;
    }
    const av=(get(a,sortKey)||'').toLowerCase();
    const bv=(get(b,sortKey)||'').toLowerCase();
    return av<bv?-sortDir:av>bv?sortDir:0;
  });
}

function applyFilters() {
  const q    = document.getElementById('searchInput').value.toLowerCase();
  const mgr  = document.getElementById('filterManager').value;
  const conn = document.getElementById('filterConnection').value;
  const win  = document.getElementById('filterWindows').value;
  const year = document.getElementById('filterYear').value;
  const vdr  = document.getElementById('filterVdr').value;

  filtered = allData.filter(r=>{
    if(q){
      const searchFields = [
        get(r,COL.OWNER), get(r,COL.MANAGER), get(r,COL.SHIPYARD), get(r,COL.IMO),
        get(r,COL.ID), get(r,COL.CONTACT), get(r,COL.PROVIDER)
      ];
      if(!searchFields.some(v=>(v||'').toLowerCase().includes(q))) return false;
    }
    if(mgr  && get(r,COL.MANAGER)!==mgr)    return false;
    if(conn && get(r,COL.CONNECTION)!==conn) return false;
    if(win  && get(r,COL.WINDOWS)!==win)     return false;
    if(year && (!r._installDate || String(r._installDate.getFullYear())!==year)) return false;
    if(vdr==='yes' && !hasVdr(r))    return false;
    if(vdr==='no'  && hasVdr(r))     return false;
    return true;
  });
  applySort();
  currentPage=1;
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
      const k=inp.dataset.key;
      if(inp.checked){ if(!visibleCols.includes(k)) visibleCols.push(k); }
      else visibleCols=visibleCols.filter(x=>x!==k);
      renderTable();
    });
  });
}

// ============================================================
// MODAL
// ============================================================
function ipField(val) {
  const v=(val||'').trim();
  if(!v||v==='-') return '—';
  return `<span class="modal-field-value mono">${v}</span>`;
}
function yesnoField(val) {
  const v=(val||'').trim();
  if(!v||v==='-'||v.toLowerCase()==='no'||v.toLowerCase()==='なし') return `<span class="badge badge-no">なし</span>`;
  return `<span class="badge badge-yes"><i class="fas fa-check"></i> ${v}</span>`;
}

function openModal(r) {
  const owner   = get(r,COL.OWNER)   ||'—';
  const manager = get(r,COL.MANAGER) ||'—';
  const imo     = get(r,COL.IMO)     ||'—';
  const shipyard= get(r,COL.SHIPYARD)||'—';

  document.getElementById('modalHeader').innerHTML=`
    <div class="modal-title">${owner}</div>
    <div class="modal-subtitle">管理: ${manager} ｜ 建造所: ${shipyard} ｜ IMO: ${imo}</div>`;

  document.getElementById('modalBody').innerHTML=`
    <!-- 基本情報 -->
    <div class="modal-section">
      <div class="modal-section-title">基本情報</div>
      <div class="modal-grid">
        ${[
          ['ID',                     get(r,COL.ID)||'—'],
          ['船主',                   owner],
          ['管理会社',               manager],
          ['コンタクト先',           get(r,COL.CONTACT)||'—'],
          ['建造所（船番）',          shipyard],
          ['IMO No.',                imo],
          ['搭載時期',               r._installDate ? formatInstallDate(r._installDate) : (get(r,COL.INSTALL_DATE)||'—')],
          ['使用状態',               get(r,COL.EMS)||'—'],
        ].map(([l,v])=>`
          <div class="modal-field">
            <div class="modal-field-label">${l}</div>
            <div class="modal-field-value">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- ネットワーク情報 -->
    <div class="modal-section">
      <div class="modal-section-title">ネットワーク・接続情報</div>
      <div class="net-grid">
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-network-wired"></i> 接続方法</div>
          <div class="net-card-ip">${get(r,COL.CONNECTION)||'—'}</div>
        </div>
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-wifi"></i> プロバイダ</div>
          <div class="net-card-ip">${get(r,COL.PROVIDER)||'—'}</div>
        </div>
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-server"></i> FT/FM IP</div>
          <div class="net-card-ip">${get(r,COL.FT_IP)||'—'}</div>
        </div>
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-envelope"></i> Mail PC IP</div>
          <div class="net-card-ip">${get(r,COL.MAIL_IP)||'—'}</div>
        </div>
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-hdd"></i> VDR IP</div>
          <div class="net-card-ip">${get(r,COL.VDR_IP)||'—'}</div>
        </div>
        <div class="net-card">
          <div class="net-card-title"><i class="fas fa-chart-line"></i> Logger IP</div>
          <div class="net-card-ip">${get(r,COL.LOGGER_IP)||'—'}</div>
        </div>
      </div>
    </div>

    <!-- システム情報 -->
    <div class="modal-section">
      <div class="modal-section-title">システム情報</div>
      <div class="modal-grid">
        <div class="modal-field">
          <div class="modal-field-label">Windows Version</div>
          <div class="modal-field-value">${get(r,COL.WINDOWS)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">BOX PC Type</div>
          <div class="modal-field-value">${get(r,COL.BOX_PC)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">BOX PC 設置場所</div>
          <div class="modal-field-value">${get(r,COL.BOX_PLACE)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">FT Serial Number</div>
          <div class="modal-field-value">${get(r,COL.FT_SERIAL)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">TV ID / Password</div>
          <div class="modal-field-value">${get(r,COL.TV_ID)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">SMTP Port</div>
          <div class="modal-field-value">${get(r,COL.SMTP)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">VDR</div>
          <div class="modal-field-value">${yesnoField(get(r,COL.VDR))}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">Logger</div>
          <div class="modal-field-value">${yesnoField(get(r,COL.LOGGER))}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">EMS プロトコル</div>
          <div class="modal-field-value">${get(r,COL.EMS)||'—'}</div>
        </div>
        <div class="modal-field">
          <div class="modal-field-label">メール連携先</div>
          <div class="modal-field-value">${get(r,COL.MAIL_METHOD)||'—'}</div>
        </div>
      </div>
    </div>

    ${get(r,COL.NOTES) ? `
    <div class="modal-section">
      <div class="modal-section-title">備考 / Notes</div>
      <p style="font-size:.84rem;color:var(--slate-700);line-height:1.8;white-space:pre-wrap">${get(r,COL.NOTES)}</p>
    </div>` : ''}
  `;

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow='';
}

// ============================================================
// EXPORT
// ============================================================
function exportCSV() {
  const cols = COLUMN_DEFS.filter(c=>visibleCols.includes(c.key));
  const header = cols.map(c=>c.label).join(',');
  const rows = filtered.map(r=>
    cols.map(c=>{
      let v = get(r,c.key)||'';
      if(c.key===COL.INSTALL_DATE && r._installDate) v=formatInstallDate(r._installDate);
      return `"${String(v).replace(/"/g,'""')}"`;
    }).join(',')
  );
  const ts = `${TODAY.getFullYear()}${String(TODAY.getMonth()+1).padStart(2,'0')}${String(TODAY.getDate()).padStart(2,'0')}`;
  const blob = new Blob(['\uFEFF'+header+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`工事後情報リスト_${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSVをエクスポートしました','success');
}

// ============================================================
// SAMPLE DATA
// ============================================================
function loadSampleData() {
  const d = (y,m) => `${y}/${String(m).padStart(2,'0')}`;
  const csv = [
`ID,船主/ship owner,管理会社/management company,コンタクト先/contact information,建造所/shipyard（船番）,接続方法/remote connection method,Windows version,TV ID password,VDR,VDR IP address,Logger,Logger IP address,EMS　プロトコル,IMO No.,FT Serial number,BOX PC Type,メール連携先/mail connection method,FT/FM IP address,mail PC IP address,"Autosend setting\n(SMTP Port number)","FT BOX PC \n設置場所/located place",プロバイダ/internet provider,搭載時期/date of installation,備考/notes`,
`001,MOL Ship Owners Ltd.,今治船舶管理,tech@imabari.co.jp,今治造船（1001），VPN,Windows 10,TV-001 / pass123,JRC JCY-1800,192.168.1.100,Furuno FV-800,192.168.1.101,NMEA 2000,9100001,FT-20240001,NEC Express,Inmarsat Fleet One,10.0.1.1,10.0.1.2,25,Engine Control Room,Inmarsat,${d(2024,3)},初搭載`,
`002,MOL Ship Owners Ltd.,今治船舶管理,tech@imabari.co.jp,今治造船（1002），VPN,Windows 11,TV-002 / pass456,Consilium Selesmar,192.168.2.100,Furuno FV-800,192.168.2.101,NMEA 2000,9100002,FT-20240002,Panasonic CF,Inmarsat Fleet One,10.0.2.1,10.0.2.2,587,Engine Control Room,Inmarsat,${d(2024,5)},EMS MODBUS対応`,
`003,MOL Tankers Ltd.,JMM東京,contact@jmm.co.jp,JMU横浜（2001），VSAT,Windows 10,TV-003 / abc789,None,-,Furuno FV-710,192.168.3.101,MODBUS,9100003,FT-20230003,Dell OptiPlex,Iridium,10.0.3.1,10.0.3.2,465,Navigation Bridge,VSAT Global,${d(2023,11)},Logger IPのみ確認済`,
`004,MOL Tankers Ltd.,JMM東京,contact@jmm.co.jp,JMU横浜（2002），VSAT,Windows 11,TV-004 / xyz012,JRC JCY-1900,192.168.4.100,Furuno FV-800,192.168.4.101,NMEA 2000,9100004,FT-20240004,NEC Express,Iridium,10.0.4.1,10.0.4.2,25,Engine Control Room,VSAT Global,${d(2024,1)},メタノール対応型`,
`005,MOL Bulk Carriers,名村船舶管理,info@namura-sm.co.jp,名村造船（3001），3G/LTE,Windows 10,TV-005 / lmn345,None,-,Furuno FV-800,192.168.5.101,NMEA 0183,9100005,FT-20220005,Panasonic CF,SoftBank Maritime,10.0.5.1,10.0.5.2,587,Engine Control Room,NTT Docomo,${d(2022,7)},旧型モデル`,
`006,MOL Bulk Carriers,名村船舶管理,info@namura-sm.co.jp,名村造船（3002），3G/LTE,Windows 11,TV-006 / opq678,None,-,Furuno FV-710,192.168.6.101,NMEA 0183,9100006,FT-20230006,Dell OptiPlex,SoftBank Maritime,10.0.6.1,10.0.6.2,465,Navigation Bridge,NTT Docomo,${d(2023,4)},アップグレード予定`,
`007,MOL Ferry Co.,MHI船舶管理,mgr@mhi-sm.co.jp,三菱重工（4001），VPN,Windows 10,TV-007 / rst901,JRC JCY-1800,192.168.7.100,Furuno FV-800,192.168.7.101,NMEA 2000,9100007,FT-20231007,NEC Express,Inmarsat Fleet One,10.0.7.1,10.0.7.2,25,Engine Control Room,Inmarsat,${d(2023,9)},客船搭載`,
`008,MOL Chemical Tankers,大島船舶管理,ops@oshima-mgmt.co.jp,大島造船（5001），VSAT,Windows 11,TV-008 / uvw234,Consilium Selesmar,192.168.8.100,Furuno FV-800,192.168.8.101,MODBUS,9100008,FT-20240008,Panasonic CF,Inmarsat Fleet One,10.0.8.1,10.0.8.2,587,Engine Control Room,VSAT Global,${d(2024,2)},EMS設定要確認`,
`009,MOL Ship Owners Ltd.,今治船舶管理,tech@imabari.co.jp,今治造船（1003），VPN,Windows 11,TV-009 / efg567,JRC JCY-1900,192.168.9.100,Furuno FV-710,192.168.9.101,NMEA 2000,9100009,FT-20240009,Dell OptiPlex,Inmarsat Fleet One,10.0.9.1,10.0.9.2,25,Navigation Bridge,Inmarsat,${d(2024,6)},メタノール対応`,
`010,MOL Ship Owners Ltd.,今治船舶管理,tech@imabari.co.jp,今治造船（1004），VPN,Windows 11,TV-010 / hij890,None,-,Furuno FV-800,192.168.10.101,NMEA 2000,9100010,FT-20250010,NEC Express,Inmarsat Fleet One,10.0.10.1,10.0.10.2,587,Engine Control Room,Inmarsat,${d(2025,1)},最新搭載`,
  ].join('\n');

  loadData(csv);
  toast('サンプルデータを読み込みました','success');
}

// ============================================================
// MAIN LOAD
// ============================================================
function loadData(csvText) {
  try {
    allData = parseCSV(csvText);
    if(!allData.length){ toast('データが見つかりませんでした','error'); return; }

    filtered = [...allData];
    const stats = analyzeData(allData);

    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    renderKPI(allData, stats);
    renderCharts(stats);
    buildFilters(allData);
    buildColToggle();

    sortKey=COL.INSTALL_DATE; sortDir=-1;
    applySort();
    renderTable();

    toast(`${allData.length} 隻のデータを読み込みました`, 'success');
  } catch(e) {
    console.error(e);
    toast('CSVの読み込みに失敗しました: '+e.message,'error');
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', ()=>{

  // File input
  document.getElementById('csvInput').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    const tryLoad = (enc) => new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=ev=>res(ev.target.result);
      r.onerror=rej;
      r.readAsText(file,enc);
    });
    tryLoad('UTF-8').then(loadData).catch(()=>tryLoad('Shift_JIS').then(loadData));
  });

  // Drag & Drop
  const dz = document.getElementById('dropZone');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag-over');}));
  dz.addEventListener('drop',e=>{
    const file=e.dataTransfer.files[0];
    if(!file||!file.name.endsWith('.csv')){toast('CSVファイルを選択してください','error');return;}
    const r=new FileReader(); r.onload=ev=>loadData(ev.target.result); r.readAsText(file,'UTF-8');
  });

  // Sample
  document.getElementById('btnSample').addEventListener('click', loadSampleData);

  // Filters
  ['searchInput','filterManager','filterConnection','filterWindows','filterYear','filterVdr'].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener('input',applyFilters);
    el.addEventListener('change',applyFilters);
  });

  // Export
  document.getElementById('btnExport').addEventListener('click', exportCSV);

  // Reset
  document.getElementById('btnReset').addEventListener('click',()=>{
    ['searchInput','filterManager','filterConnection','filterWindows','filterYear','filterVdr']
      .forEach(id=>{ document.getElementById(id).value=''; });
    applyFilters();
    toast('フィルターをリセットしました','info');
  });

  // Back
  document.getElementById('btnBack').addEventListener('click',()=>{
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('csvInput').value='';
    allData=[]; filtered=[];
    Object.values(charts).forEach(c=>c.destroy()); charts={};
  });

  // Col toggle
  document.getElementById('btnColToggle').addEventListener('click',()=>{
    document.getElementById('colToggleMenu').classList.toggle('hidden');
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('.col-toggle-wrap'))
      document.getElementById('colToggleMenu').classList.add('hidden');
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
});
