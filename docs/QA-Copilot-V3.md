# QA Copilot V3 — Tài liệu mô tả sản phẩm

> Cập nhật: 2026-08-20
> Đây là tài liệu mô tả sản phẩm V3. Không thay thế các design/handoff kỹ thuật chi tiết.

---

## 1. V3 là gì

QA Copilot V3 giúp tester đi hết một vòng:

**yêu cầu → testcase đã duyệt → ghi thao tác thật → thư viện thao tác → ghép thành luồng automation → sinh Playwright → chạy thử.**

Điểm khác cốt lõi so với bản cũ: hệ thống **không đoán automation hộ**. Tester ghi bằng chứng thật, AI chỉ đề xuất cách chia thao tác, rồi tester chọn thao tác đã lưu để ghép thành một luồng nhất quán cho từng testcase.

---

## 2. Tư duy cốt lõi

```
CODEGEN                          THƯ VIỆN                         AUTOMATION
Ghi / dán bản ghi          →     Thao tác đã xác nhận       →     Chọn thao tác
AI phân tích, đề xuất cắt        (Đăng nhập, Mở chức năng,        Ghép thành 1 luồng
Tester xác nhận → Lưu            Thêm, Tìm, Sửa, Xóa…)            Sinh spec → Chạy thử
```

Hai vai trò tách rõ:

| Vai trò | Việc làm | Việc không làm |
|---|---|---|
| **CodeGen** | Ghi/dán Playwright, để AI đề xuất cách chia, tester xác nhận, lưu Thư viện thao tác | Không map testcase, không tự sinh spec |
| **Automation** | Chọn thao tác từ thư viện, sắp thành một luồng cho testcase, xác nhận data/kết quả, sinh và chạy | Không quay/cắt bản ghi như công việc chính |

**Ghi một lần, dùng nhiều lần.** Một bản ghi dài (đăng nhập → mở chức năng → thêm/sửa/xóa) được cắt thành nhiều thao tác. Nhiều testcase dùng lại cùng thao tác, chỉ khác thứ tự, dữ liệu và kết quả mong đợi.

**AI chỉ đề xuất. Tester quyết định.** AI không tự lưu thư viện, không tự gán thao tác cho testcase, không tự bịa assertion hay dữ liệu chạy.

---

## 3. So với bản trước, V3 đổi gì

| Trước (V2 / demo CodeGen) | V3 |
|---|---|
| Upload 1 file CodeGen, AI đoán cắt và map testcase | CodeGen cắt thao tác → lưu thư viện. Automation **chọn thư viện** để ghép luồng |
| 1 recording = 1 testcase | 1 bản ghi dài tạo nhiều thao tác; 1 testcase ghép nhiều thao tác |
| Mỗi testcase phải ghi lại gần như toàn bộ | CRUD 10 testcase có thể dùng chung Đăng nhập / Mở chức năng / Tìm kiếm |
| Giá trị lúc ghi bị dùng luôn khi sinh script | Recorded chỉ là mẫu. Data chạy do tester/approved quyết |
| Assertion bị suy từ recording (kể cả câu lỗi) | Điều kiện kiểm tra phải tester xác nhận |
| Trạng thái automation nằm lẫn trong testcase đã duyệt | Tách **Automation Workspace** riêng |
| Không có khái niệm thư viện thao tác dùng chung | **Thư viện thao tác** là tài sản chung của Project |

---

## 4. Bốn khu vực làm việc

Mọi dữ liệu được phân vùng theo **Project** đang chọn. Chưa có Project thì phải tạo trước.

```
Dashboard
    │
    ├── AI Test Design     Requirement / ảnh → review → testcase đã duyệt
    ├── CodeGen            Ghi thao tác → AI đề xuất → lưu Thư viện
    └── Automation         Chọn thư viện → ghép luồng → sinh → chạy
```

### 4.1 Project

- Switcher trên header: tạo, chọn, xóa Project.
- Workflow, CodeGen, Thư viện thao tác, Automation Workspace **không trộn** giữa các Project.
- Nhiều máy trong mạng nội bộ có thể dùng chung danh mục Project qua PostgreSQL.
- Dev chưa cấu hình database thì fallback file `data/projects.json`.
- Dữ liệu JSON cũ không có `projectId` là legacy — không tự trộn vào Project mới.

### 4.2 AI Test Design

Nguồn requirement:

1. **Tải file Markdown** đúng cấu trúc module/feature.
2. **Tạo từ hình ảnh** — tối đa 5 ảnh PNG/JPEG/WebP (≤ 8 MB). AI phân tích màn hình thành draft Markdown. Tester sửa, tải `.md` ra ngoài, nạp lại, rồi xác nhận để mở workflow.

Quy trình review:

```
Upload / Ảnh  →  Review phân tích  →  Review testcase  →  Export
```

Tester duyệt từng bước. AI đề xuất, không tự phê duyệt. Testcase đã duyệt là đầu vào của Automation Workspace.

