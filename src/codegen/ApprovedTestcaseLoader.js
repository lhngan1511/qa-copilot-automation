import fs from "node:fs";
import path from "node:path";

/*
 ApprovedTestcaseLoader
 Chỉ ĐỌC approved-testcases.json để hiển thị testcase và link traceability.
 KHÔNG sửa / không ghi vào approved-testcases.json.
*/

export default class ApprovedTestcaseLoader {
    constructor({ searchRoot = process.cwd() } = {}) {
        this.searchRoot = searchRoot;
    }

    /** Tìm tất cả file tên approved-testcases.json trong output tree. */
    findFiles() {
        const files = [];
        const walk = dir => {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (entry.name === "node_modules") continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.name === "approved-testcases.json") files.push(full);
            }
        };
        walk(this.searchRoot);
        return files;
    }

    loadAll() {
        const files = this.findFiles();
        const result = [];
        for (const file of files) {
            let data;
            try {
                data = JSON.parse(fs.readFileSync(file, "utf8"));
            } catch {
                continue;
            }
            const items = Array.isArray(data) ? data : Array.isArray(data?.testCases) ? data.testCases : [];
            for (const item of items) {
                if (!item || typeof item !== "object") continue;
                const id = String(
                    item.testcaseId ?? item.id ?? ""
                ).trim();
                if (!id) continue;
                result.push({
                    id,
                    testcaseId: id,
                    title: String(item.title ?? item.scenario ?? item.name ?? "").trim(),
                    module: String(item.module ?? "").trim(),
                    feature: String(item.feature ?? item.function ?? "").trim(),
                    type: String(item.type ?? "").trim(),
                    reviewStatus: String(item.reviewStatus ?? item.status ?? "").trim() || "APPROVED"
                });
            }
        }
        // de-dup theo id
        const seen = new Set();
        return result.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    }
}
