# Automation Mapping Layer — Kiến trúc & Báo cáo Sprint

Sprint mục tiêu duy nhất: **Automation Mapping Layer**. KHÔNG mở rộng Generator/Runner, KHÔNG sinh Playwright mới, KHÔNG tạo Demo App, KHÔNG sửa Web UI (chỉ CLI + model).

## 1. Luồng dữ liệu (phạm vi sprint)

```
approved-testcases.json
        │  (chỉ đọc, không sửa ngược)
        ▼
┌─────────────────────────────────────────────┐
│ Automation Discovery                        │
│  · thu thập evidence từ nhiều nguồn         │
│  · AI Proposal => DRAFT (bắt buộc)          │
└─────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────┐
│ Automation Mapping (Draft)                  │
│  · CHỈ dựng từ evidence APPROVED            │
│  · thiếu gì ghi missingEvidence             │
└─────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────┐
│ Automation Review                           │
│  · Tester Approve / Reject / Edit từng      │
│    evidence                                 │
└─────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────┐
│ Approved Automation Mapping (state=APPROVED)│
└─────────────────────────────────────────────┘
        ▼
Readiness (READY / PARTIAL / BLOCKED)  <- đánh giá TRÊN mapping đã review
        │
        ▼ (Sprint sau)
Playwright Generator  ->  Execution  ->  Execution Report
```

## 2. Mô hình (models) — mới

| Model | File | Trách nhiệm |
|---|---|---|
| Evidence Source | `evidence/EvidenceSource.js` | Enum nguồn + `isTrustedSource`/`isProposalSource` |
| Evidence State | `evidence/EvidenceState.js` | DRAFT/APPROVED/REJECTED/EDITED |
| Automation Evidence | `evidence/AutomationEvidence.js` | Một mẩu bằng chứng (trace: source/proposedBy/reviewedBy/reviewedAt) |
| Automation Discovery | `evidence/AutomationDiscovery.js` | Kết quả thu thập; evidence chia theo nguồn, KHÔNG trộn |
| Discovery Service | `discovery/DiscoveryService.js` | Thu thập evidence từ testcase (AI proposal = DRAFT) |
| Mapping State | `mapping/MappingState.js` | DRAFT/WAITING_FOR_REVIEW/APPROVED/REJECTED/NEEDS_REVISION |
| Automation Mapping | `mapping/AutomationMapping.js` | Mapping (route/actions/assertions/locators/data + missingEvidence) |
| Approved Automation Mapping | `mapping/ApprovedAutomationMapping.js` | Mapping đã duyệt (state khóa APPROVED) |
| Mapping Builder | `mapping/MappingBuilder.js` | Dựng mapping CHỈ từ evidence APPROVED |
| Readiness Evaluator | `mapping/ReadinessEvaluator.js` | READY/PARTIAL/BLOCKED nghiêm ngặt |
| Automation Review | `review/AutomationReview.js` | Mô hình review (Approve/Reject/Edit) |
| Review Service | `review/ReviewService.js` | Áp quyết định; không auto-approve |
| Review Workflow | `ReviewWorkflow.js` | Điều phối Discovery→Mapping→Review→Approved→Readiness |

## 3. Nguyên tắc bất biến

- **Mọi AI Proposal chỉ ở DRAFT.** Không có code nào tự chuyển AI proposal sang APPROVED.
  (`ReviewService` chỉ đổi trạng thái khi có quyết định tường minh của tester.)
- **Mapping được dựng CHỈ từ evidence APPROVED/EDITED** (`MappingBuilder`).
- **Readiness chỉ đánh giá trên mapping đã review**, không dựa trên demo data / AI proposal /
  route suy luận / assertion suy luận / demo app.
- **Generator không tự suy luận** — chỉ đọc Approved Automation Mapping. Sprint này
  không sinh Playwright; mapping vẫn có shape tương thích generator để cắm sau.

## 4. Quy tắc Readiness

| Tình huống | Kết quả |
|---|---|
| Thiếu route APPROVED | BLOCKED (`ROUTE_MISSING`) |
| Action không nhận diện | BLOCKED (`ACTION_UNMAPPED`) |
| Thiếu locator cho action chính (fill/select/click/check/press) | BLOCKED (`LOCATOR_MISSING`) |
| Thiếu assertion locator | BLOCKED (`ASSERTION_LOCATOR_MISSING`) |
| Đủ hết nhưng thiếu test data (fill/select) | PARTIAL (`MISSING_DATA`) |
| Đủ tất cả | READY |

## 5. Demo (CLI)

```bash
# Discovery + Draft mapping (không review)
node src/automation/cli-mapping.js --module "Thiết bị" --testcase TC001

# Discovery + Review + Approved mapping + Readiness
node src/automation/cli-mapping.js --module "Thiết bị" --testcase TC001 \
    --decisions tests/fixtures/review-decisions-TC001.json

# Test
npm run test:mapping
```

Ví dụ đầu ra TC001: Discovery trả 9 AI proposal đều DRAFT + 1 confirmed facts;
Draft mapping = BLOCKED; sau review (tester approve/edit route, locator, data) →
Approved mapping READY.

## 6. Kết quả

- 10/10 mapping-layer tests pass; 9/9 automation (pipeline cũ) vẫn pass.
- KHÔNG thay đổi hành vi Generator/Runner; KHÔNG sinh Playwright; KHÔNG Demo App mới;
  KHÔNG sửa Web UI.

## 7. Việc để Sprint sau

- Cắm Playwright Generator đọc Approved Automation Mapping.
- Thêm nguồn discovery khác: Playwright Codegen, Page Objects, Existing Automation, DOM Discovery.
- Automation Review qua Web UI.
- Runner + Execution Report.
