import { API_BASE_URL, API_ORIGIN, ApiError, apiClient } from "./apiClient.js";
import { extractWorkflowId } from "../utils/workflowResponse.js";
import { parseAIAnalysisReview } from "../utils/aiAnalysisReview.js";
import { parseTestCaseReview } from "../utils/testCaseReview.js";

export async function listWorkflows({ limit = 6, offset = 0, signal } = {}) {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
    });
    const response = await apiClient.get(`/workflows?${params}`, { signal });

    return response?.data ?? { items: [], pagination: {} };
}

export async function getWorkflow(workflowId, { signal } = {}) {
    const response = await apiClient.get(`/workflows/${encodeURIComponent(workflowId)}`, {
        signal
    });

    return response?.data?.workflow ?? null;
}

export async function getBackendHealth({ signal } = {}) {
    const response = await apiClient.get("/health", {
        signal,
        baseUrl: API_ORIGIN
    });

    return response?.data ?? null;
}

export async function uploadRequirement({ file, signal }) {
    const response = await apiClient.post("/requirements/upload", {
        headers: {
            "Content-Type": "text/markdown",
            "x-file-name": encodeURIComponent(file.name)
        },
        body: file,
        signal
    });

    return response?.data ?? null;
}

export async function startWorkflow({ requirementId, signal }) {
    const response = await apiClient.post("/workflows", {
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ requirementId }),
        signal
    });

    return response?.data ?? null;
}

export async function deleteWorkflow(workflowId, { signal } = {}) {
    const response = await apiClient.delete(`/workflows/${encodeURIComponent(workflowId)}`, { signal });
    return response?.data ?? null;
}

export async function analyzeRequirementImages({ images, analysisMode = "FEATURES", signal }) {
    const encoded = await Promise.all(images.map(async file => ({
        name: file.name,
        mimeType: file.type,
        data: await fileToBase64(file)
    })));
    const response = await apiClient.post("/requirement-drafts/images/analyze", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: encoded, analysisMode }),
        signal
    });
    return response?.data ?? null;
}

export async function confirmImageRequirement({ draftId, markdownContent, fileName, signal }) {
    const response = await apiClient.post(`/requirement-drafts/images/${encodeURIComponent(draftId)}/confirm`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdownContent, fileName }),
        signal
    });
    return response?.data ?? null;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new ApiError({ code: "IMAGE_READ_FAILED", message: `Không đọc được ảnh ${file.name}.` }));
        reader.readAsDataURL(file);
    });
}

export async function createWorkflow({ file, signal }) {
    const upload = await uploadRequirement({ file, signal });
    const requirementId = upload?.requirementId;

    if (typeof requirementId !== "string" || !requirementId.trim()) {
        throw new ApiError({
            code: "INVALID_UPLOAD_RESPONSE",
            message: "Backend không trả về requirement ID hợp lệ."
        });
    }

    const result = await startWorkflow({ requirementId, signal });
    let workflowId;

    try {
        workflowId = extractWorkflowId(result);
    } catch (error) {
        throw new ApiError({
            code: "INVALID_WORKFLOW_RESPONSE",
            message: error.message
        });
    }

    return {
        workflowId,
        workflow: result?.workflow ?? null,
        upload: {
            requirementId,
            originalName: upload?.originalName ?? file.name,
            size: upload?.size ?? file.size
        }
    };
}

export async function getAIAnalysisReview(workflowId, { signal } = {}) {
    const response = await apiClient.get(
        `/workflows/${encodeURIComponent(workflowId)}/ai-analysis-review`,
        { signal }
    );

    return parseAIAnalysisReview(response?.data);
}

export async function answerClarification({
    workflowId,
    questionId,
    answer,
    answeredBy = "user",
    signal
}) {
    return apiClient.post(
        `/workflows/${encodeURIComponent(workflowId)}/clarifications/${encodeURIComponent(
            questionId
        )}`,
        {
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ answer, answeredBy }),
            signal
        }
    );
}

export async function updateAIAnalysis({ workflowId, artifactId, analysis, signal }) {
    const response = await apiClient.put(
        `/workflows/${encodeURIComponent(workflowId)}/ai-analysis-review`,
        {
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ artifactId, analysis }),
            signal
        }
    );

    return parseAIAnalysisReview(response?.data);
}

export async function approveAIAnalysis({ workflowId, artifactId, approvedBy = "user", signal }) {
    return apiClient.post(`/workflows/${encodeURIComponent(workflowId)}/approve`, {
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ artifactId, approvedBy }),
        signal
    });
}

export async function resumeWorkflow(workflowId, { signal } = {}) {
    const response = await apiClient.post(`/workflows/${encodeURIComponent(workflowId)}/resume`, {
        signal
    });
    const result = response?.data;

    return {
        workflowId: extractWorkflowId(result),
        workflow: result?.workflow ?? null
    };
}

export async function getTestCaseReview(workflowId, { signal } = {}) {
    const response = await apiClient.get(
        `/workflows/${encodeURIComponent(workflowId)}/test-case-review`,
        { signal }
    );

    return parseTestCaseReview(response?.data);
}

export async function updateTestCaseReview({ workflowId, artifactId, testCases, signal }) {
    const response = await apiClient.put(
        `/workflows/${encodeURIComponent(workflowId)}/test-case-review`,
        {
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ artifactId, testCases }),
            signal
        }
    );

    return parseTestCaseReview(response?.data);
}

export async function approveTestCaseReview({
    workflowId,
    artifactId,
    approvedBy = "user",
    signal
}) {
    return apiClient.post(`/workflows/${encodeURIComponent(workflowId)}/approve`, {
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ artifactId, approvedBy }),
        signal
    });
}

export function getWorkflowOutputUrl(workflowId, format) {
    return `${API_BASE_URL}/workflows/${encodeURIComponent(
        workflowId
    )}/outputs/${encodeURIComponent(format)}/download`;
}
