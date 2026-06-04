@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ========================================
echo        记账本 启动中...
echo ========================================
echo.

:: 检查 Electron 可执行文件
if not exist ".\node_modules\electron\dist\electron.exe" (
    echo [错误] 找不到 Electron！
    echo 请确认 node_modules\electron\dist\electron.exe 存在
    pause
    exit /b 1
)

:: 直接启动 Electron（不通过 Node.js 中转）
echo 正在启动记账本，请稍候...
".\node_modules\electron\dist\electron.exe" "."

if errorlevel 1 (
    echo.
    echo [错误] 启动失败，错误代码: %errorlevel%
    pause
)
