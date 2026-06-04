// 应用状态
const state = {
  userId: null,
  username: null,
  currentBookId: null,
  currentType: 'expense',
  selectedCategory: null,
  // 时间维度：month=按月, year=按年, all=全部
  periodMode: 'month',
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  currentFilter: 'all',
  statsType: 'expense',
  categories: { income: [], expense: [] },
  stats: null,
  imageData: null,
  imageFileName: null,
  ocrData: null,
  selectedBookIcon: '📒',
  // 编辑相关状态
  editCategory: null,
  editType: 'expense',
  // 当前激活的tab
  activeTab: 'tabBook'
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const Safe = {
  html: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  attr: (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initLoginPage();
});

// ===== 登录页 =====
function initLoginPage() {
  $$('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      $('#loginForm').style.display = isLogin ? 'flex' : 'none';
      $('#registerForm').style.display = isLogin ? 'none' : 'flex';
      $('#loginError').textContent = '';
    });
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = await window.api.login({ username: $('#loginUsername').value.trim(), password: $('#loginPassword').value });
    if (result.success) { state.userId = result.userId; state.username = result.username; enterMainPage(); }
    else { $('#loginError').textContent = result.error; }
  });

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('#regPassword').value, p2 = $('#regPassword2').value;
    if (p1 !== p2) { $('#loginError').textContent = '两次密码不一致'; return; }
    const result = await window.api.register({ username: $('#regUsername').value.trim(), password: p1 });
    if (result.success) { state.userId = result.userId; state.username = $('#regUsername').value.trim(); enterMainPage(); }
    else { $('#loginError').textContent = result.error; }
  });
}

function enterMainPage() {
  $('#loginPage').style.display = 'none';
  $('#mainPage').style.display = 'block';
  initMainApp();
}

// ===== 主应用初始化 =====
function initMainApp() {
  initBottomNav();
  initPeriodSelector();
  initPeriodTabs();
  initTypeToggle();
  initForm();
  initEditForm();
  initFilterTabs();
  initStatsTabs();
  initBookModal();
  initMemberModal();
  initImageModal();
  initLogout();
  initExport();
  initBookSelect();
  initBigAddBtn();

  // 加载数据
  loadMainData();
}

async function loadMainData() {
  await loadCategories();
  renderCategories();
  setDefaultDate();
  await loadBooks();
  await refreshData();
  loadProfileData();
}

// ===== 底部导航切换 =====
function initBottomNav() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  // 更新tab页面显示
  $$('.tab-page').forEach(p => p.classList.remove('active'));
  $('#' + tabId).classList.add('active');

  // 更新导航按钮状态
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $(`.nav-item[data-tab="${tabId}"]`).classList.add('active');

  state.activeTab = tabId;

  // 切换到"我的"时刷新数据
  if (tabId === 'tabProfile') {
    loadProfileData();
  }
  // 切换到"账本"时刷新数据
  if (tabId === 'tabBook') {
    refreshData();
  }
}

// ===== 大加号按钮（记账页） =====
function initBigAddBtn() {
  $('#bigAddBtn').addEventListener('click', () => {
    openRecordModal();
  });
}

// 打开记账弹窗（新增模式）
function openRecordModal() {
  $('#editRecordId').value = '';
  $('#btnSubmit').textContent = '记一笔';
  resetRecordForm();
  $('#recordModal').style.display = 'flex';
}

// 关闭记账弹窗
function closeRecordModal() {
  $('#recordModal').style.display = 'none';
}

// 重置记账表单（首次打开时调用）
function resetRecordForm() {
  $('#amount').value = '';
  $('#note').value = '';
  state.selectedCategory = null;
  state.currentType = 'expense';
  clearImage();
  renderCategories();
  setDefaultDate();
  $$('#recordForm .type-btn').forEach(b => b.classList.remove('active'));
  $('#btnExpense').classList.add('active');
  updateAmountPrefix();
}

// 重置表单准备记下一笔（保存后调用，保持弹窗打开）
function resetRecordFormForNext() {
  $('#amount').value = '';
  $('#note').value = '';
  state.selectedCategory = null;
  clearImage();
  renderCategories();
  setDefaultDate();
}

