const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

try {
  app.setPath('userData', path.join(__dirname, 'data'));
  app.setPath('appData', path.join(__dirname, 'data'));
} catch (e) {}

const { initDB, getDB, saveStore } = require('./database/init');
let mainWindow;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 750, minWidth: 900, minHeight: 650,
    title: '记账本',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function startSharedServer() {
  try {
    const cp = require('child_process');
    const nodePath = path.join(__dirname, 'node-runtime', 'node-v20.11.0-win-x64', 'node.exe');
    const serverPath = path.join(__dirname, 'server', 'index.js');
    const execPath = fs.existsSync(nodePath) ? nodePath : 'node';
    serverProcess = cp.spawn(execPath, [serverPath], {
      cwd: path.join(__dirname, 'server'),
      stdio: 'pipe',
      env: Object.assign({}, process.env)
    });
    serverProcess.stdout.on('data', (d) => { console.log('[Server]', d.toString().trim()); });
    serverProcess.stderr.on('data', (d) => { console.error('[Server]', d.toString().trim()); });
    serverProcess.on('error', (err) => { console.error('[Server]', err.message); serverProcess = null; });
  } catch (err) {
    console.error('[Main]', err.message);
  }
}

app.whenReady().then(() => {
  initDB();
  createWindow();
  startSharedServer();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

// ===== 数据库操作 =====
const dbOps = require('./database/db');
const ocr = require('./services/ocr');

// ===== 认证 API =====
ipcMain.handle('auth:register', (event, data) => dbOps.registerUser(data));
ipcMain.handle('auth:login', (event, data) => dbOps.loginUser(data));
ipcMain.handle('auth:allUsers', () => dbOps.getAllUsers());

// ===== 账本 API =====
ipcMain.handle('books:list', (event, userId) => dbOps.getBooks(userId));
ipcMain.handle('books:create', (event, data) => dbOps.createBook(data));
ipcMain.handle('books:delete', (event, id) => dbOps.deleteBook(id));

// ===== 成员 API =====
ipcMain.handle('members:list', (event, bookId) => dbOps.getBookMembers(bookId));
ipcMain.handle('members:invite', (event, data) => dbOps.inviteMember(data));
ipcMain.handle('members:remove', (event, memberId) => dbOps.removeMember(memberId));
ipcMain.handle('members:updateRole', (event, { memberId, role }) => {
  const store = getDB();
  const member = store.members.find(m => m.id === memberId);
  if (!member) return { success: false, error: '成员不存在' };
  if (member.role === 'owner') return { success: false, error: '不能修改创建者角色' };
  member.role = role;
  saveStore();
  return { success: true };
});

// ===== 邀请 API =====
ipcMain.handle('invite:create', (event, data) => dbOps.createInvite(data));
ipcMain.handle('invite:join', (event, data) => dbOps.joinByInvite(data));
ipcMain.handle('invite:list', (event, bookId) => dbOps.getInvites(bookId));

// ===== 记录 API =====
ipcMain.handle('records:add', (event, record) => dbOps.addRecord(record));
ipcMain.handle('records:list', (event, filters) => dbOps.getRecords(filters));
ipcMain.handle('records:delete', (event, id) => dbOps.deleteRecord(id));
ipcMain.handle('records:update', (event, data) => dbOps.updateRecord(data));

// ===== 统计 API =====
ipcMain.handle('stats:get', (event, filters) => dbOps.getStats(filters));

// ===== 分类 API =====
ipcMain.handle('categories:list', (event, type) => dbOps.getCategories(type));
ipcMain.handle('categories:add', (event, data) => dbOps.addCategory(data));

// ===== 图片操作 =====
ipcMain.handle('image:save', (event, { imageData, fileName }) => {
  const imgDir = path.join(__dirname, 'data', 'images');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  // 安全检查：仅允许安全的文件名，防止路径遍历
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeName).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext)) {
    return { success: false, error: '不支持的图片格式' };
  }
  const filePath = path.join(imgDir, safeName);
  // 确保路径在 imgDir 内
  if (!filePath.startsWith(path.resolve(imgDir))) {
    return { success: false, error: '非法路径' };
  }
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return { success: true, path: filePath };
});

