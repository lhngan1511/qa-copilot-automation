const RequirementKnowledgeSchema = Object.freeze({
    /*
     * Ý nghĩa: mục đích nghiệp vụ được requirement mô tả.
     * Nguồn: nội dung requirement hoặc câu trả lời clarification đã được người dùng xác nhận.
     * AI chỉ được phép tóm tắt evidence hiện có.
     * AI không được tự đoán mục tiêu nghiệp vụ không xuất hiện trong nguồn.
     */
    purpose: "",

    /*
     * Ý nghĩa: các chức năng nghiệp vụ có evidence trong requirement.
     * Nguồn: requirement và clarification answers đã được người dùng xác nhận.
     * AI được phép chuẩn hóa cách diễn đạt nhưng phải giữ traceability.
     * AI không được tự tạo chức năng, module, ID hoặc phạm vi nghiệp vụ mới.
     */
    functions: Object.freeze([
        Object.freeze({
            /*
             * Ý nghĩa: tên chức năng nghiệp vụ.
             * Nguồn: tiêu đề/phần chức năng trong requirement hoặc câu trả lời đã xác nhận.
             * AI chỉ được phép chuẩn hóa khoảng trắng và cách diễn đạt tương đương.
             * AI không được tự đặt tên CRUD hoặc chức năng không có evidence.
             */
            name: "",

            /*
             * Ý nghĩa: mô tả ngắn về hành vi của chức năng.
             * Nguồn: mô tả, flow hoặc expected result thuộc chức năng.
             * AI được phép tóm tắt nội dung có evidence.
             * AI không được bổ sung hành vi hoặc kết quả chưa được nêu.
             */
            description: "",

            /*
             * Ý nghĩa: các quy tắc nghiệp vụ áp dụng cho chức năng.
             * Nguồn: business rule, condition, exception hoặc clarification đã xác nhận.
             * AI được phép trích xuất và diễn đạt lại mà không đổi nghĩa.
             * AI không được tạo quy tắc mới hoặc gán rule sang chức năng khác.
             */
            businessRules: Object.freeze([]),

            /*
             * Ý nghĩa: các ràng buộc hợp lệ của dữ liệu đầu vào.
             * Nguồn: input definition, required marker, valid values và validation text.
             * AI được phép chuẩn hóa validation có evidence rõ ràng.
             * AI không được tự đặt format, độ dài, miền giá trị hoặc field bắt buộc.
             */
            validationRules: Object.freeze([]),

            /*
             * Ý nghĩa: quyền hoặc điều kiện truy cập của chức năng.
             * Nguồn: permission, role, actor, precondition hoặc clarification đã xác nhận.
             * AI chỉ được phép trích xuất quyền được nêu rõ.
             * AI không được tự giả định đăng nhập, vai trò hoặc quyền CRUD.
             */
            permissions: Object.freeze([]),

            /*
             * Ý nghĩa: phụ thuộc nghiệp vụ cần có để chức năng hoạt động.
             * Nguồn: quan hệ hoặc hệ thống phụ thuộc được requirement nêu rõ.
             * AI chỉ được tạo dependency khi requirement có evidence.
             * AI không được suy đoán dependency kỹ thuật, database, API hoặc service.
             */
            dependencies: Object.freeze([]),

            /*
             * Ý nghĩa: giả định cần được công khai để người dùng xem xét.
             * Nguồn: assumption được ghi rõ hoặc clarification answer đã xác nhận.
             * AI chỉ được phép ghi nhận assumption có evidence và phải phân biệt với fact.
             * AI không được tự giả định trạng thái hệ thống, dữ liệu hoặc hành vi người dùng.
             */
            assumptions: Object.freeze([]),

            /*
             * Ý nghĩa: tham chiếu từ knowledge về vị trí nguồn trong requirement.
             * Nguồn: code, heading, rule ID hoặc đoạn nguồn có sẵn.
             * AI được phép liên kết item với reference tồn tại.
             * AI không được phát minh code, ID hoặc reference không có trong nguồn.
             */
            requirementReferences: Object.freeze([])
        })
    ]),

    /*
     * Ý nghĩa: rủi ro kiểm thử có evidence từ requirement.
     * Nguồn: rule, exception, dependency hoặc clarification đã xác nhận.
     * AI được phép mô tả tác động của evidence đã có.
     * AI không được biến mọi test focus thành risk hoặc tự tạo rủi ro kỹ thuật.
     */
    risks: Object.freeze([]),

    /*
     * Ý nghĩa: câu hỏi cần người dùng làm rõ trước khi knowledge được approve.
     * Nguồn: khoảng trống hoặc mâu thuẫn có thể chỉ ra trong requirement.
     * AI được phép hỏi về thông tin thiếu ảnh hưởng trực tiếp tới testcase.
     * AI không được tự trả lời, tự xác nhận hoặc hỏi về giả định không có tín hiệu.
     */
    clarificationQuestions: Object.freeze([]),

    /*
     * Ý nghĩa: đánh dấu AI có tìm thấy khoảng trống cần clarification hay không.
     * Nguồn: đánh giá dựa trên contract bắt buộc và evidence của requirement.
     * AI được phép trả true chỉ khi các thông tin cần thiết đều có evidence.
     * AI không được coi requirement là hoàn chỉnh bằng cách tự điền thông tin thiếu.
     */
    requirementComplete: false
});

export default RequirementKnowledgeSchema;