// 退出登录
function initLogout() {
  $('#logoutBtn').addEventListener('click', () => {
    state.userId = null; state.username = null; state.currentBookId = null;
    $('#mainPage').style.display = 'none'; $('#loginPage').style.display = 'block';
    $('#loginUsername').value = ''; $('#loginPassword').value = ''; $('#loginError').textContent = '';
  });
}

// 导出
function initExport() {
  $('#exportBtn').addEventListener('click', async () => {
    if (!state.currentBookId) { alert('请先选择账本'); return; }
    const bookSelect = $('#bookSelect');
    const bookName = bookSelect.options[bookSelect.selectedIndex]?.text.replace(/^[^\s]+\s/, '') || '账本';
    $('#exportBtn').textContent = '导出中...'; $('#exportBtn').disabled = true;
    const result = await window.api.exportBook({ bookId: state.currentBookId, bookName });
    $('#exportBtn').textContent = '导出'; $('#exportBtn').disabled = false;
    if (result.success) alert('导出成功！文件已保存到：' + result.path);
    else if (!result.canceled) alert('导出失败：' + result.error);
  });
}

// ===== 时间维度切换 =====
function initPeriodTabs() {
  $$('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.periodMode = tab.dataset.period;
      updatePeriodDisplay();
      refreshData();
    });
  });
}

// 时间段选择器
function initPeriodSelector() {
  updatePeriodDisplay();
  $('#prevPeriod').addEventListener('click', () => { changePeriod(-1); });
  $('#nextPeriod').addEventListener('click', () => { changePeriod(1); });
}

function changePeriod(delta) {
  if (state.periodMode === 'month') {
    state.currentMonth += delta;
    if (state.currentMonth > 12) { state.currentMonth = 1; state.currentYear++; }
    if (state.currentMonth < 1) { state.currentMonth = 12; state.currentYear--; }
  } else if (state.periodMode === 'year') {
    state.currentYear += delta;
  }
  updatePeriodDisplay();
  refreshData();
}

function updatePeriodDisplay() {
  const el = $('#currentPeriod');
  if (state.periodMode === 'month') {
    el.textContent = `${state.currentYear}年${state.currentMonth}月`;
  } else if (state.periodMode === 'year') {
    el.textContent = `${state.currentYear}年`;
  } else {
    el.textContent = '全部记录';
  }
}

// 获取当前筛选的 yearMonth 值
function getYearMonth() {
  if (state.periodMode === 'month') {
    return `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}`;
  } else if (state.periodMode === 'year') {
    return `${state.currentYear}`;
  }
  return null;
}

// 收支类型切换（记账弹窗）
function initTypeToggle() {
  $$('#recordForm .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#recordForm .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentType = btn.dataset.type;
      state.selectedCategory = null;
      // 更新金额前缀符号和颜色
      updateAmountPrefix();
      renderCategories();
    });
  });
}

// 编辑表单收支类型切换
function initEditTypeToggle() {
  $$('#editForm .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#editForm .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.editType = btn.dataset.type;
      state.editCategory = null;
      renderEditCategories();
    });
  });
}

// 记账表单提交（保存后重置表单，保持弹窗打开，方便连续记账）
function initForm() {
  $('#recordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat($('#amount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    if (!state.selectedCategory) { alert('请选择分类'); return; }
    if (!state.currentBookId) { alert('请先选择账本'); return; }

    let imagePath = '';
    if (state.imageData) {
      const fileName = `record_${Date.now()}_${state.imageFileName || 'image.png'}`;
      const result = await window.api.saveImage({ imageData: state.imageData, fileName });
      if (result.success) imagePath = result.path;
    }

    const record = {
      bookId: state.currentBookId, type: state.currentType,
      amount: amount.toFixed(2), category: state.selectedCategory,
      date: $('#date').value, note: $('#note').value.trim(),
      imagePath, userId: state.userId
    };

    const result = await window.api.addRecord(record);
    if (result.success) {
      // 显示保存成功提示
      showSaveHint();
      // 重置表单但保持弹窗打开，方便连续记账
      resetRecordFormForNext();
      // 刷新数据
      await refreshData();
    } else { alert('保存失败：' + result.error); }
  });

  // 记账弹窗关闭按钮
  $('#closeRecordModal').addEventListener('click', () => { closeRecordModal(); hideSaveHint(); });
  $('#recordModal').addEventListener('click', (e) => { if (e.target === $('#recordModal')) { closeRecordModal(); hideSaveHint(); } });
}

