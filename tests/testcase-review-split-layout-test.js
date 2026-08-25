import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.join(testDir, "..", relative), "utf8");

const reviewPanel = read("web-ui/src/components/TestCaseReviewPanel.jsx");
const editor = read("web-ui/src/components/TestCaseEditor.jsx");
const globalCss = read("web-ui/src/styles/global.css");
const automationPage = read("web-ui/src/pages/AutomationV3Page.jsx");

// The existing list/editor composition remains intact: only its desktop layout changes.
assert.ok(reviewPanel.includes("testcase-review-main--drawer-open"), "review panel marks an open detail context");
assert.ok(reviewPanel.includes("<TestCaseList") && reviewPanel.includes("<TestCaseEditor"), "review keeps the list and editor in one layout container");
assert.ok(reviewPanel.includes("setSelectedId(id)") && reviewPanel.includes("setEditDraft(null)"), "selecting another testcase clears the prior edit draft");

// Assert the final (last) split-pane override, so legacy mobile-drawer declarations cannot mask it.
const splitCss = globalCss.slice(globalCss.lastIndexOf("Review detail uses the Automation Workspace split-pane pattern"));
assert.ok(splitCss.includes("@media (min-width: 961px)"), "desktop breakpoint is explicit");
assert.ok(splitCss.includes(".testcase-review-main--drawer-open") && splitCss.includes("display: grid"), "open review uses a two-column grid on desktop");
assert.ok(splitCss.includes(".testcase-detail-panel") && splitCss.includes("position: sticky"), "detail is an in-layout right pane, not a fixed overlay");
assert.ok(splitCss.includes(".testcase-review-page--detail-open::before { display: none; }"), "desktop split-pane disables the overlay backdrop");
const fullWorkspaceCss = globalCss.slice(globalCss.lastIndexOf("Detail mode is a workspace"));
assert.ok(fullWorkspaceCss.includes("@media (min-width: 961px)"), "full-width mode is desktop-only");
assert.ok(fullWorkspaceCss.includes(".testcase-review-route:has(.testcase-review-page--detail-open)"), "detail mode targets the outer review route");
assert.ok(fullWorkspaceCss.includes("width: 100%") && fullWorkspaceCss.includes("max-width: none") && fullWorkspaceCss.includes("margin-inline: 0"), "desktop detail mode uses the full remaining workspace width");

for (const label of [
    "Testcase ID",
    "Cần kiểm tra",
    "Tình huống kiểm tra",
    "Thông tin chung",
    "Điều kiện tiên quyết",
    "Dữ liệu kiểm thử",
    "Các bước thực hiện",
    "Kết quả mong đợi"
]) {
    assert.ok(editor.includes(label), `editor retains detail content: ${label}`);
}

assert.ok(automationPage.includes("v3-ws-panel--compact"), "workspace control is compact in the header");
assert.ok(automationPage.includes("switchWorkspace") && automationPage.includes("handleNewWorkspaceClick"), "workspace switch and creation handlers remain connected");
assert.ok(automationPage.includes("v3-ws-popover") && automationPage.includes("setWsManagerOpen(true)"), "workspace popover and manager remain available");

console.log("Testcase Review split layout + compact workspace header test: PASS");
