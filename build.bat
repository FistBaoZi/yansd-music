@echo off
chcp 65001 > nul
echo ================================
echo 🔨 开始构建音乐下载器...
echo ================================
echo.

:: 创建或清理 dist 目录
if exist "dist" (
    echo 🧹 清理旧的构建文件...
    rmdir /s /q "dist"
)
mkdir "dist"
echo 📁 已创建 dist 目录


:: 复制静态文件
echo.
echo 📂 正在复制静态文件...
if exist "public" (
    echo 📋 复制 public 目录...
    xcopy "public" "dist\public" /e /i /h /y
)


:: 复制配置文件
echo.
echo ⚙️  复制配置文件...
if exist "server.js" copy "server.js" "dist\" > nul
if exist "app.js" copy "app.js" "dist\" > nul


:: 执行程序打包
echo.
echo 🔧 正在打包程序...
npm run build-win
if errorlevel 1 (
    echo ❌ 程序打包失败！
    echo 💡 请检查 package.json 中的 build-win 脚本配置
    pause
    exit /b 1
)
echo ✅ 程序打包成功！



pause
