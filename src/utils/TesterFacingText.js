const TECHNICAL_REPLACEMENTS = [
    [
        /the testcase contains contradictory test data\.?/gi,
        "Một trường đang có hai giá trị kiểm thử khác nhau."
    ],
    [
        /expected result mismatch\.?/gi,
        "Kết quả mong đợi chưa phù hợp với tình huống kiểm thử."
    ],
    [
        /permission testcase is unsupported\.?/gi,
        "Requirement hiện chưa mô tả phân quyền nên chưa cần tạo testcase phân quyền."
    ],
    [
        /boundary cannot be generated\.?/gi,
        "Requirement chưa có giới hạn rõ ràng nên chưa tạo testcase kiểm tra giới hạn."
    ],
    [/\bsemantic contradiction\b/gi, "thông tin chưa thống nhất"],
    [/\bsemantic(?:ally)?\b/gi, "về ý nghĩa"],
    [/\bcontradictory\b|\bcontradiction\b/gi, "chưa thống nhất"],
    [/\bmetadata\b/gi, "thông tin hỗ trợ"],
    [/\bcanonical\b/gi, "thống nhất"],
    [/\bpipeline\b/gi, "quy trình"],
    [/\bvalidators?\b/gi, "bước kiểm tra"],
    [/\bnormalization\b/gi, "điều chỉnh nội dung"],
    [/\bartifacts?\b/gi, "kết quả review"],
    [/\bmapping\b/gi, "liên kết thông tin"],
    [/\btraceability object\b/gi, "thông tin đối chiếu"],
    [/\binternal identifiers?\b/gi, "mã dùng trong hệ thống"],
    [/\benums?\b/gi, "danh sách giá trị"],
    [/\bDTOs?\b/gi, "dữ liệu hiển thị"],
    [/\bJSON contracts?\b/gi, "dữ liệu cần có"],
    [/\bmodel inconsistenc(?:y|ies)\b/gi, "thông tin chưa thống nhất"],
    [/\bparsers?\b/gi, "bước đọc requirement"],
    [/\bgenerators?\b|\bgeneration\b/gi, "việc chuẩn bị testcase"],
    [/\binference\b/gi, "thông tin được hiểu từ requirement"],
    [/\bheuristics?\b/gi, "cách đánh giá"],
    [/\bexpected result mismatch\b/gi, "Kết quả mong đợi chưa phù hợp với tình huống kiểm thử"]
];

export default function testerFacingText(value) {
    let result = typeof value === "string" ? value.trim() : "";
    if (!result) return "";

    result = result
        .replace(/\[?\b(?:BR|FUNC|MOD)[-_]?\d+\b\]?\s*(?:[:\-_–—]\s*)?/gi, "")
        .replace(/\bRule[-_\s]*\d+\b\s*(?:[:\-_–—]\s*)?/gi, "");

    TECHNICAL_REPLACEMENTS.forEach(([pattern, replacement]) => {
        result = result.replace(pattern, replacement);
    });

    return result
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([:\-–—])\s*([:\-–—])/g, "$1")
        .replace(/^\s*[:\-–—]+\s*/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}
