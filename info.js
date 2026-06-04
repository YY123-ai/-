export default function handler(req, res) {
  res.status(200).json({
    name: '记账本共享服务器',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    vercel: true
  });
}