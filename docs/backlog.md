# Backlog — Automation V3

## RECORDER_INTEGRATION (Playwright Recorder thật)

> Ghi nhận: Ở Bước 5B, UI **chưa điều khiển Playwright Recorder thật**. Hiện chỉ hỗ trợ
> người dùng **dán source recording** và gắn source đó với `testCaseId` đang chọn
> (action "Gắn bản ghi testcase" / "Nhập xong"; panel "Dán mã Playwright đã ghi cho TCxxx").

Khi triển khai Recorder Integration (ngoài 5C):
- start Playwright CodeGen cho đúng testcase đang chọn;
- quản lý PID của tiến trình recorder;
- stop recorder khi người dùng dừng;
- tự đọc source từ recorder (không bắt người dùng dán tay);
- xử lý recorder đóng bất thường (PID chết, lỗi spawn, timeout).

Quy tắc: Recorder Integration **KHÔNG làm trong lượt Bước 5C**. Contract recording ↔ `testCaseId` giữ nguyên.
