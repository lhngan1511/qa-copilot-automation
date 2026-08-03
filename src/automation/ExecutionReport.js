/**
 * ExecutionReport — xuất báo cáo từ danh sách ExecutionResult.
 */
export default class ExecutionReport {
    /** @param {Array<import('./ExecutionResult.js').default>} results */
    build(results) {
        const total = results.length;
        const passed = results.filter((r) => r.status === "PASSED").length;
        const failed = results.filter((r) => r.status === "FAILED").length;
        const error = results.filter((r) => r.status === "ERROR").length;
        const notExecuted = results.filter((r) => r.status === "NOT_EXECUTED").length;
        const totalDurationMs = results.reduce((sum, r) => sum + (r.summary?.durationMs || 0), 0);
        const passRate = total ? Math.round((passed / total) * 100) : 0;

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                total,
                passed,
                failed,
                error,
                notExecuted,
                passRate,
                totalDurationMs
            },
            results: results.map((r) => r.toJSON())
        };
    }
}
