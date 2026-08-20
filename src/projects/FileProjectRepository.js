import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ProjectRepository from "./ProjectRepository.js";

export default class FileProjectRepository extends ProjectRepository {
    constructor({ dataDir = "./data" } = {}) {
        super();
        this.filePath = path.resolve(dataDir, "projects.json");
    }
    async initialize() {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, "[]", "utf8");
    }
    read() { try { return JSON.parse(fs.readFileSync(this.filePath, "utf8")); } catch { return []; } }
    write(items) { fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), "utf8"); }
    async list() { return this.read().filter(x => x.status !== "DELETED").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }
    async getById(projectId) { return this.read().find(x => x.projectId === projectId && x.status !== "DELETED") ?? null; }
    async create({ name, code = "", description = "" }) {
        const now = new Date().toISOString();
        const item = { projectId: `PRJ-${crypto.randomUUID()}`, name, code, description, status: "ACTIVE", createdAt: now, updatedAt: now };
        const items = this.read(); items.push(item); this.write(items); return item;
    }
    async update(projectId, patch) {
        const items = this.read(); const item = items.find(x => x.projectId === projectId);
        if (!item) return null;
        Object.assign(item, patch, { projectId, updatedAt: new Date().toISOString() }); this.write(items); return item;
    }
    async delete(projectId) {
        const items = this.read();
        const item = items.find(x => x.projectId === projectId && x.status !== "DELETED");
        if (!item) return null;
        item.status = "DELETED";
        item.updatedAt = new Date().toISOString();
        this.write(items);
        return item;
    }
}
