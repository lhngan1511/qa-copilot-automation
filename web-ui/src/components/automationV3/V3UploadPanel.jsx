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
    const [dragActive, setDragActive] = useState(false);

    const processFile = async file => {
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

    const handleFile = event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        processFile(file);
    };

    const handleDrop = event => {
        event.preventDefault();
        setDragActive(false);
        if (!busy) processFile(event.dataTransfer.files?.[0]);
    };

    return (
        <div
            className={`v3-upload ${dragActive ? "v3-upload--active" : ""} ${busy ? "v3-upload--disabled" : ""}`}
            onDragEnter={event => { event.preventDefault(); if (!busy) setDragActive(true); }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
            onDrop={handleDrop}
        >
            <div className="v3-upload__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.8-9.94A6.5 6.5 0 0 1 18.7 10.5 3.75 3.75 0 0 1 18.25 18H14" /><path d="M12 20V10m0 0-3 3m3-3 3 3" /></svg>
            </div>
            <div className="v3-upload__copy">
                <h4>Kéo file testcase đã duyệt vào đây</h4>
                <p>approved-testcases.json · chỉ nhận testcase có trạng thái đã duyệt</p>
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
            <button type="button" className="v3-btn v3-btn--secondary v3-upload__button" onClick={() => inputRef.current?.click()} disabled={busy}>
                Chọn file từ máy
            </button>
            {error ? <p className="v3-upload__error" role="alert">{error}</p> : null}
        </div>
    );
}
