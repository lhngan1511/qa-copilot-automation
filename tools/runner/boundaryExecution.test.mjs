import assert from "node:assert/strict";
import { runBoundaryJob } from "./boundaryExecution.mjs";

/* Smoke test THẬT (spawn playwright test thật trên máy đang chạy test này) cho boundaryExecution —
   xác nhận đọc đúng JSON reporter (--reporter=json + PLAYWRIGHT_JSON_OUTPUT_NAME), tách kết quả
   RIÊNG TỪNG candidate (2 test() trong 1 file, title = candidate id), và ảnh chụp màn hình
   (screenshot:"on" từ playwright.boundary.config.js) trả về đúng dạng base64 giải mã ra PNG thật —
   không cần server thật, chỉ cần about:blank + 1 assertion PASS và 1 assertion FAIL có chủ đích. */

const SPEC = `import { test, expect } from '@playwright/test';
test('C1', async ({ page }) => {
  await page.goto('about:blank');
  await expect(page).toHaveURL('about:blank');
});
test('C2', async ({ page }) => {
  await page.goto('about:blank');
  await expect(page).toHaveURL('http://khong-bao-gio-khop/', { timeout: 2000 });
});`;

async function main() {
    const result = await runBoundaryJob({ code: SPEC, env: { BASE_URL: "http://example.com" } });
    assert.equal(result.status, "PASSED", JSON.stringify(result));
    assert.ok(result.resultsById, "phải có resultsById");

    const c1 = result.resultsById["C1"];
    const c2 = result.resultsById["C2"];
    assert.ok(c1, "phải có kết quả cho candidate C1");
    assert.ok(c2, "phải có kết quả cho candidate C2");

    assert.equal(c1.status, "PASSED");
    assert.equal(c2.status, "FAILED");
    assert.ok(c2.errorMessage, "candidate FAILED phải có errorMessage");

    for (const [title, r] of [["C1", c1], ["C2", c2]]) {
        assert.ok(r.screenshotBase64, `candidate ${title} phải có screenshotBase64 (screenshot:"on")`);
        const bytes = Buffer.from(r.screenshotBase64, "base64");
        assert.equal(bytes.slice(0, 8).toString("hex"), "89504e470d0a1a0a", `candidate ${title} ảnh phải đúng magic bytes PNG`);
    }

    // Thiếu BASE_URL -> FAILED rõ ràng, không spawn Playwright, không throw.
    const missingBaseUrl = await runBoundaryJob({ code: SPEC, env: {} });
    assert.equal(missingBaseUrl.status, "FAILED");
    assert.match(missingBaseUrl.error, /BASE_URL/);

    console.log("boundaryExecution lifecycle smoke test: PASS");
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
