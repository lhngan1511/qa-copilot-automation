# Web UI Sprint 0 — Step 0.2 Production HTTP Flow Contract

Execution date: 2026-07-29

# 1. Test Scope

`tests/web-ui-production-http-contract-test.js` locks the current production HTTP flow from Markdown upload through approved JSON/Excel export.

The test:

- starts the real Express application on an ephemeral loopback port;
- uses file repositories under a unique OS temporary directory;
- uploads a dedicated requirement fixture through HTTP;
- injects a deterministic AI provider into the real `AIAnalysisEngine`;
- calls the real HTTP routes, controller, application service, workflow runtime, generators, mapper, and exporters;
- verifies two active review gates cannot be bypassed;
- edits tester-approved data through the existing artifact HTTP contract;
- downloads JSON and Excel through HTTP;
- reloads the completed workflow and approved artifact;
- removes its temporary repository, upload, and output files after execution.

No Gemini call, API key, internet access, production output, or production repository is used.

# 2. Production Components Exercised

| Layer            | Components exercised                                               |
| ---------------- | ------------------------------------------------------------------ |
| Server           | `src/server/createApp.js`, Express listener created by the test    |
| Upload           | `RequirementUploadService`, `POST /api/requirements/upload`        |
| Routes           | `src/routes/workflowRoutes.js`                                     |
| Controller       | `QACopilotController`                                              |
| Application      | `QACopilotApplicationService`                                      |
| Pipeline         | `QACopilot.run()` production workflow                              |
| AI               | Real `AIAnalysisEngine` with an injected deterministic provider    |
| Review workflows | Clarification/AI Analysis Review and TestCase Review               |
| Persistence      | `FileArtifactRepository`, `FileWorkflowSessionRepository`          |
| Mapping          | `RequirementKnowledgeMapper`, `ApprovedTestCaseMapper`             |
| Generation       | Production core scenario/testcase generation and semantic resolver |
| Export           | `TestCaseOutputService`, `JsonExporter`, `ExcelExporter`           |
| Download         | Existing output manifest and secured download routes               |

`createApp()` is an importable factory and does not listen during import. No server bootstrap change was necessary.

# 3. HTTP Contract Observed

| Step                | Method | Path                                                   | Request Shape                        | Response Shape                                     | Status Transition                                  |
| ------------------- | ------ | ------------------------------------------------------ | ------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| Health              | GET    | `/health`                                              | none                                 | `{ success, data: { status }, error }`             | none                                               |
| Upload              | POST   | `/api/requirements/upload`                             | Markdown bytes; `x-file-name` header | stored upload metadata including `requirementFile` | none                                               |
| Start               | POST   | `/api/workflows`                                       | `{ requirementFile }`                | application result envelope                        | New → `AWAITING_AI_CLARIFICATION`                  |
| Load workflow       | GET    | `/api/workflows/:sessionId`                            | path ID                              | persisted workflow session                         | none                                               |
| Current review      | GET    | `/api/workflows/:sessionId/current-review`             | path ID                              | session/artifact review view                       | none                                               |
| Answer              | POST   | `/api/workflows/:sessionId/clarifications/:questionId` | `{ answer, answeredBy }`             | action + clarification status                      | remains awaiting review; question becomes answered |
| Edit analysis       | PUT    | `/api/workflows/:sessionId/artifacts/:artifactId`      | `{ artifact }`                       | saved pending artifact                             | no approval transition                             |
| Approve analysis    | POST   | `/api/workflows/:sessionId/approve`                    | `{ artifactId, approvedBy }`         | `STAGE_APPROVED` result                            | artifact approved; review session completed        |
| Generate core       | POST   | `/api/workflows/:sessionId/resume`                     | none                                 | application result                                 | → `AWAITING_TEST_CASE_REVIEW`                      |
| Output manifest     | GET    | `/api/workflows/:sessionId/outputs`                    | path ID                              | `{ sessionId, status, outputs }`                   | none                                               |
| Edit testcases      | PUT    | `/api/workflows/:sessionId/artifacts/:artifactId`      | complete pending artifact            | saved pending artifact                             | no approval transition                             |
| Approve testcases   | POST   | `/api/workflows/:sessionId/approve`                    | `{ artifactId, approvedBy }`         | `STAGE_APPROVED` result                            | artifact approved; review session completed        |
| Export              | POST   | `/api/workflows/:sessionId/resume`                     | none                                 | completed application result + output paths        | → `COMPLETED`                                      |
| Download JSON/Excel | GET    | `/api/workflows/:sessionId/outputs/:format/download`   | format path                          | file bytes                                         | none                                               |
| Reload              | GET    | `/api/workflows/:sessionId` and `/artifacts`           | path ID                              | persisted completed session/artifacts              | none                                               |

There is no separate “generate testcases” or “export” action endpoint. Under the actual contract, `resume` advances the production pipeline after the current review session has been approved and completed.

The production path has no independent Requirement Review gate. Requirement understanding, functions, rules, questions, and tester edits are approved together in `AI_ANALYSIS_REVIEW`.

# 4. Gate Protection Results

