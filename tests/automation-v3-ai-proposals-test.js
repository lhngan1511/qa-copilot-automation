import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendWorkingAction, proposalStatus } from "../web-ui/src/utils/workingActions.js";

/*
 P0 — AI PROPOSAL LIST BỊ MẤT 4/5, 5/5.

 Root cause (đã trace): backend trả đủ 5 proposals (chỉ filter range hợp lệ);
 frontend state proposals.length = 5; nhưng JSX render dùng `proposals.slice(0, 3)`
 → hard limit 3 → UI chỉ thấy 1/5, 2/5, 3/5 rồi nhảy sang HOẶC TỰ TẠO.
 CSS không clip; proposalStatus/handleAddProposal KHÔNG filter proposal khỏi list.

 Fix tối thiểu: bỏ `slice(0, 3)` → render TOÀN BỘ proposals.

 Test bắt buộc: 5 proposals → add 1,2,3 → 4,5 vẫn visible và add được.
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const panelSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3RecordingPreparationPanel.jsx"), "utf8");
const clean = panelSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---- 1. Static contract: KHÔNG còn hard limit slice trên proposals ----
assert.ok(!clean.includes("proposals.slice("), "root cause: bỏ `proposals.slice(...)` khỏi render (không giới hạn cứng 3)");
assert.ok(clean.includes("proposals.map((proposal, idx) =>"), "render TOÀN BỘ proposals qua map");

// ---- 2. Logic: 5 proposals → add 1,2,3 → 4,5 vẫn visible (chưa added, chưa blocked) và add được ----
const five = [
    { suggestedName: "Login", startStep: 1, endStep: 12 },
    { suggestedName: "Open", startStep: 13, endStep: 15 },
    { suggestedName: "Add", startStep: 16, endStep: 23 },
    { suggestedName: "Search", startStep: 24, endStep: 27 },
    { suggestedName: "Delete", startStep: 28, endStep: 31 }
];
let ws = [];
ws = appendWorkingAction(ws, { label: five[0].suggestedName, startStep: five[0].startStep, endStep: five[0].endStep });
ws = appendWorkingAction(ws, { label: five[1].suggestedName, startStep: five[1].startStep, endStep: five[1].endStep });
ws = appendWorkingAction(ws, { label: five[2].suggestedName, startStep: five[2].startStep, endStep: five[2].endStep });
assert.equal(ws.length, 3, "đã add 3 proposal đầu");

// 4/5 và 5/5 vẫn VISIBLE: added=false, blocked=false → nút [Thêm thao tác] còn hoạt động.
const st4 = proposalStatus(five[3], ws);
assert.equal(st4.added, false, "proposal 4/5 chưa added → hiển thị [Thêm thao tác]");
assert.equal(st4.blocked, false, "proposal 4/5 không bị overlap chặn");
const st5 = proposalStatus(five[4], ws);
assert.equal(st5.added, false, "proposal 5/5 chưa added → hiển thị [Thêm thao tác]");
assert.equal(st5.blocked, false, "proposal 5/5 không bị overlap chặn");

// Add tiếp 4/5 và 5/5 → working = 5 (đủ, không mất).
ws = appendWorkingAction(ws, { label: five[3].suggestedName, startStep: five[3].startStep, endStep: five[3].endStep });
ws = appendWorkingAction(ws, { label: five[4].suggestedName, startStep: five[4].startStep, endStep: five[4].endStep });
assert.equal(ws.length, 5, "add 4/5 + 5/5 → working actions = 5");
assert.deepEqual(ws.map(x => x.label), ["Login", "Open", "Add", "Search", "Delete"], "đủ 5 proposal theo thứ tự");

// 1,2,3 đã add → trạng thái Đã thêm (vẫn hiển thị trong list — không bị filter).
assert.equal(proposalStatus(five[0], ws).added, true, "proposal 1/5: Đã thêm");
assert.equal(proposalStatus(five[2], ws).added, true, "proposal 3/5: Đã thêm");

console.log("Automation V3 AI Proposals (5/5 visible) test: PASS");
