/*
 P0 — Save current Playwright recording (canonical `source`).

 buildRecordingFileName(): tên file mặc định `playwright-recording-<timestamp>.js`
 (tách thuần để test — component gọi qua downloadScript khi Lưu bản ghi Playwright).
*/

export function buildRecordingFileName(d = new Date()) {
    const pad = n => String(n).padStart(2, "0");
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `playwright-recording-${ts}.js`;
}