// 显示保存成功提示
function showSaveHint() {
  const hint = $('#saveHint');
  hint.textContent = '已保存';
  hint.classList.add('show');
  setTimeout(() => { hint.classList.remove('show'); }, 1500);
}

// 隐藏保存提示
function hideSaveHint() { $('#saveHint').classList.remove('show'); }

// 更新金额前缀符号（-支出 / +收入）
function updateAmountPrefix() {
  const prefix = $('#amountPrefix');
  if (state.currentType === 'income') {
    prefix.textContent = '+';
    prefix.classList.add('positive');
  } else {
    prefix.textContent = '-';
    prefix.classList.remove('positive');
  }
}

// ===== 编辑记录功能 =====
function initEditForm() {
  initEditTypeToggle();

  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recordId = parseInt($('#editRecordIdVal').value);
    const amount = parseFloat($('#editAmount').value);
    if (!amount || amount <= 0) { alert('请输入有效金额'); return; }
    if (!state.editCategory) { alert('请选择分类'); return; }

    const data = {
      id: recordId,
      type: state.editType,
      amount: amount.toFixed(2),
      category: state.editCategory,
      date: $('#editDate').value,
      note: $('#editNote').value.trim()
    };

    const result = await window.api.updateRecord(data);
    if (result.success) {
      $('#editModal').style.display = 'none';
      await refreshData();
    } else { alert('修改失败：' + result.error); }
  });

  // 编辑弹窗关闭按钮
  $('#closeEditModal').addEventListener('click', () => { $('#editModal').style.display = 'none'; });
  $('#editModal').addEventListener('click', (e) => { if (e.target === $('#editModal')) $('#editModal').style.display = 'none'; });
}

// 打开编辑弹窗
function openEditModal(record) {
  $('#editRecordIdVal').value = record.id;
  $('#editAmount').value = Number(record.amount);
  $('#editDate').value = record.date;
  $('#editNote').value = record.note || '';

  // 设置类型
  state.editType = record.type;
  $$('#editForm .type-btn').forEach(b => b.classList.remove('active'));
  if (record.type === 'income') $('#editBtnIncome').classList.add('active');
  else $('#editBtnExpense').classList.add('active');

  // 设置分类
  state.editCategory = record.category;
  renderEditCategories();

  $('#editModal').style.display = 'flex';
}

// 渲染编辑表单的分类网格
function renderEditCategories() {
  const categories = state.categories[state.editType];
  const grid = $('#editCategoryGrid');
  grid.innerHTML = categories.map(cat => `
    <div class="category-item ${state.editCategory === cat.name ? 'selected' : ''}" data-category="${cat.name}">
      <span class="category-icon">${cat.icon}</span>
      <span class="category-name">${cat.name}</span>
    </div>
  `).join('');
  grid.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      state.editCategory = item.dataset.category;
      grid.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
}

// 筛选标签
function initFilterTabs() {
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      loadRecords();
    });
  });
}

// 统计标签
function initStatsTabs() {
  $$('.stats-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.stats-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.statsType = tab.dataset.stats;
      renderStats();
    });
  });
}

// ===== 账本管理 =====
async function loadBooks() {
  const books = await window.api.getBooks(state.userId);
  const select = $('#bookSelect');
  const prevBookId = state.currentBookId;
  select.innerHTML = books.map(b => `<option value="${Safe.attr(b.id)}">${b.icon} ${Safe.html(b.name)}</option>`).join('');
  if (books.length > 0) {
    if (prevBookId && books.some(b => b.id === prevBookId)) state.currentBookId = prevBookId;
    else state.currentBookId = books.find(b => b.is_default)?.id || books[0].id;
    select.value = state.currentBookId;
  }
}

function initBookSelect() {
  $('#bookSelect').addEventListener('change', () => {
    state.currentBookId = parseInt($('#bookSelect').value);
    refreshData();
  });
}

