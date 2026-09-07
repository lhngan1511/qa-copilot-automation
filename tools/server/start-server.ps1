# QA Copilot - script khoi dong server thuc te (Ngan yeu cau 2026-09-07: server tu chay ngay khi
# may khoi dong, ke ca chua ai dang nhap). Duoc goi boi Scheduled Task "QACopilotServer" (xem
# install-startup-task.ps1) - cung co the tu chay tay de test truoc khi dang ky task.
#
# Goi THANG node src/server/startServer.js (KHONG qua `npm start`) - `npm start` co buoc prestart
# chay lai `npm run build:web` MOI LAN khoi dong, khong can thiet cho 1 lan restart binh thuong (ban
# build web-ui da co san tu truoc, chi ton thoi gian khoi dong vo ich).
#
# Ghi chu: in tieng Viet KHONG DAU (giong tools/runner/setup.ps1) vi console/log file khong chac
# chan dung UTF-8.

$ErrorActionPreference = "Stop"

# Repo root suy tu vi tri chinh script nay (tools/server/ -> lui 2 cap).
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location -Path $repoRoot

# File .env THAT nam NGOAI repo (xem docs/tester-runner-setup.md) - sua duong dan nay neu may ban
# dat file .env o cho khac.
$env:QA_COPILOT_ENV_FILE = "G:\qa-copilot-config\.env"
$env:HOST = "0.0.0.0"
# Chay luc may khoi dong, chua chac co ai dang nhap desktop - tat tu mo trinh duyet (that bai vo hai
# nhung khong can thu, xem startServer.js).
$env:OPEN_BROWSER = "false"

# Resolve duong dan node.exe THAT (khong dua vao PATH cua tai khoan chay task - vd SYSTEM co the
# KHONG co Node.js trong PATH neu Node duoc cai qua nvm/per-user, khac PATH he thong).
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "KHONG tim thay node.exe trong PATH cua tai khoan dang chay script nay." -ForegroundColor Red
    exit 1
}

$logDir = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "server-startup.log"

"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Dang khoi dong QA Copilot server ===" | Out-File -FilePath $logFile -Encoding utf8

& $nodeCmd.Source "src\server\startServer.js" *>> $logFile
