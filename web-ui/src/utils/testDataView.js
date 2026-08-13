import { isSetupField } from "./setupFields.js";

/*
 P0 REGRESSION — TEST DATA VIEW (tester-facing).

 Tách logic tạo CÁC DÒNG dữ liệu tester thấy trên UI khỏi JSX:
   - DỮ LIỆU KIỂM THỬ (tab Thông tin): danh sách business field keys.
   - DỮ LIỆU TESTCASE (tab Chạy thử): rows {key, value, state} business-only.
   - DỮ LIỆU CHUẨN BỊ (tab Chạy thử): trạng thái per action (env/ready/review).

 P0 TC001 — canonical semantics (mirror backend resolveFillStatus):
   VALUE      — tester/business value đã xác nhận → fill.
   EMPTY      — tester xác nhận để trống → SKIP fill, KHÔNG fallback recorded.
   UNRESOLVED — chưa xác định data source/intent → cần review (Generate bị chặn).
   Recorded literal = RECORDED_SAMPLE (evidence) — KHÔNG phải runtime value.

 NGUYÊN TẮC (bất biến): KHÔNG bao giờ đưa technical target (step.target, VD
 'text search') hoặc setup credential (Tài khoản/Mật khẩu/Mã xác nhận — trừ
 testcase test Login) vào bất kỳ output nào UI render.

 Module thuần (không JSX/DOM) để test node import trực tiếp được — render-level
 regression: output của các hàm này CHÍNH LÀ chuỗi DOM sẽ render.
*/

/** Normalize entry confirmed: string cũ (non-empty = VALUE; "" = UNRESOLVED) | {value, intent}. */
export function fieldEntry(entry) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return {
            value: entry.value === undefined || entry.value === null ? "" : String(entry.value),
            intent: String(entry.intent ?? "").toUpperCase() === "EMPTY" ? "EMPTY" : "VALUE"
        };
    }
    const v = entry === undefined || entry === null ? "" : String(entry);
    return { value: v, intent: v.trim() !== "" ? "VALUE" : "" };
}

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

/** DỮ LIỆU TESTCASE (tab Chạy thử): rows [{key, value, state}] business-only.
 *  state: "VALUE" | "EMPTY" | "UNRESOLVED".
 *  confirmedTestData legacy (technical target + credential) được chiếu sang business
 *  field; KHÔNG lộ target chưa map, KHÔNG lộ setup (trừ testcase test Login). */
export function runTestcaseDataRows({ approvedBusinessValues = {}, approvedPurpose = {}, confirmedTestData = null, bindings = {}, actionInputs = {}, loginTestCase = false }) {
    const targets = new Set(Object.keys(actionInputs));
    const map = {};
    for (const [k, v] of Object.entries(approvedBusinessValues)) {
        const entry = fieldEntry(confirmedTestData?.[k]);
        const purpose = String(approvedPurpose?.[k] ?? "").toUpperCase();
        if (entry.intent === "EMPTY" || purpose === "EMPTY") {
            map[k] = { value: "—", state: "EMPTY" };
        } else if (entry.intent === "VALUE" && entry.value.trim() !== "") {
            map[k] = { value: entry.value, state: "VALUE" };
        } else if (v !== undefined && v !== null && String(v).trim() !== "") {
            map[k] = { value: String(v), state: "VALUE" }; // approved VALUE
        } else {
            map[k] = { value: "⚠ Cần review", state: "UNRESOLVED" };
        }
    }
    if (confirmedTestData && typeof confirmedTestData === "object") {
        for (const [k, v] of Object.entries(confirmedTestData)) {
            if (isSetupField(k) && !loginTestCase) continue; // credential legacy — ẩn (trừ testcase Login)
            const bound = bindings[k] && bindings[k] !== k ? bindings[k] : null; // self-binding = không binding
            const bf = bound || k;
            if (targets.has(k) && !bound) continue; // technical target chưa map thật — ẩn
            const entry = fieldEntry(v);
            if (entry.intent === "EMPTY") {
                map[bf] = { value: "—", state: "EMPTY" };
            } else if (entry.value.trim() !== "") {
                map[bf] = { value: entry.value, state: "VALUE" };
            } else if (!map[bf]) {
                map[bf] = { value: "⚠ Cần review", state: "UNRESOLVED" };
            }
        }
    }
    return Object.entries(map).map(([k, row]) => ({ key: k, value: row.value, state: row.state }));
}

