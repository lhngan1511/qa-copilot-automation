/*
 P0-A — isSensitiveField (bản web-ui): tách từ recordingParser để UI không import
 src/codegen (giữ boundary frontend/backend sạch; tránh lộ path nội bộ).
 Cùng regex với parser — không lệch hành vi.
*/

export function isSensitiveField(target) {
    const t = String(target ?? "").toLowerCase();
    return /mật khẩu|password|pass\b|captcha|mã xác nhận|secret/.test(t);
}
