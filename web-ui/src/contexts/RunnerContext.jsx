import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listRunnerAgents } from "../api/automationV3Api.js";

/*
 RunnerContext — "chọn máy Runner 1 lần, dùng chung mọi nơi" (Ngân yêu cầu 2026-09-07: CodeGen/
 Kiểm thử biên/Automation V3 đều chạy trên máy chủ hiện tại, cần chọn 1 máy Runner cá nhân và áp
 dụng tự động cho mọi chức năng thay vì chọn lại mỗi màn hình). Mô phỏng đúng ProjectContext.jsx
 (context + provider gắn ở gốc app + hook throw ngoài provider) — KHÔNG reload trang khi đổi runner
 (khác selectProject) vì đổi runner chỉ ảnh hưởng hành động Chạy/Ghi tiếp theo, không phải ranh giới
 dữ liệu như Project.

 Dùng lại NGUYÊN VẸN 2 key localStorage đã có từ AutomationV3Page.jsx để không mất lựa chọn đã lưu
 của user hiện tại khi nâng cấp lên context dùng chung.
*/

const RunnerContext = createContext(null);
const RUNNER_AGENT_KEY = "qa-copilot.automation.runnerAgentId";
const RUNNER_SLOWMO_KEY = "qa-copilot.automation.runnerSlowMo";

export function RunnerProvider({ children }) {
    const [runnerAgents, setRunnerAgents] = useState([]);
    const [runnerAgentId, setRunnerAgentIdState] = useState(() => window.localStorage.getItem(RUNNER_AGENT_KEY) || "");
    const [runnerSlowMo, setRunnerSlowMoState] = useState(() => {
        const value = Number(window.localStorage.getItem(RUNNER_SLOWMO_KEY) ?? 1000);
        return [0, 500, 1000].includes(value) ? value : 1000;
    });

    useEffect(() => {
        let cancelled = false;
        const refreshAgents = async () => {
            try {
                const list = await listRunnerAgents();
                if (!cancelled) setRunnerAgents(Array.isArray(list) ? list : []);
            } catch {
                if (!cancelled) setRunnerAgents([]);
            }
        };
        refreshAgents();
        const timer = window.setInterval(refreshAgents, 5000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, []);

    const setRunnerAgentId = next => {
        setRunnerAgentIdState(next);
        if (next) window.localStorage.setItem(RUNNER_AGENT_KEY, next);
        else window.localStorage.removeItem(RUNNER_AGENT_KEY);
    };

    const setRunnerSlowMo = next => {
        setRunnerSlowMoState(next);
        window.localStorage.setItem(RUNNER_SLOWMO_KEY, String(next));
    };

    const activeAgent = useMemo(
        () => runnerAgents.find(agent => agent.agentId === runnerAgentId) ?? null,
        [runnerAgents, runnerAgentId]
    );

    const value = useMemo(
        () => ({ runnerAgentId, setRunnerAgentId, runnerAgents, activeAgent, runnerSlowMo, setRunnerSlowMo }),
        [runnerAgentId, runnerAgents, activeAgent, runnerSlowMo]
    );

    return <RunnerContext.Provider value={value}>{children}</RunnerContext.Provider>;
}

export function useRunner() {
    const value = useContext(RunnerContext);
    if (!value) throw new Error("useRunner phải nằm trong RunnerProvider.");
    return value;
}
