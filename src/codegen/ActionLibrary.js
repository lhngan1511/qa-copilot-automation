import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/*
 ActionLibrary — TÀI SẢN DÙNG CHUNG (Boundary Codegen ↔ Automation, MVP).

 - Lưu độc lập: data/action-library.json (KHÔNG nằm trong workspace).
 - Block trong Library có thể được MỌI workspace dùng lại (reload / workspace khác vẫn dùng được).
 - usedByTestCases KHÔNG lưu — derive từ bindings (qua hàm countUsage do service cung cấp).
 - Tester chủ động "Lưu vào thư viện" mới đưa block vào đây (compatibility: block cũ trong workspace
   vẫn dùng bình thường, không migration lớn).
 - Snapshot: steps + recordedAssertions là COPY (không live ref recording).
*/

function newLibraryBlockId() {
    return `LIB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export default class ActionLibrary {
    constructor({ metadataFile = null } = {}) {
        this.metadataFile = metadataFile ?? path.resolve("data", "action-library.json");
        this.ensureFile();
        this.blocks = this.load();
    }

    ensureFile() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        if (!fs.existsSync(this.metadataFile)) {
            fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, blocks: [] }, null, 2), "utf8");
        }
    }

    load() {
        try {
            const data = JSON.parse(fs.readFileSync(this.metadataFile, "utf8"));
            return Array.isArray(data.blocks) ? data.blocks : [];
        } catch {
            return [];
        }
    }

    persist() {
        fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
        fs.writeFileSync(this.metadataFile, JSON.stringify({ version: 1, blocks: this.blocks }, null, 2), "utf8");
    }

    hash(block) {
        return crypto.createHash("sha256")
            .update(JSON.stringify({ steps: block.steps, recordedAssertions: block.recordedAssertions, sourceRange: block.sourceRange, label: block.label, kind: block.kind }))
            .digest("hex").slice(0, 12);
    }

    /** Tester chủ động LƯU thao tác vào Library (REUSABLE — bắt buộc label). */
    addBlock({ label, kind = "ACTION", steps = [], recordedAssertions = [], sourceRecordingId = null, sourceRange = null }) {
        const trimmedLabel = String(label ?? "").trim();
        if (!trimmedLabel) {
            const err = new Error("Thao tác lưu vào thư viện bắt buộc đặt tên.");
            err.code = "LIBRARY_LABEL_REQUIRED";
            throw err;
        }
        const block = {
            blockId: newLibraryBlockId(),
            label: trimmedLabel,
            kind: kind === "SETUP" ? "SETUP" : "ACTION",
            steps: Array.isArray(steps) ? steps.map(s => ({ ...s })) : [], // SNAPSHOT
            recordedAssertions: Array.isArray(recordedAssertions) ? recordedAssertions.map(a => ({ ...a })) : [], // SNAPSHOT
            sourceRecordingId: sourceRecordingId ?? null,
            sourceRange: sourceRange && Number.isInteger(sourceRange.startStep) ? { startStep: sourceRange.startStep, endStep: sourceRange.endStep } : null,
            status: "CONFIRMED", // Library block luôn CONFIRMED (tester đã xác nhận khi lưu)
            version: 1,
            hash: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        block.hash = this.hash(block);
        this.blocks.push(block);
        this.persist();
        return { ...block };
    }

    /** Sửa metadata (label/kind) — giữ CONFIRMED; đổi steps/range → re-snapshot + DRAFT + version++ (xác nhận lại). */
    updateBlock(blockId, patch = {}) {
        const block = this.blocks.find(b => b.blockId === blockId);
        if (!block) return null;
        const contentChanged = patch.steps !== undefined || patch.sourceRange !== undefined || patch.recordedAssertions !== undefined;
        if (patch.label !== undefined) {
            const label = String(patch.label ?? "").trim();
            if (!label) {
                const err = new Error("Thao tác trong thư viện bắt buộc đặt tên.");
                err.code = "LIBRARY_LABEL_REQUIRED";
                throw err;
            }
            block.label = label;
        }
        if (patch.kind !== undefined) block.kind = patch.kind === "SETUP" ? "SETUP" : "ACTION";
        if (patch.steps !== undefined) block.steps = Array.isArray(patch.steps) ? patch.steps.map(s => ({ ...s })) : [];
        if (patch.recordedAssertions !== undefined) block.recordedAssertions = Array.isArray(patch.recordedAssertions) ? patch.recordedAssertions.map(a => ({ ...a })) : [];
        if (patch.sourceRange !== undefined) {
            block.sourceRange = patch.sourceRange && Number.isInteger(patch.sourceRange.startStep) ? { startStep: patch.sourceRange.startStep, endStep: patch.sourceRange.endStep } : null;
        }
        if (contentChanged) {
            block.status = "DRAFT";
            block.version = (block.version || 1) + 1;
        }
        block.hash = this.hash(block);
        block.updatedAt = new Date().toISOString();
        this.persist();
        return { ...block };
    }

    confirmBlock(blockId) {
        const block = this.blocks.find(b => b.blockId === blockId);
        if (!block) return null;
        block.status = "CONFIRMED";
        block.updatedAt = new Date().toISOString();
        this.persist();
        return { ...block };
    }

    removeBlock(blockId) {
        const idx = this.blocks.findIndex(b => b.blockId === blockId);
        if (idx === -1) return null;
        const [removed] = this.blocks.splice(idx, 1);
        this.persist();
        return removed;
    }

    get(blockId) {
        const b = this.blocks.find(x => x.blockId === blockId);
        return b ? { ...b } : null;
    }

    list() {
        return this.blocks.map(b => ({ ...b }));
    }
}
