# WIREFRAME — P0 CODEGEN UX CONSOLIDATION (v3) — CHỜ DUYỆT, CHƯA CODE

> Branch: `arena/automation-record-by-testcase` · Ngày: 2026-08-10
> Vấn đề: CodeGen có HAI nơi xử lý Playwright recording (section 0 textarea + section 2 textarea) → feature stacking. Consolidation về MỘT main flow.

---

## A. CODEGEN PAGE — FULL WIREFRAME SAU CONSOLIDATION

```
┌──────────────────────────────────────────────────────────────────────┐
│ CODEGEN — Thu thập thao tác → Thư viện thao tác                      │
│ (không phụ thuộc Automation Workspace)                               │
│ ──────────────────────────────────────────────────────────────────── │
│                                                                      │
│ PLAYWRIGHT RECORDING                                                 │
│                                                                      │
│   [ Bắt đầu ghi ]   [ Dán bản ghi ]                                  │
│   URL: [ ... ]        Browser: [ chrome ▼ ]                          │
│                                                                      │
│   (MỘT nguồn canonical — Record hoặc Paste đều đổ vào đây)          │
│                                                                      │
│   Sau khi có recording:                                              │
│   Recording: 47 thao tác · 6 verification       [ Xem bản ghi ]      │
│                                                                      │
│ ──────────────────────────────────────────────────────────────────── │
│ PHÂN ĐOẠN THAO TÁC                                                   │
│                                                                      │
│   [ + Chọn đoạn thủ công ]     [ Phân tích bản ghi (sau này) ]       │
│                                                                      │
│   Các đoạn đang review:                                              │
│   1. Bước 1 → 8    Đăng nhập                                         │
│      Verification: adminButton visible                               │
│      [Chỉnh] [Xác nhận] [Bỏ]                                         │
│   2. Bước 9 → 12   Mở Đơn vị tính                                    │
│      [Chỉnh] [Xác nhận] [Bỏ]                                         │
│   ...                                                                 │
│                                                                      │
│ ──────────────────────────────────────────────────────────────────── │
│ CÁC THAO TÁC ĐÃ XÁC NHẬN                                             │
│                                                                      │
│   ✓ Đăng nhập                                                       │
│   ✓ Mở Đơn vị tính                                                   │
│   ✓ Tìm kiếm                                                         │
│   ✓ Sửa đơn vị tính                                                  │
│                                                                      │
│   [ Lưu vào Thư viện thao tác ]                                      │
│                                                                      │
│ ──────────────────────────────────────────────────────────────────── │
│ CÔNG CỤ NÂNG CAO (secondary — tách khỏi main flow)                   │
│   [ Chạy thử bản ghi ]    [ Lưu file ]   (đối chiếu testcase: legacy)│
└──────────────────────────────────────────────────────────────────────┘
```

- **MỘT textarea/input Playwright duy nhất** — không 2 textarea.
- Record từ Inspector và Paste thủ công **đều đổ vào cùng canonical recording** (RecordingStore).
- Primary mỗi khu vực chỉ 1 nút; nút compact (thống nhất `v3-btn--mini`).
- Không expose ActionBlock/Binding/RecordingSession.

---

## B. LEGACY CODEGEN — GIỮ / CHUYỂN / BỎ

| Phần cũ | Quyết định | Lý do |
|---|---|---|
| Bắt đầu ghi / Dừng ghi (section 1) | **GIỮ** → đưa vào Recording source (main flow) | Thuộc Recording Preparation |
| Dán script từ Inspector (section 2) | **GIỮ capability** → merge vào SAME Playwright Recording input; **bỏ textarea thứ hai** | Không 2 input cùng chức năng |
| Lưu file | **CHUYỂN** sang "Công cụ nâng cao" (secondary) | Utility, không trong main flow |
| Chạy thử | **CHUYỂN** sang "Chạy thử bản ghi" (secondary) | Debug recording — không giữa Recording→Library |
| Đối chiếu testcase | **BỎ khỏi main flow** → legacy section riêng (trace production use) | Không thuộc Recording Preparation |
| Section 0 (thu thập → thư viện) | **HẤP THỤ** làm main flow | Consolidation |

---

## C. DATA FLOW (E)

```
Record (Inspector)  OR  Paste
        │
        ▼
ONE canonical Recording (RecordingStore — KHÔNG gắn workspace bắt buộc)
        │
        ▼
Parse → steps + locators + verification/expect
        │
        ▼
CUT MANY (manual) — hoặc sau này [Phân tích bản ghi] (AI)
        │
        ▼
Confirmed Actions (review: Chỉnh / Xác nhận / Bỏ)
        │
        ▼
[Lưu vào Thư viện thao tác] → ActionLibrary (shared, data/action-library.json)
```

---

## D. CODEGEN KHÔNG CẦN ACTIVE AUTOMATION WORKSPACE (F) — IMPACT

**Trace (đã chạy):**
- `startRecording` → `ensureWorkspace(workspaceId)` + `rec.workspaceId === workspaceId` check
- `createBlock` → `ensureWorkspace(workspaceId)` + check `rec.workspaceId === workspaceId`
- `ActionLibrary` → **độc lập hoàn toàn** (không workspace)

**Correction tối thiểu (đề xuất, chưa code):**
1. Cho phép recording `workspaceId = null` (Codegen authoring không gắn workspace) — sửa `startRecording/stopRecording` bỏ `ensureWorkspace` khi `workspaceId` null; `createBlock` bỏ check `rec.workspaceId === workspaceId` khi null.
2. `createBlock` cho phép `workspaceId = null` → tạo block **trực tiếp vào ActionLibrary** (scope REUSABLE, label bắt buộc) — KHÔNG cần workspace. (Compatibility: workspace vẫn dùng createBlock cũ.)
3. Codegen gọi API **không workspace** (hoặc workspace null) → không cần active Automation Workspace.
4. **KHÔNG tạo hidden/fake workspace.**

**Files dự kiến (nếu duyệt):** `AutomationWorkspaceApplicationService` (startRecording/createBlock null-workspace), `CurrentRecordingSession` (workspaceId null), routes (cho phép null), `CodeGenPage` (consolidate UI), `V3RecordingPreparationPanel` (workspaceId optional), tests.

---

## E. AUTOMATION WORKSPACE (giữ nguyên v2)

```
THAO TÁC SẼ CHẠY
1. Login
2. Open Unit Type
3. Search
4. Edit
5. Search

[+ Thêm thao tác từ thư viện]      ← primary (compact)

Không có thao tác phù hợp?
[Tạo thao tác mới từ bản ghi]      ← secondary (reuse RecordingPreparation, không thành owner chính)
```

---

## F. CHỜ DUYỆT

- Wireframe A–D ở trên. **CHƯA CODE.** Sau duyệt: implement consolidation (1 input, sections hợp nhất, Advanced Tools tách, null-workspace cho Codegen), regression + build + push + DỪNG.
