import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const seedUsers = [
    { userId: "USR-ADMIN", username: "admin", displayName: "Quản trị viên", password: "admin", role: "ADMIN" },
    { userId: "USR-TESTER-01", username: "tester01", displayName: "Tester 01", password: "tester01", role: "TESTER" },
    { userId: "USR-TESTER-02", username: "tester02", displayName: "Tester 02", password: "tester02", role: "TESTER" }
];

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    return `${salt}:${crypto.scryptSync(String(password), salt, 64).toString("hex")}`;
}
function verifyPassword(password, stored) {
    const [salt, digest] = String(stored ?? "").split(":");
    if (!salt || !digest) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(digest, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export default class MinimalAuthService {
    constructor({ dataDir, now = () => new Date() } = {}) {
        this.file = path.join(dataDir, "auth-users.json");
        this.now = now;
        this.sessions = new Map();
        this.ensureUsers();
    }
    ensureUsers() {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const fileExisted = fs.existsSync(this.file);
        const existing = fileExisted ? JSON.parse(fs.readFileSync(this.file, "utf8")) : [];
        const existingUsernames = new Set(existing.map(user => user.username));
        const missing = seedUsers.filter(user => !existingUsernames.has(user.username))
            .map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) }));
        // Migrate users persisted before `role` existed — default TESTER (admin stays ADMIN).
        let migrated = false;
        const withRoles = existing.map(user => {
            if (user.role) return user;
            migrated = true;
            return { ...user, role: user.username === "admin" ? "ADMIN" : "TESTER" };
        });
        if (missing.length > 0 || migrated || !fileExisted) {
            fs.writeFileSync(this.file, JSON.stringify([...withRoles, ...missing], null, 2));
        }
    }
    users() { return JSON.parse(fs.readFileSync(this.file, "utf8")); }
    principal(user) { return { userId: user.userId, username: user.username, displayName: user.displayName, role: user.role ?? "TESTER" }; }
    createUser({ username, displayName, password }) {
        const normalizedUsername = String(username ?? "").trim();
        const normalizedDisplayName = String(displayName ?? "").trim();
        const plainPassword = String(password ?? "");
        if (!/^[a-zA-Z0-9._-]{3,64}$/.test(normalizedUsername)) {
            const error = new Error("Username chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang (3-64 ký tự)."); error.code = "AUTH_USERNAME_INVALID"; error.statusCode = 400; throw error;
        }
        if (!normalizedDisplayName) {
            const error = new Error("Tên hiển thị là bắt buộc."); error.code = "AUTH_DISPLAY_NAME_REQUIRED"; error.statusCode = 400; throw error;
        }
        if (plainPassword.length < 8) {
            const error = new Error("Mật khẩu phải có ít nhất 8 ký tự."); error.code = "AUTH_PASSWORD_TOO_SHORT"; error.statusCode = 400; throw error;
        }
        const users = this.users();
        if (users.some(user => user.username.toLowerCase() === normalizedUsername.toLowerCase())) {
            const error = new Error(`Username "${normalizedUsername}" đã tồn tại.`); error.code = "AUTH_USERNAME_EXISTS"; error.statusCode = 409; throw error;
        }
        const user = {
            userId: `USR-${crypto.randomUUID()}`,
            username: normalizedUsername,
            displayName: normalizedDisplayName,
            passwordHash: hashPassword(plainPassword)
        };
        fs.writeFileSync(this.file, JSON.stringify([...users, user], null, 2));
        return this.principal(user);
    }
    login({ username, password, rememberMe = false }) {
        const user = this.users().find(item => item.username === String(username ?? "").trim());
        if (!user || !verifyPassword(password, user.passwordHash)) {
            const error = new Error("Tên đăng nhập hoặc mật khẩu không đúng."); error.code = "AUTH_INVALID_CREDENTIALS"; error.statusCode = 401; throw error;
        }
        const sessionId = crypto.randomBytes(32).toString("base64url");
        const ttlMs = rememberMe ? REMEMBER_TTL_MS : SESSION_TTL_MS;
        this.sessions.set(sessionId, { user: this.principal(user), expiresAt: this.now().getTime() + ttlMs });
        return { sessionId, user: this.principal(user), ttlMs };
    }
    /** Admin đặt lại mật khẩu hộ tester (không có SMTP nên không tự phục vụ qua email). */
    resetPassword({ requestedByRole, username, newPassword }) {
        if (requestedByRole !== "ADMIN") {
            const error = new Error("Chỉ quản trị viên mới được đặt lại mật khẩu."); error.code = "AUTH_FORBIDDEN"; error.statusCode = 403; throw error;
        }
        const plainPassword = String(newPassword ?? "");
        if (plainPassword.length < 8) {
            const error = new Error("Mật khẩu phải có ít nhất 8 ký tự."); error.code = "AUTH_PASSWORD_TOO_SHORT"; error.statusCode = 400; throw error;
        }
        const users = this.users();
        const user = users.find(item => item.username === String(username ?? "").trim());
        if (!user) {
            const error = new Error(`Không tìm thấy người dùng "${username}".`); error.code = "AUTH_USER_NOT_FOUND"; error.statusCode = 404; throw error;
        }
        user.passwordHash = hashPassword(plainPassword);
        fs.writeFileSync(this.file, JSON.stringify(users, null, 2));
        return this.principal(user);
    }
    listUsers() { return this.users().map(user => this.principal(user)); }
    current(sessionId) {
        const session = this.sessions.get(String(sessionId ?? ""));
        if (!session || session.expiresAt <= this.now().getTime()) { this.sessions.delete(String(sessionId ?? "")); return null; }
        return session.user;
    }
    logout(sessionId) { this.sessions.delete(String(sessionId ?? "")); }
}
