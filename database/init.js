const path = require('path');
const fs = require('fs');

// 数据文件路径
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'bookkeeping.json');

// 内存中的数据对象
let store = null;

// 预置分类
const defaultCategories = [
  { name: '餐饮', type: 'expense', icon: '🍜' },
  { name: '交通', type: 'expense', icon: '🚗' },
  { name: '购物', type: 'expense', icon: '🛒' },
  { name: '住房', type: 'expense', icon: '🏠' },
  { name: '娱乐', type: 'expense', icon: '🎮' },
  { name: '医疗', type: 'expense', icon: '💊' },
  { name: '教育', type: 'expense', icon: '📚' },
  { name: '通讯', type: 'expense', icon: '📱' },
  { name: '采购', type: 'expense', icon: '📦' },
  { name: '其他支出', type: 'expense', icon: '📌' },
  { name: '工资', type: 'income', icon: '💰' },
  { name: '兼职', type: 'income', icon: '💼' },
  { name: '业务收入', type: 'income', icon: '📊' },
  { name: '投资', type: 'income', icon: '📈' },
  { name: '奖金', type: 'income', icon: '🎁' },
  { name: '房租收入', type: 'income', icon: '🏠' },
  { name: '其他收入', type: 'income', icon: '📌' }
];

// 默认数据结构
function getDefaultStore() {
  const s = {
    // 自增ID计数器
    nextId: {
      users: 1,
      books: 1,
      categories: 1,
      records: 1,
      members: 1,  // 账本成员ID
      invites: 1   // 邀请码ID
    },
    users: [],
    books: [],
    categories: [],
    records: [],
    members: [],   // 账本成员表：记录哪些用户加入了哪些账本
    invites: []    // 邀请码表：记录账本邀请链接
  };
  s.close = function() {};
  return s;
}

// 原子写入：先写临时文件再重命名，防止写入中断导致数据损坏
function saveStore() {
  const tmpFile = dataFile + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpFile, dataFile);
}

// 初始化数据库
function initDB() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dataFile)) {
    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      store = JSON.parse(raw);
      store.close = function() {};
      // 兼容旧数据：确保 nextId 字段存在
      if (!store.nextId) {
        store.nextId = { users: 1, books: 1, categories: 1, records: 1, members: 1 };
        if (store.users.length) store.nextId.users = Math.max(...store.users.map(u => u.id)) + 1;
        if (store.books.length) store.nextId.books = Math.max(...store.books.map(b => b.id)) + 1;
        if (store.categories.length) store.nextId.categories = Math.max(...store.categories.map(c => c.id)) + 1;
        if (store.records.length) store.nextId.records = Math.max(...store.records.map(r => r.id)) + 1;
        saveStore();
      }
      // 兼容旧数据：添加 members 表
      if (!store.members) {
        store.members = [];
        store.nextId.members = 1;
        saveStore();
      }
      // 兼容旧数据：添加 invites 表
      if (!store.invites) {
        store.invites = [];
        store.nextId.invites = 1;
        saveStore();
      }
    } catch (err) {
      console.error('数据文件读取失败，将使用默认结构:', err.message);
      store = getDefaultStore();
      saveStore();
    }
  } else {
    store = getDefaultStore();
    saveStore();
  }

  // 初始化预置分类（仅当分类表为空时）
  if (store.categories.length === 0) {
    for (const cat of defaultCategories) {
      store.categories.push({
        id: store.nextId.categories++,
        name: cat.name,
        type: cat.type,
        icon: cat.icon
      });
    }
    saveStore();
  }
}

// 获取数据存储对象
function getDB() {
  return store;
}

module.exports = { initDB, getDB, saveStore };
