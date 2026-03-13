@echo off
setlocal EnableDelayedExpansion

if "%~1"=="" (
  echo Usage: run-win-common.cmd ^<local^|prod^>
  exit /b 1
)

set "MODE=%~1"
set "START_CMD="
if /I "%MODE%"=="local" set "START_CMD=npm run start:win"
if /I "%MODE%"=="prod" set "START_CMD=npm run start:prod:win"

if "%START_CMD%"=="" (
  echo Mode tidak valid: %MODE%
  echo Gunakan: local atau prod
  exit /b 1
)

cd /d "%~dp0\.."

echo [1/5] Cek Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan. Mencoba install Node.js LTS dengan winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo winget tidak tersedia. Install manual Node.js LTS dari https://nodejs.org
    exit /b 1
  )

  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Gagal install Node.js otomatis.
    exit /b 1
  )

  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js sudah di-install, tapi belum terbaca PATH.
    echo Tutup terminal ini, buka terminal baru, lalu jalankan lagi.
    exit /b 1
  )
)

echo [2/5] Cek npm...
where npm >nul 2>nul
if errorlevel 1 (
  echo npm tidak ditemukan. Install ulang Node.js LTS lalu coba lagi.
  exit /b 1
)

echo [3/5] Cek dependency...
if not exist node_modules (
  echo node_modules belum ada. Menjalankan npm install...
  call npm install
  if errorlevel 1 goto :repair_install
)

echo [4/5] Cek modul Electron Forge...
if not exist node_modules\@electron-forge\plugin-webpack (
  echo Plugin webpack tidak ditemukan. Menjalankan npm install...
  call npm install
  if errorlevel 1 goto :repair_install
)

echo [5/5] Menjalankan aplikasi mode %MODE%...
call %START_CMD%
if errorlevel 1 goto :repair_start
goto :success

:repair_install
echo.
echo npm install gagal. Menjalankan self-heal dependency...
call npm cache verify
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm install
if errorlevel 1 (
  echo Self-heal dependency gagal.
  exit /b 1
)
goto :retry_start

:repair_start
echo.
echo Start gagal. Menjalankan self-heal ringan lalu retry sekali...
call npm install
if errorlevel 1 goto :repair_install

:retry_start
call %START_CMD%
if errorlevel 1 (
  echo Aplikasi masih gagal berjalan setelah retry.
  echo Cek error detail di output terminal di atas.
  exit /b 1
)
goto :success

:success
echo Aplikasi berjalan dalam mode %MODE%.
exit /b 0
