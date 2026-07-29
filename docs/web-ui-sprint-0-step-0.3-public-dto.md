# Web UI Sprint 0 — Step 0.3 Public Workflow DTO

# 1. Goal

Introduce a stable, plain-JSON workflow contract between the current application controller and Web UI without changing workflow transitions, generation, review gates, or export behavior.

The controller now adds `data.workflow`, produced by one centralized mapper. Existing response fields remain temporarily available as deprecated aliases, except storage paths, which are removed or replaced by HTTP download URLs.

# 2. Internal Models Observed

- `QACopilotApplicationService` returns application results containing internal pipeline status, stage names, `WorkflowExecutionContext`, and nested pipeline data.
- Persisted sessions are plain objects with `pipelineStatus`, lowercase workflow status, workflow context, input file path, and output paths.
- Active artifacts are plain objects with `artifactId`, `artifactType`, lowercase `approvalStatus`, optional revision, review payload, and output paths.
- `WorkflowSession` and `BaseArtifact` classes define a second uppercase lifecycle vocabulary but are not the authoritative shape of active production records.
- Production statuses observed are `AWAITING_AI_CLARIFICATION`, `AWAITING_TEST_CASE_REVIEW`, and `COMPLETED`.

# 3. Public Workflow DTO

Condensed real example:

```json
{
    "id": "SESSION-TESTCASE-001",
    "name": "qa-copilot",
    "status": "TEST_CASE_REVIEW_REQUIRED",
    "step": "TEST_CASE_REVIEW",
    "allowedActions": ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"],
    "isBlocking": true,
    "blockingReasons": [
        {
            "code": "TEST_CASE_REVIEW_REQUIRED",
            "message": "Test cases cần được tester phê duyệt."
        }
    ],
    "clarification": {
        "total": 0,
        "answered": 0,
        "remaining": 0
    },
    "testCases": {
        "total": 5,
        "approved": 0,
        "rejected": 0,
        "requiresTesterInput": 3
    },
    "artifacts": [],
    "exports": [],
    "timestamps": {
        "createdAt": null,
        "updatedAt": null
    },
    "revision": null
}
```

All DTOs returned by the mapper are plain objects/arrays. Missing source data is represented by empty summaries or `null`; the mapper does not invent revision, requirement, review, or progress data.

# 4. Status Mapping

| Internal Status                                         | Public Status                 | Public Step          | Blocking | Allowed Actions                               |
| ------------------------------------------------------- | ----------------------------- | -------------------- | -------: | --------------------------------------------- |
| `AWAITING_AI_CLARIFICATION`, unanswered                 | `AI_ANALYSIS_REVIEW_REQUIRED` | `AI_ANALYSIS_REVIEW` |      Yes | `ANSWER_CLARIFICATIONS`, `UPDATE_AI_ANALYSIS` |
| `AWAITING_AI_CLARIFICATION`, answered                   | `AI_ANALYSIS_REVIEW_REQUIRED` | `AI_ANALYSIS_REVIEW` |      Yes | `UPDATE_AI_ANALYSIS`, `APPROVE_AI_ANALYSIS`   |
| Same pipeline status, review session approved/completed | `AI_ANALYSIS_REVIEW_REQUIRED` | `AI_ANALYSIS_REVIEW` |      Yes | `RESUME_WORKFLOW`                             |
| `AWAITING_TEST_CASE_REVIEW`                             | `TEST_CASE_REVIEW_REQUIRED`   | `TEST_CASE_REVIEW`   |      Yes | `UPDATE_TEST_CASES`, `APPROVE_TEST_CASES`     |
| Same pipeline status, review session approved/completed | `TEST_CASE_REVIEW_REQUIRED`   | `TEST_CASE_REVIEW`   |      Yes | `RESUME_WORKFLOW`                             |
| `COMPLETED`                                             | `COMPLETED`                   | `EXPORT`             |       No | Available download actions                    |
| `FAILED`                                                | `FAILED`                      | `ERROR`              |      Yes | None                                          |
| Legacy requirement/module/scenario waits                | `REVIEW_REQUIRED`             | `AI_ANALYSIS_REVIEW` |      Yes | None                                          |
| Unknown                                                 | `UNKNOWN`                     | `ERROR`              |      Yes | None                                          |

Internal constants and workflow transitions were not changed.

# 5. Public Action Mapping

