@echo off
chcp 65001 > nul
echo ================================
echo 🎵 音乐下载器启动中...
echo ================================
echo.

:: 检查可执行文件是否存在
if exist "music-downloader.exe" (
    echo 🚀 启动音乐下载器...
    echo 📱 请在浏览器中访问: http://localhost:3000
    echo.
    echo 💡 提示: 关闭此窗口将停止服务
    echo.
    music-downloader.exe
) else (
    echo ❌ 错误: 找不到 music-downloader.exe
    echo 💡 请确保在正确的目录中运行此脚本
    echo.
    pause
)
