// 船事開 引合管理システム v3.0 - 共有サーバー
// Node.js + Express + db.json 永続化

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// ─── ミドルウェア ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));  // index.html などを配信

// ─── DB 読み書きヘルパー ────────────────────────────────────
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { cases: [], nextId: 1 };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── API ────────────────────────────────────────────────────

// 全案件取得
app.get('/api/cases', (req, res) => {
  const db = readDB();
  res.json({ ok: true, cases: db.cases, nextId: db.nextId });
});

// 案件追加
app.post('/api/cases', (req, res) => {
  const db = readDB();
  const c = req.body;
  c.id = db.nextId++;
  c.updateTime = now();
  db.cases.unshift(c);
  writeDB(db);
  res.json({ ok: true, case: c, nextId: db.nextId });
});

// 案件更新
app.put('/api/cases/:id', (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id, 10);
  const idx = db.cases.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
  const updated = { ...db.cases[idx], ...req.body, id, updateTime: now() };
  db.cases[idx] = updated;
  writeDB(db);
  res.json({ ok: true, case: updated });
});

// 案件削除
app.delete('/api/cases/:id', (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id, 10);
  const idx = db.cases.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
  db.cases.splice(idx, 1);
  writeDB(db);
  res.json({ ok: true });
});

// 一括操作（ステータス変更・ハイライト・削除）
app.post('/api/cases/bulk', (req, res) => {
  const db = readDB();
  const { ids, action, value } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, error: 'IDが必要です' });
  }
  const idSet = new Set(ids.map(Number));

  if (action === 'delete') {
    db.cases = db.cases.filter(c => !idSet.has(c.id));
  } else if (action === 'status') {
    db.cases.forEach(c => {
      if (idSet.has(c.id)) { c.status = value; c.updateTime = now(); }
    });
  } else if (action === 'highlight') {
    db.cases.forEach(c => {
      if (idSet.has(c.id)) c.highlight = value;
    });
  } else {
    return res.status(400).json({ ok: false, error: '不明なアクション' });
  }
  writeDB(db);
  res.json({ ok: true, count: ids.length });
});

// ハイライトのみ更新（軽量）
app.patch('/api/cases/:id/highlight', (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id, 10);
  const c = db.cases.find(c => c.id === id);
  if (!c) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
  c.highlight = req.body.highlight || '';
  writeDB(db);
  res.json({ ok: true });
});

// ─── ヘルパー ────────────────────────────────────────────────
function now() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── 起動 ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚢 引合管理サーバー起動 → http://0.0.0.0:${PORT}`);
  console.log(`   DB: ${DB_FILE}`);
});
