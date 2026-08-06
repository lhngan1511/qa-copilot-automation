import assert from "node:assert/strict";
import {
    isValidUrl,
    originOf,
    extractBaseUrls,
    resolveBaseUrl,
    sourceLabel,
    SOURCE
} from "../web-ui/src/utils/baseUrl.js";

/* P0 — Base URL tự nhận diện từ CodeGen. */

// 1. isValidUrl
assert.equal(isValidUrl("http://172.16.1.100:9230"), true);
assert.equal(isValidUrl("https://app.example.com"), true);
assert.equal(isValidUrl("ftp://x"), false, "chỉ http/https");
assert.equal(isValidUrl("not-a-url"), false);
assert.equal(isValidUrl(""), false);

// 2. originOf
assert.equal(originOf("http://172.16.1.100:9230/wasuco/login"), "http://172.16.1.100:9230");
assert.equal(originOf("https://app.example.com/x/y"), "https://app.example.com");
assert.equal(originOf("ftp://x"), null);

// 3. page.goto absolute URL -> nhận đúng origin
const single = `const { test } = require('@playwright/test');
test('login', async ({ page }) => {
  await page.goto('http://172.16.1.100:9230/wasuco/login');
  await page.goto('http://172.16.1.100:9230/wasuco/danh-muc');
});`;
assert.deepEqual(extractBaseUrls(single), ["http://172.16.1.100:9230"], "nhiều route cùng origin -> 1 BASE_URL");

// 4. nhiều origin -> trả về cả 2
const multi = `test('x', async ({ page }) => {
  await page.goto("http://172.16.1.100:9230/login");
  await page.goto("https://other.example.com/home");
});`;
assert.deepEqual(extractBaseUrls(multi), ["http://172.16.1.100:9230", "https://other.example.com"]);

// 5. không có page.goto tuyệt đối -> rỗng
assert.deepEqual(extractBaseUrls("test(){}"), []);
assert.deepEqual(extractBaseUrls("page.goto(process.env.BASE_URL + '/x')"), [], "bỏ relative/env-based goto");

// 6. resolveBaseUrl: ưu tiên user edit > codegen > env > none
assert.deepEqual(
    resolveBaseUrl({ edited: "http://edited.example.com", detected: ["http://codegen.example.com"], envFallback: "http://env.example.com" }).source,
    SOURCE.USER
);
const cgOnly = resolveBaseUrl({ edited: "", detected: ["http://codegen.example.com"], envFallback: "http://env.example.com" });
assert.equal(cgOnly.source, SOURCE.CODEGEN);
assert.equal(cgOnly.baseUrl, "http://codegen.example.com");
const envOnly = resolveBaseUrl({ edited: "", detected: [], envFallback: "http://env.example.com" });
assert.equal(envOnly.source, SOURCE.ENV);
assert.equal(envOnly.baseUrl, "http://env.example.com");
const none = resolveBaseUrl({ edited: "", detected: [], envFallback: "" });
assert.equal(none.source, SOURCE.NONE);
assert.equal(none.baseUrl, null);

// 7. nhiều origin -> không đoán, yêu cầu chọn
const multiRes = resolveBaseUrl({ edited: "", detected: ["http://a", "https://b"], envFallback: "http://env" });
assert.equal(multiRes.source, SOURCE.MULTIPLE);
assert.equal(multiRes.baseUrl, null);
assert.equal(multiRes.multiple, true);
assert.deepEqual(multiRes.options, ["http://a", "https://b"]);

// 8. user edit ghi đè cả khi có codegen/env
assert.equal(resolveBaseUrl({ edited: "http://edited.example.com", detected: ["http://cg.example.com"], envFallback: "http://env.example.com" }).baseUrl, "http://edited.example.com");

// 9. sourceLabel
assert.equal(sourceLabel(SOURCE.CODEGEN), "CodeGen — page.goto(...)");
assert.equal(sourceLabel(SOURCE.USER), "Người dùng chỉnh sửa");
assert.equal(sourceLabel(SOURCE.ENV), ".env fallback");
assert.equal(sourceLabel(SOURCE.MULTIPLE), "Phát hiện nhiều địa chỉ — chọn URL");
assert.equal(sourceLabel(SOURCE.NONE), "Chưa có Base URL");

console.log("Base URL test: PASS");
