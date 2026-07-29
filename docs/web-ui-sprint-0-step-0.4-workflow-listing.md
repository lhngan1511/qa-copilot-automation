# Web UI Sprint 0 — Step 0.4 Workflow Listing

# 1. Goal

Provide stable, read-only Dashboard and Workspace APIs:

- `GET /api/workflows`
- `GET /api/workflows/:workflowId`

Both use the Sprint 0.3 public mappers, expose no repository object or filesystem path, and do not change workflow state.

# 2. Existing Repository Query Contract

Both existing session repositories already implement:

- `findById(sessionId)`
- `findAll()`

`MemoryWorkflowSessionRepository` returns values from its in-memory map. `FileWorkflowSessionRepository` reads and clones all records from `workflow-sessions.json`. Neither repository implements deleted or archived states, database pagination, or sorting.

`WorkflowRuntime.findSessions()` now exposes the existing manager/repository `findAll()` operation. `QACopilotApplicationService.listWorkflows()` joins every session with its artifacts through the existing runtime query. It is read-only and contains no transition logic.

# 3. Workflow Listing API

| Method | Path                         | Query                                  | Response                                             | Error                                |
| ------ | ---------------------------- | -------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| GET    | `/api/workflows`             | `limit` default 20; `offset` default 0 | `{ success, data: { items, pagination }, error }`    | 400 for invalid query                |
| GET    | `/api/workflows/:workflowId` | none                                   | `{ success, data: { workflow, deprecated }, error }` | 400 missing ID; 404 unknown workflow |

Empty repository response:

```json
{
    "success": true,
    "data": {
        "items": [],
        "pagination": {
            "total": 0,
            "limit": 20,
            "offset": 0,
            "hasMore": false
        }
    },
    "error": null
}
```

Invalid pagination uses code `INVALID_WORKFLOW_QUERY` and never includes a stack trace.

# 4. Workflow Detail API

Detail uses `PublicWorkflowMapper` from Sprint 0.3 and returns the public DTO as the primary contract:

```json
{
    "success": true,
    "data": {
        "workflow": {
            "id": "SESSION-A",
            "name": "Quản lý thiết bị",
            "status": "TEST_CASE_REVIEW_REQUIRED",
            "step": "TEST_CASE_REVIEW",
            "allowedActions": ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"]
        },
        "deprecated": {
            "pipelineStatus": "AWAITING_TEST_CASE_REVIEW",
            "workflowContext": {}
        }
    },
    "error": null
}
```

An unknown ID returns HTTP 404 with `WORKFLOW_NOT_FOUND` and message `Không tìm thấy workflow.`. It neither creates nor falls back to another workflow.

# 5. Public List Item DTO

Example based on a persisted TestCase Review session:

```json
{
    "id": "SESSION-A",
    "name": "Quản lý thiết bị",
    "status": "TEST_CASE_REVIEW_REQUIRED",
    "step": "TEST_CASE_REVIEW",
    "allowedActions": ["UPDATE_TEST_CASES", "APPROVE_TEST_CASES"],
    "isBlocking": true,
    "clarification": {
        "total": 0,
        "answered": 0,
        "remaining": 0
    },
    "testCases": {
        "total": 2,
        "approved": 0,
        "rejected": 0,
        "requiresTesterInput": 1
    },
    "artifactAvailable": true,
    "exportAvailable": false,
    "timestamps": {
        "createdAt": "2026-07-01T08:00:00.000Z",
        "updatedAt": "2026-07-03T08:00:00.000Z"
    },
    "revision": null
}
```

The name comes from a real requirement artifact module/feature/purpose when available, then from persisted workflow name/ID. No business name or timestamp is synthesized.

# 6. Sorting and Pagination

Sorting is centralized in `PublicWorkflowListMapper`:

1. real `updatedAt`, descending;
2. real `createdAt`/`startedAt`, descending when updated time is unavailable or equal;
3. workflow ID, ascending, as deterministic fallback.

Pagination is performed after mapping and sorting because current repositories are memory/file implementations.

- default limit: 20
- maximum limit: 100
- minimum limit: 1
- minimum offset: 0
- integer values only

The response includes `total`, `limit`, `offset`, and `hasMore`. No status filter or text search was added.

# 7. Hidden Fields

Listing omits:

- full requirement and AI analysis;
- testcase arrays;
- artifact arrays and repository metadata;
- provider configuration/secrets;
- `requirementFile`;
- output/storage/file paths.

Detail uses sanitized `PublicWorkflowDto`. Export availability is represented by stable download URLs. Deprecated detail fields contain only pipeline status and workflow context; they contain no storage path.

# 8. Backward Compatibility

- Existing POST/action/review/output routes are unchanged.
- The old detail root aliases were moved under `data.deprecated`.
- `public/app.js`, production HTTP regression, and existing detail tests were updated to use the new primary detail contract.
- Other controller responses still retain Sprint 0.3 deprecated aliases.
- Internal clarification routing uses `getWorkflowState()` so its server-side workflow context is not exposed as a public detail object.

# 9. Files Created

- `src/web/dtos/PublicWorkflowListItemDto.js`
- `src/web/mappers/PublicWorkflowListMapper.js`
- `src/web/validators/WorkflowListQueryValidator.js`
- `tests/workflow-listing-http-test.js`
- `docs/web-ui-sprint-0-step-0.4-workflow-listing.md`

# 10. Files Modified

- `src/workflows/WorkflowRuntime.js`
- `src/services/QACopilotApplicationService.js`
- `src/controllers/QACopilotController.js`
- `src/routes/workflowRoutes.js`
- `src/web/mappers/PublicWorkflowMapper.js`
- `public/app.js`
- `tests/web-ui-production-http-contract-test.js`
- `tests/http-workflow-api-test.js`
- `tests/http-export-manifest-test.js`

# 11. Tests Added

`tests/workflow-listing-http-test.js` covers:

- empty listing;
- three persisted sessions;
- deterministic sorting;
- public summary fields;
- no heavy arrays or filesystem paths;
- two pagination pages;
- invalid `limit`/`offset`;
- public detail;
- 404 not found;
- persisted completed-workflow reload.

The production HTTP contract also verifies the newly created workflow appears in listing and detail uses the public contract.

# 12. Commands Run

```text
node tests/workflow-listing-http-test.js
node tests/public-workflow-dto-test.js
node tests/web-ui-production-http-contract-test.js
node tests/human-review-workspace-test.js
npm test
node --input-type=module -e "<main import check>"
npx prettier --check ...
git diff --check
```

# 13. Remaining Gaps

1. Listing reads all file records before pagination; appropriate for MVP, not high volume.
2. No status filter, search, archive/delete status, or cursor pagination exists.
3. Detail keeps `pipelineStatus` and `workflowContext` under a documented deprecated key.
4. No optimistic concurrency or real revision is introduced.
5. Artifact joins are per session in application service and may become inefficient at scale.
6. Workflow identity remains the persisted review session ID rather than a separate aggregate workflow ID.

# 14. Final Result

**PASS WITH MINOR GAPS**

Dashboard listing and Workspace detail are now available through stable public DTOs with deterministic pagination and safe 404/validation contracts. No workflow transition, business rule, generator, approved artifact, or exporter behavior changed.
