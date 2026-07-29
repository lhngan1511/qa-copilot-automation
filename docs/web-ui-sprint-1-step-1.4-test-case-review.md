# Web UI Sprint 1 — Step 1.4 TestCase Review

## 1. Goal

Provide an interactive React workspace for the existing batch TestCase Review contract without changing workflow or gate semantics.

## 2. Existing Backend TestCase Review Contract

| Operation            | Method | Path                                                 | Request                      | Response                   | Required Status               |
| -------------------- | ------ | ---------------------------------------------------- | ---------------------------- | -------------------------- | ----------------------------- |
| Read public review   | GET    | `/api/workflows/:sessionId/test-case-review`         | None                         | Public TestCase Review DTO | TestCase artifact exists      |
| Replace review batch | PUT    | `/api/workflows/:sessionId/test-case-review`         | `{ artifactId, testCases }`  | Refetched public DTO       | Artifact pending              |
| Approve batch        | POST   | `/api/workflows/:sessionId/approve`                  | `{ artifactId, approvedBy }` | Approval result            | Artifact pending              |
| Continue/export      | POST   | `/api/workflows/:sessionId/resume`                   | None                         | Completed public workflow  | Review approved and completed |
| Download JSON/Excel  | GET    | `/api/workflows/:sessionId/outputs/:format/download` | None                         | File download              | Export exists                 |

The pre-existing generic artifact edit operation replaces the whole artifact. The new narrow adapter accepts a complete testcase batch and preserves hidden fields by merging each submitted testcase with the stored testcase having the same ID.

## 3. Public TestCase Review DTO

The DTO exposes workflow/artifact identity, public status and step, approval status, sanitized testcase fields, summary, public allowed actions, public export descriptors and revision. It excludes the raw artifact, workflow context, repositories, provider configuration and filesystem paths.

## 4. Workspace Layout

The workspace has a grouped navigation column and a form-based editor. Testcases are grouped deterministically by module, function/feature and type. Small screens use a single-column layout.

## 5. Batch Editing Contract

The UI keeps the complete batch in component state, preserves item order and sends the full batch. UI-only fields are removed before submission. Hidden production fields remain stored because the application adapter merges by existing testcase ID.

Removal is supported as omission from the submitted batch and is explicitly described as “remove from review,” not rejection. Adding is not enabled because the backend does not allocate an ID for a newly submitted testcase.

## 6. Test Data Readiness

Actual domain values are `READY` and `DATA_REQUIRED`. The server normalizes `testData` and recomputes readiness after batch save. The frontend never promotes readiness itself. Under the current Sprint 2.4 contract, `DATA_REQUIRED` does not block approval or export.

## 7. Approval Flow

Save and approval are separate actions. Approval is enabled only when the server exposes `APPROVE_TEST_CASES`, the batch is non-empty, no changes are unsaved and no mutation is pending. Confirmation clearly applies to the whole batch.

## 8. Export Flow

Approval does not auto-resume or auto-export. The server then exposes `RESUME_WORKFLOW`; a separate tester action completes the workflow and creates approved JSON and Excel. Downloads use public HTTP URLs only.

## 9. Gate Protection

The backend TestCase Review Gate remains authoritative. Resume before approval is rejected. An unknown/new testcase ID is rejected by the narrow batch adapter. Approved artifacts cannot be edited.

## 10. Query and Mutation Strategy

TanStack Query uses `["workflow", workflowId, "test-case-review"]`. Successful update, approval and resume invalidate the review, workflow detail and workflow list queries. No approved state or export is synthesized in cache.

## 11. Error Handling

Malformed DTOs, missing IDs, duplicate IDs, stale approval, invalid batches, unsupported additions, backend failures and unavailable exports are surfaced without raw objects, stack traces or paths. Draft state remains intact after save/approval errors.

## 12. Accessibility

The list uses navigation/list semantics, selection has `aria-current`, every input is labelled, readiness includes an accessible label, status changes use a live region, and destructive/batch approval actions require confirmation.

## 13. Files Created

- `src/web/dtos/PublicTestCaseReviewDto.js`
- `src/web/mappers/PublicTestCaseReviewMapper.js`
- `web-ui/src/utils/testCaseReview.js`
- `web-ui/src/hooks/useTestCaseReview.js`
- `web-ui/src/components/TestDataReadinessBadge.jsx`
- `web-ui/src/components/TestCaseList.jsx`
- `web-ui/src/components/TestCaseEditor.jsx`
- `web-ui/src/components/TestCaseReviewPanel.jsx`
- `web-ui/scripts/validate-test-case-review.mjs`
- `tests/test-case-review-http-test.js`
- This document

## 14. Files Modified

- `src/services/QACopilotApplicationService.js`
- `src/controllers/QACopilotController.js`
- `src/routes/workflowRoutes.js`
- `web-ui/src/api/workflowApi.js`
- `web-ui/src/pages/WorkflowDetailPage.jsx`
- `web-ui/src/styles/global.css`
- `web-ui/package.json`

## 15. Commands Run

- `node tests/test-case-review-http-test.js`
- Required backend regression commands
- Required frontend validation/build commands
- Main import, Prettier and `git diff --check`

## 16. Frontend Validation Result

PASS. DTO parsing, grouping, hidden-field preservation, UI-field removal, allowed-action gating, unsaved-change blocking, `DATA_REQUIRED` behavior and malformed response rejection are covered.

## 17. HTTP Review Test Result

PASS. The test uses the real Express application with temporary repositories/output and a deterministic provider. It verifies public read, gate rejection, batch update, persistence, removal, server readiness, batch approval, explicit resume, approved JSON and JSON/Excel downloads.

## 18. Regression Result

All required focused and regression commands pass. No Gemini/network call is used by the new test.

## 19. Remaining Gaps

- Adding a manual testcase is unavailable because production has no safe ID allocation contract.
- No per-testcase rejection or approval exists.
- No optimistic concurrency/revision enforcement exists for concurrent batch edits.
- Tester data still uses whole-batch replacement rather than a narrow per-item patch.
- React production serving remains intentionally out of scope.

## 20. Final Result

**PASS WITH MINOR GAPS**
