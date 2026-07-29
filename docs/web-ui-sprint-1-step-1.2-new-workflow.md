# Web UI Sprint 1 — Step 1.2 New Workflow

## 1. Goal

Add a production-contract New Workflow flow to the React application:

1. select and validate a Markdown requirement;
2. upload it through the existing upload endpoint;
3. start the workflow through the existing workflow endpoint;
4. invalidate the workflow listing;
5. navigate to the public workflow detail;
6. stop at the existing AI Analysis Review gate without approving or resuming.

No backend business logic, workflow transition, review gate, generator, approved
artifact, exporter, legacy UI, or production static serving was changed.

## 2. Existing Upload Contract

Audit confirmed that the backend does **not** use multipart/FormData. It accepts
the Markdown file as the raw request body. The frontend follows this actual
contract instead of creating a parallel multipart contract.

| Method | Path                       | Content Type       | Fields                                  | Success Response                                                                        | Errors                                                                                                                |
| ------ | -------------------------- | ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/requirements/upload` | `text/markdown`    | Header `x-file-name`; raw Markdown body | HTTP 201, `{ success, data: { originalName, storedName, requirementId, size }, error }` | `FILE_NAME_REQUIRED` 400, `EMPTY_UPLOAD` 400, `UPLOAD_TOO_LARGE` 413, `INVALID_FILE_TYPE` 415, upload path validation |
| POST   | `/api/workflows`           | `application/json` | `{ requirementId }`                     | HTTP 201, application result with `workflow` public DTO                                 | Normalized application validation/conflict/server errors                                                              |

The upload endpoint only stores the requirement and returns an opaque
`requirementId`. A second request starts analysis and creates the workflow.
Workflow name is not supported by the current backend start contract, so the UI
does not send one.

The start response contains the public workflow at `data.workflow`. The new UI
extracts the workflow ID only from `data.workflow.id`, not from deprecated
workflow context.

## 3. Frontend Flow

- Dashboard “New Workflow” links to `/workflows/new`.
- `NewWorkflowPage` accepts one Markdown file.
- `createWorkflow()` calls `uploadRequirement()` and then `startWorkflow()`.
- The submit button and file replacement are disabled while the mutation is
  pending.
- Failure retains the selected file and allows retry.
- Success invalidates the `["workflows"]` query.
- The page navigates to `/workflows/:workflowId`.
- The detail route performs its normal public `GET` request rather than relying
  on a manually seeded result.

No approve or resume endpoint is called.

## 4. File Validation

Frontend validation mirrors the backend limits:

- a file is required;
- the extension must be `.md`;
- accepted MIME values are `text/markdown`, an omitted browser MIME, or
  `text/plain` when the extension is `.md`;
- the file must contain at least one byte;
- maximum size is 2 MiB (`2 * 1024 * 1024`), matching
  `RequirementUploadService.maxBytes`.

The backend remains the final source of validation. The browser does not parse
or analyze requirement business content.

## 5. Mutation and Cache Strategy

`useCreateWorkflow()` uses TanStack Query `useMutation`.

- It calls the centralized API module only.
- Duplicate submit is blocked in both the event handler and pending UI state.
- On success it invalidates `["workflows"]`.
- No manually fabricated listing DTO is appended.
- The detail query is deliberately not seeded, ensuring navigation performs a
  fresh public workflow fetch.

## 6. Success Navigation

The workflow ID is extracted from the public response:

```text
response.data.workflow.id
```

Missing or malformed IDs produce `INVALID_WORKFLOW_RESPONSE`; navigation does
not occur. A valid ID navigates to:

```text
/workflows/:workflowId
```

The detail page continues to use `GET /api/workflows/:workflowId`.

## 7. AI Analysis Review Shell

When public status is `AI_ANALYSIS_REVIEW_REQUIRED` or public step is
`AI_ANALYSIS_REVIEW`, the read-only `AIAnalysisReviewPanel` displays:

- workflow status;
- clarification total, answered, and remaining;
- public allowed actions as non-interactive chips;
- a clear notice that the workflow is stopped at its review gate.

The public artifact DTO currently contains metadata only, so the panel does not
read deprecated `workflowContext`, raw repository data, or fabricate analysis
content. Approval and clarification editing remain deferred.

## 8. Error Handling

The form differentiates:

- missing file;
- invalid format;
- empty file;
- oversized file;
- backend unavailable;
- HTTP validation errors;
- HTTP 409 conflict;
- malformed upload/start response;
- general server errors.

The UI never renders a stack, filesystem path, raw HTML, requirement body, or
raw backend object. Failed requests retain the file and re-enable submit.

## 9. Accessibility

- Real labeled file input with `.md` and MIME accept hints.
- Drag-and-drop supplements, rather than replaces, the native keyboard file
  picker.
- Errors are linked through `aria-describedby`.
- Processing and selected-file state use live-region semantics.
- File removal, submit, cancel, and navigation use semantic buttons/links.
- Visible focus styling remains available.

## 10. Files Created

- `web-ui/src/pages/NewWorkflowPage.jsx`
- `web-ui/src/components/RequirementFilePicker.jsx`
- `web-ui/src/components/AIAnalysisReviewPanel.jsx`
- `web-ui/src/hooks/useCreateWorkflow.js`
- `web-ui/src/utils/requirementFileValidation.js`
- `web-ui/src/utils/workflowResponse.js`
- `web-ui/scripts/validate-new-workflow.mjs`
- `tests/new-workflow-upload-http-smoke-test.js`
- `docs/web-ui-sprint-1-step-1.2-new-workflow.md`

## 11. Files Modified

- `web-ui/package.json`
- `web-ui/src/api/apiClient.js`
- `web-ui/src/api/workflowApi.js`
- `web-ui/src/app/router.jsx`
- `web-ui/src/pages/DashboardPage.jsx`
- `web-ui/src/pages/WorkflowDetailPage.jsx`
- `web-ui/src/styles/global.css`

No backend production file was modified.

## 12. Commands Run

```powershell
cd web-ui
npm run validate:new-workflow
npm run build

