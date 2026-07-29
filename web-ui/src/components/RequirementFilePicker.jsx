import { useRef, useState } from "react";
import { formatFileSize } from "../utils/requirementFileValidation.js";

export default function RequirementFilePicker({ file, error, disabled = false, onChange }) {
    const inputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);

    const selectFile = selectedFile => {
        if (!disabled && selectedFile) onChange(selectedFile);
    };

    const handleDrop = event => {
        event.preventDefault();
        setDragActive(false);
        selectFile(event.dataTransfer.files?.[0]);
    };

    const clearFile = () => {
        if (disabled) return;
        if (inputRef.current) inputRef.current.value = "";
        onChange(null);
    };

    return (
        <div className="file-picker">
            <label
                className={`file-drop-zone ${dragActive ? "file-drop-zone--active" : ""} ${
                    error ? "file-drop-zone--error" : ""
                }`}
                htmlFor="requirement-file"
                onDragEnter={event => {
                    event.preventDefault();
                    if (!disabled) setDragActive(true);
                }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    id="requirement-file"
                    className="visually-hidden"
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    disabled={disabled}
                    aria-describedby={
                        error
                            ? "requirement-file-help requirement-file-error"
                            : "requirement-file-help"
                    }
                    onChange={event => selectFile(event.target.files?.[0])}
                />
                <span className="file-drop-zone__mark" aria-hidden="true">
                    MD
                </span>
                <span>
                    <strong>Kéo file Markdown vào đây</strong>
                    <small>hoặc bấm để chọn file từ máy tính</small>
                </span>
            </label>

            <p id="requirement-file-help" className="field-help">
                Chấp nhận file `.md`, tối đa 2 MB. Nội dung chỉ được gửi tới backend khi bạn tạo
                workflow.
            </p>

            {error && (
                <p id="requirement-file-error" className="field-error" role="alert">
                    {error}
                </p>
            )}

            {file && (
                <div className="selected-file" aria-live="polite">
                    <div>
                        <span className="selected-file__icon" aria-hidden="true">
                            MD
                        </span>
                        <span>
                            <strong>{file.name}</strong>
                            <small>{formatFileSize(file.size)}</small>
                        </span>
                    </div>
                    <button
                        className="text-button"
                        type="button"
                        disabled={disabled}
                        onClick={clearFile}
                    >
                        Bỏ file
                    </button>
                </div>
            )}
        </div>
    );
}
