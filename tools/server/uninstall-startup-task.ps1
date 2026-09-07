# Go dang ky tu khoi dong QA Copilot server (nguoc lai install-startup-task.ps1). Can quyen
# Administrator - chuot phai vao uninstall-startup-task.bat -> "Run as administrator".

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Can chay voi quyen Administrator." -ForegroundColor Red
    Write-Host "Chuot phai vao uninstall-startup-task.bat, chon 'Run as administrator', roi chay lai." -ForegroundColor Yellow
    exit 1
}

$taskName = "QACopilotServer"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "Khong co task '$taskName' nao dang dang ky - khong can lam gi." -ForegroundColor Yellow
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Da go dang ky tu khoi dong. Server se KHONG con tu chay khi may khoi dong nua." -ForegroundColor Green
Write-Host "Server dang chay (neu co) van tiep tuc chay binh thuong - chi anh huong lan khoi dong may tiep theo."
