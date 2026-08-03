/**
 * FakeAIProvider — TEST SEAM CHỈ DÙNG TRONG TEST.
 * KHÔNG được dùng làm runtime fallback trong production.
 *
 * Nhận một hàm `responder(prompt)` trả về chuỗi response giả (thường là JSON mapping hoặc code).
 * Khi không có responder, trả về nội dung mặc định do constructor truyền.
 */
export default class FakeAIProvider {
    /**
     * @param {object} [opts]
     * @param {function} [opts.responder] (prompt:string)=>string
     * @param {string} [opts.defaultResponse] chuỗi trả về nếu không có responder
     */
    constructor({ responder = null, defaultResponse = "" } = {}) {
        this.responder = responder;
        this.defaultResponse = defaultResponse;
        this.calls = []; // ghi lại prompt để assert
    }

    async generate(prompt) {
        this.calls.push(prompt);
        if (typeof this.responder === "function") {
            return this.responder(prompt);
        }
        if (typeof this.defaultResponse === "string") {
            return this.defaultResponse;
        }
        return "";
    }
}
