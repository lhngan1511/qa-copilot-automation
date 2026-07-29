# Web UI Sprint 0 Architecture Audit

Audit date: 2026-07-29  
Scope: current repository, read-only architecture review. No business logic was changed.

# 1. Executive Summary

The existing application layer is reusable for a Web UI. The repository already contains an Express bootstrap, HTTP routes, a controller adapter, an application service, persistent file repositories, workflow orchestration, a static browser UI, and secured output downloads. A new server or a second HTTP controller architecture is not required.

Overall readiness: **READY WITH MINOR CHANGES**.

Concrete blockers/gaps:

1. Three incompatible status vocabularies coexist: uppercase workflow/pipeline constants, lowercase runtime session states, and lowercase artifact approval states.
2. File persistence rewrites whole JSON arrays without locking or optimistic concurrency, so concurrent HTTP edits can overwrite each other.
3. There is no list-workflows service/API and no narrow test-data update contract; the UI must currently replace a whole artifact.
4. The target “Test Data Completion → Final Approval” stages do not exist. Current design intentionally permits `APPROVED + DATA_REQUIRED` and exports it.
5. Review history is latest-state metadata, not an append-only audit/revision log.

An empty anomalous file really exists at `src/this.buildScenario(item` (0 bytes). It is not imported and was not removed.

# 2. Current Workflow

Production entry is `src/server/startServer.js` → `src/server/createApp.js` → `POST /api/workflows` → `QACopilotController.start()` → `QACopilotApplicationService.start()` → `QACopilot.run()`.

The active production path is:

1. Load and parse the Markdown requirement.
2. Run AI analysis when enabled, otherwise create rule-engine analysis.
3. Create a pending `AI_ANALYSIS_REVIEW` artifact and clarification review session; stop with `AWAITING_AI_CLARIFICATION`.
4. User answers questions, edits the artifact if necessary, reviews, approves, and completes the session.
5. Map only the approved analysis artifact to `RequirementKnowledge`; generation is blocked unless `knowledge.isApproved()` is true.
6. Generate recommended scenarios, enrich them, generate scenarios, generate core test cases, and run semantic overlap resolution.
7. Create a pending `TEST_CASE_REVIEW` artifact; stop with `AWAITING_TEST_CASE_REVIEW`.
8. Tester may edit test data and other testcase fields, then reviews, approves, and completes the session.
9. `ApprovedTestCaseMapper` clones the approved artifact.
10. Export `approved-testcases.json` and `approved-testcases.xlsx` under `outputs/production`; previously saved output paths are returned on resume, avoiding a second export.

The legacy/non-production branch still contains Requirement, Module, Scenario, and TestCase gates. They are represented in `WorkflowExecutionContext` and `PipelineStatuses`, but production core flow skips the first three.

AI cannot pass an active production gate by itself: core generation requires both approved analysis artifact and completed review session; export requires both approved testcase artifact and completed review session. The rule fallback can create a draft analysis, but that draft is still gated.

# 3. QACopilotApplicationService Public Contract

| Method | Input | Output | Side Effects | Status Transition | Reusable for HTTP |
|---|---|---|---|---|---|
| `start` | `{ requirementFile }` | Application result | Runs pipeline; persists session/artifacts | New → current waiting/completed state | Yes |
| `resume` | `{ requirementFile, workflowContext }` | Application result | Resumes pipeline; persists state | Waiting → next waiting/completed | Yes |
| `answerClarification` | context, question ID, answer, actor | Clarification status | Updates analysis artifact | Pending clarification remains pending | Yes |
| `approveCurrentStage` | context, stage, actor, feedback | Approval result | Review + approve/complete current workflow | Waiting → approved/completed session | Yes, legacy/generic |
| `approveAndResume` | approval input + requirement | Application result | Approves then resumes | Waiting → next stage | Yes |
| `getWorkflow` | `{ sessionId }` | Session/application view | Read only | None | Yes |
| `getCurrentReview` | `{ sessionId }` | Current session/artifact view | Read only | None | Yes |
| `getArtifacts` | `{ sessionId }` | Artifact array | Read only | None | Yes |
| `editArtifact` | session/artifact IDs + replacement artifact | Updated artifact | Saves pending artifact; recomputes testcase readiness | No approval transition | Yes; too broad |
| `approveReview` | session/artifact IDs + actor | Approval result | Reviews, approves and completes | Pending → approved/completed | Yes |
| `rejectReview` | IDs, actor, reason | Rejection result | Rejects session/artifact | Pending → rejected | Yes |
| `resumeSession` | `{ sessionId }` | Application result | Reads stored input/context and resumes | Completed review → next stage | Yes |
| `getOutputs` | `{ sessionId }` | Output manifest | Read only | None | Yes |

