import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "v3-binding-role-"));
const { default: createApp } = await import("../src/server/createApp.js");
const app = createApp({ repositoryType: "file", dataDir: path.join(root, "data"), outputDir: path.join(root, "output"), v3OutputDir: path.join(root, "generated") });
const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, route, body) {
    const response = await fetch(`${base}${route}`, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
}
const tc = id => ({ id, title: id, module: "M", type: "POSITIVE", reviewStatus: "APPROVED", expectedResult: "Sẵn sàng", testData: { fields: {} } });

const start = await req("POST", "/api/codegen/start", { url: "about:blank", browser: "chrome", mode: "FULL_FLOW" });
const recordingId = start.body?.data?.recordingId;
const script = `await page.goto('https://example.test/login');
await page.getByRole('button', { name: 'Tiếp tục' }).click();
await page.goto('https://example.test/devices');
await page.getByRole('button', { name: 'Tạo thiết bị' }).click();
await expect(page.getByText('Sẵn sàng')).toBeVisible();`;
await req("POST", `/api/codegen/recordings/${recordingId}/script`, { script });
const makeLibrary = async (label, kind, startStep, endStep) => {
    const result = await req("POST", "/api/codegen/library", { recordingId, label, kind, startStep, endStep, groupName: "M" });
    assert.equal(result.status, 201, `create ${label}`);
    return result.body.data.blockId;
};
const openLogin = await makeLibrary("Mở đăng nhập", "SETUP", 1, 1);
const login = await makeLibrary("Đăng nhập", "ACTION", 2, 2);
const openDevices = await makeLibrary("Mở thiết bị", "SETUP", 3, 3);
const create = await makeLibrary("Tạo thiết bị", "ACTION", 4, 4);

const workspace = async ids => {
    const result = await req("POST", "/api/automation-v3/workspaces", { source: "NEW", module: "M", approvedTestCases: ids.map(tc) });
    const id = result.body.workspaceId;
    for (const testCaseId of ids) {
        await req("POST", `/api/automation-v3/workspaces/${id}/testcases/${testCaseId}/select`, {});
        await req("POST", `/api/automation-v3/workspaces/${id}/testcases/${testCaseId}/assertions`, { type: "TEXT_VISIBLE", target: "Sẵn sàng", locator: "page.getByText('Sẵn sàng')", expected: "Sẵn sàng", matcher: "toBeVisible", status: "TESTER_CONFIRMED" });
    }
    return id;
};
const wid = await workspace(["TCLOGIN", "TC002", "TCPRE"]);
const bind = (testCaseId, blockId, role) => req("POST", `/api/automation-v3/workspaces/${wid}/testcases/${testCaseId}/library/blocks`, { blockId, role });

// CASE 1/7: same action is independent per testcase; library kind is merely default/suggestion.
await bind("TCLOGIN", openLogin, "PRECONDITION");
await bind("TCLOGIN", login, "ACTION_UNDER_TEST");
await bind("TC002", login, "PRECONDITION");
await bind("TC002", openDevices, "PRECONDITION");
await bind("TC002", create, "ACTION_UNDER_TEST");
let loginBinding = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/TCLOGIN/binding`);
let createBinding = await req("GET", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding`);
assert.equal(loginBinding.body.sequence[1].role, "ACTION_UNDER_TEST");
assert.equal(createBinding.body.sequence[0].role, "PRECONDITION");
assert.equal((await req("GET", `/api/automation-v3/workspaces/${wid}/library`)).body.find(b => b.blockId === login).kind, "ACTION", "binding role must not mutate library suggestion");

// CASE 2: multiple preconditions retain tester order in generated spec.
const generated = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/generate`, {});
assert.equal(generated.status, 200);
const code = generated.body.code;
assert.ok(
    code.indexOf("Tiếp tục") < code.indexOf("/devices")
    && code.indexOf("/devices") < code.indexOf("Tạo thiết bị"),
    "TC002 keeps login, navigation, and the action under test in tester-selected order"
);
assert.deepEqual(generated.body.metadata.segments.map(s => s.role), ["PRECONDITION", "PRECONDITION", "ACTION_UNDER_TEST"]);

// CASE 3: a testcase containing only prerequisites cannot generate.
await bind("TCPRE", openLogin, "PRECONDITION");
const onlyPre = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TCPRE/generate`, {});
assert.equal(onlyPre.status, 422);
assert.equal(onlyPre.body.errorCode, "ACTION_UNDER_TEST_REQUIRED");

// CASE 4: role is part of the fingerprint, so changing it makes the artifact stale.
const roleChange = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TC002/binding/blocks/${create}/role`, { order: 3, role: "PRECONDITION" });
assert.equal(roleChange.status, 200);
const stale = await req("POST", `/api/automation-v3/workspaces/${wid}/testcases/TC002/run`, {});
assert.equal(stale.status, 409);
assert.equal(stale.body.errorCode, "STALE_GENERATED");

// CASE 5/6: legacy missing role migrates from kind without reordering.
const legacy = await workspace(["TCLEGACY"]);
const svc = app.locals.dependencies.v3ApplicationService;
svc.workspace.setBinding(legacy, "TCLEGACY", [{ blockId: login, order: 1 }, { blockId: openLogin, order: 2 }]);
const migrated = await req("GET", `/api/automation-v3/workspaces/${legacy}/testcases/TCLEGACY/binding`);
assert.deepEqual(migrated.body.sequence.map(x => [x.blockId, x.order, x.role]), [[login, 1, "ACTION_UNDER_TEST"], [openLogin, 2, "PRECONDITION"]]);

// Invalid write input is rejected rather than silently normalized.
const invalid = await req("PATCH", `/api/automation-v3/workspaces/${wid}/testcases/TCLOGIN/binding/blocks/${login}/role`, { order: 2, role: "SETUP" });
assert.equal(invalid.status, 400);
assert.equal(invalid.body.errorCode, "BINDING_ROLE_INVALID");

await new Promise(resolve => server.close(resolve));
fs.rmSync(root, { recursive: true, force: true });
console.log("Automation V3 binding role regression: PASS");
