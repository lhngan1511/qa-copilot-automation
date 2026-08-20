import assert from "node:assert/strict";
import {
    actionLabel,
    domainName,
    localizedFunctionName,
    sanitizeUserFacingText
} from "../src/utils/FunctionDisplayName.js";
import TestDesignContentNormalizer from "../src/normalizers/TestDesignContentNormalizer.js";
import CoreCatalogScenarioBuilder from "../src/recommenders/CoreCatalogScenarioBuilder.js";
import ExpectedResultBuilder from "../src/builders/ExpectedResultBuilder.js";

assert.equal(domainName("Search Đơn vị tính"), "Đơn vị tính");
assert.equal(domainName("Tìm kiếm Đơn vị tính"), "Đơn vị tính");
assert.equal(domainName("CREATE Đơn vị tính"), "Đơn vị tính");
assert.equal(domainName("Create Đơn vị tính"), "Đơn vị tính");
assert.equal(domainName("Thêm Đơn vị tính"), "Đơn vị tính");
assert.equal(domainName("Search Kho"), "Kho");
assert.equal(domainName("Create Kho"), "Kho");
assert.equal(domainName("Update Kho"), "Kho");
assert.equal(domainName("Delete Kho"), "Kho");
assert.equal(actionLabel("SEARCH"), "Tìm kiếm");
assert.equal(actionLabel("CREATE"), "Thêm");
assert.equal(actionLabel("UPDATE"), "Cập nhật");
assert.equal(actionLabel("DELETE"), "Xóa");
assert.equal(localizedFunctionName("Search Kho", "SEARCH"), "Tìm kiếm Kho");
assert.equal(localizedFunctionName("Create Kho", "CREATE"), "Thêm Kho");
assert.equal(localizedFunctionName("Update Kho", "UPDATE"), "Cập nhật Kho");
assert.equal(localizedFunctionName("Delete Kho", "DELETE"), "Xóa Kho");
assert.equal(
    sanitizeUserFacingText("Tìm kiếm Search Đơn vị tính có kết quả"),
    "Tìm kiếm Đơn vị tính có kết quả"
);
assert.equal(
    sanitizeUserFacingText("Thêm Create Đơn vị tính với đầy đủ thông tin"),
    "Thêm Đơn vị tính với đầy đủ thông tin"
);
assert.doesNotMatch(sanitizeUserFacingText("Tìm kiếm Search Kho có kết quả"), /\bSearch\b/i);

const normalizer = new TestDesignContentNormalizer();
assert.equal(
    normalizer.normalizeTitle({
        title: "Tìm kiếm Search Đơn vị tính có kết quả",
        feature: "Search Đơn vị tính",
        type: "POSITIVE"
    }),
    "Tìm kiếm Đơn vị tính có kết quả"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "Search Kho",
        feature: "Search Kho",
        type: "POSITIVE"
    }),
    "Tìm kiếm kho thành công với điều kiện hợp lệ"
);
assert.equal(
    normalizer.normalizeTitle({
        title: "Create Kho",
        feature: "Create Kho",
        type: "POSITIVE"
    }),
    "Thêm mới kho thành công với dữ liệu hợp lệ"
);

const builder = new CoreCatalogScenarioBuilder();
const filled = builder.apply(
    [],
    {
        module: { name: "Kho" },
        functions: [
            { id: "F1", name: "Search Kho", automation: { operation: "Search" } },
            {
                id: "F2",
                name: "Create Kho",
                automation: { operation: "Create" },
                inputs: [{ name: "Mã kho", required: false, description: "Không bắt buộc" }]
            }
        ]
    },
    {
        module: { name: "Kho" },
        commonInputs: [{ name: "Mã kho", required: false, description: "Không bắt buộc" }],
        features: [
            { name: "Search Kho", automation: { operation: "Search" } },
            {
                name: "Create Kho",
                automation: { operation: "Create" },
                inputs: [{ name: "Mã kho", required: false }]
            }
        ]
    }
);
const titles = filled.map(item => item.title);
assert.ok(titles.includes("Tìm kiếm Kho có kết quả"));
assert.ok(titles.includes("Tìm kiếm Kho không có kết quả"));
assert.ok(titles.includes("Thêm Kho với đầy đủ thông tin"));
assert.equal(
    titles.some(title => /\b(Search|Create|Update|Delete)\b/i.test(title)),
    false,
    titles.join("\n")
);

const expected = new ExpectedResultBuilder().build({
    testCase: {
        feature: "Search Đơn vị tính",
        function: "Search Đơn vị tính",
        type: "POSITIVE",
        operation: "SEARCH"
    },
    scenario: { feature: "Search Đơn vị tính", operation: "SEARCH" },
    testData: { fields: {} },
    existing: "Hệ thống hiển thị các Search Đơn vị tính khớp với từ khóa tìm kiếm."
});
assert.doesNotMatch(expected, /\bSearch\b/i);

console.log("Function display name test: PASS");
