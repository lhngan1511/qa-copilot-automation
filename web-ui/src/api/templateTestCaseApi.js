import { apiClient } from "./apiClient.js";

/* "Tạo testcase nhanh theo khuôn mẫu" — nguồn thứ 3 sinh testcase, THUẦN RULE-BASED (không AI).
   Endpoint STATELESS (/api/template-testcases/generate, không /api/workflows/*) — chỉ sinh testcase
   từ dữ liệu wizard, KHÔNG lưu gì. Caller (TestCaseReviewPanel) tự merge kết quả vào "Duyệt testcase"
   đang mở bằng persistBatch() sẵn có (cùng cơ chế nextStableTestCaseId()/assignDisplayIds() mà
   "+ Tạo testcase từ CodeGen" dùng). */
export async function generateTemplateTestCases({ functionName, operations }) {
    const response = await apiClient.post("/template-testcases/generate", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ functionName, operations })
    });
    const testCases = response?.testCases;
    return Array.isArray(testCases) ? testCases : [];
}
