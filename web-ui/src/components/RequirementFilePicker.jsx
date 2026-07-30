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
            {!file ? (
                <label
                    className={`file-drop-zone ${dragActive ? "file-drop-zone--active" : ""} ${
                        error ? "file-drop-zone--error" : ""
                    } ${disabled ? "file-drop-zone--disabled" : ""}`}
                    htmlFor="requirement-file"
                    onDragEnter={event => {
                        event.preventDefault();
                        if (!disabled) setDragActive(true);
                    }}
                    onDragOver={event => event.preventDefault()}
                    onDragLeave={event => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
                    }}
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

                    <span className="file-drop-zone__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M7 18a5 5 0 0 1-.8-9.94A6.5 6.5 0 0 1 18.7 10.5 3.75 3.75 0 0 1 18.25 18H14m-2 2V10m0 0-3 3m3-3 3 3" />
                        </svg>
                    </span>
                    <span className="file-drop-zone__copy">
                        <strong>Kéo file Markdown vào đây</strong>
                        <small>hoặc</small>
                        <span className="file-drop-zone__button">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                aria-hidden="true"
                            >
                                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                            </svg>
                            Chọn file
                        </span>
                    </span>
                    <span id="requirement-file-help" className="file-drop-zone__support">
                        Markdown (.md), tối đa 2 MB
                    </span>
                </label>
            ) : (
                <div className="selected-file" aria-live="polite">
                    <div>
                        <span className="selected-file__icon" aria-hidden="true">
                            MD
                        </span>
                        <span className="selected-file__details">
                            <strong title={file.name}>{file.name}</strong>
                            <small>{formatFileSize(file.size)}</small>
                        </span>
                    </div>
                    <button
                        className="text-button"
                        type="button"
                        disabled={disabled}
                        onClick={clearFile}
                        aria-label={`Xóa file ${file.name}`}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 13H7L6 7" />
                        </svg>
                    </button>
                </div>
            )}

            {error && (
                <p id="requirement-file-error" className="field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