Methods below `getOutputs` are implementation helpers despite JavaScript lacking a `private` keyword; they should not become HTTP operations.

# 4. Existing Controller Contract

| Controller Method | Application Service Call | Input | Output | Error Handling | HTTP Ready |
|---|---|---|---|---|---|
| `start` | `start` | requirement file | response envelope | Central error response | Yes |
| `resume` | `resume` | file + context | envelope | Central | Yes |
| `answerClarification` | same | answer DTO | envelope | Central | Yes |
| `approveStage` | `approveCurrentStage` | stage approval DTO | envelope | Central | Legacy |
| `approveAndResume` | same | approval/resume DTO | envelope | Central | Yes |
| `getWorkflow` | same | session ID | envelope | Central | Yes |
| `getCurrentReview` | same | session ID | envelope | Central | Yes |
| `getArtifacts` | same | session ID | envelope | Central | Yes |
| `editArtifact` | same | IDs + artifact | envelope | Central | Yes |
| `approveReview` | same | IDs + actor | envelope | Central | Yes |
| `rejectReview` | same | IDs + reason | envelope | Central | Yes |
| `resumeSession` | same | session ID | envelope | Central | Yes |
| `getOutputs` | same | session ID | envelope | Central | Yes |
| `invoke` | supplied operation | callback | envelope | Central | Internal utility |
| `execute` | action dispatch table | action + input | envelope | Unknown action → error | Compatibility API |

This is an application-facing controller, but it is already used correctly behind `workflowRoutes.js`, which performs Express request/response adaptation. Keep it. Do **not** add a parallel `WorkflowHttpController`; extend the current route adapter and service contract instead.

# 5. Application Actions

| Action | Implemented | Handler | Required Status | Result Status | Web UI Usage |
|---|---:|---|---|---|---|
| `ANSWER_CLARIFICATION` | Yes | service/controller | Analysis pending | Pending | KEEP |
| `REVIEW_REQUIREMENT` | Legacy | legacy gate | Requirement waiting | In review | DEPRECATE from production UI |
| `REVIEW_MODULE` | Legacy | legacy gate | Module waiting | In review | DEPRECATE from production UI |
| `REVIEW_SCENARIO` | Legacy | legacy gate | Scenario waiting | In review | DEPRECATE from production UI |
| `REVIEW_TEST_CASE` | Yes | testcase review | Testcase waiting | In review | KEEP |
| `CLARIFICATION_ANSWERED` | Result marker | service mapping | Clarification waiting | Waiting/answered | KEEP |
| `STAGE_APPROVED` | Result marker | service mapping | Review pending | Approved | KEEP |
| `NONE` | Yes | response mapping | Terminal/no action | unchanged | KEEP |
| `CHECK_ERROR` | Yes | response mapping | Failed/invalid | unchanged | KEEP |

`WorkflowAction` separately defines lowercase `start`, `execute`, `review`, `approve`, `reject`, `complete`. `QACopilotController.execute()` also has a hardcoded uppercase dispatch map. **MODIFY** later by defining one external action DTO vocabulary and mapping it once; do not expose internal workflow verbs directly without authorization checks. **ADD** a specific `UPDATE_TEST_DATA` API action only if a generic `PUT artifact` is no longer acceptable.

# 6. Workflow Statuses

