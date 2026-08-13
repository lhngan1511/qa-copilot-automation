import { isSetupField } from "./setupFields.js";

/*
 P0 REGRESSION — TEST DATA VIEW (tester-facing).

 Tách logic tạo CÁC DÒNG dữ liệu tester thấy trên UI khỏi JSX:
   - DỮ LIỆU KIỂM THỬ (tab Thông tin): danh sách business field keys.
   - DỮ LIỆU TESTCASE (tab Chạy thử): rows {key, value} business-only.
   - DỮ LIỆU CHUẨN BỊ (tab Chạy thử): trạng thái per action (env/ready/missing).

 NGUYÊN TẮC (bất biến): KHÔNG bao giờ đưa technical target (step.target, VD
 'text search') hoặc setup credential (Tài khoản/Mật khẩu/Mã xác nhận — trừ
 testcase test Login) vào bất kỳ output nào UI render. Legacy data (confirmedTestData
 keyed theo target / chứa credential từ các phiên cũ) bị CHIẾU sang business field,
 không hiện technical raw.

 Module thuần (không JSX/DOM) để test node import trực tiếp được — render-level
 regression: output của các hàm này CHÍNH LÀ chuỗi DOM sẽ render.
*/

/** Danh sách business field keys hiển thị trong DỮ LIỆU KIỂM THỬ (tab Thông tin):
 *  approved business keys + business field của binding. KHÔNG technical target/setup. */
export function infoBusinessKeys({ approvedBusinessKeys = [], bindings = {}, actionInputs = {} }) {
    const targets = new Set(Object.keys(actionInputs));
    const keys = [...approvedBusinessKeys];
    for (const t of Object.keys(actionInputs)) {
        const bf = bindings[t];
        // Binding self-referential (target == field) hoặc setup → kỹ thuật, không phải business.
        if (!bf || targets.has(bf) || isSetupField(bf)) continue;
        if (!keys.includes(bf)) keys.push(bf);
    }
    return keys;
}

/** DỮ LIỆU TESTCASE (tab Chạy thử): rows [{key, value}] business-only.
 *  confirmedTestData legacy (technical target + credential) được chiếu sang business
 *  field; KHÔNG lộ target chưa map, KHÔNG lộ setup (trừ testcase test Login). */
export function runTestcaseDataRows({ approvedBusinessValues = {}, confirmedTestData = null, bindings = {}, actionInputs = {}, loginTestCase = false }) {
    const targets = new Set(Object.keys(actionInputs));
    const map = { ...approvedBusinessValues };
    if (confirmedTestData && typeof confirmedTestData === "object") {
        for (const [k, v] of Object.entries(confirmedTestData)) {
            if (isSetupField(k) && !loginTestCase) continue; // credential legacy — ẩn (trừ testcase Login)
            const bound = bindings[k] && bindings[k] !== k ? bindings[k] : null; // self-binding = không binding
            const bf = bound || k;
            if (targets.has(k) && !bound) continue; // technical target chưa map thật — ẩn
            map[bf] = String(v ?? "");
        }
    }
    return Object.entries(map)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => ({ key: k, value: String(v) }));
}

/** DỮ LIỆU CHUẨN BỊ (tab Chạy thử): trạng thái chuẩn bị của 1 action
 *  (setup env / sẵn sàng / thiếu dữ liệu chạy). */
export function actionPrepStatus({ inputs = [], bindings = {}, confirmedTestData = null, approvedFields = null }) {
    const noData = inputs.length === 0;
    if (noData) return { status: "ok", text: "✓ Sẵn sàng" };
    const conf = confirmedTestData ?? null;
    const appr = approvedFields ?? null;
    let allSetup = true;
    let allReady = true;
    for (const inp of inputs) {
        const f = String(inp?.field ?? "").trim();
        if (!f) continue;
        if (isSetupField(f)) continue; // setup env — không cần value (Login dùng LOGIN_*)
        allSetup = false;
        const bf = bindings[f] || f;
        const bizVal = (conf && conf[bf] != null && String(conf[bf]).trim() !== "")
            ? String(conf[bf])
            : (appr && appr[bf] && typeof appr[bf] === "object" && String(appr[bf]?.value ?? "").trim() !== "" ? String(appr[bf].value) : null);
        const recVal = String(inp?.recordedValue ?? "").trim();
        if (!bizVal && !recVal) allReady = false;
    }
    if (allSetup) return { status: "env", text: "✓ Cấu hình môi trường" };
    return allReady ? { status: "ok", text: "✓ Sẵn sàng" } : { status: "missing", text: "⚠ Thiếu dữ liệu chạy" };
}
