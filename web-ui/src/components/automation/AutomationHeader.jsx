import { useRef, useState } from "react";

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Không thể đọc file."));
        reader.readAsText(file);
    });
}

const ENVS = ["UAT", "TEST", "DEV"];

/*
 Sprint 1 (polish) — Header chỉ là bước Upload.
 Không có nút "Phân tích bằng AI" ở đây (chuyển sang bước ② của page).
 Module / Feature / Môi trường hiển thị, không nhập.
*/
export default function AutomationHeader({
    sourceFileName,
    codeGenFile,
    moduleName,
    functionName,
    environment,
    onApprovedTestCases,
    onCodeGenFile,
    onEnvironmentChange
}) {
    const approvedInput = useRef(null);
    const codeGenInput = useRef(null);
    const [approvedError, setApprovedError] = useState("");
    const [codeGenError, setCodeGenError] = useState("");
    const [editingEnv, setEditingEnv] = useState(false);

    const handleApprovedFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        setApprovedError("");
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".json")) {
            setApprovedError("Vui lòng chọn đúng file approved-testcases.json.");
            return;
        }
        try {
            const content = await readFile(file);
            const parsed = JSON.parse(content);
            const testCases = Array.isArray(parsed) ? parsed : parsed?.testCases ?? parsed?.testcases ?? parsed?.items;
            if (!Array.isArray(testCases)) throw new Error("File phải chứa một danh sách testcase hoặc thuộc tính testCases.");
            if (testCases.length === 0) throw new Error("File không có testcase nào.");
            const invalidIndex = testCases.findIndex(item => !item || typeof item !== "object" || !String(item.id ?? item.testcaseId ?? "").trim());
            if (invalidIndex >= 0) throw new Error(`Testcase thứ ${invalidIndex + 1} thiếu mã ID hợp lệ.`);
            onApprovedTestCases(testCases, file.name);
        } catch (error) {
            setApprovedError(error instanceof SyntaxError ? "JSON không hợp lệ. Vui lòng kiểm tra dấu ngoặc, dấu phẩy và chuỗi ký tự." : `Không thể tải testcase: ${error.message}`);
        }
    };

    const handleCodeGenFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        setCodeGenError("");
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".js")) {
            setCodeGenError("Vui lòng chọn file JavaScript có phần mở rộng .js.");
            return;
        }
        try {
            const content = await readFile(file);
            onCodeGenFile({ fileName: file.name, content });
        } catch (error) {
            setCodeGenError(`Không thể đọc CodeGen: ${error.message}`);
        }
    };

    return (
        <div className="automation-header">
            <div className="automation-header__grid">
                <div className="automation-field">
                    <label htmlFor="approved-testcases-file">① approved-testcases.json</label>
                    <div className="automation-file-control">
                        <button className="button button--secondary" type="button" onClick={() => approvedInput.current?.click()}>
                            Tải file testcase
                        </button>
                        <span>{sourceFileName || "Chưa chọn file"}</span>
                        <input ref={approvedInput} id="approved-testcases-file" type="file" accept=".json,application/json" hidden onChange={handleApprovedFile} />
                    </div>
                    {approvedError && <p className="automation-field-error" role="alert">{approvedError}</p>}
                </div>
                <div className="automation-field">
                    <label htmlFor="codegen-file">② CodeGen.js</label>
                    <div className="automation-file-control">
                        <button className="button button--secondary" type="button" onClick={() => codeGenInput.current?.click()}>
                            Tải CodeGen.js
                        </button>
                        <span>{codeGenFile?.fileName || "Chưa chọn CodeGen"}</span>
                        <input ref={codeGenInput} id="codegen-file" type="file" accept=".js,application/javascript" hidden onChange={handleCodeGenFile} />
                    </div>
                    {codeGenError && <p className="automation-field-error" role="alert">{codeGenError}</p>}
                </div>
                <div className="automation-field">
                    <label>Môi trường chạy</label>
                    {editingEnv ? (
                        <div className="automation-env-edit">
                            <select value={environment || ""} onChange={event => onEnvironmentChange(event.target.value)} aria-label="Môi trường chạy">
                                <option value="">Tự nhận diện</option>
                                {ENVS.map(env => <option key={env} value={env}>{env}</option>)}
                            </select>
                            <button className="text-button" type="button" onClick={() => setEditingEnv(false)}>Xong</button>
                        </div>
                    ) : (
                        <div className="automation-env-display">
                            <strong className={environment ? "" : "automation-env--auto"}>{environment || "Tự nhận diện"}</strong>
                            <button className="text-button" type="button" onClick={() => setEditingEnv(true)}>Chỉnh sửa</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
