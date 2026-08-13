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
    /AI Mapping|aiMapping/i, /codeGenFile/i
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
assert.ok(drawerClean.includes("Chạy thử") && drawerClean.includes("onRun"), "P0-C: drawer có tab Chạy thử (Run 1 testcase đang mở)");
assert.ok(!/run ?testcase/.test(drawerClean), "không có run toàn bộ testcase (chỉ chạy thử 1 testcase đang mở)");

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
assert.ok(expTab.includes("AI đề xuất thêm"), "P0-D: nút AI đề xuất thêm (secondary, không tự bung)");
assert.ok(expTab.includes("Áp dụng"), "Áp dụng đề xuất");
assert.ok(expTab.includes("Xác nhận") || expTab.includes("Sử dụng"), "Xác nhận/Sử dụng điều kiện");
assert.ok(expTab.includes("+ Thêm điều kiện kiểm tra"), "P0-D: bổ sung tay");
assert.ok(expTab.includes("Chưa có gì để đề xuất"), "gợi ý nhẹ khi không tạo được candidate (không heuristic mạnh)");
assert.ok(expTab.includes("Cần ít nhất 1 điều kiện được xác nhận"), "nhắc gate assertion");
assert.ok(expTab.includes("quay về Nháp"), "sửa điều kiện → Nháp");
assert.ok(!/aiSuggest|aiMapping/i.test(expTab), "tab không AI tự map/đề xuất ngầm (AI chỉ là nút chủ động đã duyệt)");
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
assert.ok(pageClean2.includes("v3-ws-panel") && pageClean2.includes("Workspace hiện tại") && pageClean2.includes("delete_workspace"), "P0-D: workspace panel + delete confirm");
assert.ok(pageClean2.includes("shortWorkspaceId"), "short id chỉ dùng hiển thị phụ");

assert.ok(pageClean2.includes("handleGenerate"), "page có handler Generate");
assert.ok(pageClean2.includes("drawerTab"), "page mở drawer tab theo ngữ cảnh");

// ---- 26. 6A — BUG 2 fix: page truyền expectedResult khi createWorkspace ----
assert.ok(pageClean2.includes("expectedResult"), "page map expectedResult vào payload createWorkspace (BUG 2 fix)");

// ================= 6C — UX ĐƠN GIẢN HÓA (Thao tác) =================
// ---- P0 Phase 1: Codegen là owner Recording Preparation (shared component) ----
const codegenPage = stripComments(read("pages/CodeGenPage.jsx"));
assert.ok(codegenPage.includes("V3RecordingPreparationPanel"), "Codegen page dùng shared RecordingPreparationPanel");
assert.ok(!codegenPage.includes("Công cụ kỹ thuật"), "P0 Save Recording: bỏ card Công cụ kỹ thuật cuối trang (chức năng recording chuyển vào panel)");
assert.ok(!codegenPage.includes("CÔNG CỤ NÂNG CAO"), "P0 Cleanup: không còn section CÔNG CỤ NÂNG CAO lớn");
const recPrepCleanup = stripComments(read("components/automationV3/V3RecordingPreparationPanel.jsx"));
assert.ok(recPrepCleanup.includes("createRecording"), "P0 Cleanup: paste dùng createRecording (không spawn recorder)");
assert.ok(recPrepCleanup.includes("thao tác") && recPrepCleanup.includes("Xem bản ghi"), "Seg UX: summary + Xem bản ghi (collapsed)");
assert.ok(!recPrepCleanup.includes("Bạn muốn dùng phần nào?"), "Seg UX: bỏ 'Bạn muốn dùng phần nào?' (hết duplication)");
assert.ok(!recPrepCleanup.includes("Dùng toàn bộ bản ghi"), "Seg UX: bỏ Dùng toàn bộ default");
assert.ok(recPrepCleanup.includes("THAO TÁC ĐÃ TẠO") && !recPrepCleanup.includes("III. THAO TÁC ĐÃ TẠO") && !recPrepCleanup.includes("+ Tạo thêm thao tác"), "P0-3: danh sách compact THAO TÁC ĐÃ TẠO (form luôn mở, không nút Tạo thêm)");
assert.ok(recPrepCleanup.includes("Gợi ý cách chia thao tác"), "P0-3.1: nút AI = Gợi ý cách chia thao tác");
assert.ok(recPrepCleanup.includes("Dùng gợi ý") && recPrepCleanup.includes("⚠ Trùng với thao tác đã tạo"), "Seg UX: proposal + overlap guard");
// P0 Library Visibility / Save Feedback
assert.ok(recPrepCleanup.includes("THƯ VIỆN THAO TÁC") && recPrepCleanup.includes("Xem tất cả"), "Lib: khối THƯ VIỆN + Xem tất cả");
assert.ok(recPrepCleanup.includes("Dùng bởi") && recPrepCleanup.includes("điều kiện kiểm tra"), "Lib: hiển thị tên/bước/điều kiện/usage");
assert.ok(recPrepCleanup.includes("Đã lưu") && recPrepCleanup.includes("vào Thư viện"), "Lib: success feedback sau save");
assert.ok(recPrepCleanup.includes("listLibrary"), "Lib: reuse listLibrary API (không xây Library mới)");

