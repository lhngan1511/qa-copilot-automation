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
                        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                    </svg>
                </span>
                <span className="file-drop-zone__copy">
                    <strong>Drag and drop your requirement file</strong>
                    <small>or</small>
                    <span className="file-drop-zone__button">Choose a file</span>
                </span>
                <span id="requirement-file-help" className="file-drop-zone__support">
                    Supported: Markdown (.md) · Maximum file size: 2 MB
                </span>
            </label>

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
                        <span className="selected-file__details">
                            <small>Selected file</small>
                            <strong title={file.name}>{file.name}</strong>
                            <small>{formatFileSize(file.size)}</small>
                        </span>
                    </div>
                    <button
                        className="text-button"
                        type="button"
                        disabled={disabled}
                        onClick={clearFile}
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>
    );
}
