import { Router } from "express";
import { ZipArchive } from "archiver";
import fs from "node:fs";
import path from "node:path";
import { buildRunnerAgentConfig, suggestPackageFileName, RUNNER_PACKAGE_STATIC_FILES } from "../services/runnerPackage.js";

function requireUser(req) { if (req.user) return req.user; const error = new Error("Cần đăng nhập."); error.code = "AUTH_REQUIRED"; error.statusCode = 401; throw error; }

export default function createRunnerDeviceRoutes({ service, runnerSourceDir = null } = {}) {
    const router = Router(); const send = action => (req, res, next) => { try { res.json({ success: true, data: action(req), error: null }); } catch (error) { next(error); } };
    const sourceDir = runnerSourceDir ?? path.resolve(process.cwd(), "tools", "runner");
    router.get("/", send(req => service.listForUser(requireUser(req).userId)));
    router.post("/", send(req => service.create({ userId: requireUser(req).userId, machineName: req.body?.machineName })));
    router.post("/:runnerId/revoke", send(req => service.revoke(req.params.runnerId, requireUser(req).userId)));

    /* Tải gói cài đặt Runner Agent 1-click (Ngân yêu cầu 2026-09-07) — nén .zip TRONG BỘ NHỚ rồi
       stream thẳng về response, KHÔNG BAO GIỜ ghi token/config ra đĩa server (token gốc chỉ tồn tại
       đúng 1 lần ở response tạo Runner Device, xem RunnerDeviceService#create). Xác thực bằng CHÍNH
       token thật (authenticate) — không chỉ dựa vào session — để chắc chắn client thực sự đang cầm
       đúng token vừa tạo, không đoán runnerId suông. */
    router.post("/:runnerId/package", (req, res, next) => {
        try {
            const runnerId = req.params.runnerId;
            const token = String(req.body?.token ?? "");
            if (!token) {
                const error = new Error("Thiếu token.");
                error.code = "RUNNER_TOKEN_REQUIRED";
                error.statusCode = 400;
                throw error;
            }
            const device = service.authenticate(runnerId, token);
            if (!device) {
                const error = new Error("Token Runner không hợp lệ.");
                error.code = "RUNNER_AGENT_UNAUTHORIZED";
                error.statusCode = 401;
                throw error;
            }
            const user = requireUser(req);
            if (device.userId !== user.userId) {
                const error = new Error("Runner không thuộc tài khoản hiện tại.");
                error.code = "RUNNER_DEVICE_FORBIDDEN";
                error.statusCode = 403;
                throw error;
            }

            // Kiểm tra file tồn tại TRƯỚC khi set header/bắt đầu stream — tránh lỗi giữa chừng sau
            // khi response đã bắt đầu gửi (lúc đó không còn trả JSON lỗi bình thường được nữa).
            for (const relativeName of RUNNER_PACKAGE_STATIC_FILES) {
                if (!fs.existsSync(path.join(sourceDir, relativeName))) {
                    const error = new Error(`Thiếu file gói cài đặt trên server: ${relativeName}.`);
                    error.code = "RUNNER_PACKAGE_FILE_MISSING";
                    error.statusCode = 500;
                    throw error;
                }
            }

            const serverUrl = `${req.protocol}://${req.get("host")}`;
            const config = buildRunnerAgentConfig({ serverUrl, agentId: runnerId, token, machineName: device.machineName });
            const fileName = suggestPackageFileName(device.machineName);

            res.setHeader("Content-Type", "application/zip");
            res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

            const archive = new ZipArchive({ zlib: { level: 9 } });
            archive.on("error", err => next(err));
            archive.pipe(res);
            for (const relativeName of RUNNER_PACKAGE_STATIC_FILES) {
                archive.file(path.join(sourceDir, relativeName), { name: relativeName });
            }
            archive.append(JSON.stringify(config, null, 2), { name: "runner-agent.config.json" });
            archive.finalize();
        } catch (error) {
            next(error);
        }
    });

    return router;
}