### 4.3 CodeGen — tạo Thư viện thao tác

Đây là nơi **quay lại / dán bản ghi**, để AI phân tích, rồi lưu thư viện.

Luồng chuẩn:

```
1. Bắt đầu ghi (Playwright Inspector) hoặc dán mã Playwright
2. Review bản nháp — xóa bước thừa nếu cần — [Nhập xong]
3. [Gợi ý cách chia thao tác]  ← AI đề xuất: tên, chức năng, bước Start→End, evidence
4. Tester [Thêm thao tác] hoặc tự cắt thủ công (Tên + Bắt đầu + Kết thúc)
5. Kiểm lại danh sách THAO TÁC ĐÃ TẠO
6. [Lưu vào Thư viện thao tác]
```

Quy tắc:

- Bản ghi là nguồn cố định của phiên. Cắt nhiều thao tác từ **cùng một bản ghi** (ghi một lần, cắt nhiều lần).
- AI chỉ đề xuất. Không tự lưu. Không map testcase.
- Thao tác đã thêm vẫn nằm trong danh sách gợi ý (`Đã thêm`) — tester chọn tiếp các đoạn còn lại.
- Trùng phạm vi với thao tác đã tạo thì bị chặn, không nhân đôi.
- Tester đặt **Chức năng** (Đơn vị tính, Kho, Thiết bị…) để thư viện nhóm theo nghiệp vụ.
- Có thể xem Thư viện thao tác độc lập, không cần đang ghi.

Ví dụ một bản ghi Đơn vị tính được cắt thành:

| Thao tác | Phạm vi điển hình |
|---|---|
| Đăng nhập | Mở trang → nhập tài khoản/mật khẩu → bấm Đăng nhập |
| Mở danh mục Đơn vị tính | Vào menu / mở màn hình |
| Thêm đơn vị tính | Điền form → Lưu |
| Tìm kiếm đơn vị tính | Nhập từ khóa → tìm |
| Sửa đơn vị tính | Mở sửa → đổi dữ liệu → Lưu |
| Xóa đơn vị tính | Chọn → xác nhận xóa |

### 4.4 Automation — ghép thư viện thành một luồng

Đây là nơi **dùng thư viện**, không phải nơi quay lại.

Mở Automation Workspace từ testcase đã duyệt. Mỗi testcase có drawer:

```
Thông tin  |  Thao tác  |  Kết quả mong đợi  |  Chạy thử
```

**Tab Thao tác — việc chính của V3**

```
[+ Thêm thao tác từ thư viện]
    → chọn Chức năng
    → tick các thao tác
    → sắp thứ tự thành kịch bản
    → [Thêm N thao tác vào testcase]
```

Ví dụ luồng nhất quán cho *Sửa đơn vị tính thành công*:

```
1. Đăng nhập
2. Mở danh mục Đơn vị tính
3. Tìm kiếm đơn vị tính
4. Sửa đơn vị tính
5. Tìm kiếm đơn vị tính     ← được chọn lại, vì sau khi sửa cần tìm lại
```

Tester:

- Chọn nhiều thao tác, kể cả từ nhiều chức năng.
- Sắp ↑↓ — hệ thống **không tự đổi thứ tự**.
- Được dùng lại cùng một thao tác nhiều lần trong một testcase.
- Thay thế / xóa từng bước.
- Xác nhận thao tác trước khi sinh.

Không có thao tác phù hợp? Link **Mở CodeGen** để ghi thêm rồi quay lại chọn.

**Tab Thông tin**

- Xem ID, loại, module, tiêu đề.
- Sửa **Dữ liệu kiểm thử** của lần automation (không sửa file testcase đã duyệt).
- Login/setup dùng biến môi trường (`LOGIN_*`), không nhét mật khẩu vào data nghiệp vụ.

**Tab Kết quả mong đợi**

- Kết quả nghiệp vụ lấy từ testcase đã duyệt (có thể chỉnh bản workspace).
- Điều kiện tìm thấy trong thao tác đã chọn → tester [Sử dụng] hoặc [Bỏ qua].
- Có thể thêm thủ công hoặc nhờ AI đề xuất — vẫn phải xác nhận.
- **Sinh automation** chỉ khi đã có ít nhất một điều kiện tester xác nhận.

**Tab Chạy thử**

- Xem data sẽ chạy, chuỗi thao tác, kết quả đã chọn, mã Playwright.
- [Chạy thử] đúng file vừa sinh. Đổi thao tác / data / điều kiện sau khi sinh thì phải Sinh lại.

---

## 5. Mô hình dữ liệu (ngắn)

```
Bản ghi Playwright          nguồn bằng chứng thô (steps, expect)
        │
        ▼
Thao tác (Action)           đoạn đã cắt, có tên, có chức năng, lưu thư viện
        │
        ▼
Luồng của testcase          danh sách thao tác theo thứ tự tester chọn
                            + dữ liệu + kết quả mong đợi + điều kiện kiểm tra
```

