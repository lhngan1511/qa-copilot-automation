# Web UI Sprint 1 — Step 1.1 React Shell

## 1. Goal

Create an isolated React and Vite application shell in `web-ui/` that reads the
existing public workflow API without changing backend business logic, workflow
transitions, review gates, generators, approved artifacts, or exporters.

## 2. Frontend Architecture

- React 19 with React Router.
- TanStack Query for server state and bounded retry behavior.
- A centralized Fetch-based API client with safe JSON parsing, structured
  errors, and `AbortSignal` support.
- Read-only pages that consume only the public workflow DTO.
- Plain responsive CSS with no UI framework.
- The legacy UI in `public/` remains unchanged and continues to be served by the
  backend.

## 3. Folder Structure

```text
web-ui/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── src/
    ├── api/
    ├── app/
    ├── components/
    ├── hooks/
    ├── layouts/
    ├── pages/
    ├── styles/
    └── utils/
```

## 4. Routes

| Route                    | Page               | Behavior                          |
| ------------------------ | ------------------ | --------------------------------- |
| `/`                      | DashboardPage      | Paginated public workflow listing |
| `/workflows/:workflowId` | WorkflowDetailPage | Read-only workflow detail         |
| `*`                      | NotFoundPage       | Friendly 404 state                |

## 5. API Integration

The frontend uses `import.meta.env.VITE_API_BASE_URL || "/api"` and never embeds
an absolute backend URL in a component.

- `GET /health` supplies the connection indicator.
- `GET /api/workflows?limit=&offset=` supplies the dashboard.
- `GET /api/workflows/:workflowId` supplies workflow detail.
- Listing reads `data.items` and `data.pagination`.
- Detail reads only `data.workflow`; the deprecated response alias is ignored.

The API client safely handles empty or non-JSON responses and throws an
`ApiError` containing `status`, `code`, `message`, and optional `details`.
Backend stacks are not rendered.

## 6. Public DTO Fields Used

The UI uses only:

- `id`, `name`, `status`, `step`, `allowedActions`, `isBlocking`
- `blockingReasons`
- `clarification.total`, `clarification.answered`, `clarification.remaining`
- `testCases.total`, `testCases.approved`, `testCases.rejected`,
  `testCases.requiresTesterInput`
- listing-only `artifactAvailable` and `exportAvailable`
- detail `artifacts` and `exports`
- `timestamps.createdAt`, `timestamps.updatedAt`, and `revision`

It does not read raw `workflowContext`, internal pipeline status, storage paths,
or deprecated aliases.

## 7. Loading/Error/Empty Handling

Reusable `LoadingState`, `ErrorState`, and `EmptyState` components are used by
the dashboard and detail page. Error output contains a friendly message and an
optional error code, never a JavaScript or backend stack. Retry is explicit and
does not poll continuously.

## 8. Backend Proxy Configuration

Vite proxies both `/api` and `/health` to
`VITE_BACKEND_TARGET || "http://127.0.0.1:3000"`.

The actual backend audit confirmed:

- backend host default: `127.0.0.1`
- backend port default: `3000`
- workflow prefix: `/api/workflows`
- health endpoint: `/health`
- CORS middleware: not present
- legacy static serving: enabled from the project `public/` directory
- root package: not an npm workspace
- module type: ES module
- validation Node version: `v24.17.0`

## 9. Files Created

- `web-ui/.gitignore`
- `web-ui/index.html`
- `web-ui/package.json`
- `web-ui/package-lock.json`
- `web-ui/vite.config.js`
- `web-ui/src/main.jsx`
- `web-ui/src/api/apiClient.js`
- `web-ui/src/api/workflowApi.js`
- `web-ui/src/app/App.jsx`
- `web-ui/src/app/queryClient.js`
- `web-ui/src/app/router.jsx`
- `web-ui/src/components/AppHeader.jsx`
- `web-ui/src/components/EmptyState.jsx`
- `web-ui/src/components/ErrorState.jsx`
- `web-ui/src/components/LoadingState.jsx`
- `web-ui/src/components/WorkflowCard.jsx`
- `web-ui/src/components/WorkflowStatusBadge.jsx`
- `web-ui/src/hooks/useBackendHealth.js`
- `web-ui/src/hooks/useWorkflow.js`
- `web-ui/src/hooks/useWorkflows.js`
- `web-ui/src/layouts/MainLayout.jsx`
- `web-ui/src/pages/DashboardPage.jsx`
- `web-ui/src/pages/NotFoundPage.jsx`
- `web-ui/src/pages/WorkflowDetailPage.jsx`
- `web-ui/src/styles/global.css`
- `web-ui/src/utils/formatDate.js`
- `web-ui/src/utils/workflowLabels.js`
- `docs/web-ui-sprint-1-step-1.1-react-shell.md`

## 10. Files Modified

None outside the new `web-ui/` application and this report.

## 11. Commands Run

```powershell
cd web-ui
npm install
npm run build

cd ..
node tests/workflow-listing-http-test.js
node tests/web-ui-production-http-contract-test.js
npm test
npx prettier --write "web-ui/**/*.{js,jsx,json,html,css}" --ignore-path .gitignore
```

A temporary local smoke validation also started the real backend on port `3317`
and Vite on port `4174`, then requested `/`, `/health`, and
`/api/workflows?limit=1&offset=0` through the Vite development server.

## 12. Build Result

PASS.

Vite `7.3.6` transformed 107 modules and produced the production bundle
successfully. The build validates all main frontend imports. No lint command is
configured, so lint was not run.

## 13. Backend Regression Result

- `node tests/workflow-listing-http-test.js`: PASS
- `node tests/web-ui-production-http-contract-test.js`: PASS
- `npm test` (`ENABLE_AI=false` regression): PASS
- Development proxy smoke validation:
    - `/`: HTTP 200 and contains `QA Copilot`
    - `/health`: `success=true`, status `ok`
    - `/api/workflows`: public response envelope received successfully

## 14. Remaining Gaps

- New workflow creation is intentionally disabled.
- Workflow detail is read-only; clarification, testcase editing, approvals, and
  downloads are not implemented in this step.
- Automation Intelligence is visibly disabled as “Coming later”.
- The backend still serves the legacy `public/` UI; serving the React production
  build is intentionally deferred.
- `npm install` reported two high-severity dependency audit findings. No
  automatic or breaking audit fix was applied in this scoped sprint.

## 15. Final Result

PASS.

The React/Vite shell, public workflow listing, read-only workflow detail,
connection indicator, reusable states, responsive layout, development proxy,
production build, and backend regressions all completed successfully without
changing backend business logic.
