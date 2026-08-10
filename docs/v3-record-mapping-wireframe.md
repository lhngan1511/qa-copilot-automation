# WIREFRAME (TEXT) — Recording Timeline + Segment Mapping (V3)

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Chờ **người dùng duyệt** trước khi code. Thiết kế theo `docs/DESIGN_RECORD_MAPPING.md`.
> Ngôn ngữ UI dùng cho tester (theo `UIUX_CONTRACT_RECORD_BY_TESTCASE.md` — không hiển thị thuật ngữ kỹ thuật):
> "Bản ghi" = Recording Session · "Đoạn thao tác" = Segment · "Dùng chung" = SETUP · "Gán cho testcase" = Mapping.

---

## A. MÀN HÌNH "GẮN BẢN GHI TESTCASE" — Timeline + Gán đoạn

Thay cho panel "Dán mã Playwright đã ghi cho TCxxx" hiện tại (giữ khả năng dán source). Mở khi tester chọn "Ghi testcase" / "Gắn bản ghi testcase".

```
┌────────────────────────────────────────────────────────────────────────┐
│ Gắn bản ghi testcase                          Bản ghi #01 · 10 bước · 2 đoạn│
│ [ Ghi mới ]   [ Dán mã Playwright ]                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Các bước đã ghi (theo thứ tự thao tác)                                │
│                                                                        │
│  [1] Mở trang /login                                                   │
│  [2] Nhập tên đăng nhập                                                │
│  [3] Nhập mật khẩu                                                     │
│  [4] Bấm nút "Đăng nhập"                                               │
│  [5] Bấm "Trang thiết bị"                                              │
│  [6] Bấm "Thêm"  ◄──────────────────────┐                              │
│  [7] Nhập "Tên thiết bị"                │ Đoạn đang chọn               │
│  [8] Bấm "Lưu"      ◄───────────────────┘ (bước 6 → 8, 3 bước)         │
│  [9] Bấm "Sửa"                                                         │
│ [10] Nhập "Tên thiết bị" (sửa)                                         │
│                                                                        │
│  Cách chọn: bấm bước bắt đầu → bấm bước kết thúc (hoặc chọn bằng ô)    │
│  [ Bỏ chọn ]                                                           │
├────────────────────────────────────────────────────────────────────────┤
│  Đoạn thao tác mới                                                     │
│                                                                        │
│  Loại:                                                                 │
│    ( ) Dùng chung (đăng nhập, di chuyển đến màn hình chức năng)        │
│    (•) Testcase                                                       │
│                                                                        │
│  Testcase:   [ TC025 - Thêm trang thiết bị                    ▼ ]      │
│              (gõ để tìm theo tên / bước thực hiện — KHÔNG tự chọn sẵn) │
│                                                                        │
│                                               [ Xác nhận đoạn ]        │
└────────────────────────────────────────────────────────────────────────┘
```

### Ghi chú tương tác (A)

1. **Một primary action duy nhất:** `[Xác nhận đoạn]`. Các thao tác phụ (bỏ chọn, sửa, xóa) đặt dạng link/menu nhỏ — không hàng loạt nút lớn.
2. Chọn khoảng: click bước đầu + bước cuối; range được **highlight** kèm thanh thông tin "bước 6 → 8, 3 bước".
3. Nếu `Loại = Testcase`: bắt buộc chọn testcase. Dropdown có ô tìm; **không preselect** dù text/locator trùng (chỉ dùng text để tìm kiếm — theo nguyên tắc "không AI mapping").
4. Nếu `Loại = Dùng chung`: không cần chọn testcase. Có thể có nhiều đoạn Dùng chung trong 1 bản ghi.
5. Bước **chưa thuộc đoạn nào**: hiển thị bình thường nhưng có dấu chấm trống; khi xác nhận hết, dòng thông tin cập nhật "0 bước chưa gán".
6. Sau khi xác nhận, đoạn hiện ngay ở khu vực "Các đoạn đã gán" bên dưới (xem B).

---

## B. KHU VỰC "CÁC ĐOẠN ĐÃ GÁN" (Review Mapping) — trong cùng màn hình / drawer