| Invalid Attempt                                      | Expected Rejection                   | Actual Result                                                                               | PASS/FAIL |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| Resume before answering/approving AI Analysis Review | HTTP conflict and unchanged pipeline | HTTP 409; meaningful approved/answered message; status remained `AWAITING_AI_CLARIFICATION` | PASS      |
| Approve AI Analysis before answering its question    | HTTP conflict                        | HTTP 409; message states all questions must be answered                                     | PASS      |
| Read outputs before TestCase approval                | Empty manifest                       | HTTP 200 with `outputs: {}`                                                                 | PASS      |
| Resume/export before TestCase approval               | HTTP conflict and no files           | HTTP 409; message requires approval; status remained `AWAITING_TEST_CASE_REVIEW`            | PASS      |

Error responses use `{ success: false, data: null, error: { code, message, details } }`. No stack trace was returned.

# 5. Approved Artifact Assertions

- The AI Analysis artifact began as `pending`.
- One structured clarification question was returned and answered through HTTP.
- A tester-edited analysis purpose was saved before approval.
- Core generation started only after the analysis artifact was approved and its workflow session completed.
- Production generated 4 core scenarios and 5 testcases.
- The generated set contained Positive and Validation/Data Integrity coverage.
- No Boundary testcase was generated because the fixture declares no numeric/length limit.
- Permission evidence was present in the fixture; generator behavior was not modified or forced.
- The TestCase Review artifact was edited while pending.
- A tester-edited testcase title survived approval, mapping, JSON export, and repository reload.
- The approved JSON contained exactly the 5 testcases in the approved batch.
- Every exported testcase retained canonical `testData.requirement`, `testData.value`, and `executionReadiness`.
- The AI draft purpose did not appear in exported testcase JSON.

Current production approval is batch-level. There is no per-testcase approval/rejection field or API, so this test cannot reject one testcase while approving the rest. A rejected whole `TEST_CASE_REVIEW` artifact cannot be exported, but selective rejection is a confirmed gap.

# 6. Export Assertions

| Assertion                                  | Result                              |
| ------------------------------------------ | ----------------------------------- |
| Export is blocked before TestCase approval | PASS                                |
| Approved JSON created                      | PASS                                |
| Approved JSON parses                       | PASS                                |
| JSON contains tester-approved edit         | PASS                                |
| Test data readiness exported               | PASS                                |
| Excel created                              | PASS                                |
| JSON file non-empty                        | PASS — 23,669 bytes in observed run |
| Excel file non-empty                       | PASS — 29,788 bytes in observed run |
| JSON downloadable over HTTP                | PASS                                |
| Excel downloadable over HTTP               | PASS                                |
| Production outputs untouched               | PASS                                |
| Temporary output cleanup                   | PASS                                |

The manifest stores relative production paths (`outputs/production/...`) while the test changes its working directory to the isolated temporary root. The download route resolves these paths within the explicitly allowed temporary output root.

# 7. Status Mapping Observed

Pipeline statuses:

- `AWAITING_AI_CLARIFICATION`
- `AWAITING_TEST_CASE_REVIEW`
- `COMPLETED`

Application actions:

- `CLARIFICATION_ANSWERED`
- `STAGE_APPROVED`

Artifact approval statuses:

- `pending`
- `approved`

Workflow session statuses observed internally:

- `started`
- `in-review`
- `approved`
- `completed`

These status families remain intentionally unnormalized in this step.

# 8. Remaining Gaps

1. The production workflow combines Requirement Review with AI Analysis Review; there is no separate Requirement Review HTTP stage.
2. Approval/rejection is artifact-batch based. Selective testcase rejection is unsupported.
3. Testcase edits replace the complete artifact; there is no narrow test-data/testcase patch DTO.
4. No explicit generate/export action exists; `resume` performs both stage advancement operations.
5. Output paths in the manifest are filesystem paths, not opaque download IDs.
6. `GET current-review` has no active artifact after a review session is completed; callers must use `/artifacts`.
7. File repositories still lack optimistic concurrency/revision protection.
8. The general `npm test` script passes but stops in the legacy Requirement Review flow with zero generated scenarios/testcases; the new focused test is the stronger production HTTP contract.

# 9. Files Created

- `tests/web-ui-production-http-contract-test.js`
- `tests/fixtures/web-ui-production-requirement.md`
- `docs/web-ui-sprint-0-step-0.2-http-contract.md`

# 10. Files Modified

- None.

# 11. Commands Run

```text
node tests/web-ui-production-http-contract-test.js
npx prettier --check tests/web-ui-production-http-contract-test.js tests/fixtures/web-ui-production-requirement.md
npx prettier --write tests/web-ui-production-http-contract-test.js tests/fixtures/web-ui-production-requirement.md
node tests/web-ui-production-http-contract-test.js
npm test
node --input-type=module -e "<main import check>"
git diff --check
```

Validation results:

- Focused production HTTP contract: PASS, exit 0.
- `npm test`: PASS, exit 0.
- Main imports (`createApp`, controller, application service, `QACopilot`): PASS, exit 0.
- Prettier after formatting: PASS, exit 0.
- `git diff --check`: PASS, exit 0.

# 12. Final Result

**PASS WITH CONFIRMED GAPS**

The current Web API successfully executes the real production flow, persists both active reviews, blocks gate bypass, generates core testcases, exports only the approved testcase artifact, serves JSON/Excel downloads, and reloads the completed state. No production business logic or HTTP route contract was changed.
