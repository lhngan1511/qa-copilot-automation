import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/*
 CodeGenRecordingStore
 Metadata và script giữ lâu dài của CodeGen, tách hẳn approved-testcases.json.

 - Metadata persistent: data/codegen-recordings.json
 - Script lưu phía server: outputs/codegen/

 TempDir chỉ dùng cho recording đang chạy / file run tạm / report-trace tạm.
 Không bao giờ sửa approved-testcases.json.
*/

const STORAGE_MODES = new Set(["TEMP", "SERVER", "DOWNLOADED"]);
const MODES = new Set(["FULL_FLOW", "TESTCASE_SEGMENT"]);

function newRecordingId() {
    return `REC-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export default class CodeGenRecordingStore {
    constructor({ metadataFile = null, scriptsDir = null } = {}) {
        this.metadataFile =
            metadataFile ?? path.resolve("data", "codegen-recordings.json");
        this.scriptsDir = scriptsDir ?? path.resolve("outputs", "codegen");
        this.ensureDirectories();
        this.recordings = this.load();
    }

    ensureDirectories() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        fs.mkdirSync(this.scriptsDir, { recursive: true });
    }

    load() {
        try {
            if (!fs.existsSync(this.metadataFile)) return [];
            const data = JSON.parse(fs.readFileSync(this.metadataFile, "utf8"));
            return Array.isArray(data.recordings) ? data.recordings : [];
        } catch {
            return [];
        }
    }

    persist() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        const payload = {
            version: 1,
            recordings: this.recordings
        };
        fs.writeFileSync(this.metadataFile, JSON.stringify(payload, null, 2), "utf8");
    }

    list() {
        return this.recordings.map(rec => this.sanitize(rec));
    }

    get(recordingId) {
        const rec = this.recordings.find(item => item.recordingId === recordingId) ?? null;
        return rec ? this.sanitize(rec) : null;
    }

    create({ mode = "FULL_FLOW", url = "", browser = "chrome" } = {}) {
        const recording = {
            recordingId: newRecordingId(),
            mode: MODES.has(mode) ? mode : "FULL_FLOW",
            url,
            browser,
            status: "RECORDING",
            scriptContent: "",
            storageMode: "TEMP",
            serverFilePath: null,
            downloadFileName: this.suggestFileName(url),
            testcaseIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRunResult: null,
            reportPath: null,
            tracePath: null
        };
        this.recordings.unshift(recording);
        this.persist();
        return this.sanitize(recording);
    }

    update(recordingId, patch = {}) {
        const rec = this.recordings.find(item => item.recordingId === recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        const merged = { ...rec, ...patch, recordingId: rec.recordingId, updatedAt: new Date().toISOString() };
        const index = this.recordings.findIndex(item => item.recordingId === recordingId);
        this.recordings[index] = merged;
        this.persist();
        return this.sanitize(merged);
    }

    remove(recordingId) {
        const rec = this.recordings.find(item => item.recordingId === recordingId);
        if (!rec) return null;
        // Xoá script phía server nếu có.
        if (rec.serverFilePath) {
            try {
                const abs = path.resolve(this.scriptsDir, path.basename(rec.serverFilePath));
                if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
            } catch {
                /* ignore */
            }
        }
        this.recordings = this.recordings.filter(item => item.recordingId !== recordingId);
        this.persist();
        return this.sanitize(rec);
    }

    resolveServerPath(fileName) {
        const safe = this.safeSpecName(fileName || "playwright-recording.spec.js");
        return path.join(this.scriptsDir, safe);
    }

    writeServerScript(recordingId, content, fileName) {
        const rec = this.recordings.find(item => item.recordingId === recordingId);
        if (!rec) {
            const error = new Error(`Recording '${recordingId}' không tồn tại.`);
            error.code = "RECORDING_NOT_FOUND";
            throw error;
        }
        const safe = this.safeSpecName(fileName || rec.downloadFileName || "playwright-recording.spec.js");
        const abs = path.join(this.scriptsDir, safe);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf8");
        return {
            fileName: safe,
            serverFilePath: safe,
            absPath: abs
        };
    }

    suggestFileName(url) {
        const slug = String(url ?? "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//i, "")
            .replace(/\/+$/g, "")
            .replace(/[^a-z0-9.]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "playwright";
        return `${slug}-recording.spec.js`;
    }

    safeSpecName(name) {
        const base = path.basename(String(name || "playwright-recording.spec.js"));
        const safe = base.replace(/[^a-zA-Z0-9._-]/g, "-");
        return /\.(spec|test)\.[cm]?[jt]s$/i.test(safe)
            ? safe
            : `${safe.replace(/\.(js|ts|mjs|cjs)$/i, "")}.spec.js`;
    }

    sanitize(recording) {
        const { scriptContent, ...rest } = { ...recording };
        return {
            ...rest,
            hasScript: Boolean(scriptContent && scriptContent.trim())
        };
    }
}

export { CodeGenRecordingStore, STORAGE_MODES, MODES, newRecordingId };