function initBookModal() {
  const icons = ['📒', '📕', '📗', '📘', '📙', '📓', '📔', '💼', '🏠', '👨‍👩‍👧‍👦', '🎓', '✈️', '🎯', '💰', '🏦', '🏪'];
  const iconGrid = $('#iconGrid');
  iconGrid.innerHTML = icons.map(icon => `<div class="icon-item ${icon === '📒' ? 'selected' : ''}" data-icon="${icon}">${icon}</div>`).join('');
  iconGrid.querySelectorAll('.icon-item').forEach(item => {
    item.addEventListener('click', () => {
      iconGrid.querySelectorAll('.icon-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      state.selectedBookIcon = item.dataset.icon;
    });
  });

  $('#addBookBtn').addEventListener('click', () => {
    $('#bookModal').style.display = 'flex'; $('#bookName').value = ''; state.selectedBookIcon = '📒';
    iconGrid.querySelectorAll('.icon-item').forEach(i => i.classList.toggle('selected', i.dataset.icon === '📒'));
  });
  $('#cancelBook').addEventListener('click', () => { $('#bookModal').style.display = 'none'; });
  $('#confirmBook').addEventListener('click', async () => {
    const name = $('#bookName').value.trim();
    if (!name) { alert('请输入账本名称'); return; }
    const result = await window.api.createBook({ userId: state.userId, name, icon: state.selectedBookIcon });
    if (result.success) {
      $('#bookModal').style.display = 'none';
      await loadBooks(); $('#bookSelect').value = result.id; state.currentBookId = result.id;
      await refreshData();
    }
  });
}

// ===== 成员管理 =====
function initMemberModal() {
  $('#memberBtn').addEventListener('click', async () => {
    if (!state.currentBookId) return;
    await loadMembers();
    $('#memberModal').style.display = 'flex';
  });
  $('#cancelMember').addEventListener('click', () => { $('#memberModal').style.display = 'none'; });
  $('#inviteBtn').addEventListener('click', async () => {
    const username = $('#inviteUsername').value.trim();
    if (!username) { alert('请输入用户名'); return; }
    const role = $('#inviteRole').value;
    const result = await window.api.inviteMember({ bookId: state.currentBookId, username, role });
    if (result.success) { $('#inviteUsername').value = ''; await loadMembers(); }
    else { alert(result.error); }
  });
}

async function loadMembers() {
  const members = await window.api.getBookMembers(state.currentBookId);
  const list = $('#memberList');
  list.innerHTML = members.map(m => `
    <div class="member-item">
      <div class="member-info">
        <div class="member-avatar">${Safe.html(m.username).charAt(0).toUpperCase()}</div>
        <span class="member-name">${Safe.html(m.username)}</span>
        <span class="member-role ${Safe.attr(m.role)}">${m.role === 'owner' ? '创建者' : m.role === 'member' ? '成员' : '查看者'}</span>
      </div>
      ${m.role !== 'owner' ? `<button class="btn-remove-member" data-id="${Safe.attr(m.id)}" title="移除">×</button>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.btn-remove-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('确定移除该成员？')) {
        await window.api.removeMember(parseInt(btn.dataset.id));
        await loadMembers();
      }
    });
  });
}

