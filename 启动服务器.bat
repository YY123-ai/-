@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0server"

echo ========================================
echo   记账本共享服务器启动中...
echo ========================================
echo.
echo   手机App访问: http://本机IP:3000/app/
echo   下载页面:   http://本机IP:3000/download
echo   桌面端:     双击 启动记账本.bat
echo.
echo   iOS安装: Safari打开上述地址 → 分享 → 添加到主屏幕
echo   Android: 浏览器打开上述地址 → 添加到主屏幕
echo ========================================
echo.

:: 设置 PATH 包含便携版 Node
set PATH=%~dp0node-runtime\node-v20.11.0-win-x64;%PATH%

:: 启动服务器
node index.js

if errorlevel 1 (
    echo.
    echo [错误] 服务器启动失败
    pause
)
