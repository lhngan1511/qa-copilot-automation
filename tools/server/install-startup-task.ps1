# QA Copilot - dang ky Scheduled Task de server TU CHAY ngay khi may khoi dong, KE CA CHUA AI DANG
# NHAP (Ngan yeu cau 2026-09-07). Chay task duoi tai khoan SYSTEM (khong can luu mat khau) - CAN
# QUYEN ADMINISTRATOR de dang ky (chi luc dang ky, sau do khong can dang nhap nua).
#
# Chay script nay bang cach: chuot phai vao install-startup-task.bat -> "Run as administrator".

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Can chay voi quyen Administrator." -ForegroundColor Red
    Write-Host "Chuot phai vao install-startup-task.bat, chon 'Run as administrator', roi chay lai." -ForegroundColor Yellow
    exit 1
}

$taskName = "QACopilotServer"
$scriptPath = Join-Path $PSScriptRoot "start-server.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Host "KHONG tim thay start-server.ps1 cung thu muc voi script nay." -ForegroundColor Red
    exit 1
}

Write-Host "=== QA Copilot - Dang ky tu khoi dong cung Windows ===" -ForegroundColor Cyan

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Da co task cu, dang go de dang ky lai..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
# SYSTEM = tai khoan he thong co san, KHONG can luu mat khau, chay duoc ngay ca khi chua ai dang
# nhap desktop.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
        -Description "QA Copilot server - tu dong chay khi may khoi dong, khong can dang nhap." | Out-Null
    Write-Host "Da dang ky xong." -ForegroundColor Green
} catch {
    Write-Host "Dang ky that bai: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Dang khoi dong thu ngay bay gio de kiem tra..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
$info = Get-ScheduledTaskInfo -TaskName $taskName
Write-Host "Trang thai task: LastTaskResult=$($info.LastTaskResult) (0 = dang chay/thanh cong)" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Hoan tat ===" -ForegroundColor Green
Write-Host "Mo trinh duyet vao http://localhost:3000 sau vai giay de xac nhan server da chay."
Write-Host "Xem log tai: $(Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'logs\server-startup.log')"
Write-Host "Tu lan khoi dong may sau, server se tu chay - khong can mo tay npm start nua."