// ===== 图片操作（含OCR自动填充）=====
function initImageModal() {
  $('#closeImageModal').addEventListener('click', () => { $('#imageModal').style.display = 'none'; });
  $('#imageModal').addEventListener('click', (e) => { if (e.target === $('#imageModal')) $('#imageModal').style.display = 'none'; });
  $('#selectImageBtn').addEventListener('click', async () => {
    try {
      const result = await window.api.selectImage();
      if (result.success) { state.imageData = result.data; state.imageFileName = result.fileName; showImagePreview(result.data); }
    } catch (err) {
      console.error('选择图片失败:', err);
    }
  });
  $('#removeImage').addEventListener('click', () => { clearImage(); });

  // OCR识别：自动将结果填充到表单，用户可手动修改
  $('#ocrBtn').addEventListener('click', async () => {
    if (!state.imageData) { alert('请先选择图片'); return; }
    $('#ocrBtn').textContent = '识别中...'; $('#ocrBtn').disabled = true;
    const result = await window.api.ocrRecognize(state.imageData);
    $('#ocrBtn').textContent = 'OCR 自动识别'; $('#ocrBtn').disabled = false;
    if (result.success) {
      state.ocrData = result;

      // 自动填充：金额 → 日期 → 备注
      let filledCount = 0;
      const items = [];

      if (result.amount) {
        // 如果当前金额为空才自动填充
        if (!$('#amount').value || parseFloat($('#amount').value) <= 0) {
          $('#amount').value = result.amount;
        }
        items.push(`<div>金额：<strong>${Safe.html(result.amount)}</strong> ${$('#amount').value ? '(已填入)' : ''}</div>`);
        filledCount++;
      }

      if (result.date) {
        // 如果当前日期为空才自动填充
        if (!$('#date').value) {
          $('#date').value = result.date;
        }
        items.push(`<div>日期：<strong>${Safe.html(result.date)}</strong> ${$('#date').value ? '(已填入)' : ''}</div>`);
        filledCount++;
      }

      // OCR原文作为备注参考
      if (result.text && result.text.trim()) {
        // 如果备注为空，取前30个字符作为默认备注
        const ocrNote = result.text.trim().replace(/\s+/g, ' ').substring(0, 50);
        if (!$('#note').value) {
          $('#note').value = ocrNote;
        }
        items.push(`<div style="color:#999;font-size:12px;margin-top:4px">原文：${Safe.html(result.text.substring(0, 100))}${result.text.length > 100 ? '...' : ''}</div>`);
      }

      if (items.length > 0) {
        $('#ocrItems').innerHTML = items.join('');
        $('#ocrResult').style.display = 'block';
      }
    } else { alert('识别失败：' + result.error); }
  });
}

function showImagePreview(dataUrl) { $('#previewImg').src = dataUrl; $('#imagePreview').style.display = 'inline-block'; $('#imageButtons').style.display = 'none'; }
function clearImage() { state.imageData = null; state.imageFileName = null; state.ocrData = null; $('#previewImg').src = ''; $('#imagePreview').style.display = 'none'; $('#imageButtons').style.display = 'flex'; $('#ocrResult').style.display = 'none'; }

// ===== 分类 =====
async function loadCategories() {
  state.categories.expense = await window.api.getCategories('expense');
  state.categories.income = await window.api.getCategories('income');
}

function renderCategories() {
  const categories = state.categories[state.currentType];
  const grid = $('#categoryGrid');
  grid.innerHTML = categories.map(cat => `
    <div class="category-item ${state.selectedCategory === cat.name ? 'selected' : ''}" data-category="${cat.name}">
      <span class="category-icon">${cat.icon}</span>
      <span class="category-name">${cat.name}</span>
    </div>
  `).join('');
  grid.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      state.selectedCategory = item.dataset.category;
      grid.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
}

function setDefaultDate() { $('#date').value = new Date().toISOString().slice(0, 10); }

// ===== 数据刷新 =====
async function refreshData() {
  if (!state.currentBookId) return;
  await loadStats();
  await loadRecords();
}

// 统计
async function loadStats() {
  const filters = { bookId: state.currentBookId };
  if (state.periodMode === 'month') {
    filters.dateRange = 'month';
    filters.yearMonth = getYearMonth();
  } else if (state.periodMode === 'year') {
    filters.dateRange = 'year';
    filters.year = `${state.currentYear}`;
  } else {
    filters.dateRange = 'all';
  }

  const stats = await window.api.getStats(filters);
  // 收入显示+号，支出显示-号
  const incomeNum = Number(stats.totalIncome);
  const expenseNum = Number(stats.totalExpense);
  const balanceNum = incomeNum - expenseNum;

  $('#totalIncome').textContent = '+' + incomeNum.toFixed(2);
  $('#totalExpense').textContent = '-' + expenseNum.toFixed(2);
  $('#totalBalance').textContent = (balanceNum >= 0 ? '+' : '') + balanceNum.toFixed(2);

  // 结余颜色根据正负变化
  const balanceEl = $('#totalBalance');
  if (balanceNum > 0) balanceEl.style.color = '#a8f0c6';
  else if (balanceNum < 0) balanceEl.style.color = '#ffb3b3';
  else balanceEl.style.color = '#fff';

  state.stats = stats;

  const statsSection = $('#statsSection');
  if (stats.expenseByCategory.length > 0 || stats.incomeByCategory.length > 0 || (stats.dailyStats && stats.dailyStats.length > 0)) {
    statsSection.style.display = 'block';
    renderStats();
  } else {
    statsSection.style.display = 'none';
  }
}

