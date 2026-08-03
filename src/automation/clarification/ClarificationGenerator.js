/**
 * ClarificationGenerator — bước Automation AI Clarification (6 câu bắt buộc).
 *
 * Đọc:
 *  - approved-testcases.json của Login (cấu trúc { originalTestCase, pipelineMetadata })
 *  - outputs/automation/evidence/Login.json
 *  - outputs/automation/confirmed-facts/Login.json
 *
 * Quy tắc:
 *  - AI CHỈ tạo câu hỏi + gợi ý lựa chọn. KHÔNG tự trả lời thay tester.
 *  - KHÔNG tự chuyển Evidence thành Confirmed Fact.
 *  - KHÔNG tự sửa testcase/step.
 *  - KHÔNG hỏi lại những gì Codegen đã chứng minh; chỉ hỏi tester có chấp nhận dùng cho mapping/assertion.
 *  - Không hỏi lại Mã xác nhận (đã có Confirmed Fact CF-LOGIN-CAPTCHA-001 = ARBITRARY_NON_EMPTY_TEXT).
 *  - Không hỏi lại sample values Codegen (mặc định OBSERVED, không phải approved).
 */
import fs from "node:fs";
import path from "node:path";

export default class ClarificationGenerator {
    constructor({ testCasesFile = null, evidenceFile = null, confirmedFactsFile = null } = {}) {
        this.testCasesFile = testCasesFile;
        this.evidenceFile = evidenceFile;
        this.confirmedFactsFile = confirmedFactsFile;
    }

    loadEvidence() {
        if (!this.evidenceFile || !fs.existsSync(this.evidenceFile)) return { map: {}, list: [] };
        const data = JSON.parse(fs.readFileSync(this.evidenceFile, "utf8"));
        const list = Array.isArray(data.evidence) ? data.evidence : [];
        const map = {};
        for (const ev of list) map[ev.evidenceId] = ev;
        return { map, list };
    }

    loadTestCases() {
        if (!this.testCasesFile || !fs.existsSync(this.testCasesFile)) return [];
        const data = JSON.parse(fs.readFileSync(this.testCasesFile, "utf8"));
        // Hỗ trợ cả dạng { testCases: [...] } và mảng testcase
        const list = Array.isArray(data) ? data : Array.isArray(data.testCases) ? data.testCases : [];
        return list.map((item) =>
            item && item.originalTestCase ? item.originalTestCase : item
        );
    }

    loadConfirmedFacts() {
        if (!this.confirmedFactsFile || !fs.existsSync(this.confirmedFactsFile)) return [];
        const data = JSON.parse(fs.readFileSync(this.confirmedFactsFile, "utf8"));
        return Array.isArray(data.facts) ? data.facts : [];
    }