```
┌────────────────────────────────────────────────────────────────────────┐
│ Các đoạn đã gán — Bản ghi #01                                          │
│                                                                        │
│  ⚙ Dùng chung (Setup)          bước 1 → 5     [Sửa] [Xóa]              │
│  ✔ TC025 - Thêm trang thiết bị  bước 6 → 8     [Sửa] [Xóa]              │
│  ✔ TC026 - Sửa trang thiết bị   bước 9 → 10    [Sửa] [Xóa]              │
│                                                                        │
│  ⚠ 0 bước chưa thuộc đoạn nào                                          │
│                                                                        │
│  Testcase có nhiều đoạn (thứ tự quyết định spec sinh ra):              │
│  TC030 - Xóa trang thiết bị                                            │
│    [1] Đoạn bước 11 → 13 (Bản ghi #01)   ↕ [Sửa] [Xóa]                  │
│    [2] Đoạn bước 2 → 4  (Bản ghi #02)    ↕ [Sửa] [Xóa]                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Ghi chú tương tác (B)

1. Mỗi dòng đoạn: hiển thị rõ **testcase nào ← dùng đoạn nào (khoảng bước)** — đúng yêu cầu "nhìn được testcase nào đang dùng segment nào".
2. `[Sửa]` mở lại chọn khoảng/loại/testcase (giữ nguyên lịch sử thao tác; khi sửa range → đoạn quay lại `DRAFT` chờ xác nhận lại).
3. `[Xóa]` hỏi xác nhận; xóa đoạn → các bước của nó trở lại "chưa gán".
4. **Sắp xếp nhiều đoạn của 1 testcase:** kéo thả (hoặc nút ↑/↓); thứ tự hiển thị = thứ tự sinh spec.
5. Dòng "0 bước chưa thuộc đoạn nào" đổi màu cảnh báo (vàng) khi còn bước chưa gán: "⚠ 3 bước chưa thuộc đoạn nào — các bước này sẽ không xuất hiện trong test sinh ra."

---

## C. CARD TESTCASE TRONG WORKSPACE (cập nhật trạng thái mapping)

```
┌──────────────────────────────────────────────────────────────┐
│ TC025 — Thêm trang thiết bị     · Trang thiết bị              │
│ Thao tác: Đã gán 1 đoạn (Bản ghi #01)                        │
│ Trạng thái: Sẽ tự động hóa                                    │
│ [ Xem bản ghi ]   [ Sinh automation ]                        │
├──────────────────────────────────────────────────────────────┤
│ TC099 — Xóa trang thiết bị      · Trang thiết bị              │
│ Thao tác: Chưa gán đoạn nào                                   │
│ Trạng thái: Chưa quyết định                                   │
│ [ Ghi testcase ]                                             │
└──────────────────────────────────────────────────────────────┘
```

- Trạng thái automation hiển thị trên card: `Chỉ thao tác tay` (Manual only) / `Chưa quyết định` / `Sẽ tự động hóa` (Automation candidate) / `Đã tự động hóa` (Automated).
- Testcase chưa gán đoạn → KHÔNG phải lỗi, chỉ hiển thị trạng thái "Chưa quyết định" / "Chỉ thao tác tay"; nút chính là `[Ghi testcase]`.
- `[Sinh automation]` chỉ bật khi mapping hợp lệ (đã gán + xác nhận + đủ dữ liệu).

---

## D. THÔNG BÁO CHẶN GENERATE (khi bấm Sinh automation mà thiếu)

```
⛔ Không thể sinh automation cho TC099:

   ● Chưa có bản ghi thao tác cho testcase này.
     → Hãy ghi (hoặc gắn) bản ghi và gán đoạn thao tác cho TC099.

   ● Bản ghi thao tác chưa được xác nhận.
     → Hãy xác nhận các đoạn đang ở trạng thái nháp.

   ● Chưa xác định đầy đủ đoạn thao tác cho testcase.
     → Hãy kiểm tra lại các đoạn đã gán (thiếu/sai khoảng bước).

   [ Đóng ]
```

Chỉ 1 trong 3 thông báo hiển thị tùy tình huống. **Không có** lựa chọn "tự tìm/gán giúp" — không fallback, không đoán.

---

## E. Điều CHƯA làm trong bước này

- Chưa có Expected Result → Assertion (Bước 5C) — làm sau khi wireframe này được duyệt.
- Chưa có AI hỗ trợ bất kỳ phần nào của mapping (đúng nguyên tắc đóng băng).
- Chưa tích hợp Playwright Recorder thật (backlog `RECORDER_INTEGRATION`) — vẫn "Ghi mới" (spawn thật sau này) hoặc "Dán mã Playwright".

---

## F. Câu hỏi chờ người dùng quyết định khi review

1. Gán đoạn ngay trong màn hình "Gắn bản ghi" (như A+B gộp) hay tách thành 2 bước riêng (Gắn source → Gán đoạn)?
2. Khi **sửa** range của đoạn đã CONFIRMED: tự quay về DRAFT chờ xác nhận lại — đồng ý?
3. Sắp xếp nhiều đoạn: cần kéo-thả chuột hay nút ↑/↓ là đủ cho lần đầu?
4. Trạng thái "Chưa quyết định" có cần nút "Đánh dấu chỉ thao tác tay" để tester chủ động loại testcase khỏi automation không?