function renderStats() {
  if (!state.stats) return;
  const chart = $('#statsChart');

  if (state.statsType === 'trend') {
    renderTrendChart(chart);
    return;
  }

  const data = state.statsType === 'expense' ? state.stats.expenseByCategory : state.stats.incomeByCategory;
  if (data.length === 0) { chart.innerHTML = '<div class="empty-state">暂无数据</div>'; return; }
  const maxAmount = Math.max(...data.map(d => d.total));
  chart.innerHTML = data.map(item => {
    const percent = maxAmount > 0 ? (item.total / maxAmount * 100) : 0;
    const catInfo = getCategoryInfo(item.category, state.statsType);
    return `
      <div class="stat-bar-item">
        <span class="stat-bar-label">${catInfo.icon} ${item.category}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill ${state.statsType}" style="width: ${percent}%"></div></div>
        <span class="stat-bar-amount">${Number(item.total).toFixed(2)}</span>
      </div>`;
  }).join('');
}

// 收支趋势图
function renderTrendChart(chart) {
  const data = state.stats.dailyStats || [];
  if (data.length === 0) { chart.innerHTML = '<div class="empty-state">暂无数据</div>'; return; }
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);

  chart.innerHTML = `
    <div class="trend-legend">
      <span class="legend-income">收入</span>
      <span class="legend-expense">支出</span>
    </div>
    <div class="trend-chart">
      ${data.map(d => {
        const incomeW = (d.income / maxVal * 100);
        const expenseW = (d.expense / maxVal * 100);
        const label = state.periodMode === 'year' ? d.date.substring(5) : d.date.substring(5);
        return `
          <div class="trend-row">
            <span class="trend-label">${label}</span>
            <div class="trend-bars">
              <div class="trend-bar-income" style="width: ${incomeW}%"></div>
              <div class="trend-bar-expense" style="width: ${expenseW}%"></div>
            </div>
            <div class="trend-amounts">
              <span class="trend-income">+${Number(d.income).toFixed(0)}</span>
              <span class="trend-expense">-${Number(d.expense).toFixed(0)}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function getCategoryInfo(name, type) {
  const cats = state.categories[type] || [];
  return cats.find(c => c.name === name) || { icon: '📌', name };
}

// ===== 记录列表 =====
async function loadRecords() {
  const filters = { bookId: state.currentBookId };
  const ym = getYearMonth();
  if (state.periodMode === 'month' && ym) filters.yearMonth = ym;
  else if (state.periodMode === 'year') filters.year = `${state.currentYear}`;
  if (state.currentFilter !== 'all') filters.type = state.currentFilter;
  const records = await window.api.getRecords(filters);
  await renderRecords(records);
}

