import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proposalStatus } from "../web-ui/src/utils/workingActions.js";

/*
 P0 — AI PROPOSAL KHÔNG CÀ GIẬT + TEXT SPACING (fix 14/15).

 Root cause 14:
 - [Bỏ] cũ: setProposals(prev => prev.filter(...)) → thay TOÀN BỘ mảng → re-render cả list,
   số "Gợi ý i/N" đổi, các card dịch chuyển (cà giật).
 - Key card = `${start}-${end}-${idx}` — idx (trong trang) đổi khi bỏ 1 card → React remount
   từng card còn lại.
 Fix: "Bỏ" = trạng thái dismissed (KHÔNG filter mảng — split path); key = `${start}:${end}` ổn định;
 không gọi lại analyze; không reset proposalPage. Fallback drawer giữ nguyên (Automation path).

 Root cause 15: label "Điều kiện kiểm tra:" là inline span → dính "Điều kiện kiểm tra:Không
 có thông tin...". Fix: class v3-act__verif-label (display:block + margin) — presentation.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ================= 14 — proposal ổn định =================
// ---- proposalStatus: dismissed là trạng thái (không xóa khỏi mảng) ----
const ws = [{ blockId: "WORK-1", label: "Login", startStep: 1, endStep: 12 }];
const p = { suggestedName: "Login", startStep: 1, endStep: 12 };
assert.equal(proposalStatus(p, ws, []).added, true, "14: added khi có working action");
assert.equal(proposalStatus(p, ws, ["1:12"]).dismissed, true, "14: dismissed là trạng thái riêng (vẫn giữ trong mảng proposals)");
assert.equal(proposalStatus({ startStep: 13, endStep: 15 }, ws, ["1:12"]).dismissed, false, "14: proposal khác không bị dismiss");

// ---- Static: split path — [Bỏ] dùng dismissed (không filter); key ổn định; không gọi AI ----
assert.ok(clean.includes("setDismissedProposals"), "14: [Bỏ] dùng dismissedProposals (trạng thái)");
assert.ok(clean.includes('key={`${proposal.startStep}:${proposal.endStep}`}'), "14: key card ổn định (start:end) — không remount khi bỏ card khác");
assert.ok(clean.includes('{st.dismissed ? "Đã bỏ" : "Bỏ"}'), "14: nút [Bỏ] → [Đã bỏ] (disabled)");
assert.ok(clean.includes("disabled={saving || st.added || st.blocked || st.dismissed}"), "14: [Thêm thao tác] disable khi dismissed");
// Chỉ fallback drawer còn filter (Automation path) — split không còn.
const splitIdx = clean.indexOf("splitLayout ? (");
const fallbackIdx = clean.indexOf(") : (", splitIdx);
const splitB = clean.slice(splitIdx, fallbackIdx === -1 ? clean.length : fallbackIdx);
assert.ok(!splitB.includes("setProposals(prev => prev.filter"), "14: split [Bỏ] KHÔNG filter proposals (không remount list)");
// Không gọi AI khi thêm/bỏ; không reset proposalPage trong handler proposal.
const addBody = clean.match(/const handleAddProposal = proposal => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(!addBody.includes("analyzeRecording") && !addBody.includes("setProposalPage"), "14: Thêm proposal không gọi AI / không reset page");
const pageResets = (clean.match(/setProposalPage\(0\)/g) ?? []).length;
assert.ok(pageResets <= 2, `14: setProposalPage(0) chỉ ở reset recording/newRecording (hiện ${pageResets})`);
// Không reset page trong handler proposal:
const addB2 = clean.match(/const handleAddProposal = proposal => \{[\s\S]*?\n    \};/)?.[0] ?? "";
assert.ok(!addB2.includes("setProposalPage"), "14: handleAddProposal không reset page");

// ================= 15 — spacing =================
assert.ok(clean.includes('v3-act__verif-label">Điều kiện kiểm tra:</span>'), "15: label có class v3-act__verif-label");
const css = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automationV3.css"), "utf8");
assert.ok(css.includes(".v3-act__verif-label") && css.includes("display: block"), "15: CSS label block (spacing rõ, không dính text)");
assert.ok(clean.includes("Không có thông tin xác nhận trong đoạn này."), "15: case A — message không assertion vẫn có");
assert.ok(clean.includes("readableAssertion(a)"), "15: case B — assertion render riêng sau label");

console.log("Automation V3 Proposal Stability + Spacing (P0 14/15) test: PASS");
