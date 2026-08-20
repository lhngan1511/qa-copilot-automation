import { useState } from "react";
import { useProject } from "../contexts/ProjectContext.jsx";

export default function ProjectSwitcher() {
    const { projects, project, projectId, loading, error, selectProject, addProject, removeProject } = useProject();
    const [creating, setCreating] = useState(false);
    const [managing, setManaging] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const submit = async event => {
        event.preventDefault(); if (!name.trim() || busy) return; setBusy(true);
        try { setActionError(""); await addProject({ name: name.trim() }); setName(""); setCreating(false); }
        catch (e) { setActionError(e?.message ?? "Không tạo được Project."); }
        finally { setBusy(false); }
    };
    const handleDelete = async () => {
        if (!projectId || busy) return;
        setBusy(true);
        try { setActionError(""); await removeProject(projectId); setManaging(false); setConfirmingDelete(false); }
        catch (e) { setActionError(e?.message ?? "Không xóa được Project."); }
        finally { setBusy(false); }
    };
    return (
        <div className="project-switcher">
            <span className="project-switcher__label">Project</span>
            <select value={projectId} disabled={loading || projects.length === 0} onChange={e => selectProject(e.target.value)} aria-label="Project hiện tại">
                {projects.length === 0 ? <option value="">Chưa có Project</option> : projects.map(item => <option key={item.projectId} value={item.projectId}>{item.name}</option>)}
            </select>
            <button type="button" onClick={() => { setCreating(open => !open); setManaging(false); setConfirmingDelete(false); }} aria-label="Tạo Project mới">+</button>
            <div className="project-switcher__manage-wrap">
                <button type="button" className="project-switcher__manage-button" onClick={() => { setManaging(open => !open); setCreating(false); setConfirmingDelete(false); }} aria-label="Quản lý Project" aria-expanded={managing}>Quản lý</button>
                {managing ? <div className="project-switcher__manage" role="dialog" aria-label="Quản lý Project">
                    <div className="project-switcher__manage-title">{project?.name || "Project hiện tại"}</div>
                    {!confirmingDelete ? <>
                        <p>Xóa Project khỏi danh sách làm việc.</p>
                        <button type="button" className="project-switcher__delete" onClick={() => setConfirmingDelete(true)}>Xóa Project</button>
                    </> : <>
                        <p>Dữ liệu thuộc Project này sẽ không còn được truy cập. Bạn có chắc muốn xóa?</p>
                        <div className="project-switcher__confirm-actions">
                            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy}>Hủy</button>
                            <button type="button" className="project-switcher__delete" onClick={handleDelete} disabled={busy}>{busy ? "Đang xóa…" : "Xóa Project"}</button>
                        </div>
                    </>}
                </div> : null}
            </div>
            {creating ? <form className="project-switcher__create" onSubmit={submit}><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Tên Project" /><button type="submit" disabled={busy || !name.trim()}>{busy ? "Đang tạo…" : "Tạo"}</button></form> : null}
            {error || actionError ? <span className="project-switcher__error">{actionError || error}</span> : null}
        </div>
    );
}
