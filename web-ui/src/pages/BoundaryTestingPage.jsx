import { useEffect, useMemo, useState } from "react";
import { listEntries, createEntry, deleteEntry } from "../api/boundaryTestingApi.js";
import { listRecordings, getRecording } from "../api/codeGenApi.js";
import BoundaryEntryPanel from "../components/BoundaryEntryPanel.jsx";
import { useRunner } from "../contexts/RunnerContext.jsx";

/*
 BoundaryTestingPage — Kiểm thử biên (Boundary Testing), HOÀN TOÀN độc lập với Automation
 Workspace/Action Library/testcase nào. Luồng: có script (dán tay HOẶC chọn 1 Bản ghi đã lưu ở
 CodeGen — Ngân yêu cầu 2026-09-07: chọn từ Bản ghi đã lưu, không phải Thư viện thao tác, vì Thư
 viện gộp nhiều bản ghi/nhóm theo Chức năng còn Bản ghi giữ nguyên 1 phiên ghi) → đánh dấu 1 bước
 nhập liệu làm mục tiêu → hệ thống đề xuất giá trị biên → tester duyệt/sửa → chạy hàng loạt → xem
 báo cáo, đánh dấu lỗi thật → chạy lại chỉ dòng đó.

 Khác Automation Workspace (kiểm thử theo LUỒNG, xem pass/fail cả kịch bản): đây là kiểm thử theo
 TỪNG TRƯỜNG dữ liệu, không phụ thuộc workspace/testcase/binding nào — chỉ cần 1 đoạn script.
*/

const RUN_BASE_URL_KEY = "qa-copilot.boundary.runBaseUrl";

