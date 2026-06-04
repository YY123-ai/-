@echo off
chcp 65001 >nul 2>&1
title 记账本 - 公网版服务器
cd /d "%~dp0"

echo ========================================
echo   记账本公网版服务器启动中...
echo ========================================
echo.

:: 设置 PATH
set PATH=%~dp0node-runtime\node-v20.11.0-win-x64;%PATH%

:: 查找 cpolar
set CPOLAR=""
where cpolar >nul 2>&1
if %errorlevel% equ 0 (
    set CPOLAR=cpolar
) else if exist "C:\Program Files\cpolar\cpolar.exe" (
    set CPOLAR="C:\Program Files\cpolar\cpolar.exe"
) else if exist "%~dp0cpolar\cpolar.exe" (
    set CPOLAR="%~dp0cpolar\cpolar.exe"
) else (
    echo.
    echo [错误] 未找到 cpolar，请先安装：
    echo   访问 https://www.cpolar.com/ 下载安装
    echo.
    echo 安装后运行: cpolar authtoken 你的token
    echo.
    pause
    exit /b 1
)

:: 启动本地服务器
echo [1/2] 启动本地服务器...
cd /d "%~dp0server"
start /b node index.js

:: 等待服务器就绪
timeout /t 3 >nul

:: 启动内网穿透
echo [2/2] 启动公网隧道...
echo.
echo ========================================
echo   服务器已启动！
echo.
echo   本地访问: http://localhost:3000
echo   手机App:  http://本机IP:3000/app/
echo.
echo   公网隧道正在创建，请查看下方输出的公网地址
echo   公网App:  https://你的公网地址/app/
echo.
echo   iOS:  Safari打开 → 分享 → 添加到主屏幕
echo   Android: 浏览器打开 → 添加到主屏幕
echo ========================================
echo.

cd /d "%~dp0"
%CPOLAR% http 3000

if errorlevel 1 (
    echo.
    echo [错误] cpolar 启动失败，请检查：
    echo   1. 是否已运行 cpolar authtoken 设置认证
    echo   2. 网络连接是否正常
    pause
)
