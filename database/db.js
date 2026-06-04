const { getDB, saveStore } = require('./init');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// 获取本地时间字符串
function nowLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ===== 用户管理 =====

function registerUser(data) {
  const store = getDB();
  try {
    const existing = store.users.find(u => u.username === data.username);
    if (existing) return { success: false, error: '用户名已存在' };
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    const userId = store.nextId.users++;
    store.users.push({ id: userId, username: data.username, password: hashedPassword, created_at: nowLocal() });
    // 创建默认账本
    const bookId = store.nextId.books++;
    store.books.push({ id: bookId, user_id: userId, name: '默认账本', icon: '📒', is_default: 1, created_at: nowLocal() });
    // 添加为账本owner
    const memberId = store.nextId.members++;
    store.members.push({ id: memberId, book_id: bookId, user_id: userId, role: 'owner', joined_at: nowLocal() });
    saveStore();
    return { success: true, userId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function loginUser(data) {
  const store = getDB();
  const user = store.users.find(u => u.username === data.username);
  if (!user) return { success: false, error: '用户名或密码错误' };
  if (!bcrypt.compareSync(data.password, user.password)) return { success: false, error: '用户名或密码错误' };
  return { success: true, userId: user.id, username: user.username };
}

// 获取所有用户
function getAllUsers() {
  const store = getDB();
  return store.users.map(u => ({ id: u.id, username: u.username }));
}

// ===== 账本管理 =====

// 获取用户参与的账本列表
function getBooks(userId) {
  const store = getDB();
  const memberBookIds = store.members
    .filter(m => m.user_id === userId)
    .map(m => m.book_id);
  return store.books
    .filter(b => memberBookIds.includes(b.id))
    .map(b => {
      const member = store.members.find(m => m.book_id === b.id && m.user_id === userId);
      return { ...b, role: member ? member.role : 'viewer' };
    })
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return b.is_default - a.is_default;
      return a.created_at.localeCompare(b.created_at);
    });
}

function createBook(data) {
  const store = getDB();
  try {
    const id = store.nextId.books++;
    store.books.push({ id, user_id: data.userId, name: data.name, icon: data.icon || '📒', is_default: 0, created_at: nowLocal() });
    // 创建者为owner
    const memberId = store.nextId.members++;
    store.members.push({ id: memberId, book_id: id, user_id: data.userId, role: 'owner', joined_at: nowLocal() });
    saveStore();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteBook(id) {
  const store = getDB();
  const idx = store.books.findIndex(b => b.id === id);
  if (idx === -1) return { success: false };
  // 删除关联记录的图片文件
  const relatedRecords = store.records.filter(r => r.book_id === id);
  for (const record of relatedRecords) {
    if (record.image_path) {
      try {
        if (fs.existsSync(record.image_path)) fs.unlinkSync(record.image_path);
      } catch (e) {}
    }
  }
  // 删除关联记录
  store.records = store.records.filter(r => r.book_id !== id);
  store.books.splice(idx, 1);
  // 删除关联成员
  store.members = store.members.filter(m => m.book_id !== id);
  saveStore();
  return { success: true };
}

// ===== 成员管理 =====

// 获取账本成员列表
function getBookMembers(bookId) {
  const store = getDB();
  return store.members
    .filter(m => m.book_id === bookId)
    .map(m => {
      const user = store.users.find(u => u.id === m.user_id);
      return { id: m.id, user_id: m.user_id, username: user ? user.username : '未知用户', role: m.role, joined_at: m.joined_at };
    });
}

// 邀请成员加入账本
function inviteMember(data) {
  const store = getDB();
  try {
    const targetUser = store.users.find(u => u.username === data.username);
    if (!targetUser) return { success: false, error: '用户不存在' };
    // 检查是否已是成员
    const existing = store.members.find(m => m.book_id === data.bookId && m.user_id === targetUser.id);
    if (existing) return { success: false, error: '该用户已是账本成员' };
    // 添加成员
    const id = store.nextId.members++;
    store.members.push({ id, book_id: data.bookId, user_id: targetUser.id, role: data.role || 'member', joined_at: nowLocal() });
    saveStore();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 移除成员
function removeMember(memberId) {
  const store = getDB();
  const idx = store.members.findIndex(m => m.id === memberId);
  if (idx === -1) return { success: false };
  const member = store.members[idx];
  if (member.role === 'owner') return { success: false, error: '不能移除账本创建者' };
  store.members.splice(idx, 1);
  saveStore();
  return { success: true };
}

// ===== 记录管理 =====

function addRecord(record) {
  const store = getDB();
  try {
    const id = store.nextId.records++;
    store.records.push({
      id, book_id: record.bookId, type: record.type,
      amount: parseFloat(record.amount), category: record.category,
      categoryId: record.categoryId || null,
      date: record.date, note: record.note || '',
      image_path: record.imagePath || '',
      user_id: record.userId || null,
      created_at: nowLocal()
    });
    saveStore();
    return { id, success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getRecords(filters = {}) {
  const store = getDB();
  let results = store.records.slice();
  if (filters.bookId) results = results.filter(r => r.book_id === filters.bookId);
  if (filters.yearMonth) results = results.filter(r => r.date.startsWith(filters.yearMonth));
  if (filters.year) results = results.filter(r => r.date.startsWith(filters.year));
  if (filters.type) results = results.filter(r => r.type === filters.type);
  if (filters.category) results = results.filter(r => r.category === filters.category);
  if (filters.date) results = results.filter(r => r.date === filters.date);
  results.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.created_at.localeCompare(a.created_at);
  });
  // 附加用户名
  return results.map(r => {
    const user = store.users.find(u => u.id === r.user_id);
    return { ...r, username: user ? user.username : '' };
  });
}

function deleteRecord(id) {
  const store = getDB();
  const idx = store.records.findIndex(r => r.id === id);
  if (idx === -1) return { success: false };
  const record = store.records[idx];
  if (record.image_path) {
    try {
      if (fs.existsSync(record.image_path)) fs.unlinkSync(record.image_path);
    } catch (e) {}
  }
  store.records.splice(idx, 1);
  saveStore();
  return { success: true };
}

function updateRecord(data) {
  const store = getDB();
  try {
    const record = store.records.find(r => r.id === data.id);
    if (!record) return { success: false };
    record.type = data.type;
    record.amount = parseFloat(data.amount);
    record.category = data.category;
    record.categoryId = data.categoryId || record.categoryId || null;
    record.date = data.date;
    record.note = data.note;
    saveStore();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== 统计 =====

// dateRange: 'day' | 'month' | 'year'
function getStats(filters = {}) {
  const store = getDB();
  let records = store.records.slice();

  if (filters.bookId) records = records.filter(r => r.book_id === filters.bookId);

  // 按日期范围过滤
  const dateRange = filters.dateRange;
  if (dateRange === 'day' && filters.date) {
    records = records.filter(r => r.date === filters.date);
  } else if (dateRange === 'month' && filters.yearMonth) {
    records = records.filter(r => r.date.startsWith(filters.yearMonth));
  } else if (dateRange === 'year' && filters.year) {
    records = records.filter(r => r.date.startsWith(filters.year));
  } else if (filters.date) {
    // 默认按日过滤
    records = records.filter(r => r.date === filters.date);
  } else if (filters.yearMonth) {
    // 默认按月过滤
    records = records.filter(r => r.date.startsWith(filters.yearMonth));
  } else if (filters.year) {
    // 默认按年过滤
    records = records.filter(r => r.date.startsWith(filters.year));
  }

  // 计算收支总计
  let totalIncome = 0, totalExpense = 0;
  for (const r of records) {
    if (r.type === 'income') totalIncome += r.amount;
    else if (r.type === 'expense') totalExpense += r.amount;
  }

  // 按分类汇总
  const expenseByCategory = summarizeByCategory(records, 'expense');
  const incomeByCategory = summarizeByCategory(records, 'income');

  // 按日期汇总
  const dailyStats = summarizeByDate(records, dateRange);

  return {
    totalIncome, totalExpense, balance: totalIncome - totalExpense,
    expenseByCategory, incomeByCategory, dailyStats
  };
}

function summarizeByCategory(records, type) {
  const map = {};
  for (const r of records) {
    if (r.type === type) {
      if (!map[r.category]) map[r.category] = { category: r.category, total: 0, count: 0 };
      map[r.category].total += r.amount;
      map[r.category].count++;
    }
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// 按日期汇总统计
function summarizeByDate(records, dateRange) {
  const map = {};
  for (const r of records) {
    let key;
    if (dateRange === 'year') {
      key = r.date.substring(0, 7); // 按月
    } else if (dateRange === 'month') {
      key = r.date; // 按日
    } else {
      key = r.date; // 默认按日
    }
    if (!map[key]) map[key] = { date: key, income: 0, expense: 0 };
    if (r.type === 'income') map[key].income += r.amount;
    else map[key].expense += r.amount;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// ===== 分类管理 =====

function getCategories(type) {
  const store = getDB();
  if (type) return store.categories.filter(c => c.type === type).sort((a, b) => a.id - b.id);
  return store.categories.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.id - b.id;
  });
}

function addCategory(data) {
  const store = getDB();
  try {
    const exists = store.categories.find(c => c.name === data.name && c.type === data.type);
    if (exists) return { success: false, error: '分类已存在' };
    const id = store.nextId.categories++;
    store.categories.push({ id, name: data.name, type: data.type, icon: data.icon || '📌' });
    saveStore();
    return { id, success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== 邀请码 =====

// 生成6位邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// 创建邀请码
function createInvite(data) {
  const store = getDB();
  try {
    // 验证操作者是owner
    const membership = store.members.find(m => m.book_id === data.bookId && m.user_id === data.userId);
    if (!membership || membership.role !== 'owner') {
      return { success: false, error: '只有账本创建者可以创建邀请码' };
    }
    // 生成邀请码
    const code = generateInviteCode();
    const id = store.nextId.invites++;
    store.invites.push({
      id,
      code,
      book_id: data.bookId,
      inviter_id: data.userId,
      role: data.role || 'member',
      created_at: nowLocal(),
      used: false
    });
    saveStore();
    return { success: true, code, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 通过邀请码加入账本
function joinByInvite(data) {
  const store = getDB();
  try {
    const invite = store.invites.find(i => i.code === data.code && !i.used);
    if (!invite) return { success: false, error: '邀请码无效或已使用' };
    // 检查是否已是成员
    const existing = store.members.find(m => m.book_id === invite.book_id && m.user_id === data.userId);
    if (existing) return { success: false, error: '已是账本成员' };
    // 添加成员
    const memberId = store.nextId.members++;
    store.members.push({
      id: memberId,
      book_id: invite.book_id,
      user_id: data.userId,
      role: invite.role,
      joined_at: nowLocal()
    });
    // 标记邀请码已使用
    invite.used = true;
    invite.used_by = data.userId;
    invite.used_at = nowLocal();
    saveStore();
    const book = store.books.find(b => b.id === invite.book_id);
    return { success: true, bookId: invite.book_id, bookName: book ? book.name : '', role: invite.role };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 获取邀请码列表
function getInvites(bookId) {
  const store = getDB();
  return store.invites
    .filter(i => i.book_id === bookId)
    .map(i => {
      const inviter = store.users.find(u => u.id === i.inviter_id);
      return { ...i, inviterName: inviter ? inviter.username : '' };
    });
}

// ===== 权限检查 =====

function checkPermission(bookId, userId, action) {
  const store = getDB();
  const member = store.members.find(m => m.book_id === bookId && m.user_id === userId);
  if (!member) return { allowed: false, error: '不是账本成员' };
  // owner 拥有所有权限
  if (member.role === 'owner') return { allowed: true, role: 'owner' };
  // member 可以查看/添加/编辑/删除/导出
  if (member.role === 'member') {
    if (['view', 'add', 'edit', 'delete', 'export'].includes(action)) return { allowed: true, role: 'member' };
    return { allowed: false, error: '权限不足' };
  }
  // viewer 只能查看
  if (member.role === 'viewer') {
    if (action === 'view') return { allowed: true, role: 'viewer' };
    return { allowed: false, error: '查看者无操作权限' };
  }
  return { allowed: false, error: '未知角色' };
}

module.exports = {
  registerUser, loginUser, getAllUsers,
  getBooks, createBook, deleteBook,
  getBookMembers, inviteMember, removeMember,
  addRecord, getRecords, deleteRecord, updateRecord,
  getStats,
  getCategories, addCategory,
  createInvite, joinByInvite, getInvites, checkPermission
};
