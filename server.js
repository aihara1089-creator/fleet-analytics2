// 船事開 引合管理システム v3.0 - MongoDB版
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://aihara1089_db_user:YWk4CgmUjq3VRDYv@cluster0.otnzlqa.mongodb.net/funajibiraki?appName=Cluster0';

// ─── ミドルウェア ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ─── MongoDBスキーマ ────────────────────────────────────────
const caseSchema = new mongoose.Schema({
  id:             { type: Number, unique: true },
  rowNumber:      Number,
  dept:           String,
  deptName:       String,
  sheetName:      String,
  caseNo:         String,
  customer:       String,
  projectName:    String,
  estimate:       Number,
  estimateDisplay:String,
  status:         String,
  priority:       String,
  person:         String,
  expectedDate:   String,
  notes:          String,
  updateTime:     String,
  highlight:      { type: String, default: '' },
  daysUntilDue:   Number,
  isOverdue:      { type: Boolean, default: false },
  isLocked:       { type: Boolean, default: false },
  lockedBy:       String,
}, { _id: false });

const CounterSchema = new mongoose.Schema({
  _id:    String,
  nextId: { type: Number, default: 1 }
});

const Case    = mongoose.model('Case',    caseSchema);
const Counter = mongoose.model('Counter', CounterSchema);

// ─── nextId ヘルパー ────────────────────────────────────────
async function getNextId() {
  const counter = await Counter.findByIdAndUpdate(
    'cases',
    { $inc: { nextId: 1 } },
    { upsert: true, new: true }
  );
  return counter.nextId - 1;
}

// ─── API ────────────────────────────────────────────────────

// 全案件取得
app.get('/api/cases', async (req, res) => {
  try {
    const cases = await Case.find({}, { _id: 0 }).sort({ id: 1 }).lean();
    res.json(cases);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 案件追加
app.post('/api/cases', async (req, res) => {
  try {
    const c = req.body;
    c.id = await getNextId();
    c.updateTime = now();
    await Case.create(c);
    res.json({ ok: true, case: c });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 案件更新
app.put('/api/cases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = { ...req.body, id, updateTime: now() };
    const result = await Case.findOneAndUpdate({ id }, updated, { new: true }).lean();
    if (!result) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
    res.json({ ok: true, case: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 案件削除
app.delete('/api/cases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await Case.findOneAndDelete({ id });
    if (!result) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 一括操作
app.post('/api/cases/bulk', async (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, error: 'IDが必要です' });
    }
    const numIds = ids.map(Number);
    if (action === 'delete') {
      await Case.deleteMany({ id: { $in: numIds } });
    } else if (action === 'status') {
      await Case.updateMany({ id: { $in: numIds } }, { status: value, updateTime: now() });
    } else if (action === 'highlight') {
      await Case.updateMany({ id: { $in: numIds } }, { highlight: value });
    } else {
      return res.status(400).json({ ok: false, error: '不明なアクション' });
    }
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ハイライト更新
app.patch('/api/cases/:id/highlight', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await Case.findOneAndUpdate({ id }, { highlight: req.body.highlight || '' }, { new: true }).lean();
    if (!result) return res.status(404).json({ ok: false, error: '案件が見つかりません' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── ヘルパー ────────────────────────────────────────────────
function now() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── 起動 ────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB接続成功');
    // データが空の場合は初期データを投入
    const count = await Case.countDocuments();
    if (count === 0) {
      console.log('📦 初期データを投入中...');
      const rawData = require('./db.json');
      const cases = Array.isArray(rawData) ? rawData : rawData.cases || [];
      if (cases.length > 0) {
        await Case.insertMany(cases, { ordered: false });
        const maxId = Math.max(...cases.map(c => c.id || 0));
        await Counter.findByIdAndUpdate('cases', { nextId: maxId + 1 }, { upsert: true });
        console.log(`✅ ${cases.length}件のデータを投入しました`);
      }
    } else {
      console.log(`✅ MongoDB内に${count}件のデータがあります`);
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚢 引合管理サーバー起動 → http://0.0.0.0:${PORT}`);
    });
  })
  .catch(e => {
    console.error('❌ MongoDB接続失敗:', e.message);
    process.exit(1);
  });
