# Web UI Sprint 1 — Step 1.3 AI Analysis Review

## 1. Goal

Provide an interactive React workspace for the existing AI Analysis Review gate:

- read sanitized analysis and clarification data;
- save clarification answers through the production per-question action;
- update the supported analysis purpose without losing hidden artifact fields;
- approve only when the public contract allows it;
- keep resume as a separate explicit tester action;
- move to TestCase Review only after the backend confirms the transition.

No generator, TestCase Review gate, approved artifact, exporter, workflow
transition, provider, or AI prompt was changed.

## 2. Existing Backend Review Contract

The audit found that the legacy `current-review` endpoint returns a raw artifact,
including `references.requirementFile`. It is retained for backward
compatibility but is not used by the React UI.

The existing domain already supported reading the current artifact, answering
one question, editing a pending artifact, approving the current stage, and
resuming the workflow. A narrow public review adapter was added over those
capabilities.

| Operation          | Method | Path                                                    | Request                                 | Response                                        | Required Status                          |
| ------------------ | ------ | ------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Read public review | GET    | `/api/workflows/:workflowId/ai-analysis-review`         | none                                    | Public AI Analysis Review DTO                   | AI Analysis Review exists                |
| Save one answer    | POST   | `/api/workflows/:workflowId/clarifications/:questionId` | `{ answer, answeredBy }`                | Existing normalized action response             | Pending AI Analysis Review               |
| Update analysis    | PUT    | `/api/workflows/:workflowId/ai-analysis-review`         | `{ artifactId, analysis: { purpose } }` | Public AI Analysis Review DTO                   | Pending AI Analysis Review               |
| Approve            | POST   | `/api/workflows/:workflowId/approve`                    | `{ artifactId, approvedBy }`            | Existing stage approval response                | All questions answered; artifact pending |
| Resume             | POST   | `/api/workflows/:workflowId/resume`                     | none                                    | Application result with new public workflow DTO | Review approved and session completed    |

Clarification save is per-question, not batch. Approval completes the review
session but does not generate testcases. The public workflow then exposes
`RESUME_WORKFLOW`; the tester must explicitly invoke resume.

There is no draft-only API separate from the pending review artifact. Analysis
editing persists directly to the pending artifact. Revision/concurrency
protection is not implemented by the backend.

## 3. Public Review DTO

The new public DTO contains only sanitized review data:

```text
workflowId
artifactId
status
step
approvalStatus
analysis
  module
  purpose
  functions
  risks
  requirementComplete
  source
clarifications
  id
  category
  priority
  question
  reason
  required
  options
  answer
  status
  answeredAt
  answeredBy
summary
allowedActions
revision
```

`functions` preserves only fields that exist in the AI result:
`name`, `description`, `businessRules`, `validationRules`, `permissions`,
`dependencies`, `assumptions`, and `requirementReferences`.

The DTO does not expose raw artifact objects, workflow context, provider
configuration, filesystem paths, requirement file references, or internal
pipeline status.

All current clarification questions are required because the existing backend
gate requires every stored question to be answered before approval. Status is
normalized to `ANSWERED` or `UNANSWERED`.

## 4. Clarification Form

- Initializes from the public review DTO.
- Preserves answers returned by the backend.
- Supports text entry and existing option shortcuts.
- Trims answers before submission.
- Saves only changed, non-empty answers.
- Uses the existing per-question endpoint sequentially.
- Does not autosave.
- Does not approve after saving.
- Retains local form data on a failed save.
- Refetches review, workflow detail, and listing after successful save.

Whitespace-only required answers remain blocking. Unknown question status is
treated as invalid and cannot enable approval.

## 5. Analysis Editing

The existing generic artifact edit capability could update an AI Analysis
Review, but sending a partial artifact would have discarded hidden fields. A
narrow application adapter now safely merges the supported public field:

- `analysis.purpose`

The backend preserves the requirement, questions, references, AI metadata, and
all other artifact fields. Purpose must be a meaningful string. Module,
functions, rules, permissions, and risks are shown read-only because this sprint
does not introduce a larger edit DTO.

## 6. Approval Flow

The Approve button is enabled only when:

- public `allowedActions` contains `APPROVE_AI_ANALYSIS`;
- required answers are valid and saved;
- analysis has no unsaved purpose change;
- no mutation is pending.

The tester must confirm:

```text
Xác nhận dùng kết quả đã review để tiếp tục sinh testcase?
```

Approval calls only the production approve action. It does not resume. After
approval, the UI refetches server state and displays a separate “Tiếp tục sinh
testcase” button only when public `allowedActions` contains `RESUME_WORKFLOW`.
That explicit action calls resume and navigates to the new public workflow ID
returned by the backend.

Observed transition:

```text
AI_ANALYSIS_REVIEW_REQUIRED / AI_ANALYSIS_REVIEW
→ approval, still AI_ANALYSIS_REVIEW_REQUIRED with RESUME_WORKFLOW
→ explicit resume
→ TEST_CASE_REVIEW_REQUIRED / TEST_CASE_REVIEW
```

