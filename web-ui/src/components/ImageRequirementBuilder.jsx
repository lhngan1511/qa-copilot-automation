import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeRequirementImages, confirmImageRequirement, startWorkflow } from "../api/workflowApi.js";
import { extractWorkflowId } from "../utils/workflowResponse.js";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export default function ImageRequirementBuilder() {
    const navigate = useNavigate();
    const [images, setImages] = useState([]);
    const [draft, setDraft] = useState(null);
    const [markdown, setMarkdown] = useState("");
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [analysisMode, setAnalysisMode] = useState("FEATURES");
    const [dragActive, setDragActive] = useState(false);
    const imageFileRef = useRef(null);
    const markdownFileRef = useRef(null);
    const previews = useMemo(() => images.map(file => ({ file, url: URL.createObjectURL(file) })), [images]);
    const features = useMemo(() => {
        const blocks = String(markdown).split(/(?=^## Feature:)/gm).slice(1);
        return blocks.map(block => ({
            name: block.match(/^## Feature:\s*(.+)$/m)?.[1]?.trim() || "Chưa đặt tên",
            operation: block.match(/^Operation:\s*(.+)$/mi)?.[1]?.trim() || "Other"
        }));
    }, [markdown]);
    const evidenceCount = (draft?.observations?.length ?? 0) + (draft?.inferences?.length ?? 0) + (draft?.questions?.length ?? 0);

    const selectImages = files => {
        const selected = Array.from(files ?? []);
        setError(""); setDraft(null); setMarkdown("");
        if (selected.length > 5) return setError("Chỉ được chọn tối đa 5 ảnh.");
        const invalid = selected.find(file => !ACCEPTED.has(file.type) || file.size > 8 * 1024 * 1024);
        if (invalid) return setError(`Ảnh ${invalid.name} không hợp lệ hoặc vượt quá 8 MB.`);
        setImages(selected);
    };
    const choose = event => selectImages(event.target.files);
    const dropImages = event => {
        event.preventDefault();
        setDragActive(false);
        if (!busy) selectImages(event.dataTransfer.files);
    };
    const analyze = async () => {
        if (!images.length || busy) return;
        setBusy("analyze"); setError("");
        try { const data = await analyzeRequirementImages({ images, analysisMode }); setDraft(data); setMarkdown(data.markdownContent ?? ""); }
        catch (e) { setError(e?.message ?? "Không phân tích được hình ảnh."); }
        finally { setBusy(""); }
    };
    const downloadMarkdown = () => {
        if (!markdown.trim()) return;
        const moduleName = markdown.match(/^# Module:\s*(.+)$/m)?.[1]?.trim() || draft?.document?.module?.name || "requirement";
        const safeName = moduleName.normalize("NFKD").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "requirement";
        const url = URL.createObjectURL(new Blob(["\uFEFF", markdown.trim(), "\n"], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url; link.download = `${safeName}.md`; link.click();
        URL.revokeObjectURL(url);
        setNotice(`Đã tải ${safeName}.md. Bạn có thể sửa bên ngoài rồi nạp lại tại đây.`);
    };
    const importMarkdown = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError(""); setNotice("");
        if (!/\.md$/i.test(file.name)) return setError("Chỉ chấp nhận file Markdown có phần mở rộng .md.");
        if (file.size > 2 * 1024 * 1024) return setError("File Markdown không được vượt quá 2 MB.");
        const content = (await file.text()).replace(/^\uFEFF/, "").trim();
        if (!content.startsWith("# Module:") || !content.includes("# Features")) return setError("File .md không đúng cấu trúc requirement: cần có '# Module:' và '# Features'.");
        setMarkdown(content);
        setNotice(`Đã nạp nội dung đã chỉnh sửa từ ${file.name}.`);
    };
    const confirm = async () => {
        if (!draft || !markdown.trim() || busy) return;
        setBusy("confirm"); setError("");
        try {
            const confirmed = await confirmImageRequirement({ draftId: draft.draftId, markdownContent: markdown, fileName: draft.document?.module?.name });
            const result = await startWorkflow({ requirementId: confirmed.requirementId });
            navigate(`/workflows/${encodeURIComponent(extractWorkflowId(result))}`);
        } catch (e) { setError(e?.message ?? "Không tạo được requirement Markdown."); }
        finally { setBusy(""); }
    };

    return <div className="image-requirement">
        {!draft && <>
            <label
                className={`image-requirement__picker ${dragActive ? "image-requirement__picker--active" : ""}`}
                onDragEnter={event => { event.preventDefault(); if (!busy) setDragActive(true); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
                onDrop={dropImages}
            >
                <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={choose} disabled={Boolean(busy)} />
                <span className="image-requirement__picker-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.8-9.94A6.5 6.5 0 0 1 18.7 10.5 3.75 3.75 0 0 1 18.25 18H14" /><path d="M12 20V10m0 0-3 3m3-3 3 3" /></svg>
                </span>
                <strong>Kéo ảnh giao diện vào đây</strong>
                <span>PNG, JPEG hoặc WebP · tối đa 5 ảnh · 8 MB mỗi ảnh</span>
                <span className="image-requirement__picker-button">Chọn ảnh từ máy</span>
            </label>
            {previews.length > 0 && <div className="image-requirement__previews">{previews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}`}><img src={url} alt={`Ảnh nguồn ${index + 1}`} /><figcaption>{index + 1}. {file.name}</figcaption></figure>)}</div>}
            {previews.length > 1 && <fieldset className="image-requirement__mode"><legend>Các ảnh thể hiện</legend><label><input type="radio" name="analysisMode" value="FEATURES" checked={analysisMode === "FEATURES"} onChange={event => setAnalysisMode(event.target.value)} /><span><strong>Nhiều chức năng</strong><small>Ví dụ: danh sách, thêm, sửa và xóa — AI phải tách thành Feature riêng.</small></span></label><label><input type="radio" name="analysisMode" value="FLOW" checked={analysisMode === "FLOW"} onChange={event => setAnalysisMode(event.target.value)} /><span><strong>Một luồng liên tiếp</strong><small>Các ảnh là nhiều bước của cùng một kết quả nghiệp vụ.</small></span></label></fieldset>}
            <div className="upload-actions"><button className="button button--primary" type="button" onClick={analyze} disabled={!images.length || Boolean(busy)}>{busy === "analyze" ? "AI đang phân tích…" : "Phân tích hình ảnh"}</button></div>
        </>}

        {draft && <div className="image-requirement__review">
            <header><div><h3>Kiểm tra yêu cầu do AI đề xuất</h3><p>AI hỗ trợ phân tích; tester chịu trách nhiệm xác nhận nội dung cuối cùng.</p></div><button className="button button--secondary" type="button" onClick={() => { setDraft(null); setMarkdown(""); }}>Chọn lại ảnh</button></header>
            <section className="image-requirement__feature-summary"><strong>Nội dung hiện có {features.length} chức năng</strong>{features.length > 0 && <ul>{features.map((feature, index) => <li key={`${feature.name}-${index}`}>{feature.name}<span>{feature.operation}</span></li>)}</ul>}</section>
            <label className="image-requirement__markdown"><span>Nội dung yêu cầu (.md)</span><textarea value={markdown} onChange={event => setMarkdown(event.target.value)} spellCheck="false" /></label>
            <div className="image-requirement__file-actions">
                <input ref={markdownFileRef} className="visually-hidden" type="file" accept=".md,text/markdown,text/plain" onChange={importMarkdown} />
                <button className="button button--secondary" type="button" onClick={downloadMarkdown} disabled={!markdown.trim()}>Tải file .md</button>
                <button className="button button--secondary" type="button" onClick={() => markdownFileRef.current?.click()}>Nạp lại file đã sửa</button>
                <span>Sửa bằng VS Code hoặc Notepad, sau đó nạp lại trước khi tạo testcase.</span>
            </div>
            {evidenceCount > 0 && <details className="image-requirement__evidence"><summary>Xem căn cứ phân tích ({evidenceCount} nội dung)</summary><div className="image-requirement__signals">
                <section><h4>Quan sát từ hình ảnh</h4>{draft.observations?.length ? <ul>{draft.observations.map((item, index) => <li key={index}>{item.text}<small>{item.evidence}</small></li>)}</ul> : <p>AI không ghi nhận quan sát rõ ràng.</p>}</section>
                <section className="image-requirement__inferences"><h4>Đề xuất cần xác nhận</h4>{draft.inferences?.length ? <ul>{draft.inferences.map((item, index) => <li key={index}>{item.text}<small>Bằng chứng: {item.evidence || "chưa rõ"} · Tin cậy: {Math.round((Number(item.confidence) || 0) * 100)}%</small></li>)}</ul> : <p>Không có suy luận bổ sung.</p>}</section>
                {draft.questions?.length > 0 && <section><h4>Câu hỏi cần làm rõ</h4><ul>{draft.questions.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
            </div></details>}
            <div className="image-requirement__usage">Model: {draft.model || "Gemini"}{draft.usage?.totalTokens ? ` · ${draft.usage.totalTokens.toLocaleString("vi-VN")} token` : ""}</div>
            <div className="upload-actions"><button className="button button--primary" type="button" onClick={confirm} disabled={!markdown.trim() || Boolean(busy)}>{busy === "confirm" ? "Đang tạo testcase…" : "Xác nhận .md và tạo testcase"}</button></div>
        </div>}
        {notice && <div className="image-requirement__notice" role="status">{notice}</div>}
        {error && <div className="inline-alert" role="alert"><strong>Không thể hoàn tất</strong><span>{error}</span></div>}
    </div>;
}