| Status family | Meaning | Entered From | Allowed Next Actions | Web UI Step |
|---|---|---|---|---|
| `AWAITING_AI_CLARIFICATION` | Analysis draft requires review | Parse/AI | answer, edit, approve, reject | AI Analysis Review |
| `AWAITING_REQUIREMENT_REVIEW` | Legacy requirement gate | Legacy analysis | review/approve/reject | Hidden from production |
| `AWAITING_MODULE_REVIEW` | Legacy module gate | Legacy requirement approval | review/approve/reject | Hidden from production |
| `AWAITING_SCENARIO_REVIEW` | Legacy scenario gate | Legacy module approval | review/approve/reject | Hidden from production |
| `AWAITING_TEST_CASE_REVIEW` | Tester review required | Core generation | edit, approve, reject | Tester Review |
| `COMPLETED` / `FAILED` | Pipeline terminal | Export/error | read/download or retry policy | Complete/Error |
| `CREATED/RUNNING/WAITING_FOR_REVIEW/PAUSED/COMPLETED/FAILED` | Intended session states | Model/constant | lifecycle actions | Infrastructure |
| `started/executed/in-review/approved/rejected/completed` | Actual workflow runtime states | Workflow methods | next workflow verb | Internal |
| `pending/approved/rejected` | Actual artifact approval state | Artifact saves | edit/approve/reject | Review badge |

Problems:

- `COMPLETED` and “waiting” concepts overlap across constant families.
- Workflow implementations hardcode lowercase strings rather than use `WorkflowStatus`.
- Active artifacts use `approvalStatus`, while `BaseArtifact` defines uppercase `status`; the model is not authoritative.
- Transitions are partially validated (`complete` requires approved; service requires correct current artifact) but workflow methods themselves do not consistently enforce every prior state.
- `WorkflowExecutionContext` retains legacy stages skipped by production.

# 7. Review Gates

| Gate | Input | Approval Data | Rejection Data | Blocking Rules | Persisted |
|---|---|---|---|---|---|
| Clarification / AI Analysis | Parsed requirement, AI/rule result, questions/answers | actor, time, feedback; approved artifact | actor/reason/time | Core generation requires approved artifact + completed session | Yes |
| Requirement | Legacy requirement artifact | actor/time | reason/time | Legacy branch only | Yes |
| Module | Legacy module artifact | actor/time | reason/time | Legacy branch only | Yes |
| Scenario | Legacy scenario artifact | actor/time | reason/time | Legacy branch only | Yes |
| TestCase / Tester Review | Generated testcase artifact | actor/time; tester edits | actor/reason/time | Export requires approved artifact + completed session | Yes |
| Test Data | No independent gate | N/A | N/A | Readiness is computed, not blocking | Stored inside testcase |
| Final Approval | No separate gate | TestCase approval is final today | TestCase rejection | Same as Tester Review | Yes |

Draft data does not flow past the two active production gates. AI draft and approved tester data are distinguished by artifact approval state. Auditability is limited: approval/rejection metadata is persisted, but edits and reviews do not form an immutable revision/event history.

# 8. Repository and Persistence

| Repository | Implementation | Storage | Survives Restart | HTTP Suitable | Issues |
|---|---|---|---:|---:|---|
| Artifact | Memory | `Map` | No | Tests only | Volatile |
| Artifact | File | `data/artifacts.json` | Yes | Low concurrency | Whole-file read/write, no version check |
| Workflow session | Memory | `Map` | No | Tests only | Volatile |
| Workflow session | File | `data/workflow-sessions.json` | Yes | Low concurrency | Whole-file read/write, no version check |

`RepositoryFactory` selects memory/file; server bootstrap defaults to file persistence. Therefore the current Web UI does not normally lose state on restart, but it can lose concurrent updates. File writes use temporary replacement, reducing partial-write risk, but there is no process lock, ETag/revision, transaction across session+artifact writes, or multi-instance safety.

IDs are timestamp-derived in orchestration. Same-resolution concurrent starts can collide; repository `save` behaves as upsert and can overwrite an existing record. There is no separate requirement/review repository.