assert.ok(recPrepCleanup.includes("II. TẠO THAO TÁC") && recPrepCleanup.includes("I. BẢN GHI") && recPrepCleanup.includes("THAO TÁC ĐÃ TẠO"), "P0-3: headings I. BẢN GHI / II. TẠO THAO TÁC / THAO TÁC ĐÃ TẠO");
assert.ok(recPrepCleanup.includes("Xem kỹ thuật"), "P0 Cleanup: verification business-readable + Xem kỹ thuật cho raw");

assert.ok(!codegenPage.includes("Đối chiếu testcase"), "Codegen V3 bỏ Đối chiếu testcase (legacy)");
assert.ok(codegenPage.includes("I. BẢN GHI"), "Codegen: heading I. BẢN GHI");
assert.ok(!codegenPage.includes("PHÂN ĐOẠN THAO TÁC → THƯ VIỆN"), "Codegen: bỏ heading PHÂN ĐOẠN");
assert.ok(recPrepCleanup.includes("Sao chép mã") && recPrepCleanup.includes("Lưu bản ghi Playwright"), "P0 Save Recording: panel có Sao chép mã + Lưu bản ghi Playwright (canonical source)");
assert.ok(!codegenPage.includes("Chạy thử bản ghi"), "Codegen: bỏ Chạy thử bản ghi");


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
assert.ok(actPanel.includes("Mở CodeGen") && actPanel.includes('to="/codegen"'), "P0-B: fallback = link Mở CodeGen (không nhúng CodeGen)");
// Màn C (toàn bộ/một phần + preview) nằm trong SHARED V3RecordingPreparationPanel
const recPrep = stripComments(read("components/automationV3/V3RecordingPreparationPanel.jsx"));
assert.ok(recPrep.includes("Bắt đầu") && recPrep.includes("Kết thúc") && recPrep.includes("Xác nhận thao tác"), "Seg UX: manual Start/End + Xác nhận thao tác");
assert.ok(recPrep.includes("ĐOẠN ĐANG CHỌN") && !recPrep.includes("ĐOẠN ĐÃ CHỌN") && recPrep.includes("Xác nhận thao tác"), "P0-3.1: ĐOẠN ĐANG CHỌN + Xác nhận thao tác");
assert.ok(recPrep.includes("Lưu {confirmed.length} thao tác vào Thư viện"), "P0-3.2: nút save phản ánh số lượng");
assert.ok(recPrep.includes("THAO TÁC ĐÃ TẠO"), "P0-3: danh sách thao tác đã tạo (compact)");
assert.ok(actPanel.includes("Thao tác sẽ chạy") && actPanel.includes("+ Thêm thao tác từ thư viện"), "màn D: danh sách + primary Library");
assert.ok(!actPanel.includes("V3RecordingPreparationPanel"), "P0-B: Automation KHÔNG nhúng V3RecordingPreparationPanel (Library-only)");

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

// ================= P0 — LIBRARY + AUTOMATION INTERACTION CORRECTION =================
// ---- 32. Codegen: NEW RECORDING MUST RESET — đổi nội dung → reset context cũ + TỰ parse lại ----
const recPrepP0 = stripComments(read("components/automationV3/V3RecordingPreparationPanel.jsx"));
assert.ok(recPrepP0.includes("handleSourceChange"), "P0: textarea onChange qua handleSourceChange");
assert.ok(recPrepP0.includes("resetRecordingContext"), "P0: có reset context recording cũ");
assert.ok(recPrepP0.includes("freshAnalysisWorkspace") && recPrepP0.includes("applyAnalysisWorkspace"),
    "P0-1: reset Phần II qua freshAnalysisWorkspace (start/end/name/proposals/edit state)");
assert.ok(recPrepP0.includes("initializeAnalysisFromSteps(draftSteps)"),
    "P0-1: [Nhập xong] init LẠI hoàn toàn analysis workspace từ steps mới (draft→canonical)");
assert.ok(recPrepP0.includes("setConfirmed([])") && recPrepP0.includes("setSaveFeedback(null)"),
    "P0: reset working actions + save feedback khi đổi recording");
