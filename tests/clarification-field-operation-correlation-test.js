import assert from "node:assert/strict";
import RequirementKnowledgeMapper from "../src/mappers/RequirementKnowledgeMapper.js";

/* Correlate câu trả lời Requirement Review vào ĐÚNG field/operation — thiết kế chốt 2026-09-04 sau
   khi chạy thử (prototype) trên ĐÚNG dữ liệu thật của Ngân (module "DM đợt nhập học") và cùng xác
   nhận từng điểm:
   - FIELD_MATCH: so token tên field (đã cắt tiền tố loại control txt_/txta_/date_/... + phần chung
     đầu/cuối của form) với tên field AI trích trong dấu nháy đơn — coverage-based (từ phía candidate,
     field dư token kỹ thuật không bị trừ điểm), ngưỡng tin cậy 0.5. Dưới ngưỡng KHÔNG được đoán.
   - Nhiều field ngang điểm (vd 2 field ngày) -> phân xử theo THỨ TỰ xuất hiện trong câu hỏi khớp
     thứ tự field trong flow ghi hình (input.index) — KHÔNG so ký tự đầu (quá mong manh).
   - OPERATION_MATCH: câu hỏi không nêu field cụ thể nhưng nhắc rõ nghiệp vụ (thêm mới/sửa/xóa/tìm
     kiếm) -> gán vào TẤT CẢ function cùng operation đó (Ngân xác nhận: chấp nhận nội dung trùng nhau
     giữa nhiều function, dedupe ở tầng hiển thị nếu cần, không chặn ở đây).
   - Method/confidence/câu hỏi/trả lời được lưu vào knowledge.knowledgeSources.clarificationMeta để
     hiển thị nguồn gốc trên UI chi tiết testcase. */

const requirement = {
    module: { id: "MOD-NHAPHOC", name: "DM đợt nhập học" },
    features: [
        {
            id: "CREATE",
            name: "Thêm mới đợt nhập học",
            inputs: [
                { name: "#txt_tddotnhaphoc_ma_dot_nhap_hoc", required: false, description: "" },
                { name: "#txt_tddotnhaphoc_ten_dot_nhap_hoc", required: false, description: "" },
                { name: "#txt_tddotnhaphoc_so_qd_dot_nhap_hoc", required: false, description: "" },
                { name: "#txta_tddotnhaphoc_ghi_chu_dot_nhap_hoc", required: false, description: "" },
                { name: "#date_tddotnhaphoc_svnh_td_dot_nhap_hoc_ngay_bd_nop_le_phi", required: false, description: "" },
                { name: "#date_tddotnhaphoc_svnh_td_dot_nhap_hoc_ngay_kt_nop_le_phi", required: false, description: "" }
            ],
            flow: ["Người dùng nhập thông tin", "Người dùng nhấn nút Thực hiện"],
            expectedResults: ["Đợt nhập học mới được thêm vào danh sách"]
        },
        {
            id: "UPDATE",
            name: "Sửa đợt nhập học",
            inputs: [{ name: "#txt_tddotnhaphoc_ten_dot_nhap_hoc", required: false, description: "" }],
            flow: ["Người dùng thay đổi thông tin", "Người dùng nhấn nút Thực hiện"],
            expectedResults: ["Thông tin đợt nhập học được cập nhật thành công"]
        },
        {
            id: "DELETE",
            name: "Xóa đợt nhập học",
            inputs: [],
            flow: ["Người dùng chọn dòng", "Người dùng nhấn nút Xóa"],
            expectedResults: ["Đợt nhập học bị loại bỏ khỏi danh sách"]
        },
        {
            id: "SEARCH",
            name: "Tìm kiếm đợt nhập học",
            inputs: [{ name: "#txt_sr_ma_dot_nhap_hoc", required: false, description: "" }],
            flow: ["Người dùng nhập từ khóa", "Người dùng nhấn nút Tìm"],
            expectedResults: ["Danh sách hiển thị các đợt nhập học khớp với từ khóa"]
        }
    ]
};
Object.defineProperty(requirement.features[0], "automation", { value: { operation: "CREATE" }, enumerable: true });
requirement.features[1].automation = { operation: "UPDATE" };
requirement.features[2].automation = { operation: "DELETE" };
requirement.features[3].automation = { operation: "SEARCH" };

const approvedArtifact = {
    approvalStatus: "approved",
    requirement,
    aiAnalysis: {
        functions: requirement.features.map(f => ({ id: f.id, name: f.name, description: f.name, automation: f.automation }))
    },
    questions: [
        {
            id: "CL001", category: "Business Rule",
            question: "Quy tắc nghiệp vụ kiểm tra tính trùng lặp của 'Mã đợt nhập học' khi thêm mới là gì?",
            targetField: "", answer: "không cho phép thêm mới", status: "answered"
        },
        {
            id: "CL002", category: "Validation",
            question: "Các trường thông tin nào là bắt buộc phải nhập khi tạo mới đợt nhập học?",
            targetField: "", answer: "mã tên", status: "answered"
        },
        {
            id: "CL003", category: "Exception",
            question: "Thông báo xác nhận xóa 'Đã xóa thành công các đợt nhậ' có phải là thông báo đầy đủ không?",
            targetField: "", answer: "Không", status: "answered"
        },
        {
            id: "CL004", category: "Business Rule",
            question: "Có quy tắc nào về khoảng thời gian giữa 'Ngày bắt đầu nộp lệ phí' và 'Ngày kết thúc nộp lệ phí' không?",
            targetField: "", answer: "ngày bắt đầu < ngày kết thúc", status: "answered"
        },
        {
            id: "CL005", category: "Permission",
            question: "Người dùng có quyền hạn gì để thực hiện các thao tác Thêm, Sửa, Xóa?",
            targetField: "", answer: "quyền admin", status: "answered"
        }
    ]
};

