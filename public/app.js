const STORAGE_KEY = "qa-copilot-v2.active-session";
const stages = [
    ["requirement", "Requirement"],
    ["clarificationReview", "Clarification"],
    ["requirementReview", "Requirement Review"],
    ["moduleReview", "Module Review"],
    ["scenarioReview", "Scenario Review"],
    ["testCaseReview", "TestCase Review"],
    ["completed", "Export"]
];
const state = {
    requirementFile: "",
    fileName: "",
    sessionId: "",
    artifactId: "",
    currentStage: "",
    pipelineStatus: "",
    workflowContext: null,
    artifact: null,
    busy: false
};

const $ = selector => document.querySelector(selector);
const elements = {
    progress: $("#progress"),
    startPanel: $("#startPanel"),
    reviewPanel: $("#reviewPanel"),
    completedPanel: $("#completedPanel"),
    reviewContent: $("#reviewContent"),
    reviewTitle: $("#reviewTitle"),
    stageLabel: $("#stageLabel"),
    reviewBadge: $("#reviewBadge"),
    requirementFile: $("#requirementFile"),
    selectedFile: $("#selectedFile"),
    startButton: $("#startButton"),
    saveButton: $("#saveButton"),
    approveButton: $("#approveButton"),
    newWorkflowButton: $("#newWorkflowButton"),
    outputList: $("#outputList"),
    statusPanel: $(".status-panel"),
    statusText: $("#statusText"),
    errorText: $("#errorText"),
    technicalDetails: $("#technicalDetails"),
    technicalContent: $("#technicalContent")
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok || payload?.success === false) {
        const error = new Error(
            payload?.error?.message || `Yêu cầu thất bại (${response.status}).`
        );
        error.details = payload?.error ?? null;
        throw error;
    }
    return payload?.data ?? payload;
}

function setBusy(busy, message = "") {
    state.busy = busy;
    [elements.startButton, elements.saveButton, elements.approveButton].forEach(button => {
        button.disabled =
            busy || (button === elements.startButton && !elements.requirementFile.files[0]);
    });
    elements.statusPanel.className = `status-panel ${busy ? "busy" : ""}`;
    if (message) elements.statusText.textContent = message;
}

function showError(error) {
    setBusy(false);
    elements.statusPanel.classList.add("failure");
    elements.statusText.textContent = "Có lỗi";
    elements.errorText.textContent = error.message || "Không thể hoàn thành thao tác.";
    elements.errorText.classList.remove("hidden");
    if (error.details) {
        elements.technicalContent.textContent = JSON.stringify(error.details, null, 2);
        elements.technicalDetails.classList.remove("hidden");
    }
}

function clearError() {
    elements.errorText.classList.add("hidden");
    elements.technicalDetails.classList.add("hidden");
}

function renderProgress() {
    const stageIndex =
        state.pipelineStatus === "COMPLETED"
            ? stages.length - 1
            : Math.max(
                  0,
                  stages.findIndex(([key]) => key === state.currentStage)
              );
    elements.progress.innerHTML = stages
        .map(
            ([, label], index) =>
                `<li class="${index < stageIndex ? "done" : index === stageIndex ? "active" : ""}">${index + 1}. ${label}</li>`
        )
        .join("");
}

function persist() {
    if (!state.sessionId) return;
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            sessionId: state.sessionId,
            requirementFile: state.requirementFile,
            fileName: state.fileName
        })
    );
}

function applyPipeline(result) {
    state.pipelineStatus = result.status;
    state.currentStage = result.currentStage || "";
    state.workflowContext = result.workflowContext;
    if (state.currentStage && state.workflowContext?.[state.currentStage]) {
        state.sessionId = state.workflowContext[state.currentStage].sessionId;
        state.artifactId = state.workflowContext[state.currentStage].artifactId;
    }
    persist();
}

async function uploadAndStart() {
    const file = elements.requirementFile.files[0];
    if (!file) return;
    clearError();
    try {
        setBusy(true, "Đang upload requirement...");
        const upload = await api("/api/requirements/upload", {
            method: "POST",
            headers: {
                "content-type": "text/markdown",
                "x-file-name": encodeURIComponent(file.name)
            },
            body: file
        });
        state.requirementFile = upload.requirementFile;
        state.fileName = upload.originalName;
        setBusy(true, "AI đang phân tích requirement...");
        const result = await api("/api/workflows", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requirementFile: upload.requirementFile })
        });
        applyPipeline(result);
        await loadCurrentReview();
    } catch (error) {
        showError(error);
    }
}