- **Thao tác ≠ Testcase.** Thao tác là bằng chứng/hành động dùng lại được. Testcase sở hữu thứ tự, data và assertion.
- Thao tác lưu snapshot. Sửa/xóa bản ghi gốc không làm đổi thầm các testcase đang dùng.
- Thư viện dùng chung trong Project. Xóa workspace không xóa thư viện. Xóa thao tác đang được testcase dùng thì bị chặn.

---

## 6. Dữ liệu chạy và điều kiện kiểm tra

### Dữ liệu

Mỗi trường có một trong các trạng thái:

| Trạng thái | Ý nghĩa | Khi sinh script |
|---|---|---|
| **VALUE** | Tester/approved đã chốt giá trị | `fill` đúng giá trị đó |
| **EMPTY** | Cố ý để trống (kiểm tra validation) | Bỏ qua fill — không lấy giá trị lúc ghi |
| **UNRESOLVED** | Chưa quyết | Chặn sinh |
| **RECORDED_SAMPLE** | Giá trị lúc ghi, chỉ tham khảo | Không thành data chạy |

Thiếu quyết định → hệ thống báo rõ field nào chưa xong. Không âm thầm dùng giá trị recorded.

### Điều kiện kiểm tra

Bài học từ bản demo: recording “Đăng nhập thành công” có thể chỉ chứa `expect` thông báo lỗi. Hệ thống **không được lấy đó làm bằng chứng thành công**.

Chỉ điều kiện **tester đã xác nhận** mới vào spec.

---

## 7. Sinh spec và chạy thử

```
Luồng đã xác nhận
  + dữ liệu đã chốt (VALUE / EMPTY)
  + ≥ 1 điều kiện kiểm tra đã xác nhận
        │
        ▼
  Sinh file  outputs/generated-tests/<TC>.spec.js
        │
        ▼
  Chạy đúng file đó → PASS / FAIL
```

- Không sinh ngầm khi bấm Chạy thử.
- Đổi thao tác, data hoặc điều kiện sau khi sinh → phải Sinh lại (nếu không sẽ bị từ chối vì bản sinh đã cũ).
- Sửa nội dung một thao tác trong thư viện → mọi testcase đang dùng thao tác đó cũng phải Sinh lại.

---

## 8. Nguyên tắc không đổi

1. **Tester làm chủ.** AI / hệ thống chỉ đề xuất.
2. **Thư viện là cầu nối.** CodeGen tạo tài sản. Automation tiêu thụ tài sản.
3. **Một luồng = thứ tự thao tác tester đã chọn.** Không map theo thứ tự JSON, index hay tên giống nhau.
4. **Không bịa.** Không tự bịa locator, assertion, mapping, hay data chạy.
5. **Approved testcase không chứa trạng thái automation.** Workspace mới là nơi lưu ghi / ghép / sinh / chạy.
6. **Một thời điểm một hành động chính** trên card và drawer.

---

## 9. Việc V3 chưa làm

- CodeGen vẫn cần tester thao tác trên Playwright Inspector rồi dán/lấy script — chưa tự đọc source khi recorder đóng.
- AI chưa tự đề xuất *chuỗi thao tác cho một testcase* (chỉ đề xuất *cách cắt bản ghi* ở CodeGen).
- Chưa compile thao tác thành hàm Playwright tái sử dụng (`async function addUnitType(...)`).
- Reports / chạy hàng loạt / CI chưa có trong UI.

---

## 10. Cách chạy

```bash
npm install
npm run build:web
npm start
```

Cấu hình Project dùng chung (tùy chọn) trong `.env` của server:

```env
PROJECT_REPOSITORY_TYPE=postgres
DATABASE_URL=postgresql://qa_copilot:your_password@192.168.1.20:5432/qa_copilot
DATABASE_SSL=false
HOST=0.0.0.0
PORT=3000
```

Không đưa mật khẩu database vào source control. Trình duyệt không cần biết `DATABASE_URL`.

---

## 11. Tài liệu liên quan

| Tài liệu | Vai trò |
|---|---|
| [README.md](../README.md) | Cách chạy và cấu hình Project |
| [Architecture.md](Architecture.md) | Kiến trúc pipeline AI Test Design (nền V2) |
| [V3_CODEGEN_OWNERSHIP_CORRECTION_DESIGN.md](V3_CODEGEN_OWNERSHIP_CORRECTION_DESIGN.md) | Thiết kế tách CodeGen / Thư viện / Automation |
| [V3_AUTOMATION_COMPOSITION_DESIGN.md](V3_AUTOMATION_COMPOSITION_DESIGN.md) | Mô hình Thao tác → Binding testcase |
| [DESIGN_ASSERTION_CONFIRMATION.md](DESIGN_ASSERTION_CONFIRMATION.md) | Tester xác nhận điều kiện kiểm tra |
| [V3_HANDOFF.md](V3_HANDOFF.md) | Nhật ký triển khai kỹ thuật (không phải tài liệu sản phẩm) |
