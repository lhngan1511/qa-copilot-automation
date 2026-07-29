import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RequirementFilePicker from "../components/RequirementFilePicker.jsx";
import useCreateWorkflow from "../hooks/useCreateWorkflow.js";
import { validateRequirementFile } from "../utils/requirementFileValidation.js";

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

    return (
        <section className="page page--narrow">
            <Link className="back-link" to="/">
                ← Quay lại Workflows
            </Link>

            <div className="page-heading">
                <div>
                    <p className="eyebrow">Requirement intake</p>
                    <h2>Tạo workflow mới</h2>
                    <p>
                        Chọn requirement Markdown. Backend sẽ lưu file, khởi tạo workflow và dừng
                        tại review gate phù hợp.
                    </p>
                </div>
            </div>

            <form className="new-workflow-form" onSubmit={handleSubmit} noValidate>
                <div className="form-section">
                    <div className="form-section__heading">
                        <span>01</span>
                        <div>
                            <h3>Requirement Markdown</h3>
                            <p>File được backend xác thực lại trước khi workflow bắt đầu.</p>
                        </div>
                    </div>
                    <RequirementFilePicker
                        file={file}
                        error={fileError}
                        disabled={mutation.isPending}
                        onChange={handleFileChange}
                    />
                </div>

                <aside className="form-note">
                    <strong>Tên workflow</strong>
                    <p>
                        Backend hiện chưa hỗ trợ field tên workflow khi khởi tạo. Tên hiển thị sẽ
                        được lấy từ public workflow DTO sau phân tích.
                    </p>
                </aside>

                {mutation.isError && (
                    <div className="inline-alert" role="alert">
                        <strong>Không thể tạo workflow</strong>
                        <span>{uploadErrorMessage(mutation.error)}</span>
                        {mutation.error?.code && <small>Mã lỗi: {mutation.error.code}</small>}
                    </div>
                )}

                {mutation.isPending && (
                    <div className="processing-state" role="status" aria-live="polite">
                        <span className="loading-spinner" aria-hidden="true" />
                        <span>
                            <strong>Đang tải và phân tích requirement</strong>
                            <small>Không đóng trang cho đến khi workflow được khởi tạo.</small>
                        </span>
                    </div>
                )}

                <div className="form-actions">
                    <Link className="button button--secondary" to="/">
                        Hủy
                    </Link>
                    <button
                        className="button button--primary"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Đang tạo workflow..." : "Tạo workflow"}
                    </button>
                </div>
            </form>
        </section>
    );
}
