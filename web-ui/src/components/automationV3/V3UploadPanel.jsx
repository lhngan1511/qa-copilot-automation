import { useRef, useState } from "react";
import { parseApprovedFile } from "../../utils/automationV3.js";

/*
 V3UploadPanel — Tải approved-testcases.json (bước ① Workspace).
 Sau upload: "✓ Đã đọc thành công" + meta (số testcase đã duyệt / module / chức năng).
 Không hiển thị JSON thô. File không hợp lệ → thông báo rõ, không crash.
*/

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Không thể đọc file."));
        reader.readAsText(file);
    });
}

export default function V3UploadPanel({ onApproved, onError, busy = false }) {
    const inputRef = useRef(null);
    const [error, setError] = useState("");

    const handleFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        setError("");
        if (!file) return;
        if (!/\.json$/i.test(file.name)) {
            const message = "Vui lòng chọn đúng file approved-testcases.json.";
            setError(message);
            onError?.(message);
            return;
        }
        try {
            const content = await readFileAsText(file);
            const result = parseApprovedFile(content);
            onApproved?.({ result, fileName: file.name });
        } catch (caught) {
            const message = caught?.message ?? "Không đọc được file.";
            setError(message);
            onError?.(message);
        }
    };

    return (
        <div className="v3-upload">
            <div className="v3-upload__icon" aria-hidden="true">
                📄
            </div>
            <div className="v3-upload__copy">
                <h4>Tải approved-testcases.json</h4>
                <p>Chỉ đọc testcase đã duyệt (reviewStatus = APPROVED).</p>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                className="v3-upload__input"
                onChange={handleFile}
                disabled={busy}
                aria-label="Chọn file approved-testcases.json"
            />
            <button type="button" className="v3-btn v3-btn--primary" onClick={() => inputRef.current?.click()} disabled={busy}>
                Chọn file
            </button>
            {error ? <p className="v3-upload__error" role="alert">{error}</p> : null}
        </div>
    );
}
