# QA Copilot Runner Agent - cai dat 1 lan (Ngan yeu cau 2026-09-07): npm install + cai Chromium +
# dang ky chay nen tu dong moi lan dang nhap Windows qua Task Scheduler (khong can quyen admin).
#
# Ghi chu: script nay in tieng Viet KHONG DAU co tinh (khong dung diacritics) vi console Windows
# mac dinh khong dung UTF-8 (codepage 850/1252) - co dau de bi loi font/mojibake. Web UI cua app
# van dung tieng Viet co dau day du nhu binh thuong, day la ngoai le rieng cho console/terminal.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "=== QA Copilot Runner Agent - Cai dat ===" -ForegroundColor Cyan

# 1. Kiem tra Node.js da co tren may chua.
try {
    $nodeVersion = (& node --version) 2>$null
    if (-not $nodeVersion) { throw "empty" }
    Write-Host "Da tim thay Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "KHONG tim thay Node.js tren may nay." -ForegroundColor Red
    Write-Host "Hay cai Node.js (ban LTS) tai https://nodejs.org roi chay lai setup.bat." -ForegroundColor Yellow
    exit 1
}

# 2. Cai dependencies (Playwright test runner rieng cua Runner - khong dung chung repo chinh).
Write-Host ""
Write-Host "Dang cai dependencies (npm install)..." -ForegroundColor Cyan
& npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install that bai. Kiem tra ket noi mang roi chay lai setup.bat." -ForegroundColor Red
    exit 1
}

# 3. Cai trinh duyet Chromium (can cho luong Chay testcase - luon dung Chromium do Playwright quan
#    ly; ghi man hinh CodeGen bang Chrome/Edge co san khong can buoc nay nhung co cung khong hai).
Write-Host ""
Write-Host "Dang cai trinh duyet Chromium cho Playwright (co the mat vai phut)..." -ForegroundColor Cyan
& npx playwright install chromium
if ($LASTEXITCODE -ne 0) {
    Write-Host "Cai Chromium that bai - Chay testcase co the loi. Ghi man hinh CodeGen (Chrome/Edge) van dung binh thuong." -ForegroundColor Yellow
}

# 4. Dang ky tu dong chay khi dang nhap Windows. Uu tien Task Scheduler (chay nen, khong hien cua
#    so); mot so may cong ty/quan ly tap trung CHAN han viec tao Scheduled Task qua Group Policy du
#    khong can quyen admin (loi thuc te da gap: "Access is denied.") - khi do tu dong chuyen sang
#    dat shortcut vao thu muc Startup cua Windows (chi ghi vao thu muc rieng cua user hien tai,
#    khong dung Task Scheduler API nen it bi chan hon).
$taskName = "QACopilotRunnerAgent"
$configPath = Join-Path $PSScriptRoot "runner-agent.config.json"
if (-not (Test-Path $configPath)) {
    Write-Host ""
    Write-Host "KHONG tim thay runner-agent.config.json trong thu muc nay - goi tai ve co the bi thieu file." -ForegroundColor Red
    exit 1
}

$nodePath = (Get-Command node).Source
$autoStartOk = $false

Write-Host ""
Write-Host "Dang dang ky tu dong chay khi dang nhap Windows (Task Scheduler)..." -ForegroundColor Cyan
try {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction -Execute $nodePath -Argument "agent.mjs runner-agent.config.json" -WorkingDirectory $PSScriptRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
        -Description "QA Copilot Runner Agent - tu dong chay Playwright tren may nay" | Out-Null

    Write-Host "Da dang ky xong (Task Scheduler)." -ForegroundColor Green
    Start-ScheduledTask -TaskName $taskName
    $autoStartOk = $true
} catch {
    Write-Host "Khong dang ky duoc Task Scheduler: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Dang thu cach khac (Startup folder)..." -ForegroundColor Cyan

    try {
        $startupFolder = [Environment]::GetFolderPath("Startup")
        $shortcutPath = Join-Path $startupFolder "QACopilotRunnerAgent.lnk"
        $wsh = New-Object -ComObject WScript.Shell
        $shortcut = $wsh.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $nodePath
        $shortcut.Arguments = "agent.mjs runner-agent.config.json"
        $shortcut.WorkingDirectory = $PSScriptRoot
        $shortcut.Description = "QA Copilot Runner Agent"
        $shortcut.Save()

        Write-Host "Da dat shortcut tu chay vao thu muc Startup." -ForegroundColor Green
        Write-Host "Dang khoi dong Runner Agent lan nay..." -ForegroundColor Cyan
        Start-Process -FilePath $nodePath -ArgumentList "agent.mjs runner-agent.config.json" -WorkingDirectory $PSScriptRoot
        $autoStartOk = $true
    } catch {
        Write-Host "Khong dat duoc tu chay: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "May nay co the bi khoa boi chinh sach IT. Hay chay tay moi lan can dung:" -ForegroundColor Yellow
        Write-Host "  node agent.mjs runner-agent.config.json" -ForegroundColor Yellow
        Write-Host "(hoac lien he IT de duoc cap quyen Task Scheduler/Startup)." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Hoan tat ===" -ForegroundColor Green
if ($autoStartOk) {
    Write-Host "Mo QA Copilot -> menu tai khoan de xac nhan may nay hien 'Online' (co the mat vai giay)."
    Write-Host "Tu lan dang nhap Windows sau, Runner se tu dong chay - khong can mo tay nua."
} else {
    Write-Host "Da cai xong dependencies, nhung CHUA tu chay duoc - xem huong dan chay tay o tren."
}
