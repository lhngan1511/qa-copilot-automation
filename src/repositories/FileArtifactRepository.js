import fs from "node:fs";
import path from "node:path";
import ArtifactRepository from "./ArtifactRepository.js";

export default class FileArtifactRepository extends ArtifactRepository {
    constructor({ dataDir = "./data", fileName = "artifacts.json" } = {}) {
        super();
        this.filePath = path.resolve(dataDir, fileName);
        this.ensureStorage();
    }

    save(artifact) {
        if (!artifact?.artifactId) {
            throw new Error("artifactId is required.");
        }

        const records = this.readRecords();
        const index = records.findIndex(item => item.artifactId === artifact.artifactId);
        const clone = this.clone(artifact);

        if (index >= 0) records[index] = clone;
        else records.push(clone);

        this.writeRecords(records);
        return this.clone(clone);
    }

    findById(artifactId) {
        const record = this.readRecords().find(item => item.artifactId === artifactId);
        return record ? this.clone(record) : null;
    }

    findAll() {
        return this.clone(this.readRecords());
    }

    findByWorkflowId(workflowId) {
        return this.findAll().filter(item => item.workflowId === workflowId);
    }

    findBySessionId(sessionId) {
        return this.findAll().filter(item => item.sessionId === sessionId);
    }

    exists(artifactId) {
        return this.readRecords().some(item => item.artifactId === artifactId);
    }

    deleteById(artifactId) {
        const records = this.readRecords();
        const filtered = records.filter(item => item.artifactId !== artifactId);
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
                `Malformed artifact repository JSON at ${this.filePath}: ${error.message}`
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
