function text(value, fallback = "Chưa xác định") {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
}

function bullets(items, fallback = "Chưa xác định") {
    const list = Array.isArray(items) ? items.map(item => text(item, "")).filter(Boolean) : [];
    return list.length ? list.map(item => `- ${item}`).join("\n") : `- ${fallback}`;
}

function table(headers, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const escape = value => text(value, "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...safeRows.map(row => `| ${headers.map(header => escape(row?.[header])).join(" | ")} |`)
    ].join("\n");
}

export default class RequirementMarkdownRenderer {
    render(document = {}) {
        const module = document.module ?? {};
        const sections = [
            `# Module: ${text(module.name)}`,
            "## Thông tin chung",
            `### Mục đích\n\n${text(module.purpose)}`,
            `### Mô tả\n\n${text(module.description)}`,
            `### Quyền truy cập\n\n${bullets(module.permissions)}`,
            `### Dữ liệu dùng chung\n\n${table(["Trường", "Control Type", "Nguồn dữ liệu", "Bắt buộc", "Mô tả"], module.sharedData)}`,
            `### Quan hệ dữ liệu\n\n${bullets(module.relationships)}`,
            "# Features"
        ];

        for (const feature of Array.isArray(document.features) ? document.features : []) {
            const automation = feature?.automation ?? {};
            sections.push([
                `## Feature: ${text(feature?.name)}`,
                `### Mô tả\n\n${text(feature?.description)}`,
                `### Điều kiện tiên quyết\n\n${bullets(feature?.preconditions)}`,
                `### Input\n\n${table(["Trường", "Bắt buộc", "Quy tắc"], feature?.inputs)}`,
                `### Luồng chính\n\n${(Array.isArray(feature?.mainFlow) && feature.mainFlow.length) ? feature.mainFlow.map((item, index) => `${index + 1}. ${text(item)}`).join("\n") : "1. Chưa xác định"}`,
                `### Quy tắc nghiệp vụ\n\n${bullets(feature?.businessRules)}`,
                `### Validation\n\n${bullets(feature?.validations)}`,
                `### Kết quả mong đợi\n\n${bullets(feature?.expectedResults)}`,
                `### Ngoại lệ\n\n${bullets(feature?.exceptions)}`,
                `### Automation\n\nScreen: ${text(automation.screen)}\n\nOperation: ${text(automation.operation)}\n\nPriority: ${text(automation.priority, "Medium")}\n\nAutomation Candidate: ${automation.candidate === false ? "No" : "Yes"}\n\nTags:\n\n${bullets(automation.tags)}`,
                "---"
            ].join("\n\n"));
        }
        return `${sections.join("\n\n").trim()}\n`;
    }
}
