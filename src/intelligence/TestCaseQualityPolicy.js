export default class TestCaseQualityPolicy {
    constructor({
        caps = {
            POSITIVE: 2,
            NEGATIVE: 4,
            BOUNDARY: 3,
            PERMISSION: 2,
            EXCEPTION: 3,
            DATA_INTEGRITY: 3,
            RISK: 3,
            SECURITY: 3
        }
    } = {}) {
        this.caps = { ...caps };
    }
    apply(values, { scenarios = [], maxTestCasesPerScenario = 0, maxStepsPerTestCase = 0 } = {}) {
        const owners = new Map(scenarios.map(s => [s.id, s])),
            seen = new Set(),
            counts = new Map(),
            accepted = [];
        let duplicateRemovedCount = 0,
            rejectedCount = 0;
        for (const tc of Array.isArray(values) ? values : []) {
            const s = owners.get(tc?.scenarioId),
                steps = Array.isArray(tc?.steps) ? tc.steps : [],
                refs = [...(tc?.requirementReferences || []), ...(tc?.coveredRules || [])],
                objective = this.norm(tc?.objective || tc?.testObjective || tc?.title),
                type = String(tc?.type || "")
                    .replace(/-/g, "_")
                    .toUpperCase();
            const vague = steps.some(x =>
                /^(kiểm tra hệ thống|thực hiện thao tác|xác nhận đúng)$/i.test(
                    String(x.action || x.description || "").trim()
                )
            );
            const numbered = steps.every((x, i) => (x.stepNumber ?? x.order ?? i + 1) === i + 1);
            if (
                !s ||
                tc.moduleId !== s.moduleId ||
                tc.functionId !== s.functionId ||
                !objective ||
                !steps.length ||
                vague ||
                !numbered ||
                !tc.expectedResult ||
                !refs.length ||
                tc.actualResult ||
                ["PASS", "FAIL"].includes(tc.status) ||
                (maxStepsPerTestCase > 0 && steps.length > maxStepsPerTestCase)
            ) {
                rejectedCount++;
                continue;
            }
            const key = [
                this.norm(tc.moduleId || tc.module),
                this.norm(tc.functionId || tc.function || tc.feature),
                [...new Set(refs.map(value => this.norm(value)))].sort().join(","),
                type,
                objective,
                this.norm(tc.expectedResult)
            ].join("|");
            if (seen.has(key)) {
                duplicateRemovedCount++;
                continue;
            }
            const count = counts.get(tc.scenarioId) || 0,
                sourceItemCount = Array.isArray(s?.sourceItems) ? s.sourceItems.length : 0,
                cap = maxTestCasesPerScenario || Math.max(this.caps[type] || 3, sourceItemCount),
                critical = String(tc.priority).toLowerCase() === "critical" && refs.length > 0;
            if (!critical && count >= cap) {
                rejectedCount++;
                continue;
            }
            seen.add(key);
            counts.set(tc.scenarioId, count + 1);
            accepted.push({ ...tc });
        }
        accepted.forEach((x, i) => {
            x.id = x.id || `TC${String(i + 1).padStart(3, "0")}`;
        });
        return {
            testCases: accepted,
            summary: {
                generatedCount: Array.isArray(values) ? values.length : 0,
                duplicateRemovedCount,
                rejectedCount,
                finalCount: accepted.length,
                countByScenario: Object.fromEntries(counts),
                countByFunction: this.count(accepted, "functionId"),
                countByType: this.count(accepted, "type"),
                automationCandidateCount: accepted.filter(x => x.automationCandidate).length
            }
        };
    }
    count(a, f) {
        return a.reduce((r, x) => {
            const k = x[f] || "UNKNOWN";
            r[k] = (r[k] || 0) + 1;
            return r;
        }, {});
    }
    norm(v) {
        return String(v || "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}