# 9. Artifact and approved-testcases.json

The approved testcase source is a plain `TEST_CASE_REVIEW` artifact, not a dedicated approved-testcase model. `ApprovedTestCaseMapper` rejects the wrong artifact type or non-approved artifact, deep-clones cases, normalizes IDs/test data, and recalculates readiness.

`JsonExporter` then canonicalizes cases. It preserves nested test data and readiness, but currently emits both `expectedResult` and `expectedResults`, so the JSON is not fully de-duplicated. Versioning is not consistently active: `BaseArtifact.revision` exists, while active plain artifacts generally do not advance revisions.

Condensed shape based on actual fields:

```json
{
  "testcaseId": "TC001",
  "scenarioId": "SC001",
  "module": "Thiết bị",
  "feature": "Thêm thiết bị",
  "title": "Mã thiết bị bắt buộc",
  "type": "VALIDATION",
  "testData": {
    "requirement": "Để trống Mã thiết bị",
    "value": ""
  },
  "executionReadiness": "DATA_REQUIRED",
  "steps": [{ "order": 1, "action": "Gửi biểu mẫu", "expected": "" }],
  "expectedResult": "Không lưu dữ liệu",
  "expectedResults": ["Không lưu dữ liệu"],
  "automationCandidate": false,
  "automationHints": {}
}
```

Rejected artifacts cannot pass the mapper. There is no per-testcase rejected state inside an approved artifact, so approval applies to the artifact’s entire edited testcase array. AI draft can reach final output only after a human approves that artifact; no direct draft export path was found.

# 10. Exporters

| Exporter | Input Contract | Output | Grouping | Uses Approved Data Only | HTTP Download Ready |
|---|---|---|---|---:|---:|
| JSON | testcase array | file path | none | Enforced by caller/mapper | Yes, path download |
| Excel | testcase array | `.xlsx` path | Summary text; one flat sheet | Enforced by caller/mapper | Yes |
| Markdown | testcase array | `.md` path | testcase sections | Enforced by caller/mapper | Yes |
| CSV | testcase array | `.csv` path | flat rows | Enforced by caller/mapper | Yes |

Exporters themselves do not validate approval; the application flow and mapper enforce it. `TestCaseOutputService` writes directly to disk and returns paths. That is usable for the current single-node HTTP download route, but not buffer/stream or object-storage ready.

Production core exports JSON and Excel only, named `approved-testcases`; the service supports all four formats for legacy/integration uses. Excel does not create true module/function sheet groups; it has one sheet and summary strings. It supports both `function` and legacy `feature`, and formats tester-owned data in one cell. JSON is the intended single source of truth, with the duplicate expected-result fields noted above.

# 11. AI Provider Integration

`QACopilot` owns `AIAnalysisEngine`; the engine creates a provider through `AIProviderFactory` unless injected. Gemini uses `GeminiProvider` and `@google/genai`. Provider/model/fallback settings are read by `AIConfig` from process environment; Gemini credentials remain server-side. No secret value was read during this audit.

There is no production `MockAIProvider`. Tests inject stubs/mocks, while production can use `FallbackAIProvider` to call a configured secondary provider. When provider invocation or parsing fails, `AIAnalysisEngine` returns a rule-engine result with `analysisStatus: FALLBACK`, `analysisSource: rule-engine`, and a concise error. One inconsistency exists: successful results are assigned generic source `ai` even though `getProviderName()` exists, reducing provider observability.

The browser code calls the backend API, not Gemini. API-key exposure risk is low unless future UI code imports provider/config modules or the server serializes environment data; neither was found.

# 12. Tester-Owned Test Data

Actual readiness values are `READY` and `DATA_REQUIRED` in `src/utils/TestDataReadiness.js`.

Canonical test data is:

```json
{ "requirement": "Condition the tester must satisfy", "value": "" }
```

The generator/builders describe the requirement and leave tester-owned concrete values empty. Readiness rules:

- empty requirement → `READY`;
- requirement + empty value → `DATA_REQUIRED`;
- requirement + value → `READY`.

