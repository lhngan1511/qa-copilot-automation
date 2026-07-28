import fs from "node:fs";
import path from "node:path";
import WorkflowSessionRepository from "./WorkflowSessionRepository.js";

export default class FileWorkflowSessionRepository extends WorkflowSessionRepository {
    constructor({ dataDir = "./data", fileName = "workflow-sessions.json" } = {}) {
        super();
        this.filePath = path.resolve(dataDir, fileName);
        this.ensureStorage();
    }

    save(session) {
        if (!session?.sessionId) {
            throw new Error("sessionId is required.");
        }

        const records = this.readRecords();
        const index = records.findIndex(item => item.sessionId === session.sessionId);
        const clone = this.clone(session);

        if (index >= 0) records[index] = clone;
        else records.push(clone);

        this.writeRecords(records);
        return this.clone(clone);
    }

    findById(sessionId) {
        const record = this.readRecords().find(item => item.sessionId === sessionId);
        return record ? this.clone(record) : null;
    }

    findAll() {
        return this.clone(this.readRecords());
    }

    findByWorkflowId(workflowId) {
        return this.findAll().filter(
            item => item.workflowId === workflowId || item.workflowName === workflowId
        );
    }

    exists(sessionId) {
        return this.readRecords().some(item => item.sessionId === sessionId);
    }

    deleteById(sessionId) {
        const records = this.readRecords();
        const filtered = records.filter(item => item.sessionId !== sessionId);
        if (filtered.length === records.length) return false;
        this.writeRecords(filtered);
        return true;
    }

    ensureStorage() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        if (!fs.existsSync(this.filePath)) {
            this.writeRecords([]);
        }
    }

    readRecords() {
        const content = fs.readFileSync(this.filePath, "utf8");
        if (!content.trim()) return [];

        try {
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed)) throw new Error("root value must be an array");
            return parsed;
        } catch (error) {
            throw new Error(
                `Malformed workflow session repository JSON at ${this.filePath}: ${error.message}`
            );
        }
    }

    writeRecords(records) {
        const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf8");
        fs.renameSync(tempPath, this.filePath);
    }

    clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}
