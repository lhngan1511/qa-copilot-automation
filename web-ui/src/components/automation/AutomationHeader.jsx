import { useRef, useState } from "react";

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Không thể đọc file."));
        reader.readAsText(file);
    });
}

export default function AutomationHeader({
    sourceFileName,
    codeGenFile,
    codeGenRecords,
    selectedCodeGenId,
    moduleName,
    functionName,
    environment,
    onApprovedTestCases,
    onCodeGenFile,
    onSaveCodeGen,
    onSelectCodeGen,
    onAnalyze,
    onContextChange
}) {
    const approvedInput = useRef(null);
    const codeGenInput = useRef(null);
    const [approvedError, setApprovedError] = useState("");
    const [codeGenError, setCodeGenError] = useState("");
    const [recordName, setRecordName] = useState("");

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
            const testCases = Array.isArray(parsed)
                ? parsed
                : parsed?.testCases ?? parsed?.testcases ?? parsed?.items;
            if (!Array.isArray(testCases)) {
                throw new Error("File phải chứa một danh sách testcase hoặc thuộc tính testCases.");
            }
            if (testCases.length === 0) throw new Error("File không có testcase nào.");
            const invalidIndex = testCases.findIndex(item => !item || typeof item !== "object" || !String(item.id ?? "").trim());
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
            if (!recordName) setRecordName(file.name.replace(/\.js$/i, ""));
        } catch (error) {
            setCodeGenError(`Không thể đọc CodeGen: ${error.message}`);
        }
    };

    return (
        <section className="automation-header">
            <div className="automation-section-heading">
                <div>
                    <p className="workflow-id">NGUỒN DỮ LIỆU</p>
                    <h3>Chuẩn bị dữ liệu</h3>
                </div>
                <span>Không tự đoán dữ liệu kiểm thử</span>
            </div>
            <div className="automation-header__grid">
                <div className="automation-field automation-field--wide">
                    <label htmlFor="approved-testcases-file">approved-testcases.json</label>
                    <div className="automation-file-control">
                        <button className="button button--secondary" type="button" onClick={() => approvedInput.current?.click()}>
                            Tải file testcase
                        </button>
                        <span>{sourceFileName || "Chưa chọn file"}</span>
                        <input ref={approvedInput} id="approved-testcases-file" type="file" accept=".json,application/json" hidden onChange={handleApprovedFile} />
                    </div>
                    {approvedError && <p className="automation-field-error" role="alert">{approvedError}</p>}
                </div>
                <label className="automation-field">
                    Tên module
                    <input value={moduleName} onChange={event => onContextChange("moduleName", event.target.value)} placeholder="Ví dụ: Thiết bị" />
                </label>
                <label className="automation-field">
                    Chức năng
                    <input value={functionName} onChange={event => onContextChange("functionName", event.target.value)} placeholder="Ví dụ: Thêm mới" />
                </label>
                <label className="automation-field">
                    Môi trường
                    <input value={environment} onChange={event => onContextChange("environment", event.target.value)} placeholder="Ví dụ: UAT" />
                </label>
                <div className="automation-field automation-field--wide">
                    <label htmlFor="codegen-file">CodeGen Library MVP</label>
                    <div className="automation-file-control">
                        <button className="button button--secondary" type="button" onClick={() => codeGenInput.current?.click()}>
                            Tải CodeGen .js
                        </button>
                        <span>{codeGenFile?.fileName || "Chưa chọn CodeGen"}</span>
                        <input ref={codeGenInput} id="codegen-file" type="file" accept=".js,application/javascript" hidden onChange={handleCodeGenFile} />
                    </div>
                    {codeGenError && <p className="automation-field-error" role="alert">{codeGenError}</p>}
                </div>
                <div className="automation-field automation-codegen-save">
                    <label htmlFor="codegen-record-name">Tên bản ghi</label>
                    <div className="automation-inline-control">
                        <input id="codegen-record-name" value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Tên bản ghi CodeGen" />
                        <button className="button button--primary" type="button" disabled={!codeGenFile || !recordName.trim()} onClick={() => { onSaveCodeGen({ name: recordName.trim(), ...codeGenFile }); setRecordName(""); }}>
                            Lưu
                        </button>
                    </div>
                </div>
                <label className="automation-field automation-codegen-select">
                    Chọn CodeGen đã lưu
                    <select value={selectedCodeGenId || ""} onChange={event => onSelectCodeGen(event.target.value)}>
                        <option value="">Chưa chọn</option>
                        {codeGenRecords.map(record => <option value={record.id} key={record.id}>{record.name}</option>)}
                    </select>
                </label>
            </div>
            <div className="automation-header__footer">
                <span>{codeGenRecords.length} bản ghi CodeGen trong trình duyệt này</span>
                <button className="button button--primary" type="button" disabled={!sourceFileName || !codeGenFile || !codeGenFile.content} onClick={onAnalyze}>Phân tích bằng AI</button>
            </div>
        </section>
    );
}
