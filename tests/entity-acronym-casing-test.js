import assert from "node:assert/strict";
import ExpectedResultBuilder from "../src/builders/ExpectedResultBuilder.js";
import TestDesignContentNormalizer from "../src/normalizers/TestDesignContentNormalizer.js";

/* Bug thật đã gặp (2026-09-04): "DM đợt nhập học" (viết tắt "Danh Mục") bị lowerFirst() hạ nhầm chữ
   cái đầu thành "dM đợt nhập học" khi ghép vào tiêu đề/kết quả mong đợi (vd "Tìm kiếm dM đợt nhập
   học thành công..."). Ngân báo: "Viết DM thì đúng, dM thì không. Đề nghị cách viết TC nên đúng
   chuẩn tiếng Việt!" — chữ viết tắt IN HOA ở đầu chuỗi phải giữ nguyên, không bị hạ chữ cái đầu. */

const expectedResultBuilder = new ExpectedResultBuilder();
assert.equal(expectedResultBuilder.lowerFirst("DM đợt nhập học"), "DM đợt nhập học");
assert.equal(expectedResultBuilder.lowerFirst("DM đợt nhập học (Tìm)"), "DM đợt nhập học (Tìm)");
// Chuỗi thường (không phải viết tắt) vẫn phải hạ chữ cái đầu như cũ, không được nới lỏng quá tay.
assert.equal(expectedResultBuilder.lowerFirst("Đợt nhập học"), "đợt nhập học");
assert.equal(expectedResultBuilder.lowerFirst(""), "");

const contentNormalizer = new TestDesignContentNormalizer();
assert.equal(contentNormalizer.lowerFirst("DM đợt nhập học"), "DM đợt nhập học");
assert.equal(contentNormalizer.lowerFirst("Đợt nhập học"), "đợt nhập học");

// entity() (dùng để ghép tiêu đề "Tìm kiếm {entity} thành công với điều kiện hợp lệ") phải giữ
// nguyên viết tắt DM khi tách khỏi tên function CodeGen-derived (vd "Tìm kiếm DM đợt nhập học (Tìm)").
assert.equal(contentNormalizer.entity("Tìm kiếm DM đợt nhập học (Tìm)"), "DM đợt nhập học (Tìm)");
assert.equal(expectedResultBuilder.entity("Tìm kiếm DM đợt nhập học (Tìm)"), "DM đợt nhập học (Tìm)");

// normalizeTitle() end-to-end: tiêu đề testcase Tìm kiếm sinh ra không được chứa "dM" sai chính tả.
{
    const title = contentNormalizer.normalizeTitle({
        feature: "Tìm kiếm DM đợt nhập học (Tìm)",
        type: "POSITIVE",
        ruleClassification: ""
    });
    assert.doesNotMatch(title, /\bdM\b/, `tiêu đề không được chứa "dM" sai chính tả, thấy: "${title}"`);
    assert.match(title, /\bDM đợt nhập học\b/, `tiêu đề phải giữ đúng "DM đợt nhập học", thấy: "${title}"`);
}

console.log("Entity acronym casing (DM) test: PASS");