/** Canonical — businessField cho 1 action input (MIRROR backend resolveBusinessFieldForFill;
 *  cùng rule để DỮ LIỆU CHUẨN BỊ khớp generate):
 *  1. setup env-bound → chính nó (LOGIN_* — không map);
 *  2. có binding → binding;
 *  3. target ∈ approved keys (approved định nghĩa business) và có data → chính nó;
 *  4. [CHỈ single-input] ĐÚNG 1 business field (non-setup, khác target) có data → field đó;
 *  5. legacy confirmed keyed theo target → chính nó;
 *  6. còn lại → chính nó. */
export function canonicalBusinessFieldForInput(field, { bindings = {}, confirmedTestData = null, approvedFields = null, singleInput = false }) {
    const f = String(field ?? "").trim();
    if (!f || isSetupField(f)) return f;
    if (bindings[f]) return bindings[f];
    const appr = approvedFields && typeof approvedFields === "object" ? approvedFields : {};
    const conf = confirmedTestData && typeof confirmedTestData === "object" ? confirmedTestData : {};
    const apprVal = appr[f];
    const apprRaw = apprVal != null && typeof apprVal === "object" ? apprVal.value : apprVal;
    const confEntry = fieldEntry(conf[f]);
    if (Object.prototype.hasOwnProperty.call(appr, f) &&
        ((apprRaw != null && String(apprRaw).trim() !== "") || (confEntry.intent === "VALUE" && confEntry.value.trim() !== ""))) return f;
    if (singleInput) {
        const candidates = new Set();
        const consider = (k, v) => {
            const name = String(k ?? "").trim();
            if (!name || name === f || isSetupField(name)) return;
            const entry = fieldEntry(v);
            const val = (entry.intent === "VALUE" ? entry.value : "").trim();
            if (val !== "") candidates.add(name);
        };
        for (const [k, v] of Object.entries(appr)) consider(k, v);
        for (const [k, v] of Object.entries(conf)) consider(k, v);
        if (candidates.size === 1) return [...candidates][0];
    }
    if (confEntry.intent === "VALUE" && confEntry.value.trim() !== "") return f;
    return f;
}

/** DỮ LIỆU CHUẨN BỊ (tab Chạy thử): trạng thái chuẩn bị của 1 action
 *  (setup env / sẵn sàng / cần review trước khi sinh). */
export function actionPrepStatus({ inputs = [], bindings = {}, confirmedTestData = null, approvedFields = null, singleInput = false }) {
    const noData = inputs.length === 0;
    if (noData) return { status: "ok", text: "✓ Sẵn sàng" };
    const conf = confirmedTestData ?? null;
    const appr = approvedFields ?? null;
    let allSetup = true;
    for (const inp of inputs) {
        const f = String(inp?.field ?? "").trim();
        if (!f) continue;
        if (isSetupField(f)) continue; // setup env — không cần value (Login dùng LOGIN_*)
        allSetup = false;
        const bf = canonicalBusinessFieldForInput(f, { bindings, confirmedTestData: conf, approvedFields: appr, singleInput });
        const entry = fieldEntry(conf?.[bf]);
        const purpose = String(appr?.[bf]?.purpose ?? "").toUpperCase();
        const apprRaw = appr?.[bf] != null && typeof appr[bf] === "object" ? appr[bf].value : appr?.[bf];
        // P0 TC001 — VALUE/EMPTY = sẵn sàng; UNRESOLVED = cần review (Generate bị chặn).
        const resolved = entry.intent === "EMPTY" || purpose === "EMPTY"
            ? "EMPTY"
            : (entry.intent === "VALUE" && entry.value.trim() !== "")
                ? "VALUE"
                : (apprRaw != null && String(apprRaw).trim() !== "") ? "VALUE" : "UNRESOLVED";
        if (resolved === "UNRESOLVED") return { status: "missing", text: "⚠ Cần review trước khi sinh" };
    }
    if (allSetup) return { status: "env", text: "✓ Cấu hình môi trường" };
    return { status: "ok", text: "✓ Sẵn sàng" };
}
