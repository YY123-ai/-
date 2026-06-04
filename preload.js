const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 用户认证
  register: (data) => ipcRenderer.invoke('auth:register', data),
  login: (data) => ipcRenderer.invoke('auth:login', data),
  getAllUsers: () => ipcRenderer.invoke('auth:allUsers'),
  // 账本
  getBooks: (userId) => ipcRenderer.invoke('books:list', userId),
  createBook: (data) => ipcRenderer.invoke('books:create', data),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  // 账本成员
  getBookMembers: (bookId) => ipcRenderer.invoke('members:list', bookId),
  inviteMember: (data) => ipcRenderer.invoke('members:invite', data),
  removeMember: (memberId) => ipcRenderer.invoke('members:remove', memberId),
  updateMemberRole: (data) => ipcRenderer.invoke('members:updateRole', data),
  // 邀请码
  createInvite: (data) => ipcRenderer.invoke('invite:create', data),
  joinByInvite: (data) => ipcRenderer.invoke('invite:join', data),
  getInvites: (bookId) => ipcRenderer.invoke('invite:list', bookId),
  // 记录
  addRecord: (record) => ipcRenderer.invoke('records:add', record),
  getRecords: (filters) => ipcRenderer.invoke('records:list', filters),
  deleteRecord: (id) => ipcRenderer.invoke('records:delete', id),
  updateRecord: (data) => ipcRenderer.invoke('records:update', data),
  // 统计
  getStats: (filters) => ipcRenderer.invoke('stats:get', filters),
  // 分类
  getCategories: (type) => ipcRenderer.invoke('categories:list', type),
  addCategory: (data) => ipcRenderer.invoke('categories:add', data),
  // 图片
  saveImage: (data) => ipcRenderer.invoke('image:save', data),
  readImage: (path) => ipcRenderer.invoke('image:read', path),
  selectImage: () => ipcRenderer.invoke('image:select'),
  // OCR
  ocrRecognize: (imageData) => ipcRenderer.invoke('ocr:recognize', imageData),
  // 导出
  exportBook: (data) => ipcRenderer.invoke('export:book', data),
  exportExcel: (data) => ipcRenderer.invoke('export:excel', data),
  // 服务器信息
  getServerInfo: () => ipcRenderer.invoke('server:info')
});
