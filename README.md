# 记账本 - 桌面应用

基于 Electron 的多用户多账本桌面记账应用，支持图片上传、OCR 识别、数据导出。

## 功能特性

- **多用户** — 注册/登录，数据隔离
- **多账本** — 可创建多个账本（个人、家庭、公司等）
- **记账录入** — 收入/支出，金额、分类、日期、备注
- **图片上传** — 上传票据/账单图片，关联到记录
- **OCR 识别** — 自动识别图片中的金额和日期（基于 Tesseract.js）
- **分类统计** — 按分类查看收支构成
- **数据导出** — 导出账本为 ZIP（含 JSON + CSV + 图片）
- **数据持久化** — JSON 文件本地存储，数据不丢失

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | HTML + CSS + JavaScript |
| 数据存储 | JSON 文件（原子写入） |
| 密码加密 | bcryptjs |
| OCR | Tesseract.js |
| 导出打包 | archiver |

## 项目结构

```
JZB/
├── main.js                 # Electron 主进程（窗口创建、IPC 处理）
├── preload.js              # 预加载脚本（安全桥接渲染进程和主进程）
├── package.json            # 项目配置和依赖
├── database/
│   ├── init.js             # 数据初始化（创建数据文件、预置分类）
│   └── db.js               # 数据操作（用户、账本、记录、统计的 CRUD）
├── src/
│   ├── index.html          # 主页面（登录页 + 记账主页）
│   ├── css/
│   │   └── style.css       # 全局样式
│   └── js/
│       └── renderer.js     # 渲染进程逻辑（UI 交互、数据展示）
├── data/                   # 运行时数据目录（自动创建）
│   ├── bookkeeping.json    # 核心数据文件
│   └── images/             # 上传的图片文件
└── node-runtime/           # Node.js 运行时（便携版）
```

## 快速开始

### 前置条件

- Node.js 18+（如已安装系统 Node 可跳过）
- npm

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 启动应用
npm start

# 如果使用项目内 Node 运行时（便携版）
node-runtime\node-v20.11.0-win-x64\npm.cmd install
node-runtime\node-v20.11.0-win-x64\npx.cmd electron .
```

### 打包为安装程序

```bash
npm run build
```

打包产物在 `dist/` 目录下。

## 核心架构说明

### IPC 通信模式

应用采用纯 IPC 模式，不启动额外的 HTTP 服务器：

```
渲染进程 (renderer.js)
    ↓ window.api.xxx()
预加载脚本 (preload.js)
    ↓ ipcRenderer.invoke()
主进程 (main.js)
    ↓ 调用 dbOps.xxx()
数据层 (database/db.js)
    ↓ 读写 JSON 文件
磁盘 (data/bookkeeping.json)
```

### 数据存储

数据存储在 `data/bookkeeping.json`，采用原子写入策略：
1. 先写入 `.tmp` 临时文件
2. 写入完成后 `rename` 覆盖目标文件
3. 防止写入中断导致数据损坏

### 图片存储

图片保存在 `data/images/` 目录下，数据库中只存储文件路径，避免 JSON 文件过大。

## 数据结构

### 用户 (users)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增ID |
| username | string | 用户名（唯一） |
| password | string | bcrypt 加密密码 |
| created_at | string | 创建时间 |

### 账本 (books)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增ID |
| user_id | number | 所属用户ID |
| name | string | 账本名称 |
| icon | string | 图标emoji |
| is_default | number | 是否默认账本 |
| created_at | string | 创建时间 |

### 记录 (records)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增ID |
| book_id | number | 所属账本ID |
| type | string | 'income' 或 'expense' |
| amount | number | 金额 |
| category | string | 分类名称 |
| date | string | 日期 YYYY-MM-DD |
| note | string | 备注 |
| image_path | string | 图片文件路径 |
| created_at | string | 创建时间 |

### 分类 (categories)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增ID |
| name | string | 分类名称 |
| type | string | 'income' 或 'expense' |
| icon | string | 图标emoji |

## 预置分类

**支出**: 餐饮、交通、购物、住房、娱乐、医疗、教育、通讯、采购、其他支出

**收入**: 工资、兼职、业务收入、投资、奖金、房租收入、其他收入

## 导出功能

点击顶部「导出」按钮，可将当前账本导出为 ZIP 文件，包含：
- `data.json` — 完整数据（含统计信息）
- `账本名.csv` — CSV 格式（可用 Excel 打开）
- `images/` — 所有关联的图片文件

## 常见问题

### Q: GPU 缓存错误
启动时出现 `Unable to create cache` 错误是沙箱/权限环境下的常见警告，不影响应用功能。

### Q: 如何备份数据
复制 `data/bookkeeping.json` 和 `data/images/` 目录即可。

### Q: 如何重置数据
删除 `data/bookkeeping.json` 文件，重启应用会自动创建新的空数据文件。

## 维护说明

- **添加新分类**: 修改 `database/init.js` 中的 `defaultCategories` 数组
- **修改 UI 样式**: 编辑 `src/css/style.css`
- **添加新功能**: 在 `database/db.js` 添加数据操作函数 → 在 `main.js` 添加 IPC 处理 → 在 `preload.js` 暴露 API → 在 `renderer.js` 调用
- **修改窗口大小**: 编辑 `main.js` 中 `createWindow()` 的 `width`/`height` 参数
