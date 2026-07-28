export default class TestCaseIntelligenceMerger {
    constructor(policy) {
        this.policy = policy;
    }
    merge(ruleCases, aiCases, options = {}) {
        const all = (ruleCases || []).map(x => ({ ...x, source: x.source || "rule" }));
        for (const ai of aiCases || []) {
            const m = all.find(
                r =>
                    r.scenarioId === ai.scenarioId &&
                    this.n(r.objective || r.testObjective || r.title) ===
                        this.n(ai.objective || ai.title) &&
                    String(r.type) === String(ai.type)
            );
            if (m) {
                m.id = m.id;
                m.steps = ai.steps?.length ? ai.steps : m.steps;
                m.expectedResult = ai.expectedResult || m.expectedResult;
                m.automationNotes = ai.automationNotes || m.automationNotes || "";
                m.source = `rule+${ai.source || "ai"}`;
            } else all.push({ ...ai, id: "" });
        }
        return this.policy.apply(all, options);
    }
    n(v) {
        return String(v || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }
}