ipcMain.handle('image:read', (event, filePath) => {
  try {
    // 安全检查：仅允许读取 images 目录下的文件
    const imgDir = path.resolve(path.join(__dirname, 'data', 'images'));
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(imgDir)) {
      return { success: false, error: '非法路径' };
    }
    if (fs.existsSync(resolvedPath)) {
      const data = fs.readFileSync(resolvedPath);
      const ext = path.extname(resolvedPath).slice(1);
      return { success: true, data: `data:image/${ext};base64,${data.toString('base64')}` };
    }
    return { success: false, error: '文件不存在' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('image:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);
  return {
    success: true,
    data: `data:image/${ext};base64,${data.toString('base64')}`,
    fileName: path.basename(filePath)
  };
});

// ===== OCR 识别 =====
ipcMain.handle('ocr:recognize', async (event, imageData) => {
  try {
    const result = await ocr.recognizeImage(imageData);
    if (result.text && !result.note) {
      const lines = result.text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length >= 2 && l.length <= 15; });
      const chineseLines = lines.filter(function(l) { return /[\u4e00-\u9fff]/.test(l); });
      result.note = chineseLines.slice(0, 2).join('') || '';
    }
    return result;
  } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('export:book', async (event, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出账本',
      defaultPath: `${data.bookName}_${new Date().toISOString().slice(0, 10)}`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    });
    if (result.canceled) return { success: false, canceled: true };

    const records = dbOps.getRecords({ bookId: data.bookId });
    const stats = dbOps.getStats({ bookId: data.bookId });
    const tempDir = path.join(app.getPath('temp'), 'export_' + Date.now());
    const imagesDir = path.join(tempDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    // 复制图片文件
    for (const record of records) {
      if (record.image_path && fs.existsSync(record.image_path)) {
        const imgDir = path.resolve(path.join(__dirname, 'data', 'images'));
        const resolvedPath = path.resolve(record.image_path);
        if (resolvedPath.startsWith(imgDir)) {
          fs.copyFileSync(record.image_path, path.join(imagesDir, `record_${record.id}_${record.date}${path.extname(record.image_path)}`));
        }
      }
    }

    // 写入数据文件
    fs.writeFileSync(path.join(tempDir, 'data.json'), JSON.stringify({
      bookName: data.bookName,
      exportDate: new Date().toISOString(),
      stats,
      records
    }, null, 2));

    // 打包ZIP
    const archiver = require('archiver');
    const output = fs.createWriteStream(result.filePath);
    const archive = archiver('zip', { zlib: { level: 5 } });
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize();
    });

    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===== 导出 Excel =====
ipcMain.handle('export:excel', async (event, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出Excel',
      defaultPath: `${data.bookName}_${new Date().toISOString().slice(0, 10)}`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled) return { success: false, canceled: true };

    const ExcelJS = require('exceljs');
    const records = dbOps.getRecords({ bookId: data.bookId });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '记账本';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('明细', { properties: { defaultColWidth: 18 } });
    sheet.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '类型', key: 'type', width: 10 },
      { header: '分类', key: 'category', width: 12 },
      { header: '金额', key: 'amount', width: 14 },
      { header: '备注', key: 'note', width: 24 },
      { header: '记录人', key: 'username', width: 12 },
      { header: '图片', key: 'image', width: 30 }
    ];

    for (const record of records) {
      sheet.addRow({
        date: record.date,
        type: record.type === 'income' ? '收入' : '支出',
        category: record.category,
        amount: record.type === 'income' ? record.amount : -record.amount,
        note: record.note || '',
        username: record.username || '',
        image: record.image_path ? `images/record_${record.id}_${record.date}${path.extname(record.image_path)}` : ''
      });
    }

    await workbook.xlsx.writeFile(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) {
    console.error('[Export]', err);
    return { success: false, error: err.message };
  }
});

// ===== 服务器信息 =====
ipcMain.handle('server:info', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return { name: '记账本共享服务器', version: '1.0.0', ips };
});