assert.ok(recPrepP0.includes("setTimeout") && recPrepP0.includes("doParse"), "P0: auto re-parse (debounce) — không cần F5");
assert.ok(recPrepP0.includes("parsedSource"), "P0: track source đã parse để phát hiện nội dung mới");
assert.ok(recPrepP0.includes("parseGen.current"), "P0-1: gen guard — async cũ (AI/confirm) không đổ vào bản mới");
assert.ok(!recPrepP0.includes("Bạn muốn dùng phần nào?"), "P0: không còn màn chọn nguồn ngang hàng");
// ---- 33. Action Library UI: item có Tên / N thao tác / N điều kiện / Dùng bởi N testcase / [Xem] / [Xóa] ----
assert.ok(recPrepP0.includes("Xóa") && recPrepP0.includes("deleteLibraryAction"), "Lib: [Xóa] gọi deleteLibraryAction API");
// P0-2 — confirm nhỏ cạnh action; KHÔNG full-width danger box; cảnh báo usage chỉ khi > 0.
assert.ok(recPrepP0.includes("v3-lib-delete-inline"), "P0-2: confirm nhỏ cạnh action (v3-lib-delete-inline)");
assert.ok(!recPrepP0.includes("v3-lib-delete-confirm"), "P0-2: bỏ full-width danger box (v3-lib-delete-confirm)");
assert.ok(recPrepP0.includes("usedByTestCases > 0") && recPrepP0.includes("testcase đang phụ thuộc"),
    "P0-2: chỉ hiện câu cảnh báo số testcase phụ thuộc khi usageCount > 0");
assert.ok(recPrepP0.includes("Nguồn: Thư viện thao tác"), "Lib: provenance 'Nguồn: Thư viện thao tác' trong [Xem]");
assert.ok(recPrepP0.includes("v3-act__item"), "Lib/Đã tạo: detail nằm ngoài flex row (v3-act__item — full width)");
const codeGenApiP0 = stripComments(read("api/codeGenApi.js"));
assert.ok(codeGenApiP0.includes("deleteLibraryAction"), "api codegen: có deleteLibraryAction");
const codegenPageP0 = stripComments(read("pages/CodeGenPage.jsx"));
assert.ok(codegenPageP0.includes("codegen-card") && codegenPageP0.includes("V3RecordingPreparationPanel"),
    "Codegen: prep panel bọc card (padding/margin khớp layout — không dính sát mép phải)");
// ---- 34. Automation: ADD FROM LIBRARY MULTI-SELECT (batch, picker không đóng sau mỗi chọn) ----
assert.ok(actPanel.includes("THÊM THAO TÁC TỪ THƯ VIỆN"), "P0: heading picker THÊM THAO TÁC TỪ THƯ VIỆN");
assert.ok(actPanel.includes('type="checkbox"') && actPanel.includes("toggleLib"), "P0: checkbox batch selection");
assert.ok(actPanel.includes("Đã chọn:") && actPanel.includes("Thêm ${selectedLib.length} thao tác"), "P0: footer 'Đã chọn: N thao tác' + [Thêm N thao tác]");
assert.ok(actPanel.includes("addSelectedLibrary"), "P0: [Thêm N thao tác] bind batch theo thứ tự chọn");
assert.ok(actPanel.includes("Hủy"), "P0: [Hủy] đóng picker");
assert.ok(!/Dùng lại/.test(actPanel), "P0: bỏ badge 'Dùng lại' khỏi action card");
assert.ok(actPanel.includes("Nguồn: Thư viện thao tác"), "P0: provenance chỉ trong [Xem]: 'Nguồn: Thư viện thao tác'");
// ---- 35. TAB STATE — canonical binding (không stale closure), repeated LIB-* không đụng key ----
assert.ok(actPanel.includes("refreshBinding()") && actPanel.includes("seq.length === 0"), "P0: quyết định screen từ sequence vừa fetch (không closure cũ)");
assert.ok(actPanel.includes("${item.blockId}:${item.order}"), "P0: key item = blockId:order (repeated D→E→D không đụng key)");
assert.ok(actPanel.includes("item.blockId, item.order"), "P0: [Xóa] truyền order → xóa đúng 1 occurrence");
assert.ok(actPanel.includes("v3-act__item"), "P0: expanded detail ngoài flex row (không bị ép hẹp)");
assert.ok(actPanel.includes("binding.filter(i => i.blockId === b.blockId)"), "P0: picker đếm số lần block đã có trong testcase (hỗ trợ duplicate)");

