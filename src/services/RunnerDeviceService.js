import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const tokenHash = token => crypto.createHash("sha256").update(String(token)).digest("hex");
function fail(code, message, statusCode = 400) { const error = new Error(message); error.code = code; error.statusCode = statusCode; throw error; }

export default class RunnerDeviceService {
    constructor({ dataDir, now = () => new Date() } = {}) { this.file = path.join(dataDir, "runner-devices.json"); this.now = now; this.ensure(); }
    ensure() { if (!fs.existsSync(this.file)) { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, "[]"); } }
    all() { return JSON.parse(fs.readFileSync(this.file, "utf8")); }
    save(items) { fs.writeFileSync(this.file, JSON.stringify(items, null, 2)); }
    public(device) { const { tokenHash: _tokenHash, ...result } = device; return result; }
    create({ userId, machineName }) {
        const name = String(machineName ?? "").trim(); if (!name) fail("RUNNER_MACHINE_NAME_REQUIRED", "Tên máy Runner là bắt buộc.");
        const normalizedName = name.toLocaleLowerCase();
        if (this.all().some(item => item.userId === userId && !item.revokedAt && item.machineName.trim().toLocaleLowerCase() === normalizedName)) {
            fail("RUNNER_MACHINE_NAME_EXISTS", "Tên máy chạy này đã được đăng ký. Hãy dùng Runner hiện có hoặc thu hồi máy cũ trước.", 409);
        }
        const now = this.now().toISOString(); const runnerId = `RUNNER-${crypto.randomUUID()}`; const token = crypto.randomBytes(32).toString("base64url");
        const device = { runnerId, userId, machineName: name, tokenHash: tokenHash(token), status: "OFFLINE", lastSeenAt: null, revokedAt: null, createdAt: now, updatedAt: now };
        const items = this.all(); items.push(device); this.save(items); return { device: this.public(device), token };
    }
    listForUser(userId) { return this.all().filter(item => item.userId === userId && !item.revokedAt).map(item => this.public(item)); }
    find(runnerId) { return this.all().find(item => item.runnerId === String(runnerId ?? "")) ?? null; }
    authenticate(runnerId, token) {
        const device = this.find(runnerId); if (!device) return null;
        if (device.revokedAt) fail("RUNNER_DEVICE_REVOKED", "Runner đã bị thu hồi.", 401);
        const actual = Buffer.from(tokenHash(token)); const expected = Buffer.from(device.tokenHash);
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) fail("RUNNER_AGENT_UNAUTHORIZED", "Token Runner Agent không hợp lệ.", 401);
        return device;
    }
    requireOwned(runnerId, userId) { const device = this.find(runnerId); if (!device || device.userId !== userId || device.revokedAt) fail("RUNNER_DEVICE_FORBIDDEN", "Runner không thuộc tài khoản hiện tại.", 403); return device; }
    touch(runnerId, status) { const items = this.all(); const device = items.find(item => item.runnerId === runnerId); if (!device) return; device.status = status; device.lastSeenAt = this.now().toISOString(); device.updatedAt = device.lastSeenAt; this.save(items); }
    revoke(runnerId, userId) { const items = this.all(); const device = items.find(item => item.runnerId === runnerId && item.userId === userId); if (!device) fail("RUNNER_DEVICE_NOT_FOUND", "Không tìm thấy Runner.", 404); device.revokedAt = this.now().toISOString(); device.status = "REVOKED"; device.updatedAt = device.revokedAt; this.save(items); return this.public(device); }
}
