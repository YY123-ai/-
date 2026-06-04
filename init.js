const path = require('path');
const fs = require('fs');

// 是否使用 MongoDB
const useMongoDB = !!process.env.MONGODB_URI;

// 数据文件路径
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'bookkeeping.json');

// 内存中的数据对象
let store = null;
let mongoClient = null;
let db = null;

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
    nextId: { users: 1, books: 1, categories: 1, records: 1, members: 1, invites: 1 },
    users: [],
    books: [],
    categories: [],
    records: [],
    members: [],
    invites: []
  };
  s.close = function() {};
  return s;
}

// MongoDB 保存函数
async function saveStoreMongo() {
  if (!db) return;
  try {
    await db.collection('store').updateOne(
      { _id: 'main' },
      { $set: store },
      { upsert: true }
    );
  } catch (err) {
    console.error('MongoDB save error:', err.message);
  }
}

// 文件保存函数
function saveStoreFile() {
  try {
    const tmpFile = dataFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpFile, dataFile);
  } catch (err) {
    console.error('File save error:', err.message);
  }
}

// 保存数据
async function saveStore() {
  if (useMongoDB) {
    await saveStoreMongo();
  } else {
    saveStoreFile();
  }
}

// 初始化 MongoDB
async function initMongoDB() {
  try {
    const { MongoClient } = require('mongodb');
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db();
    console.log('Connected to MongoDB');
    
    // 检查并初始化集合
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('store')) {
      await db.createCollection('store');
      store = getDefaultStore();
      for (const cat of defaultCategories) {
        store.categories.push({
          id: store.nextId.categories++,
          name: cat.name,
          type: cat.type,
          icon: cat.icon
        });
      }
      await saveStoreMongo();
    } else {
      const doc = await db.collection('store').findOne({ _id: 'main' });
      if (doc) {
        store = doc;
      } else {
        store = getDefaultStore();
        for (const cat of defaultCategories) {
          store.categories.push({
            id: store.nextId.categories++,
            name: cat.name,
            type: cat.type,
            icon: cat.icon
          });
        }
        await saveStoreMongo();
      }
    }
    
    store.close = function() {
      if (mongoClient) mongoClient.close();
    };
  } catch (err) {
    console.error('MongoDB init error:', err.message);
    throw err;
  }
}

// 初始化文件存储
function initFileStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dataFile)) {
    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      store = JSON.parse(raw);
      store.close = function() {};
      
      if (!store.nextId) {
        store.nextId = { users: 1, books: 1, categories: 1, records: 1, members: 1, invites: 1 };
        if (store.users.length) store.nextId.users = Math.max(...store.users.map(u => u.id)) + 1;
        if (store.books.length) store.nextId.books = Math.max(...store.books.map(b => b.id)) + 1;
        if (store.categories.length) store.nextId.categories = Math.max(...store.categories.map(c => c.id)) + 1;
        if (store.records.length) store.nextId.records = Math.max(...store.records.map(r => r.id)) + 1;
        saveStoreFile();
      }
      
      if (!store.members) {
        store.members = [];
        store.nextId.members = 1;
        saveStoreFile();
      }
      
      if (!store.invites) {
        store.invites = [];
        store.nextId.invites = 1;
        saveStoreFile();
      }
    } catch (err) {
      console.error('数据文件读取失败，将使用默认结构:', err.message);
      store = getDefaultStore();
      saveStoreFile();
    }
  } else {
    store = getDefaultStore();
    saveStoreFile();
  }

  if (store.categories.length === 0) {
    for (const cat of defaultCategories) {
      store.categories.push({
        id: store.nextId.categories++,
        name: cat.name,
        type: cat.type,
        icon: cat.icon
      });
    }
    saveStoreFile();
  }
}

// 初始化数据库
async function initDB() {
  if (useMongoDB) {
    await initMongoDB();
  } else {
    initFileStore();
  }
}

function getDB() {
  return store;
}

module.exports = { initDB, getDB, saveStore, useMongoDB };