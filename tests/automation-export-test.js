import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AutomationWorkspaceService from "../src/services/AutomationWorkspaceService.js";

// Xuất testcase đã chọn ra selected-testcases.json (bước ⑥ Export).
async function main() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
    const service = new AutomationWorkspaceService({ rootDir, aiProvider: null });

    const selected = [
        { id: "TC003", title: "Đăng nhập", module: "Đăng nhập", mapping: { testCaseId: "TC003" } },
        { id: "TC004", title: "Đăng nhập thành công", module: "Đăng nhập", mapping: { testCaseId: "TC004" } }
    ];

    // 1. Thiếu testcase -> lỗi
    await assert.rejects(() => service.exportSelected({ testCases: [] }), /không có testcase/i);

    // 2. Xuất đúng 2 testcase đã chọn
    const result = await service.exportSelected({ module: "Đăng nhập", testCases: selected });
    assert.equal(result.count, 2, "count = 2");
    assert.ok(fs.existsSync(path.join(rootDir, "outputs", "automation-export", "selected-testcases.json")), "file được tạo");

    const written = JSON.parse(fs.readFileSync(path.join(rootDir, "outputs", "automation-export", "selected-testcases.json"), "utf8"));
    assert.equal(written.module, "Đăng nhập");
    assert.equal(written.count, 2);
    assert.deepEqual(written.testCases.map(t => t.id), ["TC003", "TC004"]);
    // mapping phải được giữ lại (dùng lại cho generate/CI-CD)
    assert.equal(written.testCases[0].mapping.testCaseId, "TC003");

    // 3. filePath tùy chọn
    const custom = await service.exportSelected({ module: "Đăng nhập", testCases: selected, filePath: "outputs/my-export.json" });
    assert.ok(fs.existsSync(path.join(rootDir, "outputs", "my-export.json")));

    console.log("Automation Export test: PASS");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
