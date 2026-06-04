// 使用内存存储（演示用）
let users = [];
let userIdCounter = 1;

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(200).json({ success: false, error: '缺少用户名或密码' });
  }
  if (users.find(u => u.username === username)) {
    return res.status(200).json({ success: false, error: '用户名已存在' });
  }
  const user = { id: userIdCounter++, username, password };
  users.push(user);
  res.status(200).json({ success: true, userId: user.id });
}