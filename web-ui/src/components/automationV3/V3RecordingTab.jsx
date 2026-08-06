import { useState } from "react";
import { getRecordingSource } from "../../api/automationV3Api.js";

/*
 V3RecordingTab — Tab Recording trong Drawer Review.
   - stat: version, số bước, số assertion, thời gian
   - danh sách bước theo thứ tự
   - "Xem mã" thu gọn → tải source riêng (lazy) khi tester chủ động
 Không hiển thị hash/sourceRange/IR/parser.
*/

const ACTION_LABEL = {
    GOTO: "Mở trang",
    FILL: "Nhập",
    CLICK: "Bấm",
    CHECK: "Tích",
    UNCHECK: "Bỏ tích",
    SELECT: "Chọn",
    PRESS: "Phím",
    ASSERT: "Kiểm tra"
};

export default function V3RecordingTab({ workspaceId, detail, loading }) {
    const [source, setSource] = useState(null);
    const [sourceLoading, setSourceLoading] = useState(false);

    if (loading) return <div className="v3-note">Đang tải recording…</div>;
    if (!detail) return <div className="v3-empty"><span>Chưa có recording để review.</span></div>;

    const summary = detail.summary ?? {};

    const handleLoadSource = async () => {
        if (source !== null || sourceLoading) return;
        setSourceLoading(true);
        try {
            const data = await getRecordingSource(workspaceId, detail.recordingId);
            setSource(data.source ?? "");
        } finally {
            setSourceLoading(false);
        }
    };

    return (
        <div className="v3-rec-tab">
            <div className="v3-stat-grid">
                <div className="v3-stat"><small>Trạng thái</small><b>{detail.status ?? "—"}</b></div>
                <div className="v3-stat"><small>Phiên bản</small><b>v{detail.version ?? "—"}</b></div>
                <div className="v3-stat"><small>Số bước</small><b>{summary.actionCount ?? 0}</b></div>
                <div className="v3-stat"><small>Assertion</small><b>{summary.assertionCount ?? 0}</b></div>
                <div className="v3-stat"><small>Thời gian</small><b>{summary.duration ?? 0}s</b></div>
            </div>

            <h4 className="v3-rec-tab__h">Danh sách bước</h4>
            <div className="v3-steps">
                {(detail.steps ?? []).map((step, i) => (
                    <div className="v3-step" key={`${step.order ?? i}`}>
                        <span className="v3-step__n">{step.order ?? i + 1}</span>
                        <span className="v3-step__act">{ACTION_LABEL[step.actionType] ?? step.actionType}</span>
                        <span className="v3-step__loc">{step.locator || step.target || "—"}</span>
                        {step.recordedValue ? <span className="v3-step__val">{step.recordedValue}</span> : null}
                    </div>
                ))}
                {(detail.assertions ?? []).map((a, i) => (
                    <div className="v3-step" key={`a-${a.order ?? i}`}>
                        <span className="v3-step__n">{a.order ?? "A"}</span>
                        <span className="v3-step__act">Kiểm tra</span>
                        <span className="v3-step__loc">{a.statement || `${a.locator || "page"} → ${a.matcher}`}</span>
                    </div>
                ))}
            </div>

            <div className="v3-collapse">
                <button type="button" className="v3-collapse__head" onClick={handleLoadSource}>
                    <span>Xem mã</span>
                    <span aria-hidden="true">{source !== null ? "▴" : "▾"}</span>
                </button>
                {source !== null ? (
                    <pre className="v3-collapse__body">{source || "(trống)"}</pre>
                ) : sourceLoading ? (
                    <div className="v3-collapse__body">Đang tải…</div>
                ) : null}
            </div>
        </div>
    );
}
