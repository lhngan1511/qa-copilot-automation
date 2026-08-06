import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    parseApprovedFile,
    normalizeApprovedTestcases,
    NO_DATA_NOTE
} from "../web-ui/src/utils/automationV3.js";

/*
 Bước 5A — Test UI (thuần logic + static contract).

 Không có browser/Chromium trong sandbox → không chạy E2E thật.
 Phần nào xác minh được bằng logic thuần + đọc source thì assert ở đây;
 phần cần mắt nhìn (responsive, focus) ghi chú rõ mức xác minh.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, "..", "web-ui", "src");

function read(rel) {
    return fs.readFileSync(path.join(uiRoot, rel), "utf8");
}

const SAMPLE = {
    module: "Đăng nhập",
    feature: "Login",
    testCases: [
        {
            id: "TC001", title: "Đăng nhập thành công", type: "POSITIVE",
            reviewStatus: "APPROVED", executionReadiness: "READY", module: "Đăng nhập", feature: "Login"
        },
        {
            id: "TC002", title: "Đổi mật khẩu", type: "POSITIVE",
            reviewStatus: "APPROVED", automationCandidate: false, executionReadiness: "READY"
        },
        {
            id: "TC003", title: "Đăng nhập sai mk", type: "NEGATIVE",
            reviewStatus: "APPROVED", executionReadiness: "DATA_REQUIRED"
        },
        {
            id: "TC004", title: "Chưa duyệt", type: "POSITIVE",
            reviewStatus: "DRAFT"
        }
    ]
};

// ---- 1. Upload JSON hợp lệ → hiển thị approved testcase ----
const parsed = parseApprovedFile(JSON.stringify(SAMPLE));
assert.equal(parsed.approved.length, 3, "3 approved (TC001/002/003)");
assert.deepEqual(parsed.approved.map(t => t.testCaseId), ["TC001", "TC002", "TC003"], "approved ids");

// ---- 2. Testcase chưa approved không hiển thị ----
assert.equal(parsed.skippedNotApproved, 1, "TC004 DRAFT bị bỏ");
assert.ok(!parsed.approved.some(t => t.testCaseId === "TC004"), "không chứa DRAFT");
assert.ok(!parsed.rawApproved.some(t => String(t.reviewStatus ?? t.status ?? "APPROVED").toUpperCase() !== "APPROVED"), "rawApproved chỉ APPROVED");

// ---- 3. automationCandidate=false → disable checkbox (vẫn hiển thị + lý do) ----
const tc002 = parsed.approved.find(t => t.testCaseId === "TC002");
assert.equal(tc002.automationCandidate, false, "TC002 không phải candidate");
assert.ok(tc002.automationDisabledReason, "có lý do ngắn");
assert.ok(parsed.approved.some(t => t.testCaseId === "TC002"), "vẫn hiển thị trong list");

// ---- 4. DATA_REQUIRED vẫn được chọn ----
const tc003 = parsed.approved.find(t => t.testCaseId === "TC003");
assert.equal(tc003.automationCandidate, true, "DATA_REQUIRED vẫn là candidate (chọn được)");
assert.equal(tc003.dataNote, NO_DATA_NOTE, "hiện 'Cần bổ sung dữ liệu trước khi chạy'");
assert.equal(parsed.approved.find(t => t.testCaseId === "TC001").dataNote, "Sẵn sàng", "READY → Sẵn sàng");

// ---- 5. Invalid file không crash, báo rõ ----
assert.throws(() => parseApprovedFile("not-json{"), err => err.code === "INVALID_JSON", "JSON lỗi");
assert.throws(
    () => parseApprovedFile(JSON.stringify({ module: "X", testCases: [] })),
    err => err.code === "EMPTY",
    "không testcase"
);
assert.throws(
    () => parseApprovedFile(JSON.stringify({ testCases: [{ id: "T1", reviewStatus: "DRAFT" }] })),
    err => err.code === "NO_APPROVED",
    "không approved nào"
);

// ---- 6/7. API client gọi đúng endpoint select/unselect + 4 endpoint duy nhất ----
const apiSource = read("api/automationV3Api.js");
assert.ok(apiSource.includes("/automation-v3"), "BASE là automation-v3");
assert.ok(apiSource.includes("/select"), "select endpoint");
assert.ok(apiSource.includes("/unselect"), "unselect endpoint");
assert.ok(apiSource.includes("/workspaces") && apiSource.includes("getWorkspace"), "get workspace");
assert.ok((apiSource.match(/workspaces/g) ?? []).length >= 3, "chỉ các endpoint workspace/select/unselect");
assert.ok(!apiSource.includes("rendererV3") && !apiSource.includes("CodeGenRecordingStore"), "không gọi Store/Renderer");

// Page dùng đúng hàm
const pageSource = read("pages/AutomationV3Page.jsx");
assert.ok(pageSource.includes("selectTestCase") && pageSource.includes("unselectTestCase"), "page gọi select/unselect API");
assert.ok(pageSource.includes("createWorkspace"), "page gọi createWorkspace");

// ---- 8. Card chỉ một trạng thái chính + một hành động chính (checkbox, không nút phụ) ----
const cardSource = read("components/automationV3/V3TestCaseCard.jsx");
assert.equal((cardSource.match(/v3-badge--sel/g) ?? []).length, 1, "1 nhánh badge 'Đã chọn'");
assert.equal((cardSource.match(/v3-badge--nosel/g) ?? []).length, 1, "1 nhánh badge 'Chưa chọn'");
assert.ok(!cardSource.includes("v3-card__action"), "card không có nút primary action riêng");

// Loại bỏ comment JS để tránh false-positive khi check nội dung cấm.
function stripComments(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const cardClean = stripComments(cardSource);
assert.ok(!cardClean.includes("Xem chi tiết"), "không có Xem chi tiết");
assert.ok(!cardClean.includes("Review") && !cardClean.includes("Generate") && !cardClean.includes("Export"), "không Review/Generate/Export");

// ---- 9/10/11. Không Generate/Run, không upload CodeGen, không AI Mapping ----
const allSources = [
    pageSource,
    cardSource,
    read("components/automationV3/V3TestCaseList.jsx"),
    read("components/automationV3/V3UploadPanel.jsx"),
    read("components/automationV3/V3ActionBar.jsx")
].join("\n");
const allClean = stripComments(allSources);

for (const forbidden of [
    /generate/i, /run ?testcase|"RUN"|runStatus/i, /Ghi thao tác và sinh/i,
    /AI Mapping|aiMapping/i, /codeGenFile|CodeGen/i
]) {
    assert.ok(!forbidden.test(allClean), `không chứa: ${forbidden}`);
}
// Không có nút Export (chỉ chấp nhận keyword JS `export`, không chấp nhận nhãn Export).
assert.ok(!/Export|Xuất/.test(allClean), "không có nút Export");

// ---- 12. Không có HTML button mặc định (mọi <button> đều có className v3-btn) ----
const btnPattern = /<button(?![^>]*className="[^"]*v3-btn)/g;
assert.ok(!btnPattern.test(allClean), "mọi <button> đều dùng v3-btn (không mặc định)");

// ---- 13. Responsive không vỡ: media query + overflow-wrap ----
const css = fs.readFileSync(path.join(uiRoot, "styles", "automationV3.css"), "utf8");
assert.ok(css.includes("@media (max-width: 640px)"), "có media query mobile");
assert.ok(css.includes("overflow-wrap: anywhere"), "path/title dài không vỡ layout");
assert.ok(css.includes("min-height: 40px"), "button >= 40px");
assert.ok(css.includes("font-size: 14px") || css.includes("font-size:14px"), "font >= 14px");

// ---- Sidebar chỉ hiển thị "Automation", không có "Automation V3" ----
const navSource = read("config/navigation.js");
const navClean = stripComments(navSource);
assert.ok(/label:\s*"Automation"/.test(navClean), "có mục 'Automation'");
assert.ok(!navClean.includes("Automation V3") && !navClean.includes("Automation Intelligence"), "không có 'Automation V3'/'Automation Intelligence'");
assert.ok(navClean.includes('"/automation"'), "trỏ /automation");

// ---- Workspace là màn hình gốc, Upload chỉ khi tạo workspace mới ----
const pageClean = stripComments(pageSource);
assert.ok(!pageClean.includes("Record by Testcase"), "không hiển thị tên phiên bản");
assert.ok(pageClean.includes("Chưa có Automation Workspace"), "empty state khi chưa có workspace");
assert.ok(pageClean.includes("V3UploadPanel") && pageClean.includes("creating"), "Upload chỉ trong luồng tạo workspace (creating)");
assert.ok(pageClean.includes("localStorage") && pageClean.includes("getWorkspace"), "mở lại workspace đã lưu");

// ---- Không hiển thị khái niệm 5A/5B/5C / 'bước sau' ----
assert.ok(!/5A|5B|5C|bước sau|Bước sau/.test(allClean), "không lộ 5A/5B/5C hay 'bước sau'");

console.log("Automation V3 UI test: PASS");
