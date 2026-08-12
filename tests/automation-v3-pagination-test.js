import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paginate, clampPage, totalPages } from "../web-ui/src/utils/pagination.js";
import { scopedAssertionsInRange } from "../web-ui/src/utils/recordingPrepState.js";
import { appendWorkingAction, proposalStatus } from "../web-ui/src/utils/workingActions.js";

/*
 P0-3.3 — LIBRARY REFRESH + PAGINATION + AI VERIFICATION VISIBILITY (CASE A–F).

 Root cause library refresh: saveAllToLibrary (split) setShowLibrary(true) + feedback
 nhưng KHÔNG setLibrary/refresh → section mở nhưng state library vẫn [] → "Thư viện
 chưa có thao tác nào." dù save thành công. Fix: await refreshLibrary() sau save.

 Sandbox không browser → test logic thuần qua helper + static contract.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---- CASE A — Save Library → list refresh ngay (reuse refreshLibrary → setLibrary) ----
const saveBody = clean.match(/const saveAllToLibrary = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(saveBody.includes("await refreshLibrary()"), "A: sau save (split) gọi await refreshLibrary()");
const refreshBody = clean.match(/const refreshLibrary = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(refreshBody.includes("setLibrary("), "A: refreshLibrary → setLibrary (list state cập nhật ngay, không cache thứ hai)");
assert.ok(refreshBody.includes("return list"), "A: refreshLibrary trả list để save nhảy trang cuối");

// ---- CASE B — 8 proposals → 2 trang (pageSize 5); add page 1 → state giữ khi đổi trang ----
const PROPOSAL_PAGE_SIZE = 5;
const eight = Array.from({ length: 8 }, (_, i) => ({ suggestedName: `P${i + 1}`, startStep: i * 3 + 1, endStep: i * 3 + 3 }));
const p0 = paginate(eight, 0, PROPOSAL_PAGE_SIZE);
assert.equal(p0.totalPages, 2, "B: 8 proposals / size 5 → 2 trang");
assert.equal(p0.items.length, 5, "B: trang 1 có 5 items");
const p1 = paginate(eight, 1, PROPOSAL_PAGE_SIZE);
assert.equal(p1.items.length, 3, "B: trang 2 có 3 items");
assert.equal(p1.hasPrev, true, "B: trang 2 có Trước");
// add proposal đầu (page 1) → working có 1 → đổi trang → quay lại → added giữ.
let ws = appendWorkingAction([], { label: "P1", startStep: 1, endStep: 3 });
assert.equal(proposalStatus(eight[0], ws).added, true, "B: proposal 1 added ở page 1");
const p0again = paginate(eight, 0, PROPOSAL_PAGE_SIZE);
assert.equal(proposalStatus(p0again.items[0], ws).added, true, "B: quay lại page 1 → trạng thái Đã thêm còn nguyên");
assert.equal(proposalStatus(eight[1], ws).added, false, "B: proposal 2 chưa thêm → vẫn [Thêm thao tác]");
// Không gọi AI khi đổi trang: setProposalPage chỉ đổi state (static bên dưới).

// ---- CASE C — 12 Library actions → pagination đúng (pageSize 10) ----
const twelve = Array.from({ length: 12 }, (_, i) => ({ blockId: `LIB-${i}`, label: `Action ${i + 1}` }));
const l0 = paginate(twelve, 0, 10);
assert.equal(l0.totalPages, 2, "C: 12 items / size 10 → 2 trang");
assert.equal(l0.items.length, 10, "C: trang 1 có 10 items");
assert.equal(paginate(twelve, 1, 10).items.length, 2, "C: trang 2 có 2 items");

// ---- CASE D — delete last item ở trang cuối → page tự normalize ----
assert.equal(clampPage(1, 12, 10), 1, "D: page 1 hợp lệ khi còn 12 items");
assert.equal(clampPage(1, 11, 10), 1, "D: page 1 hợp lệ khi 11 items (2 trang)");
assert.equal(clampPage(1, 10, 10), 0, "D: đúng 10 items = 1 trang → page 1 clamp về 0");
assert.equal(clampPage(1, 9, 10), 0, "D: xóa item → còn 9 → page 1 clamp về 0 (trang bị rỗng)");
assert.equal(clampPage(1, 0, 10), 0, "D: xóa hết → page về 0");
assert.equal(totalPages(0, 10), 1, "D: rỗng vẫn 1 trang (không crash)");
// Component dùng clampPage sau delete (static bên dưới).

// ---- CASE E — proposal có assertion → scoped đúng range ----
const steps = [
    { order: 1, sourceStart: 0, sourceEnd: 50 },
    { order: 2, sourceStart: 60, sourceEnd: 120 },
    { order: 5, sourceStart: 400, sourceEnd: 500 },
    { order: 6, sourceStart: 510, sourceEnd: 600 }
];
const assertions = [
    { sourceStart: 30, sourceEnd: 40, statement: "await expect(page.getByText('X')).toBeVisible()", matcher: "toBeVisible", expected: "X" }, // trong range 1-2
    { sourceStart: 420, sourceEnd: 480, statement: "await expect(page.getByText('Y')).toBeVisible()", matcher: "toBeVisible", expected: "Y" } // trong range 5-6
];
const inRange = scopedAssertionsInRange(assertions, steps, 1, 2);
assert.equal(inRange.length, 1, "E: range 1-2 chỉ có assertion X (scoped đúng)");
assert.equal(inRange[0].expected, "X", "E: assertion đúng range");
const inRange56 = scopedAssertionsInRange(assertions, steps, 5, 6);
assert.equal(inRange56.length, 1, "E: range 5-6 chỉ có assertion Y");
assert.equal(inRange56[0].expected, "Y", "E: không hiển thị assertion ngoài range");

// ---- CASE F — proposal không assertion → mảng rỗng → component hiện câu thông báo ----
assert.equal(scopedAssertionsInRange(assertions, steps, 3, 4).length, 0, "F: range không assertion → rỗng");
assert.equal(scopedAssertionsInRange([], steps, 1, 2).length, 0, "F: không có assertion nào → rỗng");
assert.equal(scopedAssertionsInRange(assertions, steps, 1, 2).length, 1, "F: range có assertion → có dữ liệu (không báo nhầm 'không có')");

// ================= Static contract — component =================
assert.ok(clean.includes("paginate(proposals, proposalPage, PROPOSAL_PAGE_SIZE)"), "B: proposal render qua paginate");
assert.ok(clean.includes("paginate(library, libPage, LIB_PAGE_SIZE)"), "C: library render qua paginate");
assert.ok(clean.includes("‹ Trước") && clean.includes("Sau ›") && clean.includes("v3-pagination"), "B: controls ‹ Trước / Sau ›");
assert.ok(clean.includes("Trang {libPaged.page + 1} / {libPaged.totalPages}"), "C: label Trang X / N cho Library");
assert.ok(clean.includes("clampPage(prev, library.length - 1, LIB_PAGE_SIZE)"), "D: delete → setLibPage clamp (normalize trang rỗng)");
assert.ok(clean.includes("setProposalPage(p => p - 1)") && clean.includes("setProposalPage(p => p + 1)"), "B: đổi trang chỉ setProposalPage");
const propControls = clean.match(/‹ Trước[\s\S]*?Sau ›/)?.[0] ?? "";
assert.ok(propControls.includes("setProposalPage"), "B: controls proposal có setProposalPage");
assert.ok(!propControls.includes("analyzeRecording") && !propControls.includes("handleAnalyze"), "B: KHÔNG gọi AI khi đổi trang");
assert.ok(clean.includes("scopedAssertionsInRange(assertions, steps, proposal.startStep, proposal.endStep)"), "E: proposal dùng scoped rule (cùng rule manual)");
assert.ok(clean.includes("Điều kiện kiểm tra:") && clean.includes("Không có thông tin xác nhận trong đoạn này."), "F: luôn có dòng Điều kiện kiểm tra — không để trống");
assert.ok(clean.includes("PROPOSAL_PAGE_SIZE = 5") && clean.includes("LIB_PAGE_SIZE = 10"), "page size proposals 5 / library 10");

console.log("Automation V3 Library Refresh + Pagination (P0-3.3) test: PASS");
