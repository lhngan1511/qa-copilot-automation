import { Router } from "express";
import { handle } from "./automationV3Routes.js";
import TemplateTestCaseGenerator from "../generators/TemplateTestCaseGenerator.js";

/* "Tạo testcase nhanh theo khuôn mẫu" — nguồn thứ 3 sinh testcase, THUẦN RULE-BASED (không AI).
   Endpoint STATELESS — không gắn với workflow/session nào (khác /api/workflows/*): nhận dữ liệu
   wizard, trả về testcase sinh sẵn; FRONTEND tự merge kết quả vào "Duyệt testcase" đang mở, dùng
   ĐÚNG cơ chế nextStableTestCaseId()/assignDisplayIds() + PUT /api/workflows/:id/test-case-review
   mà "+ Tạo testcase từ CodeGen" đã dùng (xem CodeGenRequirementReviewPage.jsx#performMerge) —
   không cần tạo cơ chế merge/ID mới. */
export default function createTemplateTestCaseRoutes({ generator = new TemplateTestCaseGenerator() } = {}) {
    const router = Router();

    router.post(
        "/generate",
        handle(generator, (gen, req) => ({
            testCases: gen.generate({
                functionName: req.body?.functionName,
                operations: req.body?.operations
            })
        }))
    );

    return router;
}
