module.exports = function(req, res) {
  res.status(200).json([
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
  ]);
}