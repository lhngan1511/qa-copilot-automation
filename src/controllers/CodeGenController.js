import AIProviderFactory from "../providers/AIProviderFactory.js";
import AIConfig from "../config/AIConfig.js";

export default class CodeGenController {
    constructor({ manager, testcaseLoader = null, actionLibrary = null, usageFn = null }) {
        if (!manager) throw new Error("CodeGenController cần manager.");
        this.manager = manager;
        this.testcaseLoader = testcaseLoader;
        this.actionLibrary = actionLibrary;
        this.usageFn = usageFn;
    }

    /** P0 Library Visibility — list shared Action Library (kèm usage derive). */
    async listLibrary(req, res) {
        try {
            if (!this.actionLibrary) return this.fail(res, new Error("ActionLibrary chưa cấu hình."), 500, "LIBRARY_NOT_CONFIGURED", "Thư viện thao tác chưa sẵn sàng.");
            const usage = typeof this.usageFn === "function" ? (this.usageFn() ?? new Map()) : new Map();
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            const blocks = this.actionLibrary.list(projectId).map(b => ({
                blockId: b.blockId,
                projectId: b.projectId ?? null,
                label: b.label ?? null,
                kind: b.kind,
                groupName: b.groupName ?? null,
                // P0 EDIT — version + hash (content dependency cho fingerprint/stale UI).
                version: b.version ?? 1,
                hash: b.hash ?? null,
                stepCount: (b.steps ?? []).length,
                // P0 — kèm steps/assertions sanitized để UI "[Xem]" expand readable (không render một cục text).
                steps: (b.steps ?? []).map(s => ({
                    order: s.order,
                    actionType: s.actionType,
                    locator: s.locator,
                    target: s.target,
                    recordedValue: s.sensitive ? "••••" : (s.recordedValue ?? ""),
                    sensitive: Boolean(s.sensitive)
                })),
                recordedAssertionCount: (b.recordedAssertions ?? []).length,
                recordedAssertions: (b.recordedAssertions ?? []).map(a => ({
                    order: a.order,
                    statement: a.statement ?? "",
                    locator: a.locator ?? null,
                    matcher: a.matcher ?? null,
                    expected: a.expected ?? null,
                    sourceLine: a.sourceLine ?? null
                })),
                sourceRecordingId: b.sourceRecordingId ?? null,
                sourceRange: b.sourceRange ?? null,
                createdAt: b.createdAt ?? null,
                updatedAt: b.updatedAt ?? null,
                status: b.status,
                usedByTestCases: usage.get(b.blockId) ?? 0
            }));
            return res.status(200).json({ success: true, data: blocks, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "LIBRARY_LIST_FAILED", "Không đọc được thư viện thao tác.");
        }
    }

    /** P0 Consolidation — tạo Library Action từ GLOBAL recording (không workspace, không createBlock). */
    async createLibraryAction(req, res) {
        try {
            if (!this.actionLibrary) return this.fail(res, new Error("ActionLibrary chưa cấu hình."), 500, "LIBRARY_NOT_CONFIGURED", "Thư viện thao tác chưa sẵn sàng.");
            const { recordingId, label, kind = "ACTION", startStep, endStep, groupName } = req.body ?? {};
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            if (!recordingId || !Number.isInteger(startStep) || !Number.isInteger(endStep)) {
                return this.fail(res, new Error("Thiếu recordingId/startStep/endStep."), 400, "INVALID_REQUEST", "Thiếu thông tin đoạn thao tác.");
            }
            const trimmedLabel = String(label ?? "").trim();
            if (!trimmedLabel) return this.fail(res, new Error("Thiếu tên thao tác."), 400, "LIBRARY_LABEL_REQUIRED", "Tên thao tác bắt buộc.");
            const rec = this.manager.get(recordingId);
            if (!rec) return this.fail(res, new Error("Không tìm thấy bản ghi."), 404, "RECORDING_NOT_FOUND", "Không tìm thấy bản ghi.");
            const steps = (rec.steps ?? []).filter(s => Number.isInteger(s?.order) && s.order >= startStep && s.order <= endStep);
            if (steps.length === 0) return this.fail(res, new Error("Khoảng bước không có thao tác."), 400, "INVALID_RANGE", "Khoảng bước không hợp lệ.");
            const last = steps[steps.length - 1];
            const first = steps[0];
            const asserts = (rec.assertions ?? []).filter(a => {
                const as = a.sourceStart ?? -1; const ae = a.sourceEnd ?? -1;
                if (as >= (first?.sourceStart ?? 0) && ae <= (last?.sourceEnd ?? 0)) return true;
                if (as >= (last?.sourceStart ?? 0) && as <= (last?.sourceEnd ?? 0) + 120) return true;
                return false;
            }).map(a => ({ order: a.order, statement: a.statement ?? "", locator: a.locator ?? null, matcher: a.matcher ?? null, expected: a.expected ?? null, sourceStart: a.sourceStart ?? null, sourceEnd: a.sourceEnd ?? null, sourceLine: a.sourceLine ?? null }));
            const block = this.actionLibrary.addBlock({
                label: trimmedLabel,
                kind: String(kind ?? "ACTION").toUpperCase() === "SETUP" ? "SETUP" : "ACTION",
                steps,
                recordedAssertions: asserts,
                sourceRecordingId: recordingId,
                sourceRange: { startStep, endStep },
                groupName: String(groupName ?? "").trim() || null,
                projectId
            });
            return res.status(201).json({ success: true, data: { blockId: block.blockId, label: block.label, kind: block.kind, groupName: block.groupName, stepCount: block.steps.length, recordedAssertionCount: block.recordedAssertions.length }, error: null });
        } catch (error) {
            return this.fail(res, error, 400, "LIBRARY_CREATE_FAILED", "Không tạo được thao tác thư viện.");
        }
    }

    /** P0 — Xóa thao tác khỏi Library (tester chủ động; UI confirm trước khi gọi — block có thể đang được testcase dùng). */
    async deleteLibraryAction(req, res) {
        try {
            if (!this.actionLibrary) return this.fail(res, new Error("ActionLibrary chưa cấu hình."), 500, "LIBRARY_NOT_CONFIGURED", "Thư viện thao tác chưa sẵn sàng.");
            const { blockId } = req.params ?? {};
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            if (!this.actionLibrary.belongsToProject(blockId, projectId)) {
                return this.fail(res, new Error("Không tìm thấy thao tác."), 404, "LIBRARY_BLOCK_NOT_FOUND", "Không tìm thấy thao tác trong Project hiện tại.");
            }
            // P0 EDIT/DELETE — guard: Action đang được testcase dùng KHÔNG được xóa (xóa làm
            // binding resolve null -> testcase generate 422 SEGMENT_MAPPING_INVALID / mất action).
            const usage = typeof this.usageFn === "function" ? (this.usageFn() ?? new Map()) : new Map();
            const used = usage.get(blockId) ?? 0;
            if (used > 0) {
                return this.fail(res, new Error(`Action này đang được sử dụng bởi ${used} testcase. Hãy bỏ Action khỏi các testcase đang dùng trước.`), 409, "LIBRARY_IN_USE", `Action đang dùng bởi ${used} testcase.`);
            }
            const removed = this.actionLibrary.removeBlock(blockId);
            if (!removed) return this.fail(res, new Error("Không tìm thấy thao tác."), 404, "LIBRARY_BLOCK_NOT_FOUND", "Không tìm thấy thao tác trong thư viện.");
            return res.status(200).json({ success: true, data: { blockId, removed: true }, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "LIBRARY_DELETE_FAILED", "Không xóa được thao tác thư viện.");
        }
    }

    /** P0 EDIT — Action Library composition (KHÔNG raw Playwright): đổi tên / Chức năng /
     *  include-exclude step (steps mới). Content change → updateBlock re-snapshot + version++
     *  + hash mới; tester chủ động → confirmBlock (CONFIRMED). Testcase đang dùng Action sẽ
     *  stale (fingerprint có hash/version) → bắt Generate lại. */
    async updateLibraryAction(req, res) {
        try {
            if (!this.actionLibrary) return this.fail(res, new Error("ActionLibrary chưa cấu hình."), 500, "LIBRARY_NOT_CONFIGURED", "Thư viện thao tác chưa sẵn sàng.");
            const { blockId } = req.params ?? {};
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            const { label, groupName, steps } = req.body ?? {};
            if (!this.actionLibrary.belongsToProject(blockId, projectId)) {
                return this.fail(res, new Error("Không tìm thấy thao tác."), 404, "LIBRARY_BLOCK_NOT_FOUND", "Không tìm thấy thao tác trong thư viện.");
            }
            const patch = {};
            if (label !== undefined) patch.label = label;
            if (groupName !== undefined) patch.groupName = groupName;
            if (steps !== undefined) {
                if (!Array.isArray(steps)) return this.fail(res, new Error("steps phải là mảng."), 400, "INVALID_REQUEST", "Danh sách bước không hợp lệ.");
                // Merge theo step order để edit không làm mất metadata nguồn. Với dữ liệu nhạy cảm,
                // frontend gửi preserveRecordedValue=true nếu tester không nhập giá trị thay thế.
                const current = this.actionLibrary.get(blockId);
                patch.steps = steps.map(s => {
                    const original = (current?.steps ?? []).find(item => item.order === s.order) ?? {};
                    const incoming = { ...s };
                    const preserveSensitive = Boolean(original.sensitive && incoming.preserveRecordedValue);
                    delete incoming.preserveRecordedValue;
                    if (preserveSensitive) delete incoming.recordedValue;
                    return {
                        ...original,
                        ...incoming,
                        recordedValue: preserveSensitive ? original.recordedValue : incoming.recordedValue,
                        sensitive: Boolean(original.sensitive)
                    };
                });
            }
            let updated;
            try {
                updated = this.actionLibrary.updateBlock(blockId, patch);
            } catch (e) {
                return this.fail(res, e, 400, e.code ?? "LIBRARY_UPDATE_FAILED", e.message ?? "Không cập nhật được thao tác.");
            }
            if (!updated) return this.fail(res, new Error("Không tìm thấy thao tác."), 404, "LIBRARY_BLOCK_NOT_FOUND", "Không tìm thấy thao tác trong thư viện.");
            // Tester chủ động save composition -> xác nhận (CONFIRMED). Content change đã version++.
            this.actionLibrary.confirmBlock(blockId);
            const final = this.actionLibrary.get(blockId);
            return res.status(200).json({ success: true, data: final, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "LIBRARY_UPDATE_FAILED", "Không cập nhật được thao tác thư viện.");
        }
    }

    /** P0 — Rename group trong Action Library (persist; reload giữ; không đổi blockId/action). */
    async renameLibraryGroup(req, res) {
        try {
            if (!this.actionLibrary) return this.fail(res, new Error("ActionLibrary chưa cấu hình."), 500, "LIBRARY_NOT_CONFIGURED", "Thư viện thao tác chưa sẵn sàng.");
            const { oldGroupName, newGroupName } = req.body ?? {};
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            let result;
            try {
                result = this.actionLibrary.renameGroup(oldGroupName, newGroupName, projectId);
            } catch (e) {
                return this.fail(res, e, 400, e.code ?? "GROUP_RENAME_FAILED", e.message ?? "Không đổi được tên nhóm.");
            }
            return res.status(200).json({ success: true, data: result, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "GROUP_RENAME_FAILED", "Không đổi được tên nhóm.");
        }
    }

    /** AI Recording Analysis — input CHỈ steps/assertions của recording (KHÔNG testcase list).
     *  Output = PROPOSAL (structured); không persist. AI lỗi/unavailable → proposals: [] (manual vẫn chạy). */
    async createRecording(req, res) {
        try {
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            const data = this.manager.createRecording({ ...(req.body ?? {}), projectId });
            return res.status(201).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 400, "CODE_GEN_CREATE_FAILED", "Không tạo được bản ghi.");
        }
    }

    async analyzeRecording(req, res) {
        try {
            const { recordingId } = req.body ?? {};
            const rec = recordingId ? this.manager.get(recordingId) : null;
            if (!rec) return this.fail(res, new Error("Không tìm thấy bản ghi."), 404, "RECORDING_NOT_FOUND", "Không tìm thấy bản ghi.");
            const steps = (rec.steps ?? []).map(s => ({ order: s.order, actionType: s.actionType, target: s.target ?? "", locator: s.locator ?? "" }));
            const assertions = (rec.assertions ?? []).map(a => ({ order: a.order, statement: a.statement ?? "", matcher: a.matcher ?? "", locator: a.locator ?? "" }));
            if (steps.length === 0) return res.status(200).json({ success: true, data: { proposals: [] }, error: null });
            let provider = null;
            // P0-3.1 — phân biệt rõ lý do: provider unavailable / request fail / response sai định dạng /
            // empty hợp lệ. Trước đây mọi lỗi đều bị nuốt thành proposals:[] + error:null → frontend
            // không thể biết "AI thật sự fail" hay "AI trả về rỗng".
            try { provider = AIProviderFactory.createProvider(AIConfig.provider); } catch { provider = null; }
            if (!provider) {
                return res.status(200).json({ success: true, data: { proposals: [] }, error: { code: "AI_PROVIDER_UNAVAILABLE", retryable: true, message: "AI provider chưa sẵn sàng." } });
            }
            const prompt = `Bạn là trợ lý phân tích Playwright recording. Hãy chia bản ghi thành các THAO TÁC nghiệp vụ có thể tái sử dụng và phân loại từng thao tác vào đúng CHỨC NĂNG.
CHỈ trả về JSON hợp lệ, không kèm text khác, dạng:
{"proposals":[{"suggestedGroupName":"Đăng nhập","suggestedName":"Đăng nhập thành công","startStep":1,"endStep":4,"evidence":["..."],"confidence":0.9,"needsTesterConfirmation":true}]}
QUY TẮC:
- "suggestedGroupName" là CHỨC NĂNG/phân hệ nghiệp vụ dùng để phân nhóm trong thư viện, ví dụ: Đăng nhập, Điều hướng, Thiết bị.
- "suggestedName" là kết quả hoặc kịch bản cụ thể có thể thực thi, ví dụ: Đăng nhập thành công, Chọn phân hệ Thiết bị, Thêm thiết bị thành công.
- Một recording dài có thể đi qua NHIỀU chức năng. Phải gán chức năng riêng cho từng cụm, không gom toàn bộ recording vào một chức năng.
- Không dùng các động từ chung như "Thêm", "Sửa", "Mở chức năng" làm tên khi có đủ bằng chứng để đặt tên nghiệp vụ rõ hơn.
- Không biết/không nhắc testcase.
- Nếu không đủ bằng chứng, vẫn đề xuất range nhưng suggestedGroupName hoặc suggestedName có thể rỗng.
- KHÔNG tự sửa locator.
Dữ liệu recording:
steps: ${JSON.stringify(steps)}
assertions: ${JSON.stringify(assertions)}`;
            let text = "";
            try { text = String((await provider.generate(prompt)) ?? "").trim(); } catch { text = ""; }
            if (!text) {
                return res.status(200).json({ success: true, data: { proposals: [] }, error: { code: "AI_REQUEST_FAILED", retryable: true, message: "Không nhận được phản hồi từ AI." } });
            }
            let proposals = [];
            try {
                const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
                const json = JSON.parse(cleaned);
                if (Array.isArray(json.proposals)) proposals = json.proposals.map(p => ({
                    suggestedGroupName: String(p.suggestedGroupName ?? p.groupName ?? "").trim() || null,
                    suggestedName: String(p.suggestedName ?? "").trim() || null,
                    startStep: Number.isInteger(p.startStep) ? p.startStep : null,
                    endStep: Number.isInteger(p.endStep) ? p.endStep : null,
                    evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : [],
                    confidence: typeof p.confidence === "number" ? p.confidence : null,
                    needsTesterConfirmation: p.needsTesterConfirmation !== false
                })).filter(p => Number.isInteger(p.startStep) && Number.isInteger(p.endStep));
            } catch {
                return res.status(200).json({ success: true, data: { proposals: [] }, error: { code: "AI_RESPONSE_INVALID", retryable: true, message: "AI trả về không đúng định dạng." } });
            }
            // AI trả JSON hợp lệ nhưng không có proposal → empty hợp lệ (error: null — không phải lỗi).
            return res.status(200).json({ success: true, data: { proposals }, error: null });
        } catch (error) {
            return res.status(200).json({ success: true, data: { proposals: [] }, error: { code: "ANALYZE_FAILED", retryable: true, message: error?.message ?? "Phân tích thất bại." } });
        }
    }

    async start(req, res) {
        try {
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            const data = await this.manager.start({ ...(req.body ?? {}), projectId });
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_START_FAILED", "Không thể bắt đầu ghi CodeGen.");
        }
    }

    async stop(req, res) {
        try {
            const data = await this.manager.stop(req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 409, "CODE_GEN_STOP_FAILED", "Không thể dừng phiên ghi CodeGen.");
        }
    }

    async setScript(req, res) {
        try {
            const data = this.manager.setScript(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_SET_SCRIPT_FAILED", "Không thể lưu script.");
        }
    }

    async list(req, res) {
        try {
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            const data = this.manager.list(projectId);
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_LIST_FAILED", "Không thể đọc danh sách recording.");
        }
    }

    async get(req, res) {
        try {
            const data = this.manager.get(req.params.recordingId);
            const projectId = String(req.get?.("x-project-id") ?? "").trim() || null;
            if (!data || String(data.projectId ?? "") !== String(projectId ?? "")) return res.status(404).json({ success: false, data: null, error: { code: "RECORDING_NOT_FOUND", message: "Không tìm thấy recording trong Project hiện tại." } });
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 404, "RECORDING_NOT_FOUND", "Không tìm thấy recording.");
        }
    }

    async rename(req, res) {
        try {
            const data = this.manager.rename(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_RENAME_FAILED", "Không thể đổi tên.");
        }
    }

    async linkTestcases(req, res) {
        try {
            const data = this.manager.linkTestcases(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_LINK_FAILED", "Không thể gắn testcase.");
        }
    }

    async save(req, res) {
        try {
            const data = this.manager.saveToWorkspace(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_SAVE_FAILED", "Không thể lưu script.");
        }
    }

    async run(req, res) {
        try {
            const data = await this.manager.run(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_RUN_FAILED", "Không thể chạy thử script.");
        }
    }

    async openFolder(req, res) {
        try {
            const data = this.manager.openFolder(req.params.recordingId);
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_OPEN_FOLDER_FAILED", "Không thể mở thư mục.");
        }
    }

    async openReport(req, res) {
        try {
            const data = this.manager.openReport(req.params.recordingId);
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_OPEN_REPORT_FAILED", "Không thể mở report.");
        }
    }

    async remove(req, res) {
        try {
            const data = this.manager.delete(req.params.recordingId);
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_DELETE_FAILED", "Không thể xoá recording.");
        }
    }

    async testcases(req, res) {
        try {
            const recordingId = req.query?.recordingId || req.body?.recordingId || null;
            const hasContext = recordingId
                ? this.manager.hasReliableContext(recordingId)
                : false;
            let testcases = [];
            if (recordingId && hasContext) {
                const ctx = this.manager.getContext(recordingId);
                const all = this.testcaseLoader ? this.testcaseLoader.loadAll() : [];
                testcases = this.filterTestcasesByContext(all, ctx);
            }
            return res.status(200).json({
                success: true,
                data: { enabled: hasContext, context: recordingId ? this.manager.getContext(recordingId) : null, testcases },
                error: null
            });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_TESTCASES_FAILED", "Không thể đọc danh sách testcase.");
        }
    }

    /**
     * Lọc testcase khớp context (module/feature/moduleId/functionId) và chỉ giữ
     * APPROVED. Không dùng một approved-testcases.json rời làm mặc định.
     */
    filterTestcasesByContext(testcases, ctx = {}) {
        const ctxModule = String(ctx.module ?? "").trim().toLowerCase();
        const ctxFeature = String(ctx.feature ?? "").trim().toLowerCase();
        const ctxModuleId = String(ctx.moduleId ?? "").trim().toLowerCase();
        const ctxFunctionId = String(ctx.functionId ?? "").trim().toLowerCase();
        return (Array.isArray(testcases) ? testcases : []).filter(tc => {
            const review = String(tc.reviewStatus ?? "").trim().toUpperCase();
            if (review && review !== "APPROVED") return false;
            const m = String(tc.module ?? "").trim().toLowerCase();
            const f = String(tc.feature ?? "").trim().toLowerCase();
            const mi = String(tc.moduleId ?? "").trim().toLowerCase();
            const fi = String(tc.functionId ?? "").trim().toLowerCase();
            // khớp nếu context module/feature/id trùng
            const matchModule = !ctxModule || (m && m.includes(ctxModule)) || (ctxModule && ctxModule.includes(m));
            const matchFeature = !ctxFeature || (f && f.includes(ctxFeature)) || (ctxFeature && ctxFeature.includes(f));
            const matchModuleId = !ctxModuleId || (mi && mi === ctxModuleId);
            const matchFunctionId = !ctxFunctionId || (fi && fi === ctxFunctionId);
            return matchModule && matchFeature && matchModuleId && matchFunctionId;
        });
    }

    async setContext(req, res) {
        try {
            const data = this.manager.setContext(req.params.recordingId, req.body ?? {});
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_SET_CONTEXT_FAILED", "Không thể gán context.");
        }
    }

    async status(req, res) {
        try {
            const data = this.manager.getSessionInfo();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_STATUS_FAILED", "Không thể đọc trạng thái CodeGen.");
        }
    }

    async focus(req, res) {
        try {
            const data = await this.manager.focusBrowserWindow();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 200, "CODE_GEN_FOCUS_FAILED", "Không thể focus cửa sổ ghi.");
        }
    }

    async cleanup(req, res) {
        try {
            const data = await this.manager.dispose();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_CLEANUP_FAILED", "Không thể dọn dữ liệu CodeGen.");
        }
    }

    fail(res, error, status, diagnostic, fallbackMessage) {
        const statusCode =
            Number.isInteger(error?.statusCode) && error.statusCode >= 400
                ? error.statusCode
                : status;
        return res.status(statusCode).json({
            success: false,
            data: null,
            error: {
                code: error?.code ?? diagnostic,
                message: error?.message ?? fallbackMessage,
                diagnostic,
                technical: error?.message ?? ""
            }
        });
    }
}
