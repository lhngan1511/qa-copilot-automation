import crypto from "node:crypto";

function httpError(code, message, statusCode = 400) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
}

function configuredTokens(env = process.env) {
    const raw = String(env.RUNNER_AGENT_TOKENS ?? "").trim();
    if (!raw) return {};
    try {
        const value = JSON.parse(raw);
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

function safeEqual(left, right) {
    const a = Buffer.from(String(left ?? ""));
    const b = Buffer.from(String(right ?? ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * In-memory control plane for LAN runner agents. Workspaces/results stay canonical
 * in existing services; this class only leases execution jobs to a named machine.
 */
export default class RunnerAgentService {
    constructor({ tokens = configuredTokens(), deviceService = null, now = () => new Date() } = {}) {
        this.tokens = tokens;
        this.deviceService = deviceService;
        this.now = now;
        this.agents = new Map();
        this.jobs = new Map();
    }

    requireToken(agentId, token) {
        const device = this.deviceService?.authenticate(agentId, token);
        if (device) return device;
        const expected = this.tokens[agentId] ?? this.tokens["*"] ?? null;
        if (!expected) {
            throw httpError("RUNNER_AGENT_AUTH_NOT_CONFIGURED", "Runner Agent chưa được cấu hình token trên server.", 503);
        }
        if (!safeEqual(expected, token)) {
            throw httpError("RUNNER_AGENT_UNAUTHORIZED", "Token Runner Agent không hợp lệ.", 401);
        }
        return null; // DEV fallback RUNNER_AGENT_TOKENS
    }

    register({ agentId, token, machineName = "", capabilities = [], runnerVersion = null, runtime = null } = {}) {
        const id = String(agentId ?? "").trim();
        if (!id) throw httpError("RUNNER_AGENT_ID_REQUIRED", "agentId là bắt buộc.");
        const device = this.requireToken(id, token);
        const timestamp = this.now().toISOString();
        const existing = this.agents.get(id);
        const agent = {
            agentId: id,
            machineName: String(machineName ?? "").trim() || id,
            capabilities: [...new Set((Array.isArray(capabilities) ? capabilities : []).map(value => String(value).toUpperCase()).filter(Boolean))],
            status: "ONLINE",
            registeredAt: existing?.registeredAt ?? timestamp,
            lastSeenAt: timestamp,
            currentJobId: existing?.currentJobId ?? null
            , ownerUserId: device?.userId ?? null,
            runnerVersion: String(runnerVersion ?? existing?.runnerVersion ?? "").trim() || null,
            runtime: runtime && typeof runtime === "object" ? {
                nodeVersion: String(runtime.nodeVersion ?? ""),
                platform: String(runtime.platform ?? ""),
                playwrightVersion: String(runtime.playwrightVersion ?? ""),
                configFile: String(runtime.configFile ?? ""),
                workDirReady: runtime.workDirReady === true,
                browserInstalled: runtime.browserInstalled === true
            } : existing?.runtime ?? null
        };
        this.agents.set(id, agent);
        if (device) this.deviceService.touch(id, "ONLINE");
        return this.publicAgent(agent);
    }

    heartbeat({ agentId, token } = {}) {
        const id = String(agentId ?? "").trim();
        const device = this.requireToken(id, token);
        const agent = this.agents.get(id);
        if (!agent) throw httpError("RUNNER_AGENT_NOT_REGISTERED", "Runner Agent chưa đăng ký.", 404);
        agent.lastSeenAt = this.now().toISOString();
        agent.status = agent.currentJobId ? "BUSY" : "ONLINE";
        if (device) this.deviceService.touch(id, agent.status);
        return this.publicAgent(agent);
    }

    listAgents() {
        return [...this.agents.values()]
            .map(agent => this.publicAgent(agent))
            .sort((a, b) => a.machineName.localeCompare(b.machineName));
    }

    listAgentsForUser(userId) {
        return [...this.agents.values()].filter(agent => agent.ownerUserId === userId).map(agent => this.publicAgent(agent));
    }

    requireOwnedByUser(agentId, userId) {
        if (!userId) throw httpError("AUTH_REQUIRED", "Cần đăng nhập để dùng Runner từ xa.", 401);
        this.deviceService?.requireOwned(agentId, userId);
        const agent = this.agents.get(String(agentId));
        if (!agent || agent.ownerUserId !== userId) throw httpError("RUNNER_DEVICE_FORBIDDEN", "Runner không thuộc tài khoản hiện tại.", 403);
        return agent;
    }

    enqueue({ agentId, type, payload = {} } = {}) {
        const id = String(agentId ?? "").trim();
        const agent = this.agents.get(id);
        if (!agent || agent.status === "OFFLINE") {
            throw httpError("RUNNER_AGENT_OFFLINE", "Runner Agent đã chọn chưa online.", 409);
        }
        const jobId = `JOB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const job = {
            jobId,
            agentId: id,
            type: String(type ?? "").toUpperCase(),
            payload,
            status: "QUEUED",
            createdAt: this.now().toISOString(),
            claimedAt: null,
            completedAt: null,
            result: null
        };
        this.jobs.set(jobId, job);
        return this.publicJob(job);
    }

    claim({ agentId, token } = {}) {
        const id = String(agentId ?? "").trim();
        this.heartbeat({ agentId: id, token });
        const agent = this.agents.get(id);
        if (agent.currentJobId) return null;
        const job = [...this.jobs.values()].find(item => item.agentId === id && item.status === "QUEUED");
        if (!job) return null;
        job.status = "RUNNING";
        job.claimedAt = this.now().toISOString();
        agent.currentJobId = job.jobId;
        agent.status = "BUSY";
        return { ...job };
    }

    complete({ agentId, token, jobId, result = {} } = {}) {
        const id = String(agentId ?? "").trim();
        const device = this.requireToken(id, token);
        const agent = this.agents.get(id);
        const job = this.jobs.get(String(jobId ?? ""));
        if (!agent || !job || job.agentId !== id) {
            throw httpError("RUNNER_JOB_NOT_FOUND", "Không tìm thấy job của Runner Agent này.", 404);
        }
        if (job.status !== "RUNNING") throw httpError("RUNNER_JOB_NOT_RUNNING", "Job không ở trạng thái đang chạy.", 409);
        job.result = result && typeof result === "object" ? result : {};
        job.status = String(job.result.status ?? "ERROR").toUpperCase() === "PASSED" ? "PASSED" : "FAILED";
        job.completedAt = this.now().toISOString();
        agent.currentJobId = null;
        agent.status = "ONLINE";
        agent.lastSeenAt = job.completedAt;
        if (device) this.deviceService.touch(id, "ONLINE");
        return { job: { ...job }, agent: this.publicAgent(agent) };
    }

    publicAgent(agent) {
        return {
            agentId: agent.agentId,
            machineName: agent.machineName,
            capabilities: agent.capabilities,
            status: agent.status,
            lastSeenAt: agent.lastSeenAt,
            currentJobId: agent.currentJobId,
            runnerVersion: agent.runnerVersion ?? null,
            runtime: agent.runtime ?? null
        };
    }

    publicJob(job) {
        return { jobId: job.jobId, agentId: job.agentId, type: job.type, status: job.status, createdAt: job.createdAt };
    }
}