// ================= P0-3 — CODEGEN WORKSPACE SPLIT LAYOUT =================
// ---- 36. Split 2 cột: trái ~60% recording cố định · phải ~40% tạo thao tác ----
assert.ok(recPrepP0.includes("splitLayout"), "P0-3: prop splitLayout (CodeGen bật, fallback drawer tắt)");
assert.ok(recPrepP0.includes("v3-rec-prep__split") && recPrepP0.includes("v3-rec-prep__col--rec") && recPrepP0.includes("v3-rec-prep__col--actions"),
    "P0-3: grid split 2 cột rec/actions");
assert.ok(recPrepP0.includes("v3-rec-prep__steps"), "P0-3: cột trái steps luôn hiển thị + scroll (nguồn cố định)");
assert.ok(recPrepP0.includes("v3-step--range") && recPrepP0.includes("isStepInRange"), "P0-3: highlight range visual (không phải control)");
assert.ok(!recPrepP0.includes('type="checkbox"'), "P0-3: cột trái KHÔNG checkbox/click chọn step");
assert.ok(recPrepP0.includes("AI HỖ TRỢ") && recPrepP0.includes("HOẶC TỰ TẠO") && !recPrepP0.includes("HOẶC TỰ CHỌN"), "P0-3.2: AI HỖ TRỢ trên manual — HOẶC TỰ TẠO bên dưới");
assert.ok(recPrepP0.includes("ĐOẠN ĐANG CHỌN"), "P0-3.1: khối ĐOẠN ĐANG CHỌN (summary Bước X → Y · N thao tác)");
assert.ok(recPrepP0.includes("!splitLayout ? renderSteps(selSteps, true) : null"),
    "P0-3: split mode KHÔNG duplicate preview steps ở cột phải (steps đã hiện + highlight ở trái)");
assert.ok(codegenPageP0.includes("splitLayout"), "P0-3: CodeGenPage bật splitLayout");
assert.ok(recPrepP0.includes("Nguồn cố định"), "P0-3: cột trái ghi rõ 'Nguồn cố định — quan sát, đối chiếu'");
assert.ok(recPrepP0.includes("Nguồn cố định"), "P0-3: cột trái ghi rõ 'Nguồn cố định — quan sát, đối chiếu'");
// Confirm action KHÔNG đóng/reset recording (mental model P0-3) — đã assert trong isolation-test (createConfirmedAction).