async function loadCurrentReview() {
    clearError();
    setBusy(true, "Đang tải review...");
    try {
        const review = await api(
            `/api/workflows/${encodeURIComponent(state.sessionId)}/current-review`
        );
        state.artifactId = review.artifactId;
        state.artifact = review.artifact;
        renderReview();
        setBusy(false, "Đang chờ phê duyệt");
        elements.statusPanel.classList.add("success");
    } catch (error) {
        showError(error);
    }
}

function inputField(label, key, value, { multiline = false, full = false } = {}) {
    const tag = multiline
        ? `<textarea data-field="${key}">${escapeHtml(value)}</textarea>`
        : `<input type="text" data-field="${key}" value="${escapeHtml(value)}" />`;
    return `<div class="field ${full ? "full" : ""}"><label>${label}</label>${tag}</div>`;
}

function renderReview() {
    elements.startPanel.classList.add("hidden");
    elements.completedPanel.classList.add("hidden");
    elements.reviewPanel.classList.remove("hidden");
    elements.newWorkflowButton.classList.remove("hidden");
    elements.reviewBadge.textContent = state.artifact?.approvalStatus || "pending";
    const renderers = {
        clarificationReview: renderClarification,
        requirementReview: renderRequirement,
        moduleReview: renderModules,
        scenarioReview: renderScenarios,
        testCaseReview: renderTestCases
    };
    const titles = {
        clarificationReview: "Làm rõ requirement",
        requirementReview: "Review requirement",
        moduleReview: "Review module và chức năng",
        scenarioReview: "Review test scenario",
        testCaseReview: "Review test case"
    };
    elements.stageLabel.textContent = state.currentStage;
    elements.reviewTitle.textContent = titles[state.currentStage] || "Review";
    renderers[state.currentStage]?.();
    renderProgress();
}

function renderClarification() {
    const questions = state.artifact?.questions || [];
    elements.reviewContent.innerHTML = questions
        .map(
            question => `
            <article class="question-card" data-question-id="${escapeHtml(question.questionId)}">
                <div class="item-heading">
                    <span class="badge">${escapeHtml(question.category || "General")}</span>
                    <strong>${escapeHtml(question.priority || "Medium")}</strong>
                </div>
                <h3>${escapeHtml(question.question)}</h3>
                <p class="muted">${escapeHtml(question.reason)}</p>
                <div class="options">
                    ${(question.options || [])
                        .map(
                            option => `<label class="option">
                                <input type="radio" name="${escapeHtml(question.questionId)}"
                                    value="${escapeHtml(option)}"
                                    ${question.answer === option ? "checked" : ""}>
                                <span>${escapeHtml(option)}</span>
                            </label>`
                        )
                        .join("")}
                </div>
            </article>`
        )
        .join("");
}

function renderRequirement() {
    const value = state.artifact?.requirement || {};
    elements.reviewContent.innerHTML = `<div class="form-grid">
        ${inputField("Module", "module", value.module)}
        ${inputField("Feature", "feature", value.feature)}
        ${inputField("Mục đích", "purpose", value.purpose, { multiline: true, full: true })}
        ${inputField("Mô tả", "description", value.description, { multiline: true, full: true })}
        ${inputField("Quyền", "permissions", listText(value.permissions), { multiline: true })}
        ${inputField("Common Inputs", "commonInputs", listText(value.commonInputs), { multiline: true })}
        ${inputField("Business Rules", "businessRules", listText(value.businessRules), { multiline: true })}
        ${inputField("Risk Areas", "riskAreas", listText(state.artifact?.knowledge?.riskAreas), { multiline: true })}
    </div>`;
}

function renderModules() {
    renderCollection("modules", state.artifact?.modules || [], [
        ["module", "Module"],
        ["feature", "Chức năng"],
        ["description", "Mô tả"],
        ["source", "Nguồn"],
        ["confidence", "Confidence"]
    ]);
}

function renderScenarios() {
    renderCollection("scenarios", state.artifact?.scenarios || [], [
        ["id", "ID"],
        ["module", "Module"],
        ["feature", "Feature"],
        ["title", "Title"],
        ["type", "Type"],
        ["priority", "Priority"],
        ["severity", "Severity"],
        ["preconditions", "Preconditions"],
        ["expectedResult", "Expected result"],
        ["automationCandidate", "Automation"]
    ]);
}

function renderTestCases() {
    renderCollection("testCases", state.artifact?.testCases || [], [
        ["id", "ID"],
        ["feature", "Chức năng"],
        ["title", "Tình huống kiểm tra"],
        ["testData", "Dữ liệu đầu vào"],
        ["steps", "Các bước thực hiện"],
        ["expectedResult", "Kết quả mong đợi"],
        ["actualResult", "Kết quả thực tế"],
        ["severity", "Severity"],
        ["priority", "Priority"],
        ["automationCandidate", "Automation Candidate"]
    ]);
}

