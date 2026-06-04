/**
 * 共享后端服务?- 记账?
 * 支持桌面?Electron)和移动端(Taro)数据互?
 * 使用 Express + JSON 文件存储
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { initDB, getDB, saveStore } = require('../database/init');
const dbOps = require('../database/db');
const ocr = require('../services/ocr');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

// 信任反向代理（云部署时 Nginx 等前置代理需要）
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
}

// CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.match(/^https?:\/\/(192\\.168\\.|10\\.|172\\.(1[6-9]|2\\d|3[01])\\.|localhost|127\\.0\\.0\\.1)/)) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ̬ļͼƬ
const imgDir = path.join(__dirname, '..', 'data', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
app.use('/images', express.static(imgDir));

// ̬ļҳ
app.use('/download', express.static(path.join(__dirname, 'public')));

// ̬ļƶ AppPWA
app.use('/app', express.static(path.join(__dirname, 'public', 'app')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imgDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) .toLowerCase();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) cb(null, true);
    else cb(new Error('Only image files allowed (jpg/jpeg/png/bmp/webp)'));
  }
});

// ===== 认证 API =====
app.post('/api/auth/register', (req, res) => {
  const result = dbOps.registerUser(req.body);
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const result = dbOps.loginUser(req.body);
  res.json(result);
});

// 获取用户列表（仅限已登录用户搜索，不返回密码?
app.get('/api/auth/allUsers', (req, res) => {
  const result = dbOps.getAllUsers();
  res.json(result);
});

// ===== 账本 API =====
app.get('/api/books', (req, res) => {
  const userId = parseInt(req.query.userId);
  if (!userId) return res.json([]);
  const result = dbOps.getBooks(userId);
  res.json(result);
});

app.post('/api/books/create', (req, res) => {
  const result = dbOps.createBook(req.body);
  res.json(result);
});

app.post('/api/books/delete', (req, res) => {
  const userId = parseInt(req.body.userId);
  const bookId = parseInt(req.body.id);
  if (!userId || !bookId) return res.json({ success: false, error: '缺少用户身份或账本ID' });
  const perm = dbOps.checkPermission(bookId, userId, 'delete');
  if (!perm.allowed) return res.json({ success: false, error: perm.error });
  const result = dbOps.deleteBook(req.body.id);
  res.json(result);
});

app.post('/api/books/update', (req, res) => {
  const store = getDB();
  try {
    const { id, name, description, userId } = req.body;
    const book = store.books.find(b => b.id === id);
      if (!book) return res.json({ success: false, error: 'Book not found' });
    // 权限检查：只有 owner 可以修改账本
    if (!userId) return res.json({ success: false, error: '缺少用户身份' });
    {
      const member = store.members.find(m => m.book_id === id && m.user_id === userId);
      if (!member || member.role !== 'owner') {
        return res.json({ success: false, error: 'Only book owner can modify' });
      }
    }
    if (name) book.name = name;
    if (description !== undefined) book.description = description;
    saveStore();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== 成员 API =====
app.get('/api/members/list', (req, res) => {
  const bookId = parseInt(req.query.bookId);
  const result = dbOps.getBookMembers(bookId);
  res.json(result);
});

app.post('/api/members/invite', (req, res) => {
  const result = dbOps.inviteMember(req.body);
  res.json(result);
});

app.post('/api/members/remove', (req, res) => {
  const result = dbOps.removeMember(req.body.memberId);
  res.json(result);
});

// 更新成员角色
app.post('/api/members/updateRole', (req, res) => {
  const store = getDB();
  try {
    const { memberId, role, operatorId } = req.body;
    // 验证操作者是 owner
    const member = store.members.find(m => m.id === memberId);
      if (!member) return res.json({ success: false, error: 'Member not found' });
    const book = store.members.find(m => m.book_id === member.book_id && m.user_id === operatorId && m.role === 'owner');
    if (!book) return res.json({ success: false, error: '只有账本创建者可修改角色' });
    if (!['member', 'viewer'].includes(role)) return res.json({ success: false, error: '无效角色' });
    member.role = role;
    saveStore();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== 邀请码 API =====
// 创建邀请码
app.post('/api/invite/create', (req, res) => {
  const result = dbOps.createInvite(req.body);
  res.json(result);
});

// 通过邀请码加入
const inviteRateLimit = {};
app.post('/api/invite/join', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  if (inviteRateLimit[ip] && inviteRateLimit[ip].count >= 5 && now - inviteRateLimit[ip].time < 60000) {
    return res.json({ success: false, error: 'Too frequent, try later' });
  }
  if (!inviteRateLimit[ip] || now - inviteRateLimit[ip].time > 60000) {
    inviteRateLimit[ip] = { count: 0, time: now };
  }
  inviteRateLimit[ip].count++;
  const result = dbOps.joinByInvite(req.body);
  res.json(result);
});

// 获取账本邀请码列表
app.get('/api/invite/list', (req, res) => {
  const bookId = parseInt(req.query.bookId);
  const result = dbOps.getInvites(bookId);
  res.json(result);
});

// 获取邀请信息（用于下载页展示）
app.get('/api/invite/info', (req, res) => {
  const store = getDB();
  const code = req.query.code;
  const invite = store.invites.find(i => i.code === code && !i.used);
  if (!invite) return res.json({ success: false, error: '邀请码无效' });
  const book = store.books.find(b => b.id === invite.book_id);
  const inviter = store.users.find(u => u.id === invite.inviter_id);
  res.json({
    success: true,
    bookName: book ? book.name : '',
    inviterName: inviter ? inviter.username : '',
    role: invite.role
  });
});

// ===== 权限检查中间件 =====
function requirePermission(action) {
  return (req, res, next) => {
    const bookId = parseInt(req.query.bookId || req.body.bookId);
    const userId = parseInt(req.query.userId || req.body.userId);
    if (!bookId || !userId) {
      return res.json({ success: false, error: '缺少权限验证信息' });
    }
    const perm = dbOps.checkPermission(bookId, userId, action);
    if (!perm.allowed) {
      return res.json({ success: false, error: perm.error });
    }
    req.userRole = perm.role;
    next();
  };
}

// ===== 记录 API =====
app.get('/api/records', (req, res) => {
  const bookId = parseInt(req.query.bookId);
  const userId = parseInt(req.query.userId);
  if (!bookId) return res.json({ success: false, error: '缺少账本ID' });
  if (!userId) return res.json({ success: false, error: '缺少用户身份' });
  // 权限检查：必须是账本成?
  {
    const perm = dbOps.checkPermission(bookId, userId, 'view');
    if (!perm.allowed) return res.json({ success: false, error: perm.error });
  }
  const filters = {};
  if (req.query.bookId) filters.bookId = parseInt(req.query.bookId);
  if (req.query.yearMonth) filters.yearMonth = req.query.yearMonth;
  if (req.query.year) filters.year = req.query.year;
  if (req.query.date) filters.date = req.query.date;
  if (req.query.type) filters.type = req.query.type;
  const result = dbOps.getRecords(filters);
  result.forEach(r => {
    if (r.image_path) {
      const filename = path.basename(r.image_path);
      r.imageUrl = `/images/${filename}`;
    }
  });
  res.json(result);
});

app.post('/api/records/add', requirePermission('add'), (req, res) => {
  const result = dbOps.addRecord(req.body);
  res.json(result);
});

app.post('/api/records/update', requirePermission('edit'), (req, res) => {
  const result = dbOps.updateRecord(req.body);
  res.json(result);
});

app.post('/api/records/delete', requirePermission('delete'), (req, res) => {
  const result = dbOps.deleteRecord(req.body.id);
  res.json(result);
});

// 批量删除记录
app.post('/api/records/batch-delete', requirePermission('delete'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ success: false, error: '缺少记录ID' });
  }
  let deletedCount = 0;
  const errors = [];
  ids.forEach(id => {
    try {
      const result = dbOps.deleteRecord(id);
      if (result.success) deletedCount++;
      else errors.push(result.error);
    } catch (err) {
      errors.push(err.message);
    }
  });
  res.json({ 
    success: deletedCount > 0, 
    deletedCount, 
    total: ids.length,
    error: errors.length > 0 ? errors.join('; ') : undefined 
  });
});

// ===== 统计 API =====
app.get('/api/stats', (req, res) => {
  const bookId = parseInt(req.query.bookId);
  const userId = parseInt(req.query.userId);
  if (!bookId) return res.json({ success: false, error: '缺少账本ID' });
  if (!userId) return res.json({ success: false, error: '缺少用户身份' });
  // 权限检?
  {
    const perm = dbOps.checkPermission(bookId, userId, 'view');
    if (!perm.allowed) return res.json({ success: false, error: perm.error });
  }
  const filters = {};
  if (req.query.bookId) filters.bookId = parseInt(req.query.bookId);
  if (req.query.dateRange) filters.dateRange = req.query.dateRange;
  if (req.query.yearMonth) filters.yearMonth = req.query.yearMonth;
  if (req.query.year) filters.year = req.query.year;
  if (req.query.date) filters.date = req.query.date;
  const result = dbOps.getStats(filters);
  res.json(result);
});

// ===== 分类 API =====
app.get('/api/categories', (req, res) => {
  const type = req.query.type;
  const result = dbOps.getCategories(type || undefined);
  res.json(result);
});

app.post('/api/categories/add', (req, res) => {
  const result = dbOps.addCategory(req.body);
  res.json(result);
});

// ===== 图片上传 API =====
app.post('/api/image/upload', upload.single('image'), (req, res) => {
  if (!process.env.VERCEL) {
    // 本地环境：正常上传
    if (!req.file) return res.json({ success: false, error: '未选择图片' });
    const filePath = req.file.path;
    const filename = req.file.filename;
    res.json({ success: true, path: filePath, filename, url: `/images/${filename}` });
  } else {
    // Serverless 环境：不保存文件，返回虚拟路径
    if (!req.file) return res.json({ success: false, error: '未选择图片' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    res.json({ success: true, path: `/images/${filename}`, filename, url: `/images/${filename}` });
  }
});
// ===== OCR ʶ API =====
// ʹùģ services/ocr.js
app.post('/api/ocr/recognize', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.json({ success: false, error: 'No image data' });
    const result = await ocr.recognizeImage(imageData);
    res.json(result);
  } catch (err) {
    console.error('[OCR]', err);
    res.json({ success: false, error: err.message });
  }
});

// ===== Excel 导出 API =====
app.get('/api/export/excel', requirePermission('export'), async (req, res) => {
  try {
    const bookId = parseInt(req.query.bookId);
    if (!bookId) return res.json({ success: false, error: '缺少账本ID' });

    const ExcelJS = require('exceljs');
    const records = dbOps.getRecords({ bookId });
    const stats = dbOps.getStats({ bookId });
    const store = getDB();
    const book = store.books.find(b => b.id === bookId);
    const bookName = book ? book.name : '账本';

    const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bookkeeping';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Detail', { properties: { defaultColWidth: 18 } });
  sheet.columns = [
      { header: '类型', key: 'type', width: 10 },
      { header: '分类', key: 'category', width: 12 },
      { header: '金额', key: 'amount', width: 14 },
      { header: '备注', key: 'note', width: 24 },
      { header: 'Recorder', key: 'username', width: 12 },
      { header: '图片', key: 'image', width: 30 }
    ];
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F6EF7' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };

    for (const r of records) {
      const row = sheet.addRow({
        date: r.date, type: r.type === 'income' ? '收入' : '支出',
        category: r.category, amount: r.type === 'income' ? r.amount : -r.amount,
        note: r.note || '', username: r.username || '',
        image: r.image_path ? `/images/${path.basename(r.image_path)}` : ''
      });
      row.getCell(4).font = { color: { argb: r.type === 'income' ? 'FF00B42A' : 'FFF53F3F' } };
      row.getCell(4).numFmt = '#,##0.00';
    }

    sheet.addRow([]);
    const summaryRow = sheet.addRow({
      date: 'Summary', type: '', category: '', amount: stats.balance,
      note: `收入: ${stats.totalIncome.toFixed(2)}  支出: ${stats.totalExpense.toFixed(2)}`,
    });
    summaryRow.font = { bold: true, size: 12 };
    summaryRow.getCell(4).numFmt = '#,##0.00';

    const catSheet = workbook.addWorksheet('分类统计');
    catSheet.columns = [
      { header: '分类', key: 'category', width: 14 },
      { header: '类型', key: 'type', width: 10 },
      { header: '金额', key: 'total', width: 14 },
      { header: '笔数', key: 'count', width: 10 }
    ];
    catSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F6EF7' } };
    catSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    for (const c of stats.expenseByCategory) {
      catSheet.addRow({ category: c.category, type: '支出', total: -c.total, count: c.count });
    }
    for (const c of stats.incomeByCategory) {
      catSheet.addRow({ category: c.category, type: '收入', total: c.total, count: c.count });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = encodeURIComponent(`${bookName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[Export]', err);
    res.json({ success: false, error: err.message });
  }
});

// ===== 导出账本数据+图片 ZIP =====
app.get('/api/export/zip', requirePermission('export'), async (req, res) => {
  try {
    const bookId = parseInt(req.query.bookId);
    if (!bookId) return res.json({ success: false, error: '缺少账本ID' });

    const records = dbOps.getRecords({ bookId });
    const stats = dbOps.getStats({ bookId });
    const store = getDB();
    const book = store.books.find(b => b.id === bookId);
    const bookName = book ? book.name : '账本';

    const fileName = encodeURIComponent(`${bookName}_${new Date().toISOString().slice(0, 10)}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    if (process.env.VERCEL) {
      // Serverless 环境：只导出数据，不包含图片
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.pipe(res);
      archive.append(JSON.stringify({ bookName, exportDate: new Date().toISOString(), stats, records }, null, 2), { name: 'data.json' });
      await archive.finalize();
    } else {
      // 本地环境：导出数据+图片
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.pipe(res);
      archive.append(JSON.stringify({ bookName, exportDate: new Date().toISOString(), stats, records }, null, 2), { name: 'data.json' });
      for (const r of records.filter(r => r.image_path)) {
        if (fs.existsSync(r.image_path)) {
          const ext = path.extname(r.image_path);
          archive.file(r.image_path, { name: `images/record_${r.id}_${r.date}${ext}` });
        }
      }
      await archive.finalize();
    }
  } catch (err) {
    console.error('[Export ZIP]', err);
    res.json({ success: false, error: err.message });
  }
});

// ===== 获取服务器信息（供客户端发现?=====
app.get('/api/server/info', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  res.json({ name: '记账本共享服务器', version: '1.0.0', port: PORT, ips, downloadUrl: `http://${ips[0] || 'localhost'}:${PORT}/download` });
});

// ===== 管理后台 API =====
// 管理员登录验证（密码从环境变量读取）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin888';
const adminSessions = new Map(); // token -> { createdAt, expiresAt }

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时过期
    adminSessions.set(token, { createdAt: Date.now(), expiresAt });
    res.json({ success: true, token });
  } else {
    res.json({ success: false, error: '密码错误' });
  }
});

// 管理后台鉴权中间?
function requireAdmin(req, res, next) {
  const token = req.headers['admin-token'] || req.query.token;
  if (!token || !adminSessions.has(token)) {
    return res.json({ success: false, error: '请先登录管理后台' });
  }
  const session = adminSessions.get(token);
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return res.json({ success: false, error: 'Session expired, login again' });
  }
  next();
}

// 系统概览
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const store = getDB();
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = store.records.filter(r => r.date === today);
  const totalIncome = store.records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = store.records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);

  // 最?天活跃统?
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRecords = store.records.filter(r => r.date === dateStr);
    last7Days.push({
      date: dateStr,
      income: dayRecords.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
      expense: dayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
      count: dayRecords.length
    });
  }

  res.json({
    userCount: store.users.length,
    bookCount: store.books.length,
    recordCount: store.records.length,
    memberCount: store.members.length,
    inviteCount: store.invites ? store.invites.length : 0,
    todayRecordCount: todayRecords.length,
    todayIncome: todayRecords.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
    todayExpense: todayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
    totalIncome,
    totalExpense,
    totalBalance: totalIncome - totalExpense,
    last7Days
  });
});

// 用户列表
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const store = getDB();
  const users = store.users.map(u => {
    const recordCount = store.records.filter(r => r.user_id === u.id).length;
    const bookIds = [...new Set(store.members.filter(m => m.user_id === u.id).map(m => m.book_id))];
    const books = store.books.filter(b => bookIds.includes(b.id)).map(b => b.name);
    const lastRecord = store.records.filter(r => r.user_id === u.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      id: u.id,
      username: u.username,
      createdAt: u.created_at || u.createdAt || '',
      recordCount,
      bookCount: bookIds.length,
      books,
      lastActive: lastRecord ? lastRecord.date : '-'
    };
  });
  res.json(users);
});

// 删除用户
app.post('/api/admin/deleteUser', requireAdmin, (req, res) => {
  const store = getDB();
  const userId = req.body.userId;
  if (!userId) return res.json({ success: false, error: '缺少用户ID' });
  const idx = store.users.findIndex(u => u.id === userId);
  if (idx === -1) return res.json({ success: false, error: 'User not found' });
  store.users.splice(idx, 1);
  // 同时删除成员关系
  store.members = store.members.filter(m => m.user_id !== userId);
  // 同时删除记录
  store.records = store.records.filter(r => r.user_id !== userId);
  saveStore();
  res.json({ success: true });
});

// 账本列表（管理）
app.get('/api/admin/books', requireAdmin, (req, res) => {
  const store = getDB();
  const books = store.books.map(b => {
    const memberCount = store.members.filter(m => m.book_id === b.id).length;
    const recordCount = store.records.filter(r => r.book_id === b.id).length;
    const income = store.records.filter(r => r.book_id === b.id && r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const expense = store.records.filter(r => r.book_id === b.id && r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const owner = store.users.find(u => u.id === b.owner_id);
    return {
      id: b.id, name: b.name, description: b.description || '',
      ownerId: b.owner_id, ownerName: owner ? owner.username : '-',
      memberCount, recordCount, income, expense, balance: income - expense,
      createdAt: b.created_at || b.createdAt || ''
    };
  });
  res.json(books);
});

// 删除账本
app.post('/api/admin/deleteBook', requireAdmin, (req, res) => {
  const store = getDB();
  const bookId = req.body.bookId;
  if (!bookId) return res.json({ success: false, error: '缺少账本ID' });
  store.books = store.books.filter(b => b.id !== bookId);
  store.members = store.members.filter(m => m.book_id !== bookId);
  store.records = store.records.filter(r => r.book_id !== bookId);
  store.invites = (store.invites || []).filter(i => i.book_id !== bookId);
  saveStore();
  res.json({ success: true });
});

// 全部记录（管理）
app.get('/api/admin/records', requireAdmin, (req, res) => {
  const store = getDB();
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const type = req.query.type;
  const bookId = parseInt(req.query.bookId);

  let records = [...store.records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (type) records = records.filter(r => r.type === type);
  if (bookId) records = records.filter(r => r.book_id === bookId);

  const total = records.length;
  const list = records.slice((page - 1) * pageSize, page * pageSize).map(r => {
    const user = store.users.find(u => u.id === r.user_id);
    const book = store.books.find(b => b.id === r.book_id);
    return {
      id: r.id, date: r.date, type: r.type, amount: Number(r.amount),
      category: r.category || r.categoryName || '', note: r.note || '',
      username: user ? user.username : (r.username || '-'),
      bookName: book ? book.name : '-',
      hasImage: !!r.image_path
    };
  });
  res.json({ total, page, pageSize, list });
});

// 删除记录
app.post('/api/admin/deleteRecord', requireAdmin, (req, res) => {
  const store = getDB();
  const recordId = req.body.recordId;
  if (!recordId) return res.json({ success: false, error: '缺少记录ID' });
  store.records = store.records.filter(r => r.id !== recordId);
  saveStore();
  res.json({ success: true });
});

// 管理后台静态页?
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// 启动服务
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      const ips = [];
      for (const name in interfaces) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
        }
      }
      console.log(`========================================`);
      console.log(`  记账本共享服务器已启动`);
      console.log(`  本地访问: http://localhost:${PORT}`);
      ips.forEach(ip => console.log(`  局域网访问: http://${ip}:${PORT}`));
      console.log(`  App下载: http://${ips[0] || 'localhost'}:${PORT}/download`);
      console.log(`========================================`);
    });
  } catch (err) {
    console.error('服务器启动失败:', err.message);
    process.exit(1);
  }
}

startServer();

