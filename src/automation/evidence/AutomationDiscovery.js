/**
 * Automation Discovery — kết quả thu thập bằng chứng cho một testcase.
 * Mỗi nguồn được lưu RIÊNG (evidenceBySource), không trộn lẫn.
 */
export default class AutomationDiscovery {
    constructor({ testCaseId = "", module = "", feature = "", capturedAt = new Date().toISOString() } = {}) {
        this.testCaseId = testCaseId;
        this.module = module;
        this.feature = feature;
        this.capturedAt = capturedAt;
        this.evidence = [];
        this.sourcesUsed = [];
    }

    addEvidence(evidence) {
        this.evidence.push(evidence);
        if (!this.sourcesUsed.includes(evidence.source)) {
            this.sourcesUsed.push(evidence.source);
        }
    }

    /** Evidence chia theo nguồn — KHÔNG trộn lẫn. */
    evidenceBySource() {
        const map = {};
        for (const ev of this.evidence) {
            (map[ev.source] ??= []).push(ev);
        }
        return map;
    }

    byKind(kind) {
        return this.evidence.filter((e) => e.kind === kind);
    }

    byState(state) {
        return this.evidence.filter((e) => e.state === state);
    }

    toJSON() {
        return {
            testCaseId: this.testCaseId,
            module: this.module,
            feature: this.feature,
            capturedAt: this.capturedAt,
            sourcesUsed: this.sourcesUsed,
            evidence: this.evidence.map((e) => e.toJSON())
        };
    }
}