| Public Action           | Internal Action/Endpoint           | Available From                |
| ----------------------- | ---------------------------------- | ----------------------------- |
| `ANSWER_CLARIFICATIONS` | `POST /clarifications/:questionId` | Unanswered AI Analysis Review |
| `UPDATE_AI_ANALYSIS`    | `PUT /artifacts/:artifactId`       | Pending AI Analysis Review    |
| `APPROVE_AI_ANALYSIS`   | `POST /approve`                    | Answered AI Analysis Review   |
| `RESUME_WORKFLOW`       | `POST /resume`                     | Completed current review      |
| `UPDATE_TEST_CASES`     | `PUT /artifacts/:artifactId`       | Pending TestCase Review       |
| `APPROVE_TEST_CASES`    | `POST /approve`                    | Pending TestCase Review       |
| `DOWNLOAD_JSON`         | `GET /outputs/json/download`       | Completed with JSON output    |
| `DOWNLOAD_EXCEL`        | `GET /outputs/excel/download`      | Completed with Excel output   |

These are UI capabilities mapped onto existing endpoints; no new business action was introduced.

# 6. Hidden Internal Fields

The public workflow mapper removes:

- `requirementFile`
- `absolutePath`
- `storagePath`
- `filePath`
- `outputRoot`
- `outputDirectory`
- raw output filesystem values

Output values in backward-compatible response aliases are converted to `/api/workflows/:id/outputs/:format/download`. `PublicArtifactDto` exposes only ID, type, name, status, real revision when available, and download availability.

The upload response was also corrected: it now returns opaque `requirementId` rather than an absolute `requirementFile`. The start route resolves this identifier inside the server. Legacy callers may still submit their own `{ requirementFile }`, but the server does not return that path.

The secured download route uses a controller-only raw manifest operation; storage paths never pass through its HTTP JSON response.

# 7. Backward Compatibility

- Existing response envelope remains `{ success, data, error }`.
- Existing application result fields remain temporarily alongside `data.workflow`.
- Existing HTTP start requests using `{ requirementFile }` remain supported.
- Uploaded workflows use the new `{ requirementId }` contract.
- Existing `outputs` keys remain, but values are download URLs rather than filesystem paths.
- Artifact arrays retain their array contract, with storage fields removed and output values sanitized.
- `QACopilotController.getOutputsForDownload()` is internal to the route adapter and exists only so file download can resolve storage safely.

Deprecated aliases: raw `status`, `currentStage`, `workflowContext`, nested pipeline `data`, and full artifact payloads. They remain for current clients and will require a later versioned removal.

# 8. Files Created

- `src/web/dtos/PublicWorkflowDto.js`
- `src/web/dtos/PublicArtifactDto.js`
- `src/web/mappers/PublicWorkflowMapper.js`
- `src/web/mappers/PublicStatusMapper.js`
- `src/web/mappers/PublicActionMapper.js`
- `tests/public-workflow-dto-test.js`
- `docs/web-ui-sprint-0-step-0.3-public-dto.md`

# 9. Files Modified

- `src/controllers/QACopilotController.js`
- `src/routes/workflowRoutes.js`
- `src/server/createApp.js`
- `src/services/RequirementUploadService.js`
- `public/app.js`
- `tests/web-ui-production-http-contract-test.js`
- `tests/human-review-workspace-test.js`

# 10. Tests Added

`tests/public-workflow-dto-test.js` verifies:

- plain JSON output and serialization;
- no functions or required domain prototypes;
- centralized status/step/action mapping;
- safe unknown status;
- clarification and testcase summaries;
- artifact sanitization;
- absence of absolute storage paths;
- stable HTTP download URLs.

The production HTTP contract test now verifies the public DTO at initial review, testcase review, completion, and reload, plus absence of its temporary absolute root.

# 11. Commands Run

```text
node tests/public-workflow-dto-test.js
node tests/web-ui-production-http-contract-test.js
node tests/human-review-workspace-test.js
node tests/http-workflow-api-test.js
node tests/http-review-gate-test.js
node tests/http-artifact-edit-test.js
node tests/http-approval-resume-test.js
node tests/http-export-manifest-test.js
node tests/tester-owned-test-data-http-test.js
node tests/output-download-security-test.js
node tests/static-root-resolution-test.js
npm test
npx prettier --check ...
git diff --check
```

# 12. Remaining Gaps

1. Deprecated raw application/domain fields remain in HTTP responses for compatibility.
2. Full review artifacts are still returned by review/edit endpoints, although storage paths are sanitized.
3. There is no API version or migration date for removing legacy aliases.
4. Public DTO cannot expose a real optimistic revision when active records omit it.
5. Status immediately after approval still reflects the waiting pipeline until the client calls `resume`; allowed actions correctly exposes only `RESUME_WORKFLOW`.
6. Selective testcase rejection, narrow test-data patching, workflow listing, and concurrency remain outside this step.

# 13. Final Result

**PASS WITH MINOR GAPS**

The Web UI now has a stable public workflow/status/step/action summary, and public HTTP JSON no longer exposes upload or output filesystem paths. Internal workflow and business behavior are unchanged.
