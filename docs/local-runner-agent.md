# Local Runner Agent

The agent lets Playwright run on the tester workstation while the QA Copilot server remains the canonical owner of workspaces and results.

## Server setup

Create a QA Copilot user, then use **Kết nối máy chạy này** in the account menu. The
server issues one `runnerId` and one token for that device. `RUNNER_AGENT_TOKENS`
may remain as a development fallback only; production Runner Devices authenticate
with their own stored token hash.

## Tester workstation setup — one-click package (recommended, Windows)

In the same **Kết nối máy chạy này** dialog, click **"Tải gói cài đặt (.zip)"** — the server streams
a zip built on the fly (`src/routes/runnerDeviceRoutes.js`, `POST /runner-devices/:runnerId/package`)
containing the `tools/runner/` source files plus a `runner-agent.config.json` with `serverUrl`,
`agentId`, and `token` already filled in (the raw token only exists in that one response, so this
must happen right after device creation — it is never persisted server-side in reversible form).
Extract the zip and double-click `setup.bat`. It checks for Node.js, runs `npm install`, installs
the Playwright-managed Chromium browser, and registers a per-user Scheduled Task
(`QACopilotRunnerAgent`, trigger "At log on", no admin rights required) that starts
`node agent.mjs runner-agent.config.json` automatically — then starts it immediately so no
logoff/logon is needed to see it come `ONLINE`. Re-running `setup.bat` later (e.g. after a package
update) replaces the existing task instead of duplicating it.

## Tester workstation setup — manual (non-Windows machines, or custom setups)

1. Copy only the `tools/runner/` folder to the tester machine, for example `C:\QA-Copilot-Runner`.
2. Run `npm install` inside that folder; the Runner owns its Playwright dependency and does not need this repository.
3. Copy `config.example.json` to a private `runner-agent.config.json` in that folder and fill in its token.
4. Start the agent:

```powershell
cd C:\QA-Copilot-Runner
node agent.mjs C:\QA-Copilot-Runner\runner-agent.config.json
```

5. Keep it running via Task Scheduler (or an equivalent on non-Windows) after confirming it appears as `ONLINE` in Automation Workspace.

The agent capabilities are `PLAYWRIGHT_RUN` (assigned generated-test jobs) and `CODEGEN_RECORD`
(`START_CODEGEN`/`STOP_CODEGEN` — spawns/stops `playwright codegen` on the tester's own machine so
the Inspector window opens locally instead of on the server; see `tools/runner/codegenExecution.mjs`).
It writes each job into a per-run local work directory and returns exit code, stdout, stderr, and
result (or captured script, for CodeGen) to the canonical server. It does not execute arbitrary
shell commands.
