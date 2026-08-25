# Local Runner Agent

The agent lets Playwright run on the tester workstation while the QA Copilot server remains the canonical owner of workspaces and results.

## Server setup

Create a QA Copilot user, then use **Kết nối máy chạy này** in the account menu. The
server issues one `runnerId` and one token for that device. `RUNNER_AGENT_TOKENS`
may remain as a development fallback only; production Runner Devices authenticate
with their own stored token hash.

## Tester workstation setup

1. Copy only the `tools/runner/` folder to the tester machine, for example `C:\QA-Copilot-Runner`.
2. Run `npm install` inside that folder; the Runner owns its Playwright dependency and does not need this repository.
3. Copy `config.example.json` to a private `runner-agent.config.json` in that folder and fill in its token.
3. Start the agent:

```powershell
cd C:\QA-Copilot-Runner
node agent.mjs C:\QA-Copilot-Runner\runner-agent.config.json
```

4. Keep it running via Task Scheduler after confirming it appears as `ONLINE` in Automation Workspace.

The first delivered agent capability is `PLAYWRIGHT_RUN`. It accepts only an assigned generated-test job, writes it into a per-run local work directory, and returns exit code, stdout, stderr, and result to the canonical workspace. It does not execute arbitrary shell commands.
