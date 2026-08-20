import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RequirementFilePicker from "../components/RequirementFilePicker.jsx";
import useCreateWorkflow from "../hooks/useCreateWorkflow.js";
import { validateRequirementFile } from "../utils/requirementFileValidation.js";
import ImageRequirementBuilder from "../components/ImageRequirementBuilder.jsx";

function uploadErrorMessage(error) {
    if (error?.code === "NETWORK_ERROR") {
        return "Không thể kết nối backend. Hãy kiểm tra server và thử lại.";
    }
    if (error?.status === 409) {
        return "Workflow đang xung đột với trạng thái hiện tại. Vui lòng tải lại danh sách.";
    }
    if ([400, 413, 415, 422].includes(error?.status)) {
        return error.message || "Backend từ chối file requirement.";
    }
    return error?.message || "Không thể tạo workflow. Vui lòng thử lại.";
}

export default function NewWorkflowPage() {
    const navigate = useNavigate();
    const mutation = useCreateWorkflow();
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState("");
    const [sourceMode, setSourceMode] = useState("file");

    const handleFileChange = nextFile => {
        if (mutation.isPending) return;
        setFile(nextFile);
        setFileError("");
        mutation.reset();

        if (nextFile) {
            const validation = validateRequirementFile(nextFile);
            if (!validation.valid) setFileError(validation.message);
        }
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (mutation.isPending) return;

        const validation = validateRequirementFile(file);
        if (!validation.valid) {
            setFileError(validation.message);
            return;
        }

        setFileError("");

        try {
            const result = await mutation.mutateAsync({ file });
            navigate(`/workflows/${encodeURIComponent(result.workflowId)}`);
        } catch {
            // The mutation retains the selected file and exposes the normalized error.
        }
    };

    const fileIsValid = validateRequirementFile(file).valid;

    return (
        <section className="page page--narrow upload-page">
            <header className="upload-page__heading">
                <h2>AI Test Design</h2>
                <p>Tải requirement Markdown hoặc tạo bản nháp yêu cầu từ ảnh giao diện.</p>
            </header>

            <div className="requirement-source-tabs" role="tablist" aria-label="Nguồn requirement">
                <button type="button" role="tab" aria-selected={sourceMode === "file"} onClick={() => setSourceMode("file")}>Tải file .md</button>
                <button type="button" role="tab" aria-selected={sourceMode === "image"} onClick={() => setSourceMode("image")}>Tạo từ hình ảnh</button>
            </div>

            {sourceMode === "image" ? <div className="new-workflow-form"><div className="form-section"><ImageRequirementBuilder /></div></div> : <form className="new-workflow-form" onSubmit={handleSubmit} noValidate>
                <div className="form-section">
                    <RequirementFilePicker
                        file={file}
                        error={fileError}
                        disabled={mutation.isPending}
                        onChange={handleFileChange}
                    />

                    {mutation.isError && (
                        <div className="inline-alert" role="alert">
                            <strong>Không thể bắt đầu phân tích</strong>
                            <span>{uploadErrorMessage(mutation.error)}</span>
                            {mutation.error?.code && <small>Mã lỗi: {mutation.error.code}</small>}
                        </div>
                    )}

                    {mutation.isPending && (
                        <div className="processing-state" role="status" aria-live="polite">
                            <span className="loading-spinner" aria-hidden="true" />
                            <span>
                                <strong>Đang tải lên và phân tích yêu cầu</strong>
                                <small>Vui lòng giữ trang này mở trong khi hệ thống tạo phiên làm việc.</small>
                            </span>
                        </div>
                    )}

                    <div className="form-actions upload-actions">
                        <button
                            className="button button--primary upload-actions__primary"
                            type="submit"
                            disabled={mutation.isPending || !fileIsValid}
                        >
                            <span aria-hidden="true">✦</span>
                            {mutation.isPending ? "Đang phân tích…" : "Bắt đầu phân tích"}
                        </button>
                    </div>
                </div>
            </form>}
        </section>
    );
}
