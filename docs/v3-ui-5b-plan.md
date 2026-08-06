# Bước 5B — Ghi testcase + Review Recording (V3)

> Trạng thái: **DUYỆT** (đã chỉnh 4 điểm) — Wireframe: `docs/v3-ui-5b-wireframe.html`.
> Branch `arena/automation-record-by-testcase` @ `d74147f`.

## Phạm vi (Bước 5B)
- Ghi đúng testcase đang chọn; banner ghi cố định.
- Dừng ghi, cập nhật card tại chỗ.
- Review mở theo Drawer khi tester chủ động bấm "Xem và duyệt".
- Tab Recording: danh sách bước gọn.
- Approve / Reject / Ghi lại recording.
- **Chưa làm:** Generate, Run, AI assertion confirmation.

## 4 điểm đã chỉnh theo duyệt
1. **Menu "…" chỉ xuất hiện khi card có recording**: `REVIEW_REQUIRED` / `APPROVED`. Không menu ở `SELECTED` / `RECORDING`.
2. **Drawer 5B chỉ 2 tab**: Thông tin · Recording. KHÔNG tab Dữ liệu (chưa chỉnh/lưu dữ liệu ở 5B).
3. **list recordings chỉ trả metadata/summary** `{recordingId, version, status, summary:{actionCount, assertionCount, duration}}`. Source chỉ tải khi tester bấm "Xem mã" qua `GET /recordings/:recordingId/source`.
4. **Xóa recording có xác nhận gọn**; backend từ chối xóa khi APPROVED / đã GENERATED (validate state).

## UI contract
1. Mỗi card một primary action: SELECTED→"Ghi testcase", RECORDING→"Dừng ghi", REVIEW_REQUIRED→"Xem và duyệt", APPROVED→badge "Đã duyệt" (không Generate).
2. Banner ghi cố định: "Đang ghi TCxxx — tên" · không cho ghi testcase khác.
3. Tick checkbox / record xong KHÔNG mở Drawer. Tester chủ động mở.
4. Drawer: header `TCxxx · tên [×]`; tabs Thông tin / Recording; footer cố định `[Đóng][Duyệt recording]`. Không action ở đầu. Không Generate/Run.
5. Tab Recording: trạng thái, version, số bước, số assertion, thời gian, danh sách step theo thứ tự, "Xem mã" (tải source riêng khi chủ động).
6. Menu "…" (chỉ REVIEW_REQUIRED/APPROVED): Ghi lại, Xóa recording, Từ chối recording.
7. Approve gọi API → lưu approvedBy/approvedAt/hash → card chuyển "Đã duyệt".
8. Không hiển thị: RecordingSession, hash, sourceRange, IR, parser, guard, fallback.

## Component map (dự kiến)
| Component | Vai trò |
|---|---|
| `AutomationV3Page.jsx` | Thêm state recording active + banner + mở Drawer |
| `V3TestCaseCard.jsx` | Primary action đổi theo trạng thái + menu "…" |
| `V3RecordingBanner.jsx` | Banner "Đang ghi TCxxx" cố định |
| `V3ReviewDrawer.jsx` | Drawer Review (3 tabs + footer) |
| `V3RecordingTab.jsx` | Tab Recording (stat + step list + "Xem mã") |
| `V3ActionBar.jsx` | Giữ nguyên / khớp trạng thái |
| `api/automationV3Api.js` | Thêm start/stop/approve/reject/(delete) |
| `styles/automationV3.css` | Thêm banner/drawer/tabs/menu/steps |

## API
Có sẵn (Bước 4): `POST /recordings/start` · `POST /recordings/stop` · `POST /recordings/:id/approve` · `POST /recordings/:id/reject` · `GET /testcases/:tcId/recordings`

Bổ sung (5B):
- `GET /recordings/:recordingId` — chi tiết (steps/assertions sanitize, KHÔNG source)
- `GET /recordings/:recordingId/source` — source, chỉ tải khi "Xem mã"
- `DELETE /recordings/:recordingId` — xóa, từ chối khi APPROVED / GENERATED
- `listRecordings` → chỉ metadata/summary (không steps/source)

## Test bắt buộc
1. Chỉ testcase đã chọn mới ghi được.
2. Một workspace chỉ một recording active.
3. Banner đúng testCaseId.
4. Dừng ghi giữ đúng testCaseId.
5. Record xong không tự mở Drawer.
6. Approve cập nhật card ngay.
7. Mỗi card chỉ một primary action.
8. Drawer không Generate/Run.
9. Layout không vỡ.
10. Web build + backend regression PASS.

Chỉ sau khi wireframe được duyệt mới code.
