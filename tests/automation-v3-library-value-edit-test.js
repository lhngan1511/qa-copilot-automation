import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ActionLibrary from "../src/codegen/ActionLibrary.js";
import CodeGenController from "../src/controllers/CodeGenController.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lib-value-"));
const library = new ActionLibrary({ metadataFile: path.join(temp, "library.json") });
const block = library.addBlock({
    label: "Đăng nhập",
    steps: [
        { order: 1, actionType: "FILL", target: "Tài khoản", recordedValue: "admin", sensitive: false },
        { order: 2, actionType: "FILL", target: "Mật khẩu", recordedValue: "secret-old", sensitive: true }
    ]
});
const controller = new CodeGenController({ manager: {}, actionLibrary: library });
const response = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

let res = response();
await controller.updateLibraryAction({ params: { blockId: block.blockId }, body: { steps: [
    { order: 1, recordedValue: "tester" },
    { order: 2, preserveRecordedValue: true }
] } }, res);
assert.equal(res.statusCode, 200);
assert.equal(library.get(block.blockId).steps[0].recordedValue, "tester", "giá trị thường được cập nhật");
assert.equal(library.get(block.blockId).steps[1].recordedValue, "secret-old", "secret giữ nguyên khi không nhập lại");

res = response();
await controller.updateLibraryAction({ params: { blockId: block.blockId }, body: { steps: [
    { order: 1, recordedValue: "tester" },
    { order: 2, recordedValue: "secret-new" }
] } }, res);
assert.equal(library.get(block.blockId).steps[1].recordedValue, "secret-new", "secret đổi khi tester chủ động nhập mới");
assert.equal(library.get(block.blockId).steps[1].sensitive, true, "giữ cờ sensitive sau edit");

fs.rmSync(temp, { recursive: true, force: true });
console.log("Automation V3 Library recorded value edit test: PASS");