## 7. Gate Protection

- Backend rejected approval before the required question was answered with HTTP 409.
- Public allowed actions omitted approval while a question remained.
- Frontend displayed the blocking count and disabled approval.
- Saving an answer did not approve or resume.
- Approval did not resume or generate automatically.
- Resume became available only after server-confirmed approval.
- TestCase Review was not skipped.

## 8. Query and Mutation Strategy

Query keys:

```text
["workflow", workflowId]
["workflow", workflowId, "ai-analysis-review"]
["workflows"]
```

Successful answer, analysis, approval, and resume actions invalidate public
server state. The frontend does not fabricate status transitions or revision
values. Approval conflict also triggers a refetch so another-tab changes become
visible.

## 9. Error Handling

The workspace distinguishes public API errors by message, code, and status:

- workflow/review not found;
- invalid clarification answer;
- missing required answers;
- invalid review type/status;
- action conflict;
- backend unavailable;
- malformed public review response;
- general server error.

HTTP 409 tells the user that review state changed and refreshes server state.
The UI never renders stack traces, raw artifacts, filesystem paths, provider
errors, raw HTML, or secrets.

## 10. Accessibility

- Every textarea has an associated label.
- Required status is communicated as text.
- Field errors use `aria-describedby`.
- Mutation and success messages use live-region semantics.
- Invalid approval focuses an error summary.
- Confirmation uses the native accessible `window.confirm`.
- Options, save, approve, and resume are semantic buttons.
- Status chips are not used as action controls.

## 11. Files Created

- `src/web/dtos/PublicAIAnalysisReviewDto.js`
- `src/web/mappers/PublicAIAnalysisReviewMapper.js`
- `web-ui/src/components/ClarificationQuestionCard.jsx`
- `web-ui/src/hooks/useAIAnalysisReview.js`
- `web-ui/src/utils/aiAnalysisReview.js`
- `web-ui/scripts/validate-ai-analysis-review.mjs`
- `tests/ai-analysis-review-http-test.js`
- `docs/web-ui-sprint-1-step-1.3-ai-analysis-review.md`

## 12. Files Modified

- `src/controllers/QACopilotController.js`
- `src/routes/workflowRoutes.js`
- `src/services/QACopilotApplicationService.js`
- `web-ui/package.json`
- `web-ui/src/api/apiClient.js`
- `web-ui/src/api/workflowApi.js`
- `web-ui/src/components/AIAnalysisReviewPanel.jsx`
- `web-ui/src/styles/global.css`

Backend modifications are limited to the HTTP/application adapter and public
DTO mapping. No backend business logic or workflow transition changed.

## 13. Commands Run

```powershell
cd web-ui
npm run validate:new-workflow
npm run validate:ai-analysis-review
npm run build

cd ..
node tests/ai-analysis-review-http-test.js
node tests/new-workflow-upload-http-smoke-test.js
node tests/workflow-listing-http-test.js
node tests/web-ui-production-http-contract-test.js
node tests/human-review-workspace-test.js
npm test
```

Main import, Prettier, and `git diff --check` validations were also run.

## 14. Frontend Validation Result

PASS.

The focused script verifies:

- required unanswered is blocking;
- whitespace-only answer is blocking;
- optional unanswered does not block;
- all required answered can pass UI validation;
- missing public approve action blocks approval;
- unknown question status is handled safely;
- changed clarification payload is trimmed and correctly shaped;
- malformed review response is rejected.

## 15. HTTP Review Test Result

PASS.

The test uses the real Express route, controller, application service, review
gate, repositories, core generation path, and public mapper with temporary
storage and a deterministic provider.

Confirmed:

- sanitized review read;
- no filesystem path or raw internal object;
- premature approval rejected;
- answer persisted and summary updated;
- analysis purpose edit persisted without losing questions;
- approval succeeded after answers;
- approved state exposed `RESUME_WORKFLOW`;
- explicit resume advanced to `TEST_CASE_REVIEW`;
- provider called exactly once;
- no Gemini/network or production output.

## 16. Regression Result

- New Workflow frontend validation: PASS
- AI Analysis Review frontend validation: PASS
- Frontend production build: PASS
- New Workflow upload smoke: PASS
- Workflow listing HTTP test: PASS
- Web UI production HTTP contract: PASS
- Human Review Workspace: PASS
- `npm test`: PASS

## 17. Remaining Gaps

- Analysis editing is intentionally limited to purpose; structured function/rule
  editing needs a dedicated validated patch contract.
- Clarification save is per-question because no batch endpoint exists.
- There is no separate draft store.
- There is no real revision or optimistic concurrency contract.
- Public source metadata is shown only when the AI result provides it.
- TestCase Review UI remains out of scope.
- React production build serving remains deferred.

## 18. Final Result

PASS.

The React workspace now completes the real AI Analysis Review interaction while
preserving the backend gate: answers, analysis edit, approval, and resume are
explicit operations driven by public server state.
