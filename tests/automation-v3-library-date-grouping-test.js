import assert from "node:assert/strict";
import fs from "node:fs";
import { groupLibraryActionsByCreatedDate } from "../web-ui/src/utils/libraryGroups.js";

const now = new Date(2026, 7, 17, 12, 0, 0);
const sections = groupLibraryActionsByCreatedDate([
    { blockId: "old", createdAt: "2026-08-15T08:00:00+07:00" },
    { blockId: "today-old", createdAt: "2026-08-17T08:00:00+07:00" },
    { blockId: "unknown" },
    { blockId: "yesterday", createdAt: "2026-08-16T09:00:00+07:00" },
    { blockId: "today-new", createdAt: "2026-08-17T10:00:00+07:00" }
], now);

assert.deepEqual(sections.map(section => section.label), ["Hôm nay", "Hôm qua", "15/08/2026", "Không rõ ngày ghi"]);
assert.deepEqual(sections[0].items.map(item => item.blockId), ["today-new", "today-old"], "mới nhất trong ngày đứng trước");
assert.equal(sections.at(-1).items[0].blockId, "unknown", "thiếu createdAt không làm mất thao tác");

const controllerSource = fs.readFileSync(new URL("../src/controllers/CodeGenController.js", import.meta.url), "utf8");
const viewerSource = fs.readFileSync(new URL("../web-ui/src/components/automationV3/V3LibraryViewer.jsx", import.meta.url), "utf8");
assert.ok(controllerSource.includes("createdAt: b.createdAt ?? null"), "API trả ngày ghi cho Library Viewer");
assert.ok(viewerSource.includes("Ngày ghi") && viewerSource.includes("formatRecordedDateTime(b.createdAt)"), "Viewer hiện ngày ghi ở list và detail");
assert.ok(viewerSource.includes("v3-lib-group__arrow") && viewerSource.includes("is-open"), "chevron thể hiện rõ trạng thái nhóm");

console.log("Automation V3 Library date grouping test: PASS");