`QACopilotApplicationService.editArtifact()` accepts a replacement pending artifact. For testcase artifacts it normalizes every `testData` object and recomputes `executionReadiness`. The effective UI update field is `artifact.testCases[n].testData.value`; the requirement should be retained. There is no narrow patch endpoint, item version, or field-level conflict check.

Readiness does not block approval or export. `APPROVED + DATA_REQUIRED` is explicitly valid in the current Sprint 2.4 contract. Therefore the target’s separate Test Data Completion and Final Approval stages are missing, not merely hidden.

# 13. Existing Test Coverage

The repository contains focused model, mapper, analyzer, generator, workflow, HTTP, security, export, AI-provider, and integration tests. Representative Web API regression coverage:

| Test File | Scope | Status | Useful for Web API Regression |
|---|---|---|---:|
| `http-workflow-api-test.js` | Main HTTP lifecycle | Existing | Yes |
| `http-review-gate-test.js` | Gate blocking | Existing | Yes |
| `http-artifact-edit-test.js` | Pending artifact edits | Existing | Yes |
| `http-approval-resume-test.js` | Approval/resume | Existing | Yes |
| `http-export-manifest-test.js` | Output manifest | Existing | Yes |
| `tester-owned-test-data-http-test.js` | Tester data edit/readiness | Existing | Yes |
| `requirement-upload-security-test.js` | Upload validation | Existing | Yes |
| `output-download-security-test.js` | Download/path traversal | Existing | Yes |
| `static-root-resolution-test.js` | `/` static UI | Existing | Yes |
| `pipeline-test.js` | Offline pipeline regression | PASS | Yes |

Validation performed:

- `npm test`
- resolved command: `cross-env ENABLE_AI=false node tests/pipeline-test.js`
- exit code: **0**
- test runner is script-style rather than a framework, so it reports no formal assertion count.
- observed terminal state: pipeline intentionally stopped at Requirement Review in the legacy regression path; 0 scenarios, 0 testcases, 0 outputs. This is a PASS for the current script but weak as a full production Web workflow regression.
- main-class import check (application service, controller, model context, app factory, provider factory): **PASS**, five default exports are functions.
- hardcoded state search and HTTP dependency search were run.

An initial import using the audit’s conceptual path `src/workflows/WorkflowExecutionContext.js` failed because the real file is `src/models/WorkflowExecutionContext.js`; the corrected import passed.

# 14. HTTP Readiness Gap Analysis

## KEEP

- `src/server/createApp.js`
- `src/server/startServer.js`
- `src/routes/workflowRoutes.js`
- `src/controllers/QACopilotController.js`
- `src/services/QACopilotApplicationService.js`
- `src/services/RequirementUploadService.js`
- workflow runtime/coordinator/registry
- file repository implementations for single-node MVP
- `ApprovedTestCaseMapper`, output service, exporters
- provider factory/providers (server side only)

## MODIFY

- Application service: add workflow listing and narrow test-data patch operation.
- Routes: add list/action/test-data/export aliases only where the UI needs them.
- Controller: map new operations without duplicating domain logic.
- Status/action response mapper: expose one stable external vocabulary.
- File repositories: add revision/compare-and-save before multi-user rollout.
- Production regression: cover both active gates through export without network.

## ADD

- Request validation schemas for start, answer, edit, approve/reject, test-data patch.
- Stable HTTP error-code/status mapper.
- Workflow list/query DTO and pagination.
- Optimistic concurrency token (`revision`/ETag).
- Append-only review/edit audit records if traceability is mandatory.
- A policy decision and implementation for separate Test Data Completion/Final Approval.

Already present, so do not add: Web server bootstrap, Express routes, HTTP adapter, upload handling, static UI hosting, and output download endpoint.

## DEPRECATE

- Requirement/Module/Scenario review actions and statuses from the **production Web UI** after compatibility users are confirmed.
- `src/this.buildScenario(item` after an explicit cleanup task confirms it is not externally relied upon.
- Generic controller `execute()` action dispatch once all clients use explicit REST routes.

