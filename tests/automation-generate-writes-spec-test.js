import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";

/*
 P2 — Generate phải chạy được (sinh file .spec.js) khi có mapping.
 KHÔNG lọc generate theo isReady (test-data ready); generate chỉ cần mapping.
*/

const codegenText = `const { test } = require('@playwright/test');
test('login', async ({ page }) => { await page.goto('https://example.com/login'); await page.getByRole('button', { name: 'Đăng nhập' }).click(); });`;

const mapping = {
  testCaseId: "TC001",
  entryRoute: { type:"URL_PATH", value:"/login", sourceReference:null, status:"DRAFT" },
  authenticationSetup: { steps:[], status:"DRAFT" },
  navigationChain: { steps:[], status:"DRAFT" },
  route: { source:"PLAYWRIGHT_CODEGEN", value:"/login", status:"MAPPED" },
  stepMappings: [{ stepOrder:1, businessStep:"Bấm Đăng nhập", actionType:"CLICK", locator:"page.getByRole('button', { name: 'Đăng nhập' })", codegenSource:"PLAYWRIGHT_CODEGEN", confidence:0.9, status:"MAPPED" }],
  assertionMappings: [{ businessExpectation:"Đăng nhập thành công", playwrightAssertion:"await expect(page.getByText('Chào mừng')).toBeVisible()", confidence:0.9, status:"MAPPED" }],
  missingData:[], warnings:[]
};

const fakeProvider = { async generate(){ return `import { test, expect } from '@playwright/test';
test('TC001 - Đăng nhập', async ({ page }) => { await page.goto(process.env.BASE_URL + '/login'); await page.getByRole('button', { name: 'Đăng nhập' }).click(); await expect(page.getByText('Chào mừng')).toBeVisible(); });`; } };

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(),"gen-"));
const svc = new AutomationWorkspaceService({ rootDir: tempRoot, aiProvider: fakeProvider });

// Testcase DATA_REQUIRED vẫn generate được (mapping là đủ).
const result = await svc.generate({ testCase:{id:"TC001",module:"Đăng nhập",executionReadiness:"DATA_REQUIRED"}, mapping, codegenText, confirmedFacts:[] });
assert.equal(result.validation?.ok, true, "validation phải ok");
assert.ok(result.filePath, "phải có filePath");
assert.ok(fs.existsSync(result.filePath), "file .spec.js phải tồn tại");
assert.match(path.basename(result.filePath), /\.spec\.js$/);
const content = fs.readFileSync(result.filePath,"utf8");
assert.ok(content.length > 0, "file không rỗng");
assert.match(content, /TC001/, "code chứa mã testcase");

// Generate thiếu mapping -> lỗi rõ (không im lặng)
let err = null;
try { await svc.generate({ testCase:{id:"TC001"}, mapping:null, codegenText, confirmedFacts:[] }); } catch (e) { err = e; }
assert.ok(err, "thiếu mapping phải báo lỗi");
assert.match(err.message, /Thiếu mapping/);

fs.rmSync(tempRoot,{recursive:true,force:true});
console.log("Automation Generate writes spec.js test: PASS");

/* ---------- Generate gate: không lọc theo isReady; cần mapping ---------- */
function generateItems(testCases, ids) {
    return testCases.filter(item => ids.includes(item.id) && item.includedInSession && item.mapping && Object.keys(item.mapping).length > 0);
}
const list = [
    { id:"TC001", includedInSession:true, executionReadiness:"DATA_REQUIRED", mapping:{ testCaseId:"TC001" } },
    { id:"TC002", includedInSession:true, executionReadiness:"READY", mapping:null }
];
const gen = generateItems(list, ["TC001","TC002"]);
assert.deepEqual(gen.map(i=>i.id), ["TC001"], "DATA_REQUIRED vẫn generate nếu có mapping; TC002 không mapping bị loại");
