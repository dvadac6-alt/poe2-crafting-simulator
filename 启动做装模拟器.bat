@echo off
rem ── 流放之路2 做装模拟器 启动器 ──
rem 以独立应用窗口（无浏览器地址栏）打开模拟器，本地运行、无需联网
setlocal
cd /d "%~dp0"

rem 生成正确百分号编码的 file:// URL（路径含空格也能用）
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Uri]::new((Resolve-Path 'app\index.html').Path).AbsoluteUri"`) do set "URL=%%i"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="%URL%" --window-size=1520,960
) else (
  where chrome >nul 2>nul
  if %errorlevel%==0 (
    start "" chrome --app="%URL%" --window-size=1520,960
  ) else (
    start "" "app\index.html"
  )
)
endlocal
