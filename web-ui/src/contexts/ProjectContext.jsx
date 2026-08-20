import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createProject, deleteProject, listProjects } from "../api/projectApi.js";

const ProjectContext = createContext(null);
const KEY = "qa-copilot-project-id";

export function ProjectProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectIdState] = useState(() => localStorage.getItem(KEY) ?? "");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const refresh = async () => {
        setLoading(true); setError("");
        try {
            const items = await listProjects(); setProjects(items);
            const current = items.some(item => item.projectId === projectId) ? projectId : (items[0]?.projectId ?? "");
            if (current !== projectId) { setProjectIdState(current); current ? localStorage.setItem(KEY, current) : localStorage.removeItem(KEY); }
        } catch (e) { setError(e?.message ?? "Không tải được Project."); }
        finally { setLoading(false); }
    };
    useEffect(() => { refresh(); }, []);
    const selectProject = id => { setProjectIdState(id); id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); window.location.assign("/"); };
    const addProject = async input => {
        const item = await createProject(input);
        localStorage.setItem(KEY, item.projectId);
        setProjectIdState(item.projectId);
        setProjects(current => [item, ...current.filter(project => project.projectId !== item.projectId)]);
        return item;
    };
    const removeProject = async id => {
        await deleteProject(id);
        const remaining = projects.filter(item => item.projectId !== id);
        const nextId = remaining[0]?.projectId ?? "";
        localStorage.removeItem(`qa-copilot.automation.workspaceId.${id}`);
        if (nextId) localStorage.setItem(KEY, nextId); else localStorage.removeItem(KEY);
        setProjects(remaining);
        setProjectIdState(nextId);
        if (nextId) window.location.assign("/");
    };
    const value = useMemo(() => ({ projects, projectId, project: projects.find(x => x.projectId === projectId) ?? null, loading, error, selectProject, addProject, removeProject, refresh }), [projects, projectId, loading, error]);
    return <ProjectContext.Provider value={value}>
        {loading ? <ProjectGate title="Đang tải Project…" /> : (!projectId ? <ProjectGate error={error} onCreate={addProject} /> : children)}
    </ProjectContext.Provider>;
}

function ProjectGate({ title = "Tạo Project đầu tiên", error = "", onCreate = null }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const submit = async event => {
        event.preventDefault();
        if (!onCreate || !name.trim()) return;
        setSaving(true); setMessage("");
        try { await onCreate({ name: name.trim(), code: code.trim() }); window.location.assign("/"); }
        catch (e) { setMessage(e?.message ?? "Không tạo được Project."); }
        finally { setSaving(false); }
    };
    return <main className="project-gate">
        <section className="project-gate__card">
            <div className="project-gate__eyebrow">QA Copilot</div>
            <h1>{title}</h1>
            {onCreate && <><p>Testcase, CodeGen, Thư viện thao tác và Automation sẽ được lưu và tra cứu theo Project này.</p>
                <form onSubmit={submit}>
                    <label>Tên Project<input value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Quản lý thiết bị" autoFocus /></label>
                    <label>Mã Project <span>(không bắt buộc)</span><input value={code} onChange={e => setCode(e.target.value)} placeholder="QLTB" /></label>
                    {(message || error) && <div className="project-gate__error">{message || error}</div>}
                    <button type="submit" disabled={saving || !name.trim()}>{saving ? "Đang tạo…" : "Tạo Project"}</button>
                </form></>}
        </section>
    </main>;
}

export function useProject() { const value = useContext(ProjectContext); if (!value) throw new Error("useProject phải nằm trong ProjectProvider."); return value; }
