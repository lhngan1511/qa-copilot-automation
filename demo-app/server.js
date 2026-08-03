#!/usr/bin/env node
/**
 * Demo app dùng để chạy generated Playwright tests (chạy trên máy local).
 *   node demo-app/server.js   -> http://localhost:3100
 *
 * Các route khớp với Automation Mapping do Phase 2 sinh:
 *   /login, /device/create, /device/edit, /device/delete, /device/list
 */
import express from "express";

const PORT = process.env.DEMO_PORT || 3100;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const layout = (title, body) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;max-width:640px;margin:40px auto}label{display:block;margin:8px 0 2px}
input,select,button{padding:6px;font-size:14px;margin-bottom:6px}button{cursor:pointer}
.msg{color:green;margin-top:10px}</style></head><body><h1>${title}</h1>${body}</body></html>`;

const field = (label, name, type = "text") =>
    `<label>${label}</label><input name="${name}" type="${type}" />`;

// ---------- Login ----------
app.get("/", (_req, res) => res.redirect("/login"));
app.get("/login", (_req, res) =>
    res.send(
        layout(
            "Đăng nhập",
            `<form method="post" action="/login">
        ${field("Tài khoản", "username")}
        ${field("Mật khẩu", "password", "password")}
        ${field("Mã xác nhận", "captcha")}
        <button type="submit">Đăng nhập</button></form>`
        )
    )
);
app.post("/login", (req, res) => {
    const { username, password } = req.body || {};
    if (username === "admin" && password === "demo123") {
        res.redirect("/device/list");
    } else {
        res.send(
            layout("Đăng nhập", `<p style="color:red">Sai tài khoản hoặc mật khẩu.</p>
        <a href="/login">Quay lại</a>`)
        );
    }
});

// ---------- Device ----------
app.get("/device/list", (_req, res) =>
    res.send(
        layout(
            "Danh sách thiết bị",
            `<form method="get">
        ${field("Tên thiết bị", "keyword")}
        <button type="submit">Tìm kiếm</button></form>
        <p>Thiết bị A001, Thiết bị A002, Thiết bị A003</p>
        <a href="/device/create">Thêm thiết bị</a>`
        )
    )
);

app.get("/device/create", (_req, res) =>
    res.send(
        layout(
            "Thêm thiết bị",
            `<form method="post" action="/device/create">
        ${field("Mã thiết bị", "code")}
        ${field("Tên thiết bị", "name")}
        <label>Loại thiết bị</label>
        <select name="type"><option>Loại 1</option><option>Loại 2</option></select>
        <label>Trạng thái</label>
        <select name="status"><option>Hoạt động</option><option>Ngừng</option></select>
        ${field("Ghi chú", "note")}
        <button type="submit">Lưu</button></form>`
        )
    )
);
app.post("/device/create", (req, res) =>
    res.send(
        layout("Thêm thiết bị", `<p class="msg">Thiết bị được tạo thành công.</p>
        <a href="/device/list">Về danh sách</a>`)
    )
);

app.get("/device/edit", (_req, res) =>
    res.send(
        layout(
            "Sửa thiết bị",
            `<form method="post" action="/device/edit">
        ${field("Mã thiết bị", "code")}
        ${field("Tên thiết bị", "name")}
        <button type="submit">Lưu</button></form>`
        )
    )
);
app.post("/device/edit", (_req, res) =>
    res.send(layout("Sửa thiết bị", `<p class="msg">Thiết bị được cập nhật thành công.</p>`))
);

app.get("/device/delete", (_req, res) =>
    res.send(
        layout("Xóa thiết bị", `<p>Xác nhận xóa thiết bị?</p>
        <form method="post" action="/device/delete"><button type="submit">Xóa</button></form>`)
    )
);
app.post("/device/delete", (_req, res) =>
    res.send(layout("Xóa thiết bị", `<p class="msg">Thiết bị được xóa thành công.</p>`))
);

app.listen(PORT, () =>
    console.log(`Demo app đang chạy tại http://localhost:${PORT}`)
);