function renderCollection(key, items, fields) {
    const rows = items
        .map(
            (item, index) => `<article class="review-item" data-index="${index}">
                <div class="item-heading"><strong>Mục ${index + 1}</strong>
                    <button class="button danger remove-item" type="button">Xóa</button>
                </div>
                <div class="form-grid">
                    ${fields
                        .map(([field, label]) =>
                            inputField(label, field, editableValue(item[field]), {
                                multiline: [
                                    "description",
                                    "preconditions",
                                    "expectedResult",
                                    "testData",
                                    "steps"
                                ].includes(field),
                                full: [
                                    "description",
                                    "preconditions",
                                    "expectedResult",
                                    "testData",
                                    "steps"
                                ].includes(field)
                            })
                        )
                        .join("")}
                </div>
            </article>`
        )
        .join("");
    elements.reviewContent.innerHTML = `<div data-collection="${key}">${rows}</div>
        <button id="addItemButton" class="button secondary" type="button">Thêm mục</button>`;
    elements.reviewContent.querySelectorAll(".remove-item").forEach(button => {
        button.addEventListener("click", () => button.closest(".review-item").remove());
    });
    $("#addItemButton").addEventListener("click", () => {
        const current = collectCollection(key, fields);
        current.push({});
        state.artifact[key] = current;
        renderCollection(key, current, fields);
    });
}

function editableValue(value) {
    if (Array.isArray(value))
        return value
            .map(item =>
                typeof item === "string"
                    ? item
                    : item.action || item.content || JSON.stringify(item)
            )
            .join("\n");
    if (value && typeof value === "object") return JSON.stringify(value, null, 2);
    return value ?? "";
}

function listText(value) {
    return Array.isArray(value)
        ? value
              .map(item =>
                  typeof item === "string"
                      ? item
                      : item.content || item.name || JSON.stringify(item)
              )
              .join("\n")
        : editableValue(value);
}

function textList(value) {
    return String(value || "")
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}

function listEdit(value, original) {
    return String(value || "").trim() === listText(original).trim()
        ? structuredClone(original || [])
        : textList(value);
}

function parseComplex(value, original) {
    const text = String(value || "").trim();
    if (original && typeof original === "object" && text === editableValue(original).trim()) {
        return structuredClone(original);
    }
    if (original && typeof original === "object" && !Array.isArray(original)) {
        try {
            return JSON.parse(text || "{}");
        } catch {
            return text;
        }
    }
    return Array.isArray(original) ? textList(text) : text;
}

function collectCollection(key, fields) {
    const originals = state.artifact?.[key] || [];
    return [...elements.reviewContent.querySelectorAll(".review-item")].map((row, index) => {
        const original = originals[index] || {};
        const updated = { ...original };
        fields.forEach(([field]) => {
            const input = row.querySelector(`[data-field="${field}"]`);
            updated[field] = parseComplex(input?.value, original[field]);
        });
        return updated;
    });
}

function collectArtifact() {
    const artifact = structuredClone(state.artifact);
    if (state.currentStage === "requirementReview") {
        const requirement = { ...(artifact.requirement || {}) };
        elements.reviewContent.querySelectorAll("[data-field]").forEach(input => {
            if (input.dataset.field === "riskAreas") {
                artifact.knowledge = {
                    ...(artifact.knowledge || {}),
                    riskAreas: listEdit(input.value, artifact.knowledge?.riskAreas)
                };
            } else if (
                ["permissions", "commonInputs", "businessRules"].includes(input.dataset.field)
            ) {
                requirement[input.dataset.field] = listEdit(
                    input.value,
                    requirement[input.dataset.field]
                );
            } else {
                requirement[input.dataset.field] = input.value.trim();
            }
        });
        artifact.requirement = requirement;
    } else if (state.currentStage === "moduleReview") {
        artifact.modules = collectCollection("modules", [
            ["module"],
            ["feature"],
            ["description"],
            ["source"],
            ["confidence"]
        ]);
    } else if (state.currentStage === "scenarioReview") {
        artifact.scenarios = collectCollection("scenarios", [
            ["id"],
            ["module"],
            ["feature"],
            ["title"],
            ["type"],
            ["priority"],
            ["severity"],
            ["preconditions"],
            ["expectedResult"],
            ["automationCandidate"]
        ]);
    } else if (state.currentStage === "testCaseReview") {
        artifact.testCases = collectCollection("testCases", [
            ["id"],
            ["feature"],
            ["title"],
            ["testData"],
            ["steps"],
            ["expectedResult"],
            ["actualResult"],
            ["severity"],
            ["priority"],
            ["automationCandidate"]
        ]);
    }
    return artifact;
}