export default function BoundaryTestingPage() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newScript, setNewScript] = useState("");
    const [createBusy, setCreateBusy] = useState(false);
    // Phần 2 — tạo từ Bản ghi đã lưu (CodeGen) thay vì dán script tay (Ngân yêu cầu 2026-09-07:
    // chọn từ Bản ghi đã lưu, không phải Thư viện thao tác — Thư viện gộp nhiều bản ghi/nhóm theo
    // Chức năng nên không còn đúng 1-bản-ghi-1-kiểm-thử-biên; Bản ghi đã lưu giữ nguyên 1 phiên ghi).
    const [createMode, setCreateMode] = useState("PASTE"); // "PASTE" | "RECORDING"
    const [recordings, setRecordings] = useState([]);
    const [recordingsLoading, setRecordingsLoading] = useState(false);
    const [recordingSearch, setRecordingSearch] = useState("");
    const [runBaseUrl, setRunBaseUrl] = useState(() => window.localStorage.getItem(RUN_BASE_URL_KEY) || "");
    // Chạy Kiểm thử biên từ xa qua Runner đã chọn 1 lần ở AppHeader (Ngân yêu cầu 2026-09-07).
    const { runnerAgentId } = useRunner();

    async function refresh() {
        setLoading(true);
        try {
            const list = await listEntries();
            setEntries(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e?.message ?? "Không tải được danh sách kiểm thử biên.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    function handleRunBaseUrlChange(value) {
        setRunBaseUrl(value);
        window.localStorage.setItem(RUN_BASE_URL_KEY, value);
    }

    async function handleCreate() {
        if (!newScript.trim()) {
            setError("Chưa dán script.");
            return;
        }
        setCreateBusy(true);
        try {
            const entry = await createEntry(newLabel, newScript);
            setNewLabel("");
            setNewScript("");
            setCreating(false);
            await refresh();
            setSelectedId(entry.entryId);
            setError("");
        } catch (e) {
            setError(e?.message ?? "Không tạo được kiểm thử biên — kiểm tra lại script đã dán.");
        } finally {
            setCreateBusy(false);
        }
    }

    /** Chọn 1 Bản ghi đã lưu -> lấy nguyên script đã ghi -> tạo entry qua CÙNG đường createEntry()
     *  dán script tay dùng (parseRecording() xử lý y hệt, kể cả redact field nhạy cảm) — không cần
     *  endpoint/service riêng. */
    async function handleCreateFromRecording(recording) {
        setCreateBusy(true);
        try {
            const rec = await getRecording(recording.recordingId);
            const entry = await createEntry(recording.label, rec?.scriptContent ?? "");
            setCreating(false);
            await refresh();
            setSelectedId(entry.entryId);
            setError("");
        } catch (e) {
            setError(e?.message ?? "Không tạo được kiểm thử biên từ bản ghi này.");
        } finally {
            setCreateBusy(false);
        }
    }

    useEffect(() => {
        if (!creating || createMode !== "RECORDING") return;
        setRecordingsLoading(true);
        listRecordings()
            .then(list => {
                const all = Array.isArray(list) ? list : [];
                // Chỉ hiện bản ghi tester đã chủ động đặt tên & lưu — bỏ qua bản ghi nháp tự tạo lúc
                // parse (cùng quy tắc V3SavedRecordingsViewer.jsx đang dùng).
                setRecordings(all.filter(r => r?.savedByUser));
            })
            .catch(e => setError(e?.message ?? "Không tải được danh sách bản ghi đã lưu."))
            .finally(() => setRecordingsLoading(false));
    }, [creating, createMode]);

    const filteredRecordings = useMemo(() => {
        const q = recordingSearch.trim().toLowerCase();
        if (!q) return recordings;
        return recordings.filter(r => String(r.label ?? "").toLowerCase().includes(q));
    }, [recordings, recordingSearch]);

    async function handleDelete(entryId) {
        try {
            await deleteEntry(entryId);
            if (selectedId === entryId) setSelectedId(null);
            await refresh();
        } catch (e) {
            setError(e?.message ?? "Không xóa được.");
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(e => e.label.toLowerCase().includes(q));
    }, [entries, search]);

    return (
        <div className="v3-page v3-boundary-page">
            <div className="v3-page__head">
                <div>
                    <h1>Kiểm thử biên</h1>
                    <p className="v3-act__note">Dán 1 script đã ghi, đánh dấu 1 trường cần kiểm thử — không phụ thuộc Automation Workspace.</p>
                </div>
                <button type="button" className="v3-btn v3-btn--primary" onClick={() => setCreating(v => !v)}>
                    {creating ? "Đóng" : "+ Tạo kiểm thử biên mới"}
                </button>
            </div>

            {creating ? (
                <div className="v3-boundary-create">
                    <div className="v3-boundary-create__mode">
                        <button type="button" className={`v3-btn v3-btn--mini ${createMode === "PASTE" ? "v3-btn--primary" : "v3-btn--ghost"}`} onClick={() => setCreateMode("PASTE")}>Dán script</button>
                        <button type="button" className={`v3-btn v3-btn--mini ${createMode === "RECORDING" ? "v3-btn--primary" : "v3-btn--ghost"}`} onClick={() => setCreateMode("RECORDING")}>Chọn từ Bản ghi đã lưu</button>
                    </div>
                    {createMode === "PASTE" ? (
                        <>
                            <input
                                className="v3-input"
                                type="text"
                                placeholder="Đặt tên (vd: Đăng nhập - Tài khoản)"
                                value={newLabel}
                                onChange={e => setNewLabel(e.target.value)}
                            />
                            <textarea
                                className="v3-input v3-boundary-create__script"
                                placeholder={"Dán script Playwright đã ghi, vd:\nimport { test, expect } from '@playwright/test';\ntest('test', async ({ page }) => {\n  await page.goto('...');\n  await page.getByRole('textbox', { name: 'Tài khoản' }).fill('admin');\n  ...\n});"}
                                value={newScript}
                                onChange={e => setNewScript(e.target.value)}
                                rows={10}
                            />
                            <div className="v3-boundary-detail__actions">
                                <button type="button" className="v3-btn v3-btn--primary" disabled={createBusy} onClick={handleCreate}>
                                    {createBusy ? "Đang phân tích…" : "Phân tích script"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="v3-boundary-create__library">
                            {recordingsLoading ? (
                                <p className="v3-act__note">Đang tải danh sách bản ghi đã lưu…</p>
                            ) : recordings.length === 0 ? (
                                <p className="v3-act__note">Chưa có bản ghi nào đã lưu — ghi màn hình ở CodeGen rồi "Đặt tên & Lưu" trước.</p>
                            ) : (
                                <>
                                    <input
                                        className="v3-input"
                                        type="text"
                                        placeholder="Tìm theo tên bản ghi…"
                                        value={recordingSearch}
                                        onChange={e => setRecordingSearch(e.target.value)}
                                    />
                                    {filteredRecordings.map(rec => (
                                        <div className="v3-boundary-group__item" key={rec.recordingId}>
                                            <span className="v3-boundary-group__item-main">
                                                <span>{rec.label}</span>
                                                <span className="v3-act__note">{rec.summary?.actionCount ?? rec.steps?.length ?? 0} bước</span>
                                            </span>
                                            <button type="button" className="v3-btn v3-btn--primary v3-btn--mini" disabled={createBusy} onClick={() => handleCreateFromRecording(rec)}>
                                                Dùng bản ghi này
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : null}

            <div className="v3-boundary-page__env">
                <label>
                    <span>Địa chỉ hệ thống</span>
                    <input
                        type="url"
                        className="v3-input"
                        value={runBaseUrl}
                        placeholder="http://localhost:3000"
                        onChange={e => handleRunBaseUrlChange(e.target.value)}
                    />
                </label>
                <p className="v3-act__note">Địa chỉ hệ thống dùng cho các lần chạy kiểm thử biên; để trống chỉ khi server đã có BASE_URL trong .env.</p>
            </div>

            {error ? <p className="v3-warn">{error}</p> : null}

            <div className="v3-boundary-page__body">
                <div className="v3-boundary-page__list">
                    <input
                        className="v3-input"
                        type="text"
                        placeholder="Tìm theo tên…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {loading ? (
                        <p className="v3-act__note">Đang tải…</p>
                    ) : filtered.length === 0 ? (
                        <p className="v3-act__note">
                            {entries.length === 0 ? "Chưa có kiểm thử biên nào — bấm \"+ Tạo kiểm thử biên mới\" để bắt đầu." : "Không tìm thấy."}
                        </p>
                    ) : filtered.map(e => (
                        <div className={`v3-boundary-group__item${selectedId === e.entryId ? " v3-boundary-group__item--active" : ""}`} key={e.entryId}>
                            <button type="button" className="v3-boundary-group__item-main" onClick={() => setSelectedId(e.entryId)}>
                                <span>{e.label}</span>
                                <span className="v3-act__note">{e.targetStep ? e.targetStep.target : "Chưa chọn mục tiêu"} · {e.runs?.[0] ? `${e.runs[0].summary.passed}/${e.runs[0].summary.total} pass` : "Chưa chạy"}</span>
                            </button>
                            <button type="button" className="v3-btn v3-btn--ghost v3-btn--mini" onClick={() => handleDelete(e.entryId)}>Xóa</button>
                        </div>
                    ))}
                </div>

                <div className="v3-boundary-page__detail">
                    {!selectedId ? (
                        <p className="v3-act__note">Chọn 1 mục bên trái để xem chi tiết, hoặc tạo kiểm thử biên mới.</p>
                    ) : (
                        <BoundaryEntryPanel
                            key={selectedId}
                            entryId={selectedId}
                            runBaseUrl={runBaseUrl}
                            runnerAgentId={runnerAgentId}
                            onError={setError}
                            onChanged={refresh}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