// ================= P0-3.1 — CODEGEN SPLIT LAYOUT UX CLEANUP =================
// ---- 37. I. BẢN GHI: raw source collapse sau parse (không chiếm diện tích thường trực) ----
assert.ok(recPrepP0.includes("Xem mã Playwright ▾") && recPrepP0.includes("v3-act__raw"), "P0-3.1: raw source collapse 'Xem mã Playwright ▾' sau parse");
assert.ok(recPrepP0.includes("handleSourceChange"), "P0-3.1: textarea trong collapse vẫn giữ P0-1 isolation (đổi nội dung → reset + re-parse)");
// ---- 38. II. TẠO THAO TÁC: bỏ note, thứ tự Tên → Bắt đầu/Kết thúc → ĐOẠN ĐANG CHỌN ----
assert.ok(!recPrepP0.includes("Chọn một phần trong bản ghi để tạo thao tác dùng lại."), "P0-3.1: bỏ dòng 'Chọn một phần trong bản ghi…'");
const nameIdx = recPrepP0.indexOf("Tên thao tác");
const startIdx = recPrepP0.indexOf("Bắt đầu");
assert.ok(nameIdx > -1 && startIdx > -1 && nameIdx < startIdx, "P0-3.1: Tên thao tác đặt TRƯỚC Bắt đầu");
assert.ok(recPrepP0.includes("ĐOẠN ĐANG CHỌN"), "P0-3.1: khối ĐOẠN ĐANG CHỌN sau Bắt đầu/Kết thúc");
// ---- 39. AI HỖ TRỢ: status compact NGAY trong section; KHÔNG full-width red alert ----
assert.ok(recPrepP0.includes("v3-act__ai-status"), "P0-3.1: AI status inline (v3-act__ai-status)");
assert.ok(recPrepP0.includes("Không nhận được gợi ý. Bạn vẫn có thể tự chọn bên dưới."), "P0-3.1: empty → thông báo compact");
assert.ok(recPrepP0.includes("Không thể lấy gợi ý lúc này.") && recPrepP0.includes("Thử lại"), "P0-3.1: fail retryable → [Thử lại]");
const analyzeBody = recPrepP0.match(/const handleAnalyze = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(analyzeBody.length > 0, "tìm thấy thân handleAnalyze");
assert.ok(!analyzeBody.includes("setLocalError("), "P0-3.1: handleAnalyze KHÔNG đẩy lỗi AI vào banner đỏ full-width");
assert.ok(recPrepP0.includes('setAiStatus({ kind: "error"') && recPrepP0.includes('setAiStatus({ kind: "empty" })'), "P0-3.1: phân biệt error vs empty qua aiStatus");

// ================= P0-3.2 — RÚT GỌN FLOW AI → TẠO THAO TÁC =================
// ---- 40. AI proposal → working action TRỰC TIẾP (không vòng qua form manual) ----
assert.ok(recPrepP0.includes("handleAddProposal") && recPrepP0.includes("Thêm thao tác"), "P0-3.2: nút [Thêm thao tác] trên proposal");
assert.ok(recPrepP0.includes("Đã thêm"), "P0-3.2: trạng thái proposal đã thêm (✓/disabled)");
assert.ok(recPrepP0.includes("appendWorkingAction") && recPrepP0.includes("proposalStatus"), "P0-3.2: dùng helper workingActions (working set)");
const addPBody = recPrepP0.match(/const handleAddProposal = proposal => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(addPBody.length > 0 && !addPBody.includes("setStartSel(") && !addPBody.includes("setName(") && !addPBody.includes("createLibraryAction"),
    "P0-3.2: AI add KHÔNG populate form / KHÔNG tự persist Library");
// ---- 41. Library gate: persist chỉ ở saveAllToLibrary (bấm Lưu N thao tác) ----
const saveB = recPrepP0.match(/const saveAllToLibrary = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(saveB.includes("createLibraryAction") && saveB.includes("planLibrarySave"), "P0: Lưu → createLibraryAction cho action cần tạo, reconcile canonical (không duplicate)");
assert.ok(recPrepP0.includes("Lưu {confirmed.length} thao tác vào Thư viện"), "P0-3.2: nút 'Lưu N thao tác vào Thư viện'");

// ================= P0 — SAVE CURRENT PLAYWRIGHT RECORDING =================
// ---- 42. Utility recording: copy/save dùng CHÍNH canonical `source` (KHÔNG active.scriptContent list) ----
assert.ok(!codegenPage.includes("scriptContent"), "P0: CodeGenPage không còn đọc active.scriptContent từ list recordings (sai canonical)");
assert.ok(recPrepP0.includes("handleCopyRecording") && recPrepP0.includes("navigator.clipboard.writeText(source)"), "P0: Sao chép mã đọc `source`");
assert.ok(recPrepP0.includes("handleSaveRecording") && recPrepP0.includes("downloadScript(source,"), "P0: Lưu bản ghi Playwright download `source`");
assert.ok(recPrepP0.includes("buildRecordingFileName"), "P0: filename playwright-recording-<timestamp>.js (util thuần, đã test trong save-recording-test)");
assert.ok(recPrepP0.includes("v3-rec-utils") && recPrepP0.includes("steps.length > 0"), "P0: utility chỉ render khi recording tồn tại (empty state không báo nhầm)");
assert.ok(!recPrepP0.includes("Chưa có script trong bản ghi hiện tại."), "P0: bỏ message 'Chưa có script…' gây hiểu lầm");
assert.ok(!codegenPage.includes("Tải/Lưu script"), "P0: bỏ nút Tải/Lưu script cũ");
const copyH = recPrepP0.match(/const handleCopyRecording = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(!copyH.includes("createLibraryAction") && !copyH.includes("listLibrary"), "P0: copy KHÔNG đụng Action Library (CASE 3)");

// ================= P0 — CODEGEN PAGE HEADER CLEANUP =================
// ---- 43. Header: bỏ CODEGEN MVP / badge Chưa ghi / mô tả cũ; title chính + subtitle ngắn ----
assert.ok(!codegenPage.includes("CODEGEN MVP"), "P0 header: bỏ 'CODEGEN MVP'");
assert.ok(!codegenPage.includes("Chưa ghi"), "P0 header: bỏ badge 'Chưa ghi'");
assert.ok(!codegenPage.includes("Ghi lại thao tác, dán script, lưu và chạy thử."), "P0 header: bỏ mô tả cũ");
assert.ok(codegenPage.includes("Playwright CodeGen") && codegenPage.includes("Ghi hoặc dán bản ghi Playwright, tạo thao tác và lưu vào Thư viện."),
    "P0 header: title chính + subtitle ngắn mới");
assert.ok(!codegenPage.includes('status-badge--neutral') || !/Chưa ghi/.test(codegenPage), "P0 header: không còn badge trạng thái ghi trong header");

console.log("Automation V3 UI test: PASS");
