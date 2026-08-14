import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 P0 UI REGRESSION — Action Library Viewer layout contract (fix sau ed6592f).

 ROOT CAUSE (trace): .v3-lib-modal__body là CSS grid 2 cột nhưng error/notice render
 trực tiếp làm grid child #1/#2 → auto-placement: notice chiếm 1 cell (vùng xanh lớn),
 list sang cell khác, detail bị đẩy row 2 → vỡ layout sau Save. Modal chỉ max-height →
 height content-driven (co/giãn). Edit mode dùng grid 4 cột riêng (edit-step) khác View.

 FIX (UI-only): body LUÔN chỉ 2 children (tree + detail); status nằm HEADER;
 modal height ỔN ĐỊNH 88vh; View/Edit dùng CÙNG step grid 5 cột (edit chỉ thêm
 checkbox trong cell STT); detail min-width:0; scroll riêng.

 J1-J8 regression (static + render-level).
*/

const testDir = path.dirname(fileURLToPath(import.meta.url));
const viewerSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "components", "automationV3", "V3LibraryViewer.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(testDir, "..", "web-ui", "src", "styles", "automationV3.css"), "utf8");

// ===== J1 — Body chỉ có ĐÚNG 2 grid children (tree + detail); success/error không là child #3 =====
// Status nằm HEADER (.v3-lib-modal__status) — body KHÔNG render error/notice trực tiếp.
assert.ok(viewerSource.includes("v3-lib-modal__status"), "J1: status row trong header");
const bodySection = viewerSource.slice(viewerSource.indexOf('<div className="v3-lib-modal__body">'), viewerSource.indexOf("</div>\n            </div>\n        </div>\n    );\n}"));
// Trong body: KHÔNG có {error ? / {notice ? / {status ? render
assert.ok(!/className="v3-lib-modal__body"[\s\S]{0,400}?\{error \?/.test(viewerSource), "J1: error không render trong body");
assert.ok(!/className="v3-lib-modal__body"[\s\S]{0,400}?\{notice \?/.test(viewerSource), "J1: notice không render trong body");
assert.ok(viewerSource.includes("v3-lib-modal__list") && viewerSource.includes("v3-lib-modal__detail"), "J1: body có tree + detail");

// ===== J2 — View và Edit dùng CÙNG step grid (renderStepRow chung; không còn edit-step) =====
assert.ok(viewerSource.includes("const renderStepRow"), "J2: 1 hàm step row dùng chung View/Edit");
assert.ok(!viewerSource.includes("v3-lib-modal__edit-step"), "J2: KHÔNG còn markup edit-step riêng");
assert.ok(!cssSource.includes(".v3-lib-modal__edit-step"), "J2: CSS edit-step đã bỏ");
assert.ok(viewerSource.includes("renderStepRow(s, editing)"), "J2: edit chỉ truyền flag — cùng structure");
assert.ok(viewerSource.includes('{editing ? "Dùng" : "STT"}'), "J2: header cột STT đổi nhãn khi edit — grid giữ nguyên");

// ===== J3/J4 — Save giữ selected blockId + edit=false nhưng detail vẫn render cùng action =====
assert.ok(viewerSource.includes("setSelectedId(selected.blockId)"), "J3: sau save re-select SAME blockId");
assert.ok(viewerSource.includes("setEditing(false)") && viewerSource.includes("setSelectedId(selected.blockId)"), "J4: edit=false nhưng selected giữ -> detail vẫn cột phải");

// ===== J5 — Success không thay đổi grid placement (status ở header, không phải body child) =====
const headerIdx = viewerSource.indexOf('className="v3-lib-modal__header"');
const bodyIdx = viewerSource.indexOf('className="v3-lib-modal__body"');
const headerSection = viewerSource.slice(headerIdx, bodyIdx);
assert.ok(headerSection.includes("v3-lib-modal__status"), "J5: status trong header");
assert.ok(!headerSection.includes("grid-column"), "J5: status không phải grid item của body");

// ===== J6 — Modal stable height (88vh — không content-driven) =====
assert.ok(cssSource.includes("height: 88vh") && cssSource.includes("max-height: 88vh"), "J6: modal height 88vh cố định (không chỉ max-height)");
assert.ok(cssSource.includes("height: 92vh"), "J6: mobile height ổn định");

// ===== J7 — Tree/detail overflow riêng =====
assert.ok(/\.v3-lib-modal__list \{[\s\S]*?overflow: auto/.test(cssSource), "J7: tree scroll riêng");
assert.ok(/\.v3-lib-modal__detail \{[\s\S]*?overflow: auto/.test(cssSource), "J7: detail scroll riêng");
assert.ok(cssSource.includes("min-width: 0"), "J7: detail min-width:0 (không horizontal overflow)");

// ===== J8 — 3-step / 24-step không đổi geometry: modal height cố định + body flex min-height 0 =====
assert.ok(/\.v3-lib-modal__body \{[\s\S]*?min-height: 0/.test(cssSource), "J8: body flex-1 min-height 0 — content không kéo modal");
assert.ok(cssSource.includes("grid-template-columns: 340px minmax(0, 1fr)"), "J8: tree 340px cố định + detail flexible");

// ===== J13/J14 — sensitive mask + technical collapsed (giữ) =====
assert.ok(viewerSource.includes('"••••"'), "J13: sensitive mask giữ");
assert.ok(viewerSource.includes("Xem kỹ thuật") && viewerSource.includes("<details"), "J14: technical collapse mặc định");

console.log("Automation V3 Library Viewer Layout Contract (J1-J14) test: PASS");
