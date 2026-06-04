// ===================== 记账本 App (优化版) =====================
// 优化：安全性 / 状态管理 / 错误处理 / 性能 / 代码结构
(() => {
  'use strict';

  // ---------- 常量 ----------
  const API = location.origin + '/api';
  const CATEGORIES = [
    { id: 1, name: '餐饮', type: 'expense', icon: '🍜' },
    { id: 2, name: '交通', type: 'expense', icon: '🚗' },
    { id: 3, name: '购物', type: 'expense', icon: '🛒' },
    { id: 4, name: '住房', type: 'expense', icon: '🏠' },
    { id: 5, name: '娱乐', type: 'expense', icon: '🎮' },
    { id: 6, name: '医疗', type: 'expense', icon: '💊' },
    { id: 7, name: '教育', type: 'expense', icon: '📚' },
    { id: 8, name: '通讯', type: 'expense', icon: '📱' },
    { id: 9, name: '采购', type: 'expense', icon: '📦' },
    { id: 10, name: '其他支出', type: 'expense', icon: '📌' },
    { id: 11, name: '工资', type: 'income', icon: '💰' },
    { id: 12, name: '兼职', type: 'income', icon: '💼' },
    { id: 13, name: '业务收入', type: 'income', icon: '📊' },
    { id: 14, name: '投资', type: 'income', icon: '📈' },
    { id: 15, name: '奖金', type: 'income', icon: '🎁' },
    { id: 16, name: '房租收入', type: 'income', icon: '🏠' },
    { id: 17, name: '其他收入', type: 'income', icon: '📌' }
  ];

  // ---------- 安全工具 ----------
  const Safe = {
    html(str) {
      const div = document.createElement('div');
      div.textContent = str ?? '';
      return div.innerHTML;
    },
    attr(str) {
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  };

  // ---------- DOM 工具 ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  // ---------- Toast 轻提示 ----------
  const Toast = {
    _container: null,
    _init() {
      if (this._container) return;
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    },
    show(msg, type = 'info', duration = 2000) {
      this._init();
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.textContent = msg;
      this._container.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
      });
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
        setTimeout(() => el.remove(), 300);
      }, duration);
    },
    success: msg => Toast.show(msg, 'success'),
    error: msg => Toast.show(msg, 'error'),
    warn: msg => Toast.show(msg, 'warning')
  };

  // ---------- 请求客户端 (超时 & 重试) ----------
  const Request = {
    async api(path, data, retries = 2) {
      for (let i = 0; i <= retries; i++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(API + path, {
            method: data ? 'POST' : 'GET',
            headers: data ? { 'Content-Type': 'application/json' } : {},
            body: data ? JSON.stringify(data) : undefined,
            signal: controller.signal
          });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (e) {
          if (i === retries) {
            console.error('[API] 请求失败:', e);
            return { success: false, error: '网络连接失败，请稍后重试' };
          }
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
  };

  // ---------- 状态管理器 ----------
  const Store = {
    state: {
      user: null,
      books: [],
      currentBookId: 0,
      records: [],
      stats: null,
      allTimeStats: null,
      periodMode: 'month',
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      currentDay: new Date().getDate(),
      recordType: 'expense',
      amount: '',
      categoryId: 0,
      note: '',
      date: today(),
      imageUrl: '',
      categoryFilter: null
    },
    set(path, value) {
      const keys = path.split('.');
      let obj = this.state;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      this._trigger(path, value);
    },
    get(path) {
      return path.split('.').reduce((o, k) => o?.[k], this.state);
    },
    _listeners: {},
    on(path, fn) {
      (this._listeners[path] = this._listeners[path] || []).push(fn);
    },
    _trigger(path, val) {
      (this._listeners[path] || []).forEach(fn => fn(val));
    }
  };

  // 表单双向同步
  Store.on('amount', v => { const el = $('#amount-input'); if (el) el.value = v; });
  Store.on('date', v => { const el = $('#date-input'); if (el) el.value = v; });
  Store.on('note', v => { const el = $('#note-input'); if (el) el.value = v; });

  // ---------- 辅助函数 ----------
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function formatAmount(n, type) {
    return type === 'income' ? `+${n.toFixed(2)}` : `-${n.toFixed(2)}`;
  }
  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const todayStr = today();
    const dObj = new Date(y, m - 1, d);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (dateStr === todayStr) return '今天';
    if (dateStr === yesterdayStr) return '昨天';
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${m}月${d}日 周${weekDays[dObj.getDay()]}`;
  }

  // ---------- 弹窗管理 ----------
  const Modal = {
    open(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; },
    close(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  };

  // ---------- 图片处理器 ----------
  const ImageProcessor = {
    async compress(file, maxWidth = 1200, quality = 0.7) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },
    async upload(file) {
      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await fetch(API + '/image/upload', { method: 'POST', body: formData });
        return await res.json();
      } catch (e) { return { success: false, error: '上传失败' }; }
    },
    async uploadAndOCR(file) {
      Toast.show('处理中...', 'info', 1500);
      const uploadRes = await this.upload(file);
      if (!uploadRes.success) { Toast.error(uploadRes.error || '上传失败'); return { uploadRes, ocrRes: null }; }
      try {
        const compressed = await this.compress(file);
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(compressed);
        });
        const ocrRes = await Request.api('/ocr/recognize', { imageData: base64 });
        return { uploadRes, ocrRes };
      } catch (e) {
        Toast.error('OCR 处理失败');
        return { uploadRes, ocrRes: { success: false } };
      }
    }
  };

  // ---------- 事件委托统一处理 ----------
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};

    switch (action) {
      case 'switchTab': switchTab(params.tab); break;
      case 'switchType': switchType(params.type); break;
      case 'selectCat': selectCategory(params.id); break;
      case 'selectEditCat': selectEditCat(params.id); break;
      case 'quickAmount': setQuickAmount(Number(params.n)); break;
      case 'selectBook': selectBook(params.id); break;
      case 'filterCategory': filterByCategory(params.name); break;
      case 'clearCategoryFilter': clearCategoryFilter(); break;
      case 'editRecord': editRecord(params.id); break;
      case 'deleteRecordById': deleteRecordById(params.id); break;
      case 'showModal': Modal.open(params.id); break;
      case 'closeModal': Modal.close(params.id); break;
      case 'switchPeriod': switchPeriod(target); break;
      case 'goToToday': goToToday(); break;
      case 'changePeriod': changePeriod(Number(params.dir)); break;
      case 'saveRecord': saveRecord(); break;
      case 'createBook': createNewBook(); break;
      case 'createInvite': createInvite(); break;
      case 'joinByCode': joinByCode(); break;
      case 'showMembers': showMembers(); break;
      case 'exportExcel': exportExcel(); break;
      case 'exportZip': exportZip(); break;
      case 'logout': handleLogout(); break;
      case 'login': handleLogin(); break;
      case 'register': handleRegister(); break;
      case 'openBookEdit': openBookEdit(params.id); break;
      case 'deleteBook': confirmDeleteBook(params.id, params.name); break;
      case 'saveBookEdit': saveBookEdit(); break;
      case 'saveRecordEdit': saveRecordEdit(); break;
      case 'deleteCurrentRecord': deleteCurrentRecord(); break;
      case 'triggerImageUpload': triggerImageUpload(); break;
      case 'triggerOcr': triggerOcr(); break;
      case 'clearImage': clearImage(); break;
      case 'showBookManage': showBookManage(); break;
      case 'showNewBookDialog': showNewBookDialog(); break;
      case 'showImageViewer': showImageViewer(params.url); break;
      case 'closeImageViewer': closeImageViewer(); break;
      case 'installApp': installApp(); break;
      case 'hideInstallBanner': hideInstallBanner(); break;
      case 'hideInstallGuide': hideInstallGuide(); break;
      case 'copyAppUrl': copyAppUrl(); break;
    }
  });

  // 文件输入变化监听
  document.addEventListener('change', (e) => {
    if (e.target.id === 'image-file-input') handleImageSelect(e);
    else if (e.target.id === 'ocr-file-input') handleOcrSelect(e);
  });

  // ---------- Tab 切换 ----------
  function switchTab(tab) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $$('.tab-item').forEach(t => t.classList.remove('active'));
    const page = $(`#page-${tab}`), tabBtn = $(`#tab-${tab}`);
    if (page) page.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    if (tab === 'book') loadBookData();
    if (tab === 'mine') loadMineData();
    if (tab === 'add') {
      if (!$('#date-input').value) $('#date-input').value = today();
      renderCategoryGrid();
    }
  }

  // ---------- 数据加载 ----------
  async function loadBookData() {
    const user = Store.get('user');
    if (!user) return;
    const books = await Request.api(`/books?userId=${user.id}`);
    if (Array.isArray(books)) {
      Store.set('books', books);
      if (books.length > 0) {
        let bookId = Store.get('currentBookId');
        if (!bookId || !books.find(b => b.id === bookId)) {
          bookId = books[0].id;
          Store.set('currentBookId', bookId);
        }
        renderBookSelector();
      } else {
        Store.set('currentBookId', 0);
        $('#book-name').textContent = '暂无账本';
        $('#stat-income').textContent = '+0.00';
        $('#stat-expense').textContent = '-0.00';
        $('#stat-balance').textContent = '0.00';
        $('#cat-list-expense').innerHTML = '';
        $('#cat-list-income').innerHTML = '';
        $('#record-list').innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">请先创建账本</div></div>';
      }
    }
    loadRecords();
  }

  function renderBookSelector() {
    const book = Store.get('books').find(b => b.id === Store.get('currentBookId')) || Store.get('books')[0];
    if (book) {
      Store.set('currentBookId', book.id);
      localStorage.setItem('jzb_bookId', book.id);
      $('#book-name').textContent = book.name;
    }
  }

  async function loadRecords() {
    const bookId = Store.get('currentBookId');
    if (!bookId) { Store.set('records', []); renderRecords(); return; }
    const filters = buildFilters();
    const userId = Store.get('user.id') || '';
    const [recordsRes, statsRes, allStatsRes] = await Promise.all([
      Request.api(`/records?bookId=${bookId}&userId=${userId}&${filters}`),
      Request.api(`/stats?bookId=${bookId}&userId=${userId}&${filters}`),
      Request.api(`/stats?bookId=${bookId}&userId=${userId}`)
    ]);
    if (Array.isArray(recordsRes)) { Store.set('records', recordsRes); renderRecords(); }
    if (statsRes && statsRes.totalIncome !== undefined) { Store.set('stats', statsRes); renderStats(); }
    if (allStatsRes && allStatsRes.totalIncome !== undefined) { Store.set('allTimeStats', allStatsRes); }
  }

  function buildFilters() {
    const p = new URLSearchParams();
    const mode = Store.get('periodMode');
    const y = Store.get('currentYear'), m = Store.get('currentMonth'), d = Store.get('currentDay');
    if (mode === 'day') p.set('date', `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    else if (mode === 'month') p.set('yearMonth', `${y}-${String(m).padStart(2,'0')}`);
    else if (mode === 'year') p.set('year', String(y));
    return p.toString();
  }

  function renderStats() {
    const s = Store.get('stats');
    if (!s) return;
    const categoryFilter = Store.get('categoryFilter');
    if (categoryFilter) {
      const catExp = (s.expenseByCategory||[]).find(c => c.category === categoryFilter);
      const catInc = (s.incomeByCategory||[]).find(c => c.category === categoryFilter);
      if (catExp) {
        $('#stat-income').textContent = '+0.00';
        $('#stat-expense').textContent = `-${catExp.total.toFixed(2)}`;
        $('#stat-balance').textContent = (-catExp.total).toFixed(2);
      } else if (catInc) {
        $('#stat-income').textContent = `+${catInc.total.toFixed(2)}`;
        $('#stat-expense').textContent = '-0.00';
        $('#stat-balance').textContent = catInc.total.toFixed(2);
      }
    } else {
      $('#stat-income').textContent = `+${(s.totalIncome||0).toFixed(2)}`;
      $('#stat-expense').textContent = `-${(s.totalExpense||0).toFixed(2)}`;
      $('#stat-balance').textContent = (s.balance||0).toFixed(2);
    }
    let expenseHtml = '';
    (s.expenseByCategory||[]).forEach(c => {
      const cat = CATEGORIES.find(ct => ct.name === c.category);
      const isActive = categoryFilter === c.category;
      const pct = s.totalExpense > 0 ? Math.round(c.total / s.totalExpense * 100) : 0;
      expenseHtml += `<span class="cat-tag cat-tag-expense${isActive?' cat-tag-active':''}" data-action="filterCategory" data-params='${Safe.attr(JSON.stringify({name:c.category}))}'>${cat?.icon||'📌'} ${Safe.html(c.category)} ${(c.total||0).toFixed(0)}<span class="cat-pct">${pct}%</span></span>`;
    });
    if (categoryFilter && (s.expenseByCategory||[]).find(c => c.category === categoryFilter)) {
      expenseHtml += `<span class="cat-tag cat-tag-clear" data-action="clearCategoryFilter">✕ 清除筛选</span>`;
    }
    if (!expenseHtml) expenseHtml = '<span style="color:var(--text-tertiary);font-size:12px">暂无支出</span>';
    $('#cat-list-expense').innerHTML = expenseHtml;

    let incomeHtml = '';
    (s.incomeByCategory||[]).forEach(c => {
      const cat = CATEGORIES.find(ct => ct.name === c.category);
      const isActive = categoryFilter === c.category;
      const pct = s.totalIncome > 0 ? Math.round(c.total / s.totalIncome * 100) : 0;
      incomeHtml += `<span class="cat-tag cat-tag-income${isActive?' cat-tag-active':''}" data-action="filterCategory" data-params='${Safe.attr(JSON.stringify({name:c.category}))}'>${cat?.icon||'📌'} ${Safe.html(c.category)} +${(c.total||0).toFixed(0)}<span class="cat-pct">${pct}%</span></span>`;
    });
    if (categoryFilter && (s.incomeByCategory||[]).find(c => c.category === categoryFilter)) {
      incomeHtml += `<span class="cat-tag cat-tag-clear" data-action="clearCategoryFilter">✕ 清除筛选</span>`;
    }
    if (!incomeHtml) incomeHtml = '<span style="color:var(--text-tertiary);font-size:12px">暂无收入</span>';
    $('#cat-list-income').innerHTML = incomeHtml;
  }

  function filterByCategory(name) {
    Store.set('categoryFilter', Store.get('categoryFilter') === name ? null : name);
    renderStats(); renderRecords();
  }
  function clearCategoryFilter() {
    Store.set('categoryFilter', null);
    renderStats(); renderRecords();
  }

  function renderRecords() {
    const records = Store.get('records');
    const categoryFilter = Store.get('categoryFilter');
    let filtered = categoryFilter ? records.filter(r => r.category === categoryFilter) : records;
    const grouped = {};
    filtered.forEach(r => { if (!grouped[r.date]) grouped[r.date] = []; grouped[r.date].push(r); });
    const dates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
    if (dates.length === 0) {
      const msg = categoryFilter ? '该分类下暂无记录' : '暂无账单记录';
      $('#record-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${msg}</div></div>`;
      return;
    }
    let html = '';
    if (categoryFilter) html += `<div class="filter-hint">筛选：${Safe.html(categoryFilter)} <span class="filter-clear" data-action="clearCategoryFilter">✕</span></div>`;
    dates.forEach(date => {
      const dayRecords = grouped[date];
      const income = dayRecords.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount),0);
      const expense = dayRecords.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount),0);
      html += `<div class="record-date-group"><div class="record-date-header"><span class="record-date">${formatDateLabel(date)}</span><span class="record-date-summary">${income>0?`<span style="color:var(--income)">+${income.toFixed(2)}</span> `:''}${expense>0?`<span style="color:var(--expense)">-${expense.toFixed(2)}</span>`:''}</span></div>`;
      dayRecords.forEach(r => {
        const cat = CATEGORIES.find(c=>c.id===r.categoryId) || CATEGORIES.find(c=>c.name===r.category) || {icon:'📌',name:r.category};
        const imgUrl = r.imageUrl || (r.image_path ? `/images/${r.image_path.split(/[\\/]/).pop()}` : '');
        const isSelected = Batch.isSelected(r.id);
        html += `<div class="record-card ${isSelected ? 'selected' : ''}" data-id="${r.id}" data-action="editRecord" data-params='${Safe.attr(JSON.stringify({id:r.id}))}' ontouchstart="recordTouchStart(${r.id}, event)" ontouchend="recordTouchEnd(${r.id}, event)"><span class="record-icon">${cat.icon}</span><div class="record-info"><div class="record-cat">${Safe.html(cat.name)}</div>${r.note?`<div class="record-note">${Safe.html(r.note)}</div>`:''}</div>${imgUrl?`<img class="record-thumb" src="${imgUrl}" data-action="showImageViewer" data-params='${Safe.attr(JSON.stringify({url:imgUrl}))}' style="pointer-events:auto;">`:''}<div class="record-right"><div class="record-amount record-amount-${r.type}">${formatAmount(Number(r.amount),r.type)}</div><div class="record-user">${Safe.html(r.username||'')}</div></div><label class="record-checkbox" onclick="event.stopPropagation(); Batch.toggle(${r.id});"><input type="checkbox" ${isSelected ? 'checked' : ''}><span class="checkmark"></span></label></div>`;
      });
      html += '</div>';
    });
    $('#record-list').innerHTML = html;
  }

  // ---------- 触摸事件处理 ----------
  let touchTimer = null;
  let touchTarget = null;

  function recordTouchStart(recordId, event) {
    touchTimer = setTimeout(() => {
      event.preventDefault();
      Batch.toggle(recordId);
      Toast.show('已选择', 'info', 1000);
    }, 500);
    touchTarget = recordId;
  }

  function recordTouchEnd(recordId, event) {
    if (touchTimer && touchTarget === recordId) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  }

  // ---------- 批量操作 ----------
  const Batch = {
    selectedIds: [],
    
    toggle(recordId) {
      const idx = this.selectedIds.indexOf(recordId);
      if (idx === -1) {
        this.selectedIds.push(recordId);
      } else {
        this.selectedIds.splice(idx, 1);
      }
      this.updateUI();
    },
    
    selectAll() {
      const records = Store.get('records');
      this.selectedIds = records.map(r => r.id);
      this.updateUI();
    },
    
    clearAll() {
      this.selectedIds = [];
      this.updateUI();
    },
    
    isSelected(recordId) {
      return this.selectedIds.includes(recordId);
    },
    
    updateUI() {
      const batchBar = $('#batch-bar');
      if (this.selectedIds.length > 0) {
        batchBar.style.display = 'flex';
        $('#batch-count').textContent = this.selectedIds.length;
      } else {
        batchBar.style.display = 'none';
      }
      
      $$('.record-card').forEach(card => {
        const id = parseInt(card.dataset.id);
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (this.isSelected(id)) {
          card.classList.add('selected');
          if (checkbox) checkbox.checked = true;
        } else {
          card.classList.remove('selected');
          if (checkbox) checkbox.checked = false;
        }
      });
    },
    
    async deleteSelected() {
      if (this.selectedIds.length === 0) return;
      
      const confirmed = confirm(`确定删除选中的 ${this.selectedIds.length} 条记录吗？此操作不可恢复。`);
      
      if (!confirmed) return;
      
      const res = await Request.api('/records/batch-delete', {
        ids: this.selectedIds,
        bookId: Store.get('currentBookId'),
        userId: Store.get('user.id')
      });
      
      if (res.success) {
        Toast.success(`已删除 ${this.selectedIds.length} 条记录`);
        this.clearAll();
        loadRecords();
      } else {
        Toast.error(res.error || '删除失败');
      }
    }
  };

  // ---------- 全局暴露（兼容旧的onclick调用）----------
  window.Batch = Batch;
  window.recordTouchStart = recordTouchStart;
  window.recordTouchEnd = recordTouchEnd;

  function changePeriod(dir) {
    clearCategoryFilter();
    const mode = Store.get('periodMode');
    if (mode === 'day') {
      const d = new Date(Store.get('currentYear'), Store.get('currentMonth')-1, Store.get('currentDay')+dir);
      Store.set('currentYear', d.getFullYear()); Store.set('currentMonth', d.getMonth()+1); Store.set('currentDay', d.getDate());
    } else if (mode === 'month') {
      const d = new Date(Store.get('currentYear'), Store.get('currentMonth')-1+dir, 1);
      Store.set('currentYear', d.getFullYear()); Store.set('currentMonth', d.getMonth()+1);
    } else if (mode === 'year') {
      Store.set('currentYear', Store.get('currentYear')+dir);
    }
    updatePeriodDisplay(); loadRecords();
  }

  function updatePeriodDisplay() {
    const mode = Store.get('periodMode'), y = Store.get('currentYear'), m = Store.get('currentMonth'), d = Store.get('currentDay');
    $('#period-label').textContent = mode==='day'?`${y}年${m}月${d}日`:mode==='month'?`${y}年${m}月`:mode==='year'?`${y}年`:'全部';
  }

  function goToToday() {
    const now = new Date();
    Store.set('currentYear', now.getFullYear()); Store.set('currentMonth', now.getMonth()+1); Store.set('currentDay', now.getDate());
    Store.set('categoryFilter', null); updatePeriodDisplay(); loadRecords();
  }

  function switchPeriod(target) {
    const mode = target.dataset.mode;
    Store.set('periodMode', mode); Store.set('categoryFilter', null);
    $$('.period-tab').forEach(b => b.classList.remove('active'));
    target.classList.add('active');
    $('#period-nav').style.display = mode === 'all' ? 'none' : 'flex';
    updatePeriodDisplay(); loadRecords();
  }

  // ---------- 记账页 ----------
  function switchType(type) {
    Store.set('recordType', type); Store.set('categoryId', 0);
    $$('#page-add .type-btn').forEach(b => b.className = 'type-btn');
    const btn = $(`#type-${type}`); if (btn) btn.className = `type-btn active-${type}`;
    $('#amount-prefix').textContent = type === 'expense' ? '-' : '+';
    $('#amount-prefix').className = `amount-prefix amount-prefix-${type}`;
    renderCategoryGrid();
  }

  function renderCategoryGrid() {
    const type = Store.get('recordType');
    const cats = CATEGORIES.filter(c => c.type === type);
    if (!cats.find(c => c.id === Store.get('categoryId'))) Store.set('categoryId', cats.length>0 ? cats[0].id : 0);
    let html = '';
    cats.forEach(c => {
      const selected = Store.get('categoryId') === c.id ? ' selected' : '';
      html += `<div class="cat-item${selected}" data-action="selectCat" data-params='${Safe.attr(JSON.stringify({id:c.id}))}'><span class="cat-item-icon">${c.icon}</span><span>${c.name}</span></div>`;
    });
    $('#cat-grid').innerHTML = html;
  }

  function selectCategory(id) { Store.set('categoryId', id); renderCategoryGrid(); }

  function setQuickAmount(n) {
    const current = parseFloat($('#amount-input').value) || 0;
    const newVal = current + n;
    Store.set('amount', String(newVal));
    $('#amount-input').value = newVal;
  }

  function triggerImageUpload() { const el = $('#image-file-input'); el.value = ''; el.click(); }
  function triggerOcr() { const el = $('#ocr-file-input'); el.value = ''; el.click(); }

  async function handleImageSelect(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    const { uploadRes, ocrRes } = await ImageProcessor.uploadAndOCR(file);
    if (uploadRes.success) {
      Store.set('imageUrl', uploadRes.url);
      $('#preview-img').src = uploadRes.url; $('#image-preview').style.display = 'block';
    }
    if (ocrRes?.success) applyOcrResult(ocrRes);
  }

  async function handleOcrSelect(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    const { uploadRes, ocrRes } = await ImageProcessor.uploadAndOCR(file);
    if (uploadRes.success) {
      Store.set('imageUrl', uploadRes.url);
      $('#preview-img').src = uploadRes.url; $('#image-preview').style.display = 'block';
    }
    if (ocrRes?.success) applyOcrResult(ocrRes);
  }

  function applyOcrResult(ocrRes) {
    let filled = [];
    if (ocrRes.amount && ocrRes.amount > 0) { Store.set('amount', String(ocrRes.amount)); filled.push('金额'); }
    if (ocrRes.date) { Store.set('date', ocrRes.date); filled.push('日期'); }
    if (ocrRes.note?.trim()) { Store.set('note', ocrRes.note); filled.push('备注'); }
    if (filled.length) Toast.success('已识别: ' + filled.join('、'));
  }

  function clearImage() {
    Store.set('imageUrl', '');
    $('#image-preview').style.display = 'none'; $('#preview-img').src = '';
  }

  async function saveRecord() {
    const btn = $('#save-btn'); if (btn.disabled) return;
    Store.set('amount', $('#amount-input').value);
    Store.set('date', $('#date-input').value);
    Store.set('note', $('#note-input').value);
    const state = Store.state;
    if (!state.currentBookId) return Toast.warn('请先选择账本');
    if (!state.user?.id) return Toast.warn('请先登录');
    if (!state.amount || parseFloat(state.amount) <= 0) return Toast.warn('请输入金额');
    if (!state.categoryId) return Toast.warn('请选择分类');
    if (!state.date) return Toast.warn('请选择日期');
    btn.disabled = true;
    const cat = CATEGORIES.find(c => c.id === state.categoryId);
    const res = await Request.api('/records/add', {
      bookId: state.currentBookId, userId: state.user.id, type: state.recordType,
      amount: parseFloat(state.amount), category: cat?.name || '', categoryId: state.categoryId,
      note: state.note, date: state.date, imagePath: state.imageUrl
    });
    if (res.success) {
      Toast.success('保存成功');
      Store.set('amount', ''); Store.set('note', ''); Store.set('imageUrl', '');
      Store.set('categoryId', 0); Store.set('date', today());
      $('#amount-input').value = ''; $('#note-input').value = ''; $('#date-input').value = today();
      clearImage(); renderCategoryGrid(); loadRecords();
    } else Toast.error(res.error || '保存失败');
    btn.disabled = false;
  }

  // ---------- 记录编辑/删除 ----------
  function editRecord(recordId) {
    const r = Store.get('records').find(rec => rec.id === recordId);
    if (!r) return;
    $('#edit-record-id').value = r.id; $('#edit-record-type').value = r.type;
    $('#edit-record-amount').value = r.amount; $('#edit-record-date').value = r.date;
    $('#edit-record-note').value = r.note || '';
    const catId = r.categoryId || (CATEGORIES.find(c => c.name === r.category)?.id || 0);
    $('#edit-record-categoryId').value = catId;
    renderEditCategoryGrid(r.type, catId);
    const imgUrl = r.imageUrl || (r.image_path ? `/images/${r.image_path.split(/[\\/]/).pop()}` : '');
    if (imgUrl) { $('#edit-record-image').src = imgUrl; $('#edit-record-image').style.display = 'block'; }
    else $('#edit-record-image').style.display = 'none';
    Modal.open('record-edit-modal');
  }

  function renderEditCategoryGrid(type, selectedId) {
    const cats = CATEGORIES.filter(c => c.type === type);
    let html = '';
    cats.forEach(c => {
      html += `<div class="cat-item${selectedId===c.id?' selected':''}" data-action="selectEditCat" data-params='${Safe.attr(JSON.stringify({id:c.id}))}'><span class="cat-item-icon">${c.icon}</span><span>${c.name}</span></div>`;
    });
    $('#edit-cat-grid').innerHTML = html;
  }

  function selectEditCat(id) {
    $('#edit-record-categoryId').value = id;
    renderEditCategoryGrid($('#edit-record-type').value, id);
  }

  async function saveRecordEdit() {
    const id = parseInt($('#edit-record-id').value);
    const type = $('#edit-record-type').value;
    const amount = parseFloat($('#edit-record-amount').value);
    if (!amount || amount <= 0) return Toast.warn('请输入有效金额');
    const date = $('#edit-record-date').value;
    const note = $('#edit-record-note').value.trim();
    const categoryId = parseInt($('#edit-record-categoryId').value);
    const cat = CATEGORIES.find(c => c.id === categoryId);
    const res = await Request.api('/records/update', {
      id, type, amount, date, note, category: cat?.name || '', categoryId,
      bookId: Store.get('currentBookId'), userId: Store.get('user.id')
    });
    if (res.success) { Toast.success('修改成功'); Modal.close('record-edit-modal'); loadRecords(); }
    else Toast.error(res.error || '修改失败');
  }

  async function deleteCurrentRecord() {
    const id = parseInt($('#edit-record-id').value);
    if (!confirm('确定删除此条记录？')) return;
    const res = await Request.api('/records/delete', { id, bookId: Store.get('currentBookId'), userId: Store.get('user.id') });
    if (res.success) { Toast.success('已删除'); Modal.close('record-edit-modal'); loadRecords(); }
    else Toast.error(res.error || '删除失败');
  }

  async function deleteRecordById(id) {
    if (!confirm('确定删除此条记录？')) return;
    const res = await Request.api('/records/delete', { id, bookId: Store.get('currentBookId'), userId: Store.get('user.id') });
    if (res.success) { Toast.success('已删除'); loadRecords(); }
    else Toast.error(res.error || '删除失败');
  }

  // ---------- 我的页 ----------
  async function loadMineData() {
    const user = Store.get('user'); if (!user) return;
    $('#mine-username').textContent = user.username || '用户';
    if (!Store.get('allTimeStats') && Store.get('currentBookId')) {
      const allStats = await Request.api(`/stats?bookId=${Store.get('currentBookId')}&userId=${user.id}`);
      if (allStats && allStats.totalIncome !== undefined) Store.set('allTimeStats', allStats);
    }
    const s = Store.get('allTimeStats') || Store.get('stats') || {};
    $('#overview-income').textContent = (s.totalIncome||0).toFixed(0);
    $('#overview-expense').textContent = (s.totalExpense||0).toFixed(0);
    $('#overview-books').textContent = Store.get('books').length;
    renderBookCards(); renderSummary();
  }

  function renderBookCards() {
    const books = Store.get('books');
    let html = books.length ? '' : '<div style="text-align:center;padding:20px;color:var(--text-tertiary)">暂无账本</div>';
    books.forEach(b => {
      html += `<div class="book-card" data-action="switchTab" data-params='${Safe.attr(JSON.stringify({tab:'book'}))}'><div class="book-icon-box">📒</div><div class="book-info"><div class="book-card-name">${Safe.html(b.name)}</div><div class="book-card-desc">${Safe.html(b.description||'')}</div></div><span class="book-arrow">›</span></div>`;
    });
    $('#book-cards').innerHTML = html;
  }

  function renderSummary() {
    const s = Store.get('allTimeStats') || Store.get('stats'); if (!s) return;
    $('#sum-income').textContent = `+${(s.totalIncome||0).toFixed(2)}`;
    $('#sum-expense').textContent = `-${(s.totalExpense||0).toFixed(2)}`;
    $('#sum-balance').textContent = (s.balance||0).toFixed(2);
  }

  // ---------- 账本管理 ----------
  function showBookManage() { renderBookManageList(); Modal.open('book-manage-modal'); }
  function renderBookManageList() {
    const books = Store.get('books'), currentId = Store.get('currentBookId');
    let html = '';
    books.forEach(b => {
      html += `<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--divider)"><span style="flex:1">${b.id===currentId?'▸ ':''}${Safe.html(b.name)}</span><button class="btn-sm" data-action="openBookEdit" data-params='${Safe.attr(JSON.stringify({id:b.id}))}' style="margin-right:6px">编辑</button><button class="btn-sm btn-danger" data-action="deleteBook" data-params='${Safe.attr(JSON.stringify({id:b.id,name:b.name}))}'>删除</button></div>`;
    });
    if (!html) html = '<div style="text-align:center;padding:20px">暂无账本</div>';
    $('#book-manage-list').innerHTML = html;
  }

  async function createNewBook() {
    const name = $('#new-book-name').value.trim();
    if (!name) return Toast.warn('请输入账本名称');
    const res = await Request.api('/books/create', { name, userId: Store.get('user.id') });
    if (res.success) { Toast.success('创建成功'); $('#new-book-name').value = ''; await loadBookData(); renderBookManageList(); }
    else Toast.error(res.error||'创建失败');
  }

  async function createNewBookQuick() {
    const name = $('#new-book-name-quick').value.trim();
    if (!name) return Toast.warn('请输入账本名称');
    const res = await Request.api('/books/create', { name, userId: Store.get('user.id') });
    if (res.success) {
      Toast.success('创建成功');
      $('#new-book-name-quick').value = '';
      await loadBookData();
      const newBook = Store.get('books').find(b => b.name === name);
      if (newBook) {
        Store.set('currentBookId', newBook.id);
        $('#book-name').textContent = newBook.name;
      }
      Modal.close('book-select-modal');
      loadRecords();
    } else {
      Toast.error(res.error||'创建失败');
    }
  }

  function openBookEdit(bookId) {
    const book = Store.get('books').find(b => b.id === bookId); if (!book) return;
    $('#edit-book-id').value = bookId; $('#edit-book-name').value = book.name; $('#edit-book-desc').value = book.description || '';
    Modal.close('book-manage-modal'); Modal.open('book-edit-modal');
  }

  async function saveBookEdit() {
    const bookId = parseInt($('#edit-book-id').value);
    const name = $('#edit-book-name').value.trim();
    if (!name) return Toast.warn('请输入账本名称');
    const desc = $('#edit-book-desc').value.trim();
    const res = await Request.api('/books/update', { id: bookId, name, description: desc, userId: Store.get('user.id') });
    if (res.success) { Toast.success('修改成功'); Modal.close('book-edit-modal'); await loadBookData(); }
    else Toast.error(res.error||'修改失败');
  }

  function confirmDeleteBook(bookId, name) {
    if (!confirm(`确定删除账本「${name}」？`)) return;
    doDeleteBook(bookId);
  }

  async function doDeleteBook(bookId) {
    const res = await Request.api('/books/delete', { id: bookId, userId: Store.get('user.id') });
    if (res.success) {
      Toast.success('已删除');
      if (Store.get('currentBookId') === bookId) Store.set('currentBookId', 0);
      await loadBookData(); renderBookManageList(); Modal.close('book-edit-modal');
    } else Toast.error(res.error||'删除失败');
  }

  function selectBook(bookId) {
    Store.set('currentBookId', bookId); Store.set('categoryFilter', null);
    localStorage.setItem('jzb_bookId', bookId); renderBookSelector();
    Modal.close('book-select-modal'); loadRecords();
  }

  function showNewBookDialog() {
    const name = prompt('请输入新账本名称：');
    if (name?.trim()) createNewBookByName(name.trim());
  }

  async function createNewBookByName(name) {
    const res = await Request.api('/books/create', { name, userId: Store.get('user.id') });
    if (res.success) {
      Toast.success('创建成功');
      await loadBookData();
      if (res.id) { Store.set('currentBookId', res.id); localStorage.setItem('jzb_bookId', res.id); }
      renderBookSelector(); loadRecords();
    } else Toast.error(res.error||'创建失败');
  }

  // ---------- 邀请 & 成员 ----------
  async function createInvite() {
    const res = await Request.api('/invite/create', { bookId: Store.get('currentBookId'), userId: Store.get('user.id'), role: $('#invite-role').value });
    if (res.success) { $('#invite-code-display').textContent = res.code; $('#invite-result').style.display = 'block'; }
    else Toast.error(res.error||'创建失败');
  }

  async function joinByCode() {
    const code = $('#join-code-input').value.trim();
    if (!code) return Toast.warn('请输入邀请码');
    const res = await Request.api('/invite/join', { code, userId: Store.get('user.id') });
    if (res.success) { Toast.success(`已加入「${res.bookName}」`); Modal.close('join-modal'); loadBookData(); }
    else Toast.error(res.error||'加入失败');
  }

  async function showMembers() {
    const res = await Request.api(`/members/list?bookId=${Store.get('currentBookId')}&userId=${Store.get('user.id')}`);
    const members = Array.isArray(res) ? res : [];
    const roleMap = { owner:'创建者', member:'编辑者', viewer:'查看者' };
    let html = '';
    members.forEach(m => html += `<div class="member-item"><div class="member-avatar">👤</div><div class="member-info"><div class="member-name">${Safe.html(m.username)}</div><div class="member-role">${roleMap[m.role]||m.role}</div></div></div>`);
    $('#member-list').innerHTML = html;
    Modal.open('member-modal');
  }

  function exportExcel() {
    window.open(`${API}/export/excel?bookId=${Store.get('currentBookId')}&userId=${Store.get('user.id')}`, '_blank');
    Modal.close('export-modal');
  }
  function exportZip() {
    window.open(`${API}/export/zip?bookId=${Store.get('currentBookId')}&userId=${Store.get('user.id')}`, '_blank');
    Modal.close('export-modal');
  }

  // ---------- 登录/注册/退出 ----------
  async function handleLogin() {
    const username = $('#login-user').value.trim(), password = $('#login-pass').value.trim();
    if (!username || !password) return Toast.warn('请输入用户名和密码');
    const res = await Request.api('/auth/login', { username, password });
    if (res.success) {
      Store.set('user', { id: res.userId, username: res.username || username });
      localStorage.setItem('jzb_user', JSON.stringify(Store.get('user')));
      $('#login-page').style.display = 'none'; $('#app-page').style.display = 'block';
      loadBookData();
    } else Toast.error(res.error||'登录失败');
  }

  async function handleRegister() {
    const username = $('#login-user').value.trim(), password = $('#login-pass').value.trim();
    if (!username || !password) return Toast.warn('请输入用户名和密码');
    const res = await Request.api('/auth/register', { username, password });
    if (res.success) Toast.success('注册成功，请登录');
    else Toast.error(res.error||'注册失败');
  }

  function handleLogout() {
    Object.assign(Store.state, {
      user: null, books: [], records: [], stats: null, allTimeStats: null,
      currentBookId: 0, categoryFilter: null
    });
    localStorage.removeItem('jzb_user'); localStorage.removeItem('jzb_bookId');
    $('#login-page').style.display = 'flex'; $('#app-page').style.display = 'none';
    $('#login-user').value = ''; $('#login-pass').value = '';
  }

  function restoreLogin() {
    const saved = localStorage.getItem('jzb_user');
    if (saved) {
      try {
        Store.set('user', JSON.parse(saved));
        $('#login-page').style.display = 'none'; $('#app-page').style.display = 'block';
        const savedBookId = localStorage.getItem('jzb_bookId');
        if (savedBookId) Store.set('currentBookId', parseInt(savedBookId));
        return true;
      } catch (e) { localStorage.removeItem('jzb_user'); localStorage.removeItem('jzb_bookId'); }
    }
    return false;
  }

  // ---------- PWA & 图片查看器 ----------
  function showImageViewer(url) {
    const viewer = $('#image-viewer'), img = $('#viewer-img');
    if (!viewer || !img) return;
    img.src = url; viewer.style.display = 'flex';
  }
  function closeImageViewer() { const v = $('#image-viewer'); if (v) v.style.display = 'none'; }

  let deferredPrompt = null;
  function installApp() {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
    else { const g = $('#install-guide'); if (g) g.style.display = 'block'; }
  }
  function hideInstallBanner() { const b = $('#install-banner'); if (b) b.style.display = 'none'; }
  function hideInstallGuide() {
    const g = $('#install-guide'); if (g) g.style.display = 'none';
    localStorage.setItem('installGuideDismissed', '1');
  }
  function copyAppUrl() {
    const url = location.href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => Toast.success('链接已复制'));
    else {
      const input = document.createElement('input'); input.value = url;
      document.body.appendChild(input); input.select();
      document.execCommand('copy'); document.body.removeChild(input);
      Toast.success('链接已复制');
    }
  }

  // ---------- 图片查看器缩放 & 触摸 ----------
  let viewerScale = 1;
  function viewerZoomIn() { viewerScale = Math.min(viewerScale + 0.3, 5); applyViewerScale(); }
  function viewerZoomOut() { viewerScale = Math.max(viewerScale - 0.3, 0.5); applyViewerScale(); }
  function viewerReset() { viewerScale = 1; applyViewerScale(); }
  function applyViewerScale() { const img = $('#viewer-img'); if (img) img.style.transform = `scale(${viewerScale})`; }
  let touchStartDist = 0, touchStartScale = 1;
  function handleViewerTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.hypot(dx, dy);
      touchStartScale = viewerScale;
    }
  }
  function handleViewerTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      viewerScale = Math.max(0.5, Math.min(5, touchStartScale * (dist / touchStartDist)));
      applyViewerScale();
    }
  }
  function handleViewerTouchEnd() { touchStartDist = 0; }

  // ---------- 账本选择列表 ----------
  function renderBookSelectList() {
    const books = Store.get('books'), currentId = Store.get('currentBookId');
    let html = '';
    books.forEach(b => {
      const isCurrent = b.id === currentId;
      html += `<div style="padding:12px 0;border-bottom:1px solid var(--divider);display:flex;align-items:center;cursor:pointer" data-action="selectBook" data-params='${Safe.attr(JSON.stringify({id:b.id}))}'><span style="flex:1;font-size:15px;${isCurrent?'font-weight:600;color:var(--primary)':''}">${isCurrent?'▸ ':''}${Safe.html(b.name)}</span>${isCurrent?'<span style="font-size:12px;color:var(--text-tertiary)">当前</span>':''}</div>`;
    });
    if (!html) html = '<div style="text-align:center;padding:20px;color:var(--text-tertiary)">暂无账本</div>';
    $('#book-select-list').innerHTML = html;
  }

  // ---------- 角色选择 ----------
  function selectRole(el, role) {
    $$('.role-option').forEach(r => r.classList.remove('active'));
    el.classList.add('active');
    $('#invite-role').value = role;
  }

  // ---------- 编辑记录类型切换 ----------
  function switchEditType(type) {
    $('#edit-record-type').value = type;
    const expBtn = $('#edit-type-expense'), incBtn = $('#edit-type-income');
    if (expBtn) expBtn.className = type === 'expense' ? 'type-btn active-expense' : 'type-btn';
    if (incBtn) incBtn.className = type === 'income' ? 'type-btn active-income' : 'type-btn';
    renderEditCategoryGrid(type, parseInt($('#edit-record-categoryId').value) || 0);
  }

  // ---------- 删除账本/记录 (HTML onclick 兼容) ----------
  function deleteBook() {
    const bookId = parseInt($('#edit-book-id').value);
    const book = Store.get('books').find(b => b.id === bookId);
    if (book) confirmDeleteBook(bookId, book.name);
  }
  function deleteRecord() { deleteCurrentRecord(); }

  // ---------- 初始化 ----------
  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/app/sw.js').catch(e => console.log('SW注册失败', e));
    }
    if (restoreLogin()) loadBookData();
    $('#date-input').value = today();
    updatePeriodDisplay();
    renderCategoryGrid();
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferredPrompt = e;
      const banner = $('#install-banner'); if (banner) banner.style.display = 'flex';
    });
    setTimeout(() => {
      if (!deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
        const guide = $('#install-guide');
        if (guide && !localStorage.getItem('installGuideDismissed')) guide.style.display = 'block';
      }
    }, 3000);
  });

  // 全局暴露 (兼容旧 onclick 调用)
  window.switchTab = switchTab;
  window.changePeriod = changePeriod;
  window.goToToday = goToToday;
  window.switchPeriod = switchPeriod;
  window.saveRecord = saveRecord;
  window.switchType = switchType;
  window.selectCat = selectCategory;
  window.setQuickAmount = setQuickAmount;
  window.triggerImageUpload = triggerImageUpload;
  window.triggerOcr = triggerOcr;
  window.clearImage = clearImage;
  window.editRecord = editRecord;
  window.saveRecordEdit = saveRecordEdit;
  window.deleteCurrentRecord = deleteCurrentRecord;
  window.selectBook = selectBook;
  window.showNewBookDialog = showNewBookDialog;
  window.createNewBook = createNewBook;
  window.createNewBookQuick = createNewBookQuick;
  window.openBookEdit = openBookEdit;
  window.saveBookEdit = saveBookEdit;
  window.confirmDeleteBook = confirmDeleteBook;
  window.createInvite = createInvite;
  window.joinByCode = joinByCode;
  window.showMembers = showMembers;
  window.exportExcel = exportExcel;
  window.exportZip = exportZip;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.handleLogout = handleLogout;
  window.filterByCategory = filterByCategory;
  window.clearCategoryFilter = clearCategoryFilter;
  window.showImageViewer = showImageViewer;
  window.closeImageViewer = closeImageViewer;
  window.installApp = installApp;
  window.hideInstallBanner = hideInstallBanner;
  window.hideInstallGuide = hideInstallGuide;
  window.copyAppUrl = copyAppUrl;
  // HTML onclick 兼容别名
  window.showModal = Modal.open;
  window.closeModal = Modal.close;
  window.renderBookSelectList = renderBookSelectList;
  window.renderBookManageList = renderBookManageList;
  window.selectRole = selectRole;
  window.switchEditType = switchEditType;
  window.deleteBook = deleteBook;
  window.deleteRecord = deleteRecord;
  window.viewerZoomIn = viewerZoomIn;
  window.viewerZoomOut = viewerZoomOut;
  window.viewerReset = viewerReset;
  window.handleViewerTouchStart = handleViewerTouchStart;
  window.handleViewerTouchMove = handleViewerTouchMove;
  window.handleViewerTouchEnd = handleViewerTouchEnd;

})();