    generate() {
        const tcs = this.loadTestCases();
        const ids = tcs.map((t) => t.id);
        const questions = [];

        const Q = ({ questionId, category, question, relatedTestCaseIds = [], evidenceReferences = [], suggestions = [] }) =>
            questions.push({
                questionId,
                category,
                question,
                relatedTestCaseIds,
                evidenceReferences,
                suggestions,
                required: true,
                answer: null,
                answerStatus: "UNANSWERED"
            });

        // 1. Login success criteria
        Q({
            questionId: "Q-LOGIN-SUCCESS-001",
            category: "ASSERTION",
            question:
                "Xác nhận tiêu chí đăng nhập thành công cho TC001: (a) adminButton visible (quan sát từ Codegen) có được chấp nhận làm tiêu chí thành công không? (b) có cần thêm tiêu chí URL thay đổi (toHaveURL) hoặc trang đích xuất hiện không?",
            relatedTestCaseIds: ["TC001"],
            evidenceReferences: ["EV-LOGIN-ASSERT-SUCCESS-001", "EV-LOGIN-ROUTE-001"],
            suggestions: [
                "Chỉ adminButton visible là đủ",
                "adminButton + kiểm tra URL chuyển hướng (toHaveURL)",
                "adminButton + kiểm tra trang đích",
                "Không dùng adminButton — cần tiêu chí khác"
            ]
        });

        // 2. Validation assertions TC002-004
        Q({
            questionId: "Q-ASSERTION-VALIDATION-001",
            category: "ASSERTION",
            question:
                "Xác nhận dùng 3 message quan sát từ Codegen làm assertion validation cho TC002–TC004: 'Vui lòng nhập Tên tài khoản', 'Vui lòng nhập Mật khẩu', 'Vui lòng nhập Mã xác nhận'?",
            relatedTestCaseIds: ["TC002", "TC003", "TC004"],
            evidenceReferences: [
                "EV-LOGIN-ASSERT-VALIDATE-ACCOUNT-001",
                "EV-LOGIN-ASSERT-VALIDATE-PASSWORD-001",
                "EV-LOGIN-ASSERT-VALIDATE-CAPTCHA-001"
            ],
            suggestions: [
                "Có — dùng cả 3 làm assertion",
                "Chỉ dùng một số (ghi rõ)",
                "Không dùng — cần assertion khác"
            ]
        });

        // 3. Route
        Q({
            questionId: "Q-ROUTE-001",
            category: "ROUTE",
            question:
                "Xác nhận route chính thức cho Login: (a) BASE_URL + /user/login, (b) URL đầy đủ quan sát từ Codegen có returnUrl, hay (c) route khác?",
            relatedTestCaseIds: ids,
            evidenceReferences: ["EV-LOGIN-ROUTE-001"],
            suggestions: [
                "BASE_URL + /user/login (bỏ returnUrl)",
                "URL đầy đủ có returnUrl như Codegen",
                "Route khác (cung cấp cụ thể)",
                "Cần config base URL riêng"
            ]
        });

        // 4. Credential source
        Q({
            questionId: "Q-CREDENTIAL-SOURCE-001",
            category: "TEST_DATA",
            question:
                "Xác nhận nguồn tài khoản và mật khẩu cho TC001 (testData.fields['Tài khoản'] và ['Mật khẩu'] hiện requiresTesterInput:true, value:null): lấy từ .env, runtime input, config riêng, hay nguồn khác?",
            relatedTestCaseIds: ["TC001"],
            evidenceReferences: [],
            suggestions: [
                "Từ biến môi trường (.env)",
                "Runtime input (tester nhập khi chạy)",
                "Config riêng của automation",
                "Nguồn khác (ghi rõ)"
            ]
        });

        // 5. TC001 step targets (semantic)
        Q({
            questionId: "Q-STEP-TARGET-TC001-001",
            category: "STEP_CONFLICT",
            question:
                "TC001 có 4 step thiếu 'target'. Xác nhận semantic target cho từng step để map locator: 'Nhập tài khoản'→?, 'Nhập mật khẩu'→?, 'Nhập mã xác nhận'→?, 'Chọn Đăng nhập'→?",
            relatedTestCaseIds: ["TC001"],
            evidenceReferences: ["EV-LOGIN-LOC-TAIKHOAN-001", "EV-LOGIN-LOC-MATKHAU-001", "EV-LOGIN-LOC-MAXACNHAN-001", "EV-LOGIN-LOC-DANGNHAP-001"],
            suggestions: [
                "Nhập tài khoản → Tài khoản; Nhập mật khẩu → Mật khẩu; Nhập mã xác nhận → Mã xác nhận; Chọn Đăng nhập → Đăng nhập (nút)",
                "Cần sửa lại steps",
                "Để tôi cung cấp target khác"
            ]
        });

        // 6. TC002-004 step conflict
        Q({
            questionId: "Q-STEP-CONFLICT-TC002004-001",
            category: "STEP_CONFLICT",
            question:
                "TC002–TC004 có step 'Nhập mã xác nhận' nhưng target là 'Đăng nhập' (mâu thuẫn action nhập vs target nút). Xác định target đúng của step này (hoặc đánh dấu thừa)?",
            relatedTestCaseIds: ["TC002", "TC003", "TC004"],
            evidenceReferences: ["EV-LOGIN-LOC-MAXACNHAN-001", "EV-LOGIN-LOC-DANGNHAP-001"],
            suggestions: [
                "Target đúng là 'Mã xác nhận' (field captcha)",
                "Target đúng là 'Đăng nhập' (nút) — sửa action thành click",
                "Step này là thừa — bỏ",
                "Để tôi tự xử lý khi review"
            ]
        });

        return {
            module: "Login",
            status: "WAITING_FOR_TESTER",
            questions
        };
    }

    write(outputFile) {
        const artifact = this.generate();
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.writeFileSync(outputFile, JSON.stringify(artifact, null, 2));
        return outputFile;
    }
}