# 15. Proposed Minimal API Contract

| Method | Path | Existing Service Method | Request DTO | Response DTO | Missing Work |
|---|---|---|---|---|---|
| POST | `/api/workflows` | `start` | `{ requirementFile }` | application result | Exists |
| GET | `/api/workflows` | None | query/paging | workflow summaries | Add service/repository query |
| GET | `/api/workflows/:id` | `getWorkflow` | path ID | workflow view | Exists |
| POST | `/api/workflows/:id/actions` | Several explicit methods | `{ action, artifactId, ... }` | action result | Optional unified alias; whitelist actions |
| PUT | `/api/workflows/:id/clarifications` | `answerClarification` | `{ questionId, answer, answeredBy }` | clarification view | Existing route is per-question POST; choose one contract |
| PUT | `/api/workflows/:id/reviews/requirement` | Legacy approval | review DTO | review view | Do not expose in core production UI |
| PUT | `/api/workflows/:id/reviews/testcases` | `editArtifact`/`approveReview` | artifact edit or decision | review view | Prefer separate edit and decision operations |
| PUT | `/api/workflows/:id/test-data` | `editArtifact` | `{ artifactId, testcaseId, value, revision }` | updated testcase/readiness | Add narrow service method + concurrency check |
| GET | `/api/workflows/:id/artifacts` | `getArtifacts` | path ID | artifacts | Exists |
| POST | `/api/workflows/:id/exports/json` | Resume/export flow | optional revision | manifest/path | Current export is automatic after approval; add only for controlled re-export |
| POST | `/api/workflows/:id/exports/excel` | Resume/export flow | optional revision | manifest/path | Same |

Existing concrete routes also include current-review, artifact PUT, approve, reject, resume, outputs manifest, format download, requirement upload, and health.

# 16. Recommended Implementation Order

## Sprint 0.1 — Contract regression baseline

- Goal: lock current HTTP responses and two active production gates.
- Create: one offline end-to-end HTTP production-flow test.
- Modify: none in production.
- Validate: `node tests/<new-http-production-flow-test>.js`.
- Expected: clarification review blocks core generation; testcase review blocks export; approved output downloads.

## Sprint 0.2 — External status/action normalization

- Goal: give React one stable status/action vocabulary without changing domain transitions.
- Create: response mapper and focused tests.
- Modify: controller/application result mapping only.
- Validate: focused contract test + `npm test`.
- Expected: no lowercase/uppercase leakage in public responses.

## Sprint 0.3 — Safe tester-data update

- Goal: update only `testData.value`.
- Create: request validator/test.
- Modify: service, controller, routes.
- Validate: HTTP readiness/edit tests.
- Expected: readiness recalculated; approval unchanged; stale revision rejected.

## Sprint 0.4 — Workflow listing and concurrency

- Goal: resume workflows reliably from a dashboard.
- Create: list DTO/query tests.
- Modify: repositories/service/routes; add revision compare-and-save.
- Validate: restart and concurrent-edit tests.
- Expected: persisted list and no silent lost update.

## Sprint 1 — React adapter

- Goal: upload, AI analysis review, tester review/data editing, approval, download.
- Create: frontend application consuming only HTTP.
- Modify: static hosting configuration only if build output path differs.
- Validate: browser E2E against real server with AI disabled/stubbed server-side.
- Expected: React never imports provider/generator/domain modules.

The smallest next step is Sprint 0.1: an offline HTTP production-flow contract test. It is independently verifiable and changes no domain logic.

# 17. Final Verdict

**READY WITH MINOR CHANGES**

The server, controller, application service, persistence, review enforcement, approved-data mapper, exporters, downloads, and static hosting already form a viable Web UI backend. React can be added as an adapter without rewriting the domain.

Before multi-user use, normalize the public status/action contract, prevent lost updates, add workflow listing and a narrow tester-data operation, and decide whether the architectural target truly requires a separate Test Data Completion/Final Approval gate. The current implementation safely enforces its two production approvals, but it does not implement that later target lifecycle.

