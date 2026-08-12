/*
 P0 — SEMANTIC / READABLE PLAYWRIGHT STEPS (dùng chung Recording + Library + Draft).

 Root cause: UI chỉ dùng ACTION_LABEL (động từ chung) + target (accessible name) →
 mất ngữ cảnh role type (button/textbox), key của press, URL path, giá trị.
 Parser ĐÃ lưu đủ: locator (full), recordedValue (key/URL/value, REDACTED nếu sensitive).

 semanticStepText(step): readable tiếng Việt, KHÔNG expose value nhạy cảm,
 KHÔNG invent control type khi locator không đủ evidence (fallback an toàn).
 Mọi UI (Recording/Draft/Library detail/dropdown) dùng CHUNG hàm này.
*/

import { ACTION_LABEL } from "./automationV3.js";

/** Control type từ locator — chỉ tin getByRole('...'); getByLabel/Text/... → null (không đủ evidence). */
export function locatorControlType(locatorSeg) {
    const l = String(locatorSeg ?? "");
    const m = l.match(/getByRole\s*\(\s*['"]([a-z]+)['"]/);
    return m ? m[1] : null;
}

const CONTROL_LABEL = {
    button: "nút",
    textbox: "ô",
    searchbox: "ô",
    checkbox: "checkbox",
    radio: "radio",
    link: "liên kết",
    menuitem: "menu",
    tab: "tab",
    heading: "tiêu đề",
    combobox: "ô chọn",
    listbox: "danh sách",
    option: "mục",
    cell: "ô",
    row: "dòng"
};

/** Rút path + search từ URL (an toàn với relative/không parse được). */
export function urlPath(raw) {
    const t = String(raw ?? "").trim();
    if (!t) return "";
    try {
        const u = new URL(t);
        return u.pathname + u.search;
    } catch {
        const q = t.indexOf("?");
        const h = t.indexOf("#");
        let cut = t.length;
        if (q !== -1) cut = Math.min(cut, q);
        if (h !== -1) cut = Math.min(cut, h);
        return t.slice(0, cut);
    }
}

/** Vị trí: giới từ mặc định "tại" ("tại ô Tài khoản"); CLICK/FILL/HOVER dùng "vào". */
function atPosition(ctl, target, preposition = "tại") {
    const t = String(target ?? "").trim();
    if (!t) return "";
    const ctlWord = ctl && CONTROL_LABEL[ctl] ? CONTROL_LABEL[ctl] : null;
    return ctlWord ? `${preposition} ${ctlWord} ${t}` : `${preposition} ${t}`;
}

export function semanticStepText(step) {
    const type = String(step?.actionType ?? "");
    const target = String(step?.target ?? "").trim();
    const ctl = locatorControlType(step?.locator);
    const value = step?.recordedValue;

    switch (type) {
        case "GOTO": {
            const path = urlPath(value);
            return path ? `Mở trang ${path}` : (target ? `Mở trang ${target}` : "Mở trang");
        }
        case "CLICK": {
            // Spec: nút → "Click nút X"; ô → "Click vào ô X"; fallback → "Click vào X".
            const t = String(target ?? "").trim();
            if (ctl === "button") return `Click nút ${t}`;
            return `Click ${atPosition(ctl, target, "vào")}`;
        }
        case "FILL":
            // KHÔNG expose value (kể cả không nhạy cảm — readable list không cần).
            return `Nhập giá trị ${atPosition(ctl, target, "vào")}`;
        case "PRESS": {
            const key = String(value ?? "").trim();
            return key ? `Nhấn phím ${key} ${atPosition(ctl, target)}` : `Nhấn phím ${atPosition(ctl, target)}`;
        }
        case "CHECK":
            return `Chọn checkbox ${target}`;
        case "UNCHECK":
            return `Bỏ chọn checkbox ${target}`;
        case "SELECT":
            return `Chọn giá trị ${atPosition(ctl, target)}`;
        case "HOVER":
            return `Di chuột ${atPosition(ctl, target, "vào")}`;
        default:
            // Fallback an toàn — không invent control type.
            return `${ACTION_LABEL[type] ?? type ?? ""} ${target}`.trim();
    }
}