async function saveCurrent() {
    clearError();
    setBusy(true, "Đang lưu...");
    try {
        if (state.currentStage === "clarificationReview") {
            const cards = [...elements.reviewContent.querySelectorAll(".question-card")];
            const unanswered = cards.filter(card => !card.querySelector("input:checked"));
            if (unanswered.length)
                throw new Error(`Còn ${unanswered.length} câu hỏi chưa được trả lời.`);
            for (const card of cards) {
                await api(
                    `/api/workflows/${encodeURIComponent(state.sessionId)}/clarifications/${encodeURIComponent(card.dataset.questionId)}`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            answer: card.querySelector("input:checked").value,
                            answeredBy: "user"
                        })
                    }
                );
            }
        } else {
            const artifact = collectArtifact();
            state.artifact = await api(
                `/api/workflows/${encodeURIComponent(state.sessionId)}/artifacts/${encodeURIComponent(state.artifactId)}`,
                {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ artifact })
                }
            );
        }
        setBusy(false, "Đã lưu thay đổi");
        elements.statusPanel.classList.add("success");
    } catch (error) {
        showError(error);
        throw error;
    }
}

async function approveAndContinue() {
    clearError();
    try {
        await saveCurrent();
        setBusy(true, "Đang phê duyệt...");
        await api(`/api/workflows/${encodeURIComponent(state.sessionId)}/approve`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ artifactId: state.artifactId, approvedBy: "user" })
        });
        setBusy(true, "Đang tiếp tục pipeline...");
        const result = await api(`/api/workflows/${encodeURIComponent(state.sessionId)}/resume`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}"
        });
        applyPipeline(result);
        if (result.completed || result.status === "COMPLETED") {
            await renderCompleted();
        } else {
            await loadCurrentReview();
        }
    } catch (error) {
        showError(error);
    }
}

async function renderCompleted() {
    elements.reviewPanel.classList.add("hidden");
    elements.startPanel.classList.add("hidden");
    elements.completedPanel.classList.remove("hidden");
    renderProgress();
    setBusy(false, "Hoàn thành");
    elements.statusPanel.classList.add("success");
    const outputData = await api(`/api/workflows/${encodeURIComponent(state.sessionId)}/outputs`);
    const outputs = outputData.outputs || {};
    elements.outputList.innerHTML =
        Object.keys(outputs)
            .map(
                format =>
                    `<a class="output-link" href="/api/workflows/${encodeURIComponent(state.sessionId)}/outputs/${encodeURIComponent(format)}/download">${format.toUpperCase()}</a>`
            )
            .join("") || '<div class="empty-state">Chưa có output.</div>';
    localStorage.removeItem(STORAGE_KEY);
}

async function restoreSession() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved?.sessionId) return;
    if (!confirm(`Tiếp tục phiên "${saved.fileName || saved.sessionId}" chưa hoàn tất?`)) return;
    state.sessionId = saved.sessionId;
    state.requirementFile = saved.requirementFile;
    state.fileName = saved.fileName;
    try {
        const workflow = await api(`/api/workflows/${encodeURIComponent(saved.sessionId)}`);
        state.pipelineStatus = workflow.pipelineStatus;
        state.workflowContext = workflow.workflowContext;
        const active = Object.entries(state.workflowContext || {}).find(
            ([, value]) => value.sessionId === saved.sessionId
        );
        state.currentStage = active?.[0] || workflow.session.currentStage;
        if (state.pipelineStatus === "COMPLETED") await renderCompleted();
        else await loadCurrentReview();
    } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
        showError(new Error("Phiên đã lưu không còn tồn tại. Vui lòng bắt đầu phiên mới."));
    }
}

function resetWorkspace() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

elements.requirementFile.addEventListener("change", () => {
    const file = elements.requirementFile.files[0];
    elements.selectedFile.textContent = file ? file.name : "Chưa chọn file";
    elements.startButton.disabled = !file;
});
elements.startButton.addEventListener("click", uploadAndStart);
elements.saveButton.addEventListener("click", () => saveCurrent().catch(() => {}));
elements.approveButton.addEventListener("click", approveAndContinue);
elements.newWorkflowButton.addEventListener("click", resetWorkspace);

renderProgress();
restoreSession();