cd ..
node tests/new-workflow-upload-http-smoke-test.js
node tests/workflow-listing-http-test.js
node tests/web-ui-production-http-contract-test.js
node tests/human-review-workspace-test.js
npm test
```

Final validation also includes main import checks, Prettier checks, and
`git diff --check`.

## 13. Frontend Build Result

PASS.

Vite 7.3.6 transformed 113 modules and produced the production bundle
successfully.

The focused Node validation passed:

- valid `.md`;
- invalid extension rejection;
- empty file rejection;
- file over 2 MiB rejection;
- public workflow ID extraction;
- malformed response rejection.

## 14. HTTP Smoke Result

PASS.

The smoke test:

- started the real Express app on an ephemeral loopback port;
- used temporary file repositories and outputs;
- injected the existing deterministic test provider;
- uploaded the existing Markdown fixture using the production raw-body
  contract;
- started a workflow through `POST /api/workflows`;
- confirmed a public workflow ID;
- confirmed detail returns `AI_ANALYSIS_REVIEW_REQUIRED` and
  `AI_ANALYSIS_REVIEW`;
- confirmed the listing contains the workflow;
- confirmed the provider was called exactly once;
- removed all temporary files;
- did not call Gemini or write production data.

## 15. Backend Regression Result

- Workflow listing HTTP test: PASS
- Web UI production HTTP contract test: PASS
- Human Review Workspace test: PASS
- `npm test` with the existing regression script: PASS

## 16. Remaining Gaps

- AI Analysis Review remains read-only.
- Clarification answering and analysis approval are not implemented.
- TestCase Review UI is not implemented.
- Workflow naming is unavailable because the backend start contract has no
  supported name field.
- The public detail DTO exposes artifact metadata but not full sanitized review
  content.
- React production build serving remains intentionally deferred.

## 17. Final Result

PASS.

New Workflow uses the real two-request production contract, navigates by the
public workflow ID, refreshes the dashboard cache, and displays the correct
read-only review state without changing backend business logic or bypassing any
review gate.
