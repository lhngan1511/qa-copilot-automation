import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendWorkingAction, removeWorkingAction, proposalStatus } from "../web-ui/src/utils/workingActions.js";

/*
 P0-3.2 — RÚT GỌN FLOW AI → TẠO THAO TÁC (CASE A–F).

 Flow mới (splitLayout/CodeGen):
   AI proposal → [Thêm thao tác] → THẲNG vào working set "THAO TÁC ĐÃ TẠO"
   (KHÔNG populate form manual, KHÔNG bắt Xác nhận lần 2, KHÔNG tự persist Library).
   Persist CHỈ khi tester bấm "Lưu N thao tác vào Thư viện".
   Manual flow giữ nguyên: Tên + Start/End → [Xác nhận thao tác].

 Sandbox không có browser → test logic thuần qua helper + static contract.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PROPOSALS = [
    { suggestedName: "Login", startStep: 1, endStep: 12, evidence: ["click Đăng nhập"] },
    { suggestedName: "Open", startStep: 13, endStep: 15, evidence: ["click Danh mục"] },
    { suggestedName: "Add", startStep: 16, endStep: 23, evidence: ["click Thêm"] }
];

// ---- CASE A — AI direct add: working có Login; không populate form; proposals khác còn ----
let ws = [];
ws = appendWorkingAction(ws, { label: "Login", startStep: 1, endStep: 12 });
assert.equal(ws.length, 1, "A: working actions có Login sau [Thêm thao tác]");
assert.equal(ws[0].label, "Login", "A: label Login");
assert.equal(ws[0].startStep, 1, "A: start 1");
assert.equal(ws[0].endStep, 12, "A: end 12");
assert.equal(ws[0].stepCount, 12, "A: 12 thao tác (1→12)");
assert.equal(proposalStatus(PROPOSALS[1], ws).added, false, "A: proposal Open chưa được thêm");
assert.equal(proposalStatus(PROPOSALS[2], ws).added, false, "A: proposal Add chưa được thêm");

// ---- CASE B — nhiều proposal: add 3 → working = 3 ----
ws = appendWorkingAction(ws, { label: "Open", startStep: 13, endStep: 15 });
ws = appendWorkingAction(ws, { label: "Add", startStep: 16, endStep: 23 });
assert.equal(ws.length, 3, "B: working actions = 3 (Login/Open/Add)");
assert.deepEqual(ws.map(x => x.label), ["Login", "Open", "Add"], "B: thứ tự thêm đúng");

// ---- CASE E — accidental duplicate: add cùng range 2 lần → KHÔNG duplicate ----
const dup = appendWorkingAction(ws, { label: "Login", startStep: 1, endStep: 12 });
assert.equal(dup.length, 3, "E: add lại cùng range → không duplicate");
assert.equal(proposalStatus(PROPOSALS[0], dup).added, true, "E: proposal Login có trạng thái 'Đã thêm'");
// proposalStatus blocked khi overlap (khác range nhưng chồng lấn)
const overlapWs = appendWorkingAction([], { label: "X", startStep: 5, endStep: 8 });
assert.equal(proposalStatus({ startStep: 1, endStep: 12 }, overlapWs).blocked, true, "E: proposal overlap với action khác → blocked");
assert.equal(proposalStatus({ startStep: 1, endStep: 12 }, overlapWs).overlapLabel, "X", "E: overlapLabel đúng");

// ---- CASE F — delete/re-add: xóa action → proposal add lại được ----
const removed = removeWorkingAction(ws, ws[0].blockId);
assert.equal(removed.length, 2, "F: xóa 1 action → còn 2");
assert.equal(proposalStatus(PROPOSALS[0], removed).added, false, "F: proposal Login trở lại [Thêm thao tác]");
assert.equal(proposalStatus(PROPOSALS[0], removed).blocked, false, "F: không còn blocked");
const readd = appendWorkingAction(removed, { label: "Login", startStep: 1, endStep: 12 });
assert.equal(readd.length, 3, "F: add lại được (không lỗi)");

// ---- CASE D — manual flow: append bình thường (component gọi addWorkingAction từ confirmSegment) ----
const manualWs = appendWorkingAction([], { label: "Tự tạo", startStep: 9, endStep: 11 });
assert.equal(manualWs.length, 1, "D: manual flow thêm bình thường");
assert.equal(manualWs[0].label, "Tự tạo", "D: label manual");

// ================= Static contract — component dùng đúng đường =================

// handleAddProposal: KHÔNG populate form (start/end/name), KHÔNG xóa proposal khỏi list,
// KHÔNG gọi createLibraryAction (AI không tự persist).
const addProposalBody = clean.match(/const handleAddProposal = proposal => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(addProposalBody.length > 0, "tìm thấy handleAddProposal");
assert.ok(!addProposalBody.includes("setStartSel(") && !addProposalBody.includes("setEndSel(") && !addProposalBody.includes("setName("),
    "A: handleAddProposal KHÔNG populate form manual");
assert.ok(!addProposalBody.includes("setProposals("), "A: handleAddProposal KHÔNG xóa proposal khỏi list (Open/Add vẫn còn)");
assert.ok(!addProposalBody.includes("createLibraryAction"), "C: handleAddProposal KHÔNG persist Library");
assert.ok(addProposalBody.includes("addWorkingAction"), "A: handleAddProposal → addWorkingAction (working set)");

// addWorkingAction: dùng appendWorkingAction (functional update — chống duplicate), KHÔNG API.
const addWorkingBody = clean.match(/const addWorkingAction = \(s, e, label\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(addWorkingBody.includes("appendWorkingAction") && addWorkingBody.includes("setConfirmed(prev =>"), "E: add qua functional update appendWorkingAction (chống double-click)");
assert.ok(!addWorkingBody.includes("createLibraryAction"), "C: addWorkingAction KHÔNG persist");

// confirmSegment: split → addWorkingAction (không createLibraryAction); non-split → createConfirmedAction (fallback giữ cũ).
const confirmSegBody = clean.match(/const confirmSegment = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(confirmSegBody.includes("splitLayout") && confirmSegBody.includes("addWorkingAction"), "D: manual confirm (split) → working set");
assert.ok(confirmSegBody.includes("createConfirmedAction"), "D: fallback (non-split) giữ createConfirmedAction — không phá Automation");

// saveAllToLibrary (split): persist từng working action qua createLibraryAction — ĐÂY mới là Library gate.
const saveBody = clean.match(/const saveAllToLibrary = async \(\) => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(saveBody.includes("createLibraryAction"), "C: saveAllToLibrary (split) gọi createLibraryAction cho từng action cần tạo");
assert.ok(saveBody.includes("planLibrarySave(confirmed, canonical)"), "C: reconcile theo canonical Library — chỉ tạo action chưa lưu/đã bị xóa (không duplicate)");

// UI labels
assert.ok(clean.includes("Thêm thao tác"), "A: nút proposal = [Thêm thao tác]");
assert.ok(clean.includes("Đã thêm"), "E: trạng thái proposal đã thêm (✓ Đã thêm / disabled [Đã thêm])");
assert.ok(clean.includes("HOẶC TỰ TẠO"), "D: heading HOẶC TỰ TẠO");
assert.ok(clean.includes("Lưu {confirmed.length} thao tác vào Thư viện"), "B: nút save phản ánh số lượng");
assert.ok(!clean.includes("HOẶC TỰ CHỌN"), "P0-3.2: bỏ HOẶC TỰ CHỌN cũ");
assert.ok(clean.includes("proposalStatus"), "component dùng proposalStatus");

// Recording không bị reset khi add proposal: handleAddProposal không gọi setSteps/setSource/setRecordingId.
assert.ok(!addProposalBody.includes("setSteps(") && !addProposalBody.includes("setSource(") && !addProposalBody.includes("setRecordingId("),
    "8: thêm proposal KHÔNG reset recording bên trái");

console.log("Automation V3 AI Flow (P0-3.2) test: PASS");