async function renderRecords(records) {
  const list = $('#recordsList');
  if (records.length === 0) { list.innerHTML = '<div class="empty-state">暂无记录，快去记一笔吧</div>'; return; }

  // 按日期分组
  const grouped = {};
  records.forEach(r => { if (!grouped[r.date]) grouped[r.date] = []; grouped[r.date].push(r); });

  let html = '';
  for (const date of Object.keys(grouped).sort().reverse()) {
    const dayIncome = grouped[date].filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const dayExpense = grouped[date].filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    html += `<div class="date-group-title">${formatDate(date)} &nbsp; <span style="color:#51cf66">+${dayIncome.toFixed(0)}</span> <span style="color:#ff6b6b">-${dayExpense.toFixed(0)}</span></div>`;

    for (const record of grouped[date]) {
      const catInfo = getCategoryInfo(record.category, record.type);
      let imageHtml = '';
      if (record.image_path) imageHtml = `<img class="record-image-thumb" data-path="${Safe.attr(record.image_path)}" src="" alt="图">`;
      html += `
        <div class="record-item" data-id="${Safe.attr(record.id)}">
          <div class="record-icon">${catInfo.icon}</div>
          <div class="record-info">
            <div class="record-category">${Safe.html(record.category)}</div>
            <div class="record-note">${Safe.html(record.note || '')}</div>
            ${record.username ? `<div class="record-user">by ${Safe.html(record.username)}</div>` : ''}
          </div>
          <div class="record-right">
            <span class="record-amount ${Safe.attr(record.type)}">${record.type === 'income' ? '+' : '-'}${Number(record.amount).toFixed(2)}</span>
          </div>
          ${imageHtml}
          <div class="record-actions">
            <button class="record-edit" data-id="${Safe.attr(record.id)}" title="编辑">&#9998;</button>
            <button class="record-delete" data-id="${Safe.attr(record.id)}" title="删除">×</button>
          </div>
        </div>`;
    }
  }

  list.innerHTML = html;

  // 异步加载缩略图
  for (const img of list.querySelectorAll('.record-image-thumb')) {
    const p = img.dataset.path;
    const result = await window.api.readImage(p);
    if (result.success) {
      img.src = result.data;
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        $('#modalImage').src = result.data; $('#imageModal').style.display = 'flex';
      });
    }
  }

  // 编辑事件
  list.querySelectorAll('.record-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const recordId = parseInt(btn.dataset.id);
      // 从当前渲染的records中找到对应记录
      const records = await window.api.getRecords({ bookId: state.currentBookId });
      const record = records.find(r => r.id === recordId);
      if (record) openEditModal(record);
    });
  });

  // 点击整行也可以编辑
  list.querySelectorAll('.record-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      // 如果点击的是删除或编辑按钮或图片，不触发
      if (e.target.closest('.record-delete') || e.target.closest('.record-edit') || e.target.closest('.record-image-thumb')) return;
      const recordId = parseInt(item.dataset.id);
      const records = await window.api.getRecords({ bookId: state.currentBookId });
      const record = records.find(r => r.id === recordId);
      if (record) openEditModal(record);
    });
  });

  // 删除事件
  list.querySelectorAll('.record-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('确定删除这条记录吗？')) {
        await window.api.deleteRecord(parseInt(btn.dataset.id));
        await refreshData();
      }
    });
  });
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(dateStr);
  return `${parseInt(m)}月${parseInt(d)}日 周${weekDays[date.getDay()]}`;
}

// ===== Tab3: 账号总览页 =====
async function loadProfileData() {
  // 用户信息
  $('#profileAvatar').textContent = state.username ? state.username.charAt(0).toUpperCase() : 'A';
  $('#profileName').textContent = state.username || '用户';
  $('#profileRole').textContent = '普通用户';

  // 账本列表
  const books = await window.api.getBooks(state.userId);
  const booksGrid = $('#myBooksList');
  if (books.length === 0) {
    booksGrid.innerHTML = '<div class="empty-state">暂无账本</div>';
  } else {
    booksGrid.innerHTML = books.map(book => {
      const roleText = book.role === 'owner' ? '创建者' : book.role === 'member' ? '成员' : '查看者';
      return `
        <div class="book-card" data-book-id="${Safe.attr(book.id)}">
          <div class="book-card-icon">${book.icon}</div>
          <div class="book-card-name">${Safe.html(book.name)}</div>
          <div class="book-card-role">${Safe.html(roleText)}</div>
        </div>`;
    }).join('');

    // 点击账本卡片跳转到账本页并选中该账本
    booksGrid.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', () => {
        state.currentBookId = parseInt(card.dataset.bookId);
        $('#bookSelect').value = state.currentBookId;
        switchTab('tabBook');
      });
    });
  }

  // 统计概览（所有账本汇总）
  let totalRecords = 0;
  let totalIncomeAll = 0;
  let totalExpenseAll = 0;

  for (const book of books) {
    const stats = await window.api.getStats({ bookId: book.id, dateRange: 'all' });
    totalIncomeAll += stats.totalIncome || 0;
    totalExpenseAll += stats.totalExpense || 0;
    const records = await window.api.getRecords({ bookId: book.id });
    totalRecords += records.length;
  }

  $('#ovTotalBooks').textContent = books.length;
  $('#ovTotalRecords').textContent = totalRecords;
  $('#ovTotalIncome').textContent = '+' + totalIncomeAll.toFixed(2);
  $('#ovTotalExpense').textContent = '-' + totalExpenseAll.toFixed(2);
}
