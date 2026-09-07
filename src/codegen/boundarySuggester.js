import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIConfig from "../config/AIConfig.js";

/*
 boundarySuggester — Phase 5 (Kiểm thử biên).

 - suggestBoundaryValuesRuleBased: DETERMINISTIC, pure, không FS/AI/network — luôn có sẵn,
   giống nguyên tắc assertionSuggester.js (src/codegen/assertionSuggester.js). Suy luận kiểu
   dữ liệu từ giá trị hiện tại (số/ngày/chuỗi) → sinh danh sách giá trị biên cố định.
 - suggestBoundaryValuesAI: theo đúng pattern CodeGenController.analyzeRecording — luôn resolve
   (không throw), phân biệt AI_PROVIDER_UNAVAILABLE / AI_REQUEST_FAILED / AI_RESPONSE_INVALID,
   error:null khi thành công dù rỗng.
 - "AI chỉ đề xuất, tester quyết": cả 2 hàm chỉ trả candidate để tester duyệt/sửa, không tự lưu.
*/

const SPECIAL_CHARS = "!@#$%^&*()<>{}[]';--";

function detectKind(value) {
    const v = String(value ?? "").trim();
    if (/^-?\d+(\.\d+)?$/.test(v)) return "NUMBER";
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return "DATE";
    return "TEXT";
}

function candidate(value, reason) {
    return { value: String(value), source: "RULE_BASED", reason };
}

/** Đề xuất giá trị biên deterministic dựa trên kiểu dữ liệu suy ra từ giá trị hiện tại. */
export function suggestBoundaryValuesRuleBased({ currentValue = "" } = {}) {
    const kind = detectKind(currentValue);
    const candidates = [candidate("", "Giá trị rỗng — kiểm tra validate bắt buộc nhập.")];

    if (kind === "NUMBER") {
        const n = Number(String(currentValue).trim()) || 0;
        candidates.push(
            candidate("abc", "Chữ thay cho số — kiểm tra validate kiểu dữ liệu."),
            candidate(-Math.abs(n || 1), "Số âm."),
            candidate(0, "Giá trị 0."),
            candidate("999999999999", "Số vượt ngưỡng hợp lý."),
            candidate(`${n}.5`, "Số thập phân khi hệ thống có thể chỉ nhận số nguyên."),
            candidate(SPECIAL_CHARS, "Ký tự đặc biệt.")
        );
    } else if (kind === "DATE") {
        const now = new Date();
        const future = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
        const past = new Date(now.getFullYear() - 150, now.getMonth(), now.getDate());
        candidates.push(
            candidate(future.toISOString().slice(0, 10), "Ngày trong tương lai."),
            candidate(past.toISOString().slice(0, 10), "Ngày quá xa trong quá khứ (vượt tuổi thọ hợp lý)."),
            candidate("31/13/2024", "Định dạng ngày không hợp lệ."),
            candidate("abc", "Chữ thay cho ngày."),
            candidate(SPECIAL_CHARS, "Ký tự đặc biệt.")
        );
    } else {
        candidates.push(
            candidate("a", "Chuỗi 1 ký tự — kiểm tra giới hạn độ dài tối thiểu."),
            candidate("a".repeat(500), "Chuỗi rất dài — kiểm tra giới hạn độ dài."),
            candidate("   ", "Chỉ có khoảng trắng."),
            candidate(`  ${String(currentValue || "value").trim()}  `, "Khoảng trắng đầu/cuối chuỗi — kiểm tra hệ thống có trim đúng không."),
            candidate(SPECIAL_CHARS, "Ký tự đặc biệt — có thể gây injection nếu không escape đúng."),
            candidate("' OR '1'='1", "Chuỗi SQL injection điển hình — kiểm tra hệ thống có escape/parameterize đúng."),
            candidate("<script>alert(1)</script>", "Thẻ HTML/script — kiểm tra lỗ hổng XSS nếu không escape đúng."),
            candidate("😀🚀✅", "Ký tự Unicode/emoji.")
        );
    }
    return candidates;
}

/** Đề xuất giá trị biên qua AI — luôn resolve, không throw; error:null khi thành công dù rỗng. */
export async function suggestBoundaryValuesAI({ businessField = "", currentValue = "" } = {}) {
    let provider = null;
    try {
        provider = AIProviderFactory.createProvider(AIConfig.provider);
    } catch {
        provider = null;
    }
    if (!provider) {
        return { candidates: [], error: { code: "AI_PROVIDER_UNAVAILABLE", retryable: true, message: "AI provider chưa sẵn sàng." } };
    }

    const prompt = `Bạn là trợ lý kiểm thử phần mềm. Trường dữ liệu "${businessField}" đang có giá trị mẫu ${JSON.stringify(String(currentValue))}.
Hãy đề xuất một danh sách giá trị BIÊN (boundary/invalid) để kiểm thử trường này — ví dụ: giá trị rỗng, sai kiểu dữ liệu, vượt giới hạn độ dài/độ lớn, ký tự đặc biệt, giá trị âm/0 nếu là số, ngày quá khứ xa/tương lai nếu là ngày.
CHỈ trả về JSON hợp lệ, không kèm text khác, dạng:
{"candidates":[{"value":"...","reason":"..."}]}
Không đề xuất quá 8 giá trị. Không lặp lại giá trị hiện tại.`;

    let text = "";
    try {
        text = String((await provider.generate(prompt)) ?? "").trim();
    } catch {
        text = "";
    }
    if (!text) {
        return { candidates: [], error: { code: "AI_REQUEST_FAILED", retryable: true, message: "Không nhận được phản hồi từ AI." } };
    }

    try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const json = JSON.parse(cleaned);
        const candidates = Array.isArray(json.candidates)
            ? json.candidates
                .filter(c => c && c.value !== undefined && c.value !== null)
                .map(c => ({ value: String(c.value), source: "AI_SUGGESTED", reason: String(c.reason ?? "").trim() || null }))
            : [];
        return { candidates, error: null };
    } catch {
        return { candidates: [], error: { code: "AI_RESPONSE_INVALID", retryable: true, message: "AI trả về không đúng định dạng." } };
    }
}
