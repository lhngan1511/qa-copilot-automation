/* Công thức chuẩn — số testcase tối thiểu theo loại nghiệp vụ (Ngân chốt 2026-09-04, dùng để đối
   chiếu/sanity-check mỗi khi AI sinh testcase, KHÔNG phụ thuộc module nào):

     Tìm kiếm     2         1 (có kết quả) + 1 (không có kết quả)
     Thêm mới     1 + N + M 1 (thành công, hợp lệ) + N (mỗi field bắt buộc) + M (mỗi business rule
                            riêng của field, vd trùng mã/sai định dạng/quan hệ giữa 2 field)
     Sửa          1 + N + M Tương tự Thêm mới, áp dụng cho field có thể sửa
     Xóa          1 + K     1 (thành công) + K (mỗi điều kiện chặn xóa, vd đang được sử dụng)
     Phân quyền   1/role    1 testcase/role bị chặn cho mỗi operation có yêu cầu quyền
     In ấn        4         Chính xác thông tin + đúng định dạng + đúng chính tả + đúng biểu mẫu
     Xuất Excel   4         (giống In ấn)

   Nếu tổng testcase AI sinh ra THẤP HƠN tổng tối thiểu này -> coi là BẤT THƯỜNG, phải giải thích rõ
   lý do (thiếu do gộp nhầm/rơi mất clarification/field không xác định được...), không được mặc định
   coi là "đã xong". Đây là diagnostic/soft-check (giống CoreTestCaseCoverageValidator) — KHÔNG chặn
   pipeline, chỉ trả về report để hiển thị cảnh báo cho tester tự xem xét.

   Giới hạn đã biết: automation.operation hiện chỉ có SEARCH/CREATE/UPDATE/DELETE/VIEW/OTHER (xem
   CodeGenRequirementDocumentBuilder.js) — "VIEW" gộp chung cả In ấn lẫn Xuất Excel (chưa phân biệt
   được), nên áp minimum 4 cho VIEW thay vì tách riêng 2 loại. */
export default class MinimumTestCaseCountValidator {
    validate(knowledge, testCases = []) {
        const cases = Array.isArray(testCases) ? testCases : [];
        const functions = Array.isArray(knowledge?.functions) ? knowledge.functions : [];

        const perFunction = functions.map(functionKnowledge => {
            const breakdown = this.minimumFor(functionKnowledge);
            const actualCount = this.countTestCasesFor(functionKnowledge, cases);
            const expectedMinimum = breakdown.total;
            return {
                functionId: functionKnowledge.id ?? "",
                function: functionKnowledge.name ?? "",
                operation: functionKnowledge.automation?.operation ?? "OTHER",
                expectedMinimum,
                actualCount,
                deficit: Math.max(0, expectedMinimum - actualCount),
                breakdown,
                valid: actualCount >= expectedMinimum
            };
        });

        const deficits = perFunction.filter(item => !item.valid);
        const totalExpectedMinimum = perFunction.reduce((sum, item) => sum + item.expectedMinimum, 0);
        const totalActualCount = perFunction.reduce((sum, item) => sum + item.actualCount, 0);

        return {
            valid: deficits.length === 0,
            totalExpectedMinimum,
            totalActualCount,
            perFunction,
            deficits
        };
    }

    /** Tính tối thiểu theo CÔNG THỨC CHUẨN cho 1 function, dựa theo operation của nó. Trả về
     *  breakdown chi tiết (không chỉ tổng số) để tester/log biết ĐANG THIẾU LOẠI NÀO khi có deficit. */
    minimumFor(functionKnowledge) {
        const operation = String(functionKnowledge?.automation?.operation ?? "").toUpperCase();
        const inputs = Array.isArray(functionKnowledge?.inputs) ? functionKnowledge.inputs : [];
        const requiredFieldCount = inputs.filter(input => input?.required === true).length;
        const businessRuleCount = (Array.isArray(functionKnowledge?.businessRules)
            ? functionKnowledge.businessRules
            : []
        ).length;
        const blockingConditionCount =
            (Array.isArray(functionKnowledge?.businessRules) ? functionKnowledge.businessRules.length : 0) +
            (Array.isArray(functionKnowledge?.exceptions) ? functionKnowledge.exceptions.length : 0);
        const permissionCount = (Array.isArray(functionKnowledge?.permissions)
            ? functionKnowledge.permissions
            : []
        ).length;

        switch (operation) {
            case "SEARCH":
                return { rule: "SEARCH: 2 (có kết quả + không có kết quả)", success: 1, noResult: 1, total: 2 };
            case "CREATE":
                return {
                    rule: "CREATE: 1 + N (field bắt buộc) + M (business rule riêng của field)",
                    success: 1,
                    requiredFieldCount,
                    businessRuleCount,
                    total: 1 + requiredFieldCount + businessRuleCount
                };
            case "UPDATE":
                return {
                    rule: "UPDATE: 1 + N (field có thể sửa, bắt buộc) + M (business rule riêng của field)",
                    success: 1,
                    requiredFieldCount,
                    businessRuleCount,
                    total: 1 + requiredFieldCount + businessRuleCount
                };
            case "DELETE":
                return {
                    rule: "DELETE: 1 + K (mỗi điều kiện chặn xóa)",
                    success: 1,
                    blockingConditionCount,
                    total: 1 + blockingConditionCount
                };
            case "VIEW":
                // Chưa phân biệt được In ấn / Xuất Excel từ operation hiện có -> áp minimum chung 4.
                return {
                    rule: "In ấn/Xuất Excel: 4 (thông tin + định dạng + chính tả + biểu mẫu)",
                    total: 4
                };
            default:
                return { rule: `${operation || "OTHER"}: chưa có công thức chuẩn`, total: 0 };
        }
    }

    countTestCasesFor(functionKnowledge, testCases) {
        const functionId = this.normalize(functionKnowledge?.id);
        const functionName = this.normalize(functionKnowledge?.name);
        if (!functionId && !functionName) return 0;

        return testCases.filter(testCase => this.testCaseTargets(testCase).some(
            target => (functionId && target === functionId) || (functionName && target === functionName)
        )).length;
    }

    /** Testcase sinh từ OPERATION_MATCH broadcast (nhiều function cùng operation) hoặc bị dedupe ở
     *  tầng hiển thị (TestCaseGenerator#dedupeIdenticalContentTestCases) có `function`/`feature` là
     *  CHUỖI GỘP nhiều tên cách nhau bởi ", " — phải tách ra so khớp TỪNG tên, không so nguyên chuỗi
     *  (nếu không sẽ đếm thiếu, coi testcase đã gộp là "không thuộc function nào"). */
    testCaseTargets(testCase) {
        const raw = [testCase?.functionId, testCase?.function, testCase?.feature]
            .filter(value => typeof value === "string" && value.trim());
        return [...new Set(raw.flatMap(value => value.split(",").map(part => this.normalize(part))))].filter(
            Boolean
        );
    }

    normalize(value) {
        return String(value ?? "")
            .normalize("NFC")
            .toLocaleLowerCase("vi")
            .trim();
    }
}
