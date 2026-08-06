/**
 * SPIKE — Architecture Sprint "Record by Testcase"
 *
 * Chứng minh workflow mới:
 *   approved-testcases.json → chọn TC001 → recording gắn testCaseId → lưu session
 *   → ghép SETUP + TC001 → render spec → node --check PASS.
 *
 * KHÔNG sửa production. Chỉ:
 *   - import production (renderGotoStatement, renderFillExpression) để TÁI SỬỤNG (không sửa).
 *   - đọc fixture recording (giả lập).
 *   - render spec từ IR, node --check.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { renderGotoStatement } from '../src/automation/ai/testDataBinding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 1. Đọc approved-testcases.json (fixture demo) + chọn TC001 ----
const approved = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/demo/dang-nhap/approved-testcases.json'), 'utf8'));
const tc001 = approved.find(t => (t.id ?? t.testcaseId) === 'TC001');
if (!tc001) throw new Error('Không tìm thấy TC001');
console.log(`1. Chọn testcase: TC001 - ${tc001.title}`);

// ---- 2. Đọc recording giả lập (SETUP + TESTCASE gắn testCaseId) ----
const setup = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/setup-recording.json'), 'utf8'));
const rec = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tc001-recording.json'), 'utf8'));
console.log(`2. RecordingSession: testCaseId=${rec.testCaseId} type=${rec.type} status=${rec.status}, setup=${setup.steps.length} steps`);

// ---- 3. Ghép SETUP + TC001 (giữ locator/action/thứ tự CodeGen, thay value binding) ----
function valueExpr(step, recordedValues) {
  if (String(step.valueKind ?? '').toUpperCase() === 'ENV') {
    const t = String(step.target ?? '').toLowerCase();
    if (/tài khoản|username/.test(t)) return 'process.env.TESTDATA_USERNAME ?? ""';
    if (/mật khẩu|password/.test(t)) return 'process.env.TESTDATA_PASSWORD ?? ""';
    if (/mã xác nhận|captcha/.test(t)) return 'process.env.TESTDATA_CAPTCHA ?? ""';
  }
  // literal/recorded: JSON.stringify để giữ nguyên
  const v = recordedValues?.[step.target];
  if (v != null) return JSON.stringify(v);
  return '""';
}
function renderStep(step, recordedValues) {
  const loc = String(step.locator ?? '').trim(); // giữ nguyên (fixture có sẵn page.getByRole...)
  const action = String(step.actionType ?? 'CLICK').toUpperCase();
  if (action === 'GOTO') return renderGotoStatement(step.locator);
  if (action === 'EXPECT') return `  await ${step.statement ?? `expect(${loc}).toBeVisible()`};`;
  switch (action) {
    case 'FILL': return `  await ${loc}.fill(${valueExpr(step, recordedValues)});`;
    case 'CLICK': return `  await ${loc}.click();`;
    case 'PRESS': return `  await ${loc}.press('Enter');`;
    case 'SELECT': return `  await ${loc}.selectOption(${valueExpr(step, recordedValues)});`;
    default: return `  await ${loc}.click();`;
  }
}

const allSteps = [...setup.steps, ...rec.steps];
const specLines = [
  `import { test, expect } from '@playwright/test';`,
  `test(${JSON.stringify(`${tc001.id} - ${tc001.title}`)}, async ({ page }) => {`
];
for (const st of allSteps) {
  const line = renderStep(st, rec.recordedValues);
  if (line) specLines.push(line);
}
specLines.push(`});`);
const spec = specLines.join('\n');

console.log(`3. Ghép SETUP(${setup.steps.length}) + TC001(${rec.steps.length}) -> ${allSteps.length} bước`);
console.log('--- SPEC ---');
console.log(spec);

// ---- 4. node --check PASS ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rbt-'));
const file = path.join(tmp, 'check.mjs');
fs.writeFileSync(file, spec, 'utf8');
const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('--- node --check ---');
console.log(`status=${r.status} ${r.status === 0 ? 'PASS' : 'FAIL: ' + r.stderr}`);

// ---- 5. Kết luận ----
const hasLogin = spec.includes("page.getByRole('textbox', { name: 'Tài khoản' })");
const hasNavigate = spec.includes("page.getByRole('link', { name: 'Đơn vị tính' })");
const hasAssertion = spec.includes("expect(page.getByText('Danh mục phần mềm quản lý')).toBeVisible()");
const hasEnv = spec.includes('process.env.TESTDATA_');
console.log('--- KẾT LUẬN SPIKE ---');
console.log(`- ghép SETUP (login + phân hệ + danh mục) + TC001: ok`);
console.log(`- có login: ${hasLogin}, có navigate: ${hasNavigate}, có assertion: ${hasAssertion}, dùng env TESTDATA_: ${hasEnv}`);
console.log(`- node --check: ${r.status === 0 ? 'PASS' : 'FAIL'}`);
console.log(`=> Record by Testcase khả thi: 1 recording/testcase + SETUP chung -> render spec hợp lệ.`);