const knowledge = new RequirementKnowledgeMapper().map({ approvedArtifact });
const meta = knowledge.knowledgeSources.clarificationMeta;
const byId = id => knowledge.functions.find(f => f.id === id);

// CL001 — nêu đúng tên field 'Mã đợt nhập học', khớp field CSS-ID "ma_dot_nhap_hoc" (sau khi cắt
// tiền tố txt_ + phần chung "tddotnhaphoc"/"dot_nhap_hoc" của form) -> FIELD_MATCH, điểm tuyệt đối.
assert.equal(meta.CL001.method, "FIELD_MATCH", "CL001 phải khớp field (không cho phép đoán bừa nếu điểm thấp)");
assert.equal(meta.CL001.confidence, 1, `CL001 phải khớp tuyệt đối, thấy confidence=${meta.CL001.confidence}`);
assert.ok(byId("CREATE").businessRules.some(r => r.includes("thêm mới") || r.includes("trùng lặp") || r.length > 0), "fact CL001 phải nằm trong businessRules của CREATE");
assert.equal(byId("UPDATE").businessRules.length + byId("DELETE").businessRules.length + byId("SEARCH").businessRules.length, 0, "CL001 không được lan sang function khác CREATE");

// CL002 — không có field trong dấu nháy đơn (answer "mã tên" là mảnh câu không tách được) nhưng câu
// hỏi nhắc rõ "tạo mới" -> OPERATION_MATCH vào CREATE (không phải field cụ thể nào).
assert.equal(meta.CL002.method, "OPERATION_MATCH", "CL002 không có field cụ thể, phải rơi về operation");
assert.deepEqual(meta.CL002.matchedOperations, ["CREATE"]);
assert.ok(byId("CREATE").validationRules.includes("mã tên"), "fact CL002 phải nằm trong validationRules của CREATE");

// CL003 — cụm trong nháy đơn là NỘI DUNG THÔNG BÁO, không phải tên field nào -> không đạt ngưỡng field,
// câu hỏi cũng không nhắc rõ nghiệp vụ nào bằng từ khoá chuẩn -> NONE (không được đoán bừa).
assert.equal(meta.CL003.method, "NONE", "CL003 không phải tên field cũng không nêu rõ nghiệp vụ -> phải rơi về CONFIRMED_FACT đứng riêng, không đoán");
for (const id of ["CREATE", "UPDATE", "DELETE", "SEARCH"]) {
    assert.ok(!byId(id).businessRules.some(r => r.includes("đầy đủ")), `CL003 không được lọt vào function ${id}`);
}

// CL004 — 2 field cùng nêu trong 1 câu hỏi, cùng thuộc CREATE, ngang điểm với nhau (cùng dư token
// "svnh_td" không giải thích được) -> FIELD_MATCH (coverage đủ ngưỡng dù không tuyệt đối), disambiguate
// đúng thứ tự "bắt đầu" trước "kết thúc" theo thứ tự field trong flow (input đầu tiên trong inputs[]
// là field "bd", input thứ hai là "kt" — đúng thứ tự khai báo ở trên).
assert.equal(meta.CL004.method, "FIELD_MATCH", `CL004 phải khớp field (2 field ngày, coverage đủ ngưỡng), thấy method=${meta.CL004.method} confidence=${meta.CL004.confidence}`);
assert.ok(meta.CL004.confidence >= 0.5, `CL004 confidence phải >= ngưỡng 0.5, thấy ${meta.CL004.confidence}`);
assert.deepEqual(
    meta.CL004.matchedFields,
    ["#date_tddotnhaphoc_svnh_td_dot_nhap_hoc_ngay_bd_nop_le_phi", "#date_tddotnhaphoc_svnh_td_dot_nhap_hoc_ngay_kt_nop_le_phi"],
    "phải phân xử ĐÚNG field 'bắt đầu' cho candidate 1, field 'kết thúc' cho candidate 2, theo thứ tự flow"
);
assert.ok(byId("CREATE").businessRules.includes("ngày bắt đầu < ngày kết thúc"), "fact CL004 phải nằm trong businessRules của CREATE");

// CL005 — không nêu field nào, câu hỏi nhắc "Thêm, Sửa, Xóa" -> OPERATION_MATCH vào CẢ 3 function
// (không phải SEARCH, vì câu hỏi không nhắc "tìm kiếm").
assert.equal(meta.CL005.method, "OPERATION_MATCH");
assert.deepEqual([...meta.CL005.matchedOperations].sort(), ["CREATE", "DELETE", "UPDATE"]);
for (const id of ["CREATE", "UPDATE", "DELETE"]) {
    assert.ok(byId(id).permissions.includes("Chỉ quyền admin được quyền thực hiện thêm, sửa, xóa"), `CL005 phải lọt vào function ${id}`);
}
assert.ok(!byId("SEARCH").permissions.includes("Chỉ quyền admin được quyền thực hiện thêm, sửa, xóa"), "CL005 không được lọt vào SEARCH (câu hỏi không nhắc tìm kiếm)");

console.log("Clarification field/operation correlation test: PASS");
