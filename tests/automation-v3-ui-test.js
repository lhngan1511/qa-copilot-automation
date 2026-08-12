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

// Loại bỏ comment JS để tránh false-positive khi check nội dung cấm.
function stripComments(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ---- 8. Card: một trạng thái chính + một primary action; menu chỉ ở REVIEW_REQUIRED/APPROVED ----
const cardSource = read("components/automationV3/V3TestCaseCard.jsx");
assert.equal((cardSource.match(/v3-badge--sel/g) ?? []).length, 1, "1 nhánh badge 'Đã chọn'");
assert.equal((cardSource.match(/v3-badge--nosel/g) ?? []).length, 1, "1 nhánh badge 'Chưa chọn'");
assert.equal((cardSource.match(/v3-card__action/g) ?? []).length, 1, "card chỉ 1 slot primary action");
assert.ok(
    /showMenu = status === "REVIEW_REQUIRED" \|\| status === "APPROVED"/.test(cardSource),
    "menu '…' chỉ ở REVIEW_REQUIRED/APPROVED"
);
const cardClean = stripComments(cardSource);
assert.ok(!cardClean.includes("Xem chi tiết"), "không có Xem chi tiết");
assert.ok(!cardClean.includes("Generate") && !cardClean.includes("Export"), "card không Generate/Export");
// Card có đủ primary action theo trạng thái (gắn/nhập bản ghi + duyệt).
assert.ok(cardClean.includes("Tạo Automation") && cardClean.includes("Tiếp tục Automation") && cardClean.includes("Xem Automation"), "đủ primary action theo trạng thái (6C)");
// Không dùng nhãn gây hiểu nhầm khi chưa có Recorder thật.
assert.ok(!cardClean.includes("Đang ghi") && !cardClean.includes("Dừng ghi") && !cardClean.includes("Ghi testcase"), "không dùng 'Đang ghi'/'Dừng ghi' khi chưa spawn recorder");

// ---- 9/10/11. Không Generate/Run, không upload CodeGen, không AI Mapping ----
const allSources = [
    pageSource,
    cardSource,
    read("components/automationV3/V3TestCaseList.jsx"),
    read("components/automationV3/V3UploadPanel.jsx"),
    read("components/automationV3/V3RecordingPanel.jsx"),
    read("components/automationV3/V3SegmentMappingPanel.jsx"),
    read("components/automationV3/V3ActionSetupPanel.jsx"),
    read("components/automationV3/V3ReviewDrawer.jsx"),
    read("components/automationV3/V3RecordingTab.jsx"),
    read("components/automationV3/V3ConfirmDialog.jsx")
].join("\n");
const allClean = stripComments(allSources);

// 5C: Generate chính thức chỉ ở Drawer (không ở card/panel cũ). Vòng cấm áp cho các component
// ngoài Drawer — không cấm keyword `generate` (page/drawer dùng hàm generateTestcase hợp lệ).
for (const forbidden of [
    /Ghi thao tác và sinh/i,
    /AI Mapping|aiMapping/i, /codeGenFile|CodeGen/i
]) {
    assert.ok(!forbidden.test(allClean), `không chứa: ${forbidden}`);
}
// Không có nút Export (chỉ chấp nhận keyword JS `export`, không chấp nhận nhãn Export).
assert.ok(!/Export|Xuất/.test(allClean), "không có nút Export");
// Chỉ Drawer mới có nút "Sinh automation" (card/panel cũ không có).
assert.ok(!cardClean.includes("Sinh automation"), "card không có nút Sinh automation");

// ---- 12. Không có HTML button mặc định (mọi <button> đều có className) ----
const btnPattern = /<button(?![^>]*className=)/g;
assert.ok(!btnPattern.test(allClean), "mọi <button> đều có className styling (không mặc định)");

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

// ---- Bước 5B: page gọi recording API ----
const pageClean2 = stripComments(pageSource);
assert.ok(
    pageClean2.includes("startRecording") &&
        pageClean2.includes("stopRecording") &&
        pageClean2.includes("approveRecording") &&
        pageClean2.includes("rejectRecording") &&
        pageClean2.includes("deleteRecording"),
    "page gọi start/stop/approve/reject/delete recording"
);
assert.ok(pageClean2.includes("V3RecordingPanel"), "có banner nhập bản ghi");
const recPanelClean = stripComments(read("components/automationV3/V3RecordingPanel.jsx"));
assert.ok(recPanelClean.includes("Nhập bản ghi testcase"), "banner nhập bản ghi");
assert.ok(recPanelClean.includes("Dán mã Playwright đã ghi cho"), "panel dán mã Playwright cho testcase");
assert.ok(!recPanelClean.includes("Đang ghi") && !recPanelClean.includes("Dừng ghi"), "không 'Đang ghi'/'Dừng ghi'");
assert.ok(!pageClean2.includes("getRecordingSource"), "page không tải source mặc định (lazy ở 'Xem mã')");

// ---- Bước 5B: Drawer 2 tab (Thông tin, Recording), không tab Dữ liệu ----
const drawer = read("components/automationV3/V3ReviewDrawer.jsx");
const drawerClean = stripComments(drawer);
assert.ok(drawerClean.includes("Thông tin") && drawerClean.includes("Thao tác") && drawerClean.includes("Kết quả mong đợi"), "tabs 6C.1 (không Recording)");
assert.ok(!drawerClean.includes("Duyệt recording"), "6C.1: không còn Duyệt recording (recording không là business gate)");
assert.ok(!drawerClean.includes("Dữ liệu"), "không có tab Dữ liệu ở 5B");
assert.ok(!/run ?testcase|"RUN"|runStatus/i.test(drawerClean), "Drawer không Run (Bước 6)");

// ---- Bước 5B: source chỉ tải khi "Xem mã" (V3RecordingTab) ----
const recTab = stripComments(read("components/automationV3/V3RecordingTab.jsx"));
assert.ok(recTab.includes("getRecordingSource") && recTab.includes("Xem mã"), "source lazy qua 'Xem mã'");

// ================= 5C-0 — Record Mapping (Segment) =================

// ---- 14. Card hiển thị trạng thái 3 nhãn + thông tin đoạn đã gán ----
const utilsSource = stripComments(read("utils/automationV3.js"));
assert.ok(utilsSource.includes("Chưa quyết định") && utilsSource.includes("Có automation") && utilsSource.includes("Chỉ kiểm thử thủ công"), "3 nhãn trạng thái (utils)");
assert.ok(cardClean.includes("decisionLabel") && cardClean.includes("Thao tác:"), "card dùng nhãn quyết định + thông tin thao tác");
assert.ok(cardClean.includes("Đánh dấu chỉ kiểm thử thủ công"), "menu có đánh dấu thủ công");
assert.ok(!cardClean.includes("Sinh automation"), "card chưa có nút sinh (đợi 5C)");

// ---- 15. Panel gán đoạn: timeline + form gán + review (wireframe đã duyệt) ----
const mapPanel = stripComments(read("components/automationV3/V3SegmentMappingPanel.jsx"));
assert.ok(mapPanel.includes("Gắn bản ghi testcase") && mapPanel.includes("Các bước đã ghi"), "panel timeline");
assert.ok(mapPanel.includes("Xác nhận đoạn") && mapPanel.includes("Cập nhật đoạn"), "primary action gán đoạn");
assert.ok(mapPanel.includes("Dùng chung") && mapPanel.includes("Testcase"), "loại SETUP/TESTCASE");
assert.ok(mapPanel.includes("Các đoạn đã gán") && mapPanel.includes("Xác nhận") && mapPanel.includes("Chắc chắn?"), "review + xác nhận + xóa 2 bước");
assert.ok(mapPanel.includes("↑") && mapPanel.includes("↓"), "sắp xếp nhiều đoạn bằng ↑/↓");
assert.ok(mapPanel.includes("bước chưa thuộc đoạn nào"), "thông tin bước chưa dùng (không chặn)");
assert.ok(mapPanel.includes("— Chọn testcase —"), "không preselect testcase");
assert.ok(!/\bAI\b|aiMapping/i.test(mapPanel), "panel không dùng AI cho mapping");

// ---- 16. API client có đủ endpoint segment (5C-0) ----
assert.ok(apiSource.includes("createSegment") && apiSource.includes("updateSegment"), "api segment create/update");
assert.ok(apiSource.includes("confirmSegment") && apiSource.includes("deleteSegment"), "api segment confirm/delete");
assert.ok(apiSource.includes("reorderTestCaseSegments") && apiSource.includes("setAutomationDecision"), "api reorder + decision");
assert.ok(!apiSource.includes("rendererV3") && !apiSource.includes("CodeGenRecordingStore"), "không gọi Store/Renderer");

// ---- 17. Page nối luồng: bản ghi chưa gán testcase → mở panel gán đoạn ----
assert.ok(pageClean2.includes("V3SegmentMappingPanel"), "page có panel gán đoạn");
assert.ok(pageClean2.includes("setMappingPanel") && pageClean2.includes("refreshWorkspace"), "page mở panel + refresh sau khi đổi mapping");
assert.ok(pageClean2.includes("setAutomationDecision"), "page gọi API đặt trạng thái tự động hóa");
assert.ok(!pageClean2.includes("getRecordingSource"), "page không tải source mặc định");

// ---- 18. Pure helpers 5C-0 (thuần, test được) ----
const utils = await import(`../web-ui/src/utils/automationV3.js?t=${Date.now()}`);
const {
    validateSegmentRange, rangeLabel, findOverlap, unusedStepCount,
    canConfirmSegment, decisionLabel, segmentStatusLabel, SEGMENT_ERROR_MESSAGES
} = utils;
assert.deepEqual(validateSegmentRange(10, 6, 8), { ok: true, startStep: 6, endStep: 8, stepCount: 3 }, "range hợp lệ");
assert.equal(validateSegmentRange(10, 8, 6).ok, false, "start > end");
assert.equal(validateSegmentRange(10, 0, 3).ok, false, "start < 1");
assert.equal(validateSegmentRange(10, 9, 11).ok, false, "end > steps");
assert.equal(rangeLabel(6, 8), "bước 6 → 8 (3 bước)", "range label");
const segs = [
    { segmentId: "A", startStep: 1, endStep: 5 },
    { segmentId: "B", startStep: 6, endStep: 8 }
];
assert.equal(findOverlap(segs, 4, 6)?.segmentId, "A", "overlap tìm thấy");
assert.equal(findOverlap(segs, 9, 10), null, "không overlap");
assert.equal(findOverlap(segs, 4, 5, "A"), null, "loại trừ chính nó khi sửa");
assert.equal(unusedStepCount([{ order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }, { order: 5 }, { order: 6 }, { order: 7 }, { order: 8 }, { order: 9 }], segs), 1, "step 9 chưa dùng");
assert.equal(canConfirmSegment({ range: { ok: true }, segType: "TESTCASE", testCaseId: "TC1", stepsCount: 5 }), true, "đủ điều kiện");
assert.equal(canConfirmSegment({ range: { ok: true }, segType: "TESTCASE", testCaseId: "", stepsCount: 5 }), false, "thiếu testcase");
assert.equal(canConfirmSegment({ range: null, segType: "SETUP", testCaseId: null, stepsCount: 5 }), false, "thiếu range");
assert.equal(decisionLabel("AUTOMATED"), "Có automation", "nhãn quyết định");
assert.equal(decisionLabel("UNDECIDED"), "Chưa quyết định", "nhãn mặc định");
assert.equal(segmentStatusLabel("CONFIRMED"), "Đã xác nhận", "nhãn segment");
assert.equal(SEGMENT_ERROR_MESSAGES.RECORDING_MAPPING_REQUIRED, "Không có bản ghi thao tác cho testcase này.", "message chuẩn");

// ================= 5C — Expected Result → Điều kiện xác nhận → Generate =================

// ---- 20. Drawer có tab "Kết quả mong đợi" (chỉ khi selectedForAutomation) ----
const drawerClean2 = stripComments(read("components/automationV3/V3ReviewDrawer.jsx"));
assert.ok(drawerClean2.includes("Kết quả mong đợi"), "drawer có tab Kết quả mong đợi");
assert.ok(drawerClean2.includes("Sinh automation"), "footer drawer có Sinh automation");
assert.ok(drawerClean2.includes("canGenerateForTestcase"), "drawer dùng gate Generate");

// ---- 21. Tab expected: đúng flow chốt (xem/sửa → đề xuất chủ động → áp dụng → xác nhận) ----
const expTab = stripComments(read("components/automationV3/V3ExpectedResultTab.jsx"));
assert.ok(expTab.includes("Chỉnh sửa kết quả mong đợi"), "sửa Expected Result");
assert.ok(expTab.includes("Đề xuất điều kiện xác nhận"), "nút đề xuất chủ động (không tự bung)");
assert.ok(expTab.includes("Áp dụng"), "Áp dụng đề xuất");
assert.ok(expTab.includes("Xác nhận"), "Xác nhận điều kiện");
assert.ok(expTab.includes("+ Bổ sung điều kiện kiểm tra"), "bổ sung tay");
assert.ok(expTab.includes("Chưa có gì để đề xuất"), "gợi ý nhẹ khi không tạo được candidate (không heuristic mạnh)");
assert.ok(expTab.includes("Cần ít nhất 1 điều kiện được xác nhận"), "nhắc gate assertion");
assert.ok(expTab.includes("quay về Nháp"), "sửa điều kiện → Nháp");
assert.ok(!/\bAI\b|aiSuggest/i.test(expTab), "tab không dùng AI ở 5C");
assert.ok(!expTab.includes("Xóa trống → quay về bản gốc đã duyệt + hiện warning"), "không còn warning heuristic cũ");

// ---- 22. Card: primary "Điều kiện xác nhận" khi có segment CONFIRMED; không Generate trên card ----
assert.ok(cardClean.includes("Tạo Automation") && cardClean.includes("Xem Automation"), "card primary 6C (Tạo/Xem Automation)");
assert.ok(!cardClean.includes("Sinh automation"), "card KHÔNG có nút Sinh automation (chỉ drawer)");

// ---- 23. API client có đủ endpoint 5C ----
assert.ok(apiSource.includes("updateExpectedResult") && apiSource.includes("suggestAssertions"), "api expected-result + suggest");
assert.ok(apiSource.includes("listAssertions") && apiSource.includes("createAssertion"), "api list/create assertion");
assert.ok(apiSource.includes("confirmAssertion") && apiSource.includes("updateAssertion") && apiSource.includes("removeAssertion"), "api confirm/update/remove");
assert.ok(apiSource.includes("generateTestcase"), "api generate");

// ---- 24. Pure helpers 5C ----
assert.equal(decisionLabel("AUTOMATED"), "Có automation", "nhãn quyết định (giữ)");
const canGen = utils.canGenerateForTestcase;
assert.equal(canGen({ selectedForAutomation: true, segmentSummary: { total: 1, confirmed: 1 }, assertionStatus: { confirmed: 1 } }), true, "đủ gate");
assert.equal(canGen({ selectedForAutomation: true, segmentSummary: { total: 1, confirmed: 0 }, assertionStatus: { confirmed: 1 } }), false, "thiếu segment confirmed");
assert.equal(canGen({ selectedForAutomation: true, segmentSummary: { total: 2, confirmed: 1 }, assertionStatus: { confirmed: 1 } }), false, "6C.1: TẤT CẢ thao tác phải CONFIRMED");
assert.equal(canGen({ selectedForAutomation: true, segmentSummary: { total: 1, confirmed: 1 }, assertionStatus: { confirmed: 0 } }), false, "thiếu assertion confirmed");
assert.equal(canGen({ selectedForAutomation: false, segmentSummary: { total: 1, confirmed: 1 }, assertionStatus: { confirmed: 1 } }), false, "chưa chọn automation");
assert.equal(utils.assertionTypeLabel("TEXT_VISIBLE"), "Hiển thị nội dung", "nhãn loại");
assert.equal(utils.assertionStatusLabel("TESTER_CONFIRMED"), "Đã xác nhận", "nhãn trạng thái");
assert.equal(utils.matcherLabel("toBeHidden"), "Không hiển thị", "nhãn matcher");
assert.equal(utils.generateGateReason({ selectedForAutomation: true, segmentSummary: { total: 1, confirmed: 1 }, assertionStatus: { confirmed: 0 } }), "Chưa có điều kiện xác nhận phù hợp với kết quả mong đợi.", "lý do gate");
assert.equal(utils.generateGateReason({ selectedForAutomation: true, segmentSummary: { total: 1, confirmed: 0 }, segments: [{ status: "DRAFT", label: "Đăng nhập" }], assertionStatus: { confirmed: 1 } }), "Thao tác 'Đăng nhập' chưa được xác nhận.", "lý do gate 6C.1");

// ---- 25. Page: nối Generate từ drawer ----
assert.ok(pageClean2.includes("generateTestcase"), "page gọi generateTestcase");
// ================= P0 — Drawer testcase context (derive từ active workspace, không snapshot stale) =================
assert.ok(pageClean2.includes("drawerTestCaseId"), "drawer chỉ giữ testCaseId (không giữ object snapshot)");
assert.ok(pageClean2.includes("workspace?.items ?? []").find ? true : pageClean2.includes("workspace?.items"), "drawer derive testcase từ workspace items");
assert.ok(!pageClean2.includes("setDrawerTestcase("), "không còn setDrawerTestcase(object) — tránh snapshot stale");

// ================= P0 — Workspace lifecycle =================
assert.ok(pageClean2.includes("Đã lưu"), "header hiển thị 'Đã lưu' (trạng thái workspace)");
assert.ok(pageClean2.includes("Workspace gần đây"), "có bộ chọn workspace gần đây (recovery)");
assert.ok(pageClean2.includes("Bạn sắp chuyển sang workspace mới"), "confirm khi tạo workspace mới có dữ liệu");
assert.ok(pageClean2.includes("handleNewWorkspaceClick"), "nút Tạo workspace mới đi qua confirm handler");
assert.ok(pageClean2.includes("recentWorkspaces") && pageClean2.includes("switchWorkspace"), "recent + switch workspace");
assert.ok(pageClean2.includes("shortWorkspaceId"), "short id chỉ dùng hiển thị phụ");

assert.ok(pageClean2.includes("handleGenerate"), "page có handler Generate");
assert.ok(pageClean2.includes("drawerTab"), "page mở drawer tab theo ngữ cảnh");

// ---- 26. 6A — BUG 2 fix: page truyền expectedResult khi createWorkspace ----
assert.ok(pageClean2.includes("expectedResult"), "page map expectedResult vào payload createWorkspace (BUG 2 fix)");

// ================= 6C — UX ĐƠN GIẢN HÓA (Thao tác) =================
// ---- P0 Phase 1: Codegen là owner Recording Preparation (shared component) ----
const codegenPage = stripComments(read("pages/CodeGenPage.jsx"));
assert.ok(codegenPage.includes("V3RecordingPreparationPanel"), "Codegen page dùng shared RecordingPreparationPanel");
assert.ok(codegenPage.includes("PHÂN ĐOẠN THAO TÁC → THƯ VIỆN"), "Codegen có khu vực owner recording prep");
assert.ok(codegenPage.includes("Công cụ kỹ thuật ▾"), "P0 Cleanup: Advanced Tools collapse thành Công cụ kỹ thuật");
assert.ok(!codegenPage.includes("CÔNG CỤ NÂNG CAO"), "P0 Cleanup: không còn section CÔNG CỤ NÂNG CAO lớn");
const recPrepCleanup = stripComments(read("components/automationV3/V3RecordingPreparationPanel.jsx"));
assert.ok(recPrepCleanup.includes("createRecording"), "P0 Cleanup: paste dùng createRecording (không spawn recorder)");
assert.ok(recPrepCleanup.includes("thao tác") && recPrepCleanup.includes("Xem bản ghi"), "Seg UX: summary + Xem bản ghi (collapsed)");
assert.ok(recPrepCleanup.includes("PHÂN TÍCH / TẠO THAO TÁC"), "Seg UX: phần II PHÂN TÍCH/TẠO THAO TÁC");
assert.ok(!recPrepCleanup.includes("Bạn muốn dùng phần nào?"), "Seg UX: bỏ 'Bạn muốn dùng phần nào?' (hết duplication)");
assert.ok(!recPrepCleanup.includes("Dùng toàn bộ bản ghi"), "Seg UX: bỏ Dùng toàn bộ default");
assert.ok(recPrepCleanup.includes("CÁC THAO TÁC ĐÃ TẠO") && recPrepCleanup.includes("+ Tạo thêm thao tác"), "Seg UX: danh sách đã tạo + Tạo thêm");
assert.ok(recPrepCleanup.includes("✨ Phân tích bản ghi"), "Seg UX: AI nằm trong phần II");
assert.ok(recPrepCleanup.includes("Xem kỹ thuật"), "P0 Cleanup: verification business-readable + Xem kỹ thuật cho raw");

assert.ok(!codegenPage.includes("Đối chiếu testcase"), "Codegen V3 bỏ Đối chiếu testcase (legacy)");


// ---- 27. Card: primary theo trạng thái + hiển thị Expected Result + Thao tác ----
assert.ok(cardClean.includes("Tạo Automation") && cardClean.includes("Tiếp tục Automation") && cardClean.includes("Xem Automation"), "card 3 primary 6C");
assert.ok(cardClean.includes("Kết quả mong đợi:"), "card hiển thị Expected Result");
assert.ok(cardClean.includes("Thao tác:") && cardClean.includes("Chưa có thao tác"), "card hiển thị trạng thái thao tác");
assert.ok(!cardClean.includes("Sinh automation"), "card không có Sinh automation");

// ---- 28. Panel Thao tác (V3ActionSetupPanel): màn B/C/D theo wireframe ----
const actPanel = stripComments(read("components/automationV3/V3ActionSetupPanel.jsx"));
// Phase 1 Ownership: bỏ màn chọn nguồn ngang hàng; primary = Library
assert.ok(!actPanel.includes("Bạn muốn lấy thao tác thêm từ đâu?"), "không còn màn chọn nguồn ngang hàng");
assert.ok(actPanel.includes("+ Thêm thao tác từ thư viện"), "primary = thêm từ thư viện");
assert.ok(actPanel.includes("Tạo thao tác mới từ bản ghi"), "fallback = tạo mới từ bản ghi (secondary)");
// Màn C (toàn bộ/một phần + preview) nằm trong SHARED V3RecordingPreparationPanel
const recPrep = stripComments(read("components/automationV3/V3RecordingPreparationPanel.jsx"));
assert.ok(recPrep.includes("Bắt đầu") && recPrep.includes("Kết thúc") && recPrep.includes("Xác nhận đoạn"), "Seg UX: manual Start/End + Xác nhận đoạn");
assert.ok(recPrep.includes("Đã chọn bước") && recPrep.includes("Xác nhận đoạn"), "shared: preview range rõ + xác nhận đoạn");
assert.ok(recPrep.includes("Lưu vào Thư viện thao tác"), "shared: Lưu vào Thư viện");
assert.ok(recPrep.includes("CÁC THAO TÁC ĐÃ TẠO"), "Seg UX: danh sách thao tác đã tạo");
assert.ok(actPanel.includes("Thao tác sẽ chạy") && actPanel.includes("+ Thêm thao tác từ thư viện"), "màn D: danh sách + primary Library");
assert.ok(actPanel.includes("V3RecordingPreparationPanel"), "fallback reuse shared RecordingPreparationPanel (không duplicate)");

assert.ok(actPanel.includes("Lưu vào thư viện"), "reuse là tùy chọn phụ (Lưu vào thư viện)");
assert.ok(actPanel.includes("Đang dùng bởi"), "library hiển thị 'Đang dùng bởi N testcase'");
assert.ok(actPanel.includes("↑") && actPanel.includes("↓"), "sắp xếp thứ tự ↑↓");
assert.ok(!actPanel.includes("ActionBlock") && !actPanel.includes("Composition Path"), "KHÔNG lộ thuật ngữ kỹ thuật trong UI");
assert.ok(!/\bAI\b|aiMapping/i.test(actPanel), "panel không AI mapping");

// ---- 29. Drawer: tab "Thao tác" + header context ----
assert.ok(drawerClean2.includes("Thao tác"), "drawer có tab Thao tác");
assert.ok(drawerClean2.includes("V3ActionSetupPanel"), "drawer render panel thao tác");
assert.ok(drawerClean2.includes("v3-drawer__sub"), "drawer header có context (expected + trạng thái)");

// ---- 30. Page: nối primary setup/view → drawer tab Thao tác ----
assert.ok(pageClean2.includes('setDrawerTab("actions")'), "page mở drawer tab Thao tác");

// ---- 31. API client có đủ endpoint blocks/binding (6B/6C) ----
assert.ok(apiSource.includes("listBlocks") && apiSource.includes("createBlock"), "api list/create block");
assert.ok(apiSource.includes("listLibrary") && apiSource.includes("saveToLibrary") && apiSource.includes("bindLibraryBlock"), "api Action Library (boundary)");
assert.ok(apiSource.includes("updateBlock") && apiSource.includes("confirmBlock") && apiSource.includes("deleteBlock"), "api update/confirm/delete block");
assert.ok(apiSource.includes("getBlockUsage"), "api usage (reverse dependency)");
assert.ok(apiSource.includes("getBinding") && apiSource.includes("bindBlock"), "api binding get/bind");
assert.ok(apiSource.includes("unbindBlock") && apiSource.includes("reorderBinding"), "api unbind/reorder");
assert.ok(!apiSource.includes("rendererV3") && !apiSource.includes("CodeGenRecordingStore"), "không gọi Store/Renderer");

console.log("Automation V3 UI test: PASS");
