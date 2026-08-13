/*
 P0 — SETUP DATA CLASSIFICATION (C).

 Input thuộc SETUP (reusable Action, dùng shared runtime env LOGIN_*):
   username/tài khoản/account  -> LOGIN_USERNAME
   mật khẩu/password           -> LOGIN_PASSWORD
   mã xác nhận/captcha         -> LOGIN_CAPTCHA

 Rule (không hardcode tên testcase):
   - isSetupField(target): input env-bound (LOGIN_*) -> SETUP -> KHÔNG đưa vào business
     Test Data editor (không copy credentials vào confirmedTestData).
   - isLoginTestCase(title, module): testcase đang TEST chính chức năng Login
     (bằng chứng từ tên) -> ngoại lệ: credential fields thuộc approved Test Data
     được hiển thị/edit bình thường.
*/

export function setupEnvKey(target) {
    const t = String(target ?? "").toLowerCase();
    if (/tài khoản|username|account/.test(t)) return "LOGIN_USERNAME";
    if (/mật khẩu|password/.test(t)) return "LOGIN_PASSWORD";
    if (/mã xác nhận|captcha/.test(t)) return "LOGIN_CAPTCHA";
    return null;
}

export function isSetupField(target) {
    return setupEnvKey(target) !== null;
}

export function isLoginTestCase(title, module = "") {
    return /đăng nhập|login/i.test(`${title ?? ""} ${module ?? ""}`);
}
