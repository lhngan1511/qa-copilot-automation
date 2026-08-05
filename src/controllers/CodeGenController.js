export default class CodeGenController {
    constructor({ manager, testcaseLoader = null }) {
        if (!manager) throw new Error("CodeGenController cần manager.");
        this.manager = manager;
        this.testcaseLoader = testcaseLoader;
    }

    async start(req, res) {
        try {
            const data = await this.manager.start(req.body ?? {});
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

    async list(req, res) {
        try {
            const data = this.manager.list();
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_LIST_FAILED", "Không thể đọc danh sách recording.");
        }
    }

    async get(req, res) {
        try {
            const data = this.manager.get(req.params.recordingId);
            if (!data) return res.status(404).json({ success: false, data: null, error: { code: "RECORDING_NOT_FOUND", message: "Không tìm thấy recording." } });
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
            const data = this.testcaseLoader ? this.testcaseLoader.loadAll() : [];
            return res.status(200).json({ success: true, data, error: null });
        } catch (error) {
            return this.fail(res, error, 500, "CODE_GEN_TESTCASES_FAILED", "Không thể đọc danh sách testcase.");
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
