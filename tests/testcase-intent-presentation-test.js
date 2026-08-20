import assert from "node:assert/strict";
import fs from "node:fs";
import SemanticTestCaseOverlapResolver from "../src/resolvers/SemanticTestCaseOverlapResolver.js";
import PublicTestCaseReviewMapper from "../src/web/mappers/PublicTestCaseReviewMapper.js";
import {
    applyTestCasePresentation,
    classifyTestCaseIntent,
    intentDedupeKey
} from "../src/intelligence/TestCaseIntent.js";

{
    const foundA = classifyTestCaseIntent({
        title: "Tìm kiếm đơn vị tính thành công với điều kiện hợp lệ",
        feature: "Tìm kiếm đơn vị tính",
        type: "POSITIVE",
        operation: "SEARCH"
    });
    const foundB = classifyTestCaseIntent({
        title: "Tìm kiếm đơn vị tính có kết quả",
        feature: "Tìm kiếm đơn vị tính",
        type: "POSITIVE",
        catalogKey: "SEARCH_HIT"
    });
    const foundC = classifyTestCaseIntent({
        title: "Hiển thị kết quả tìm kiếm phù hợp",
        function: "Tìm kiếm khách hàng",
        type: "POSITIVE"
    });
    assert.equal(foundA.intent, "SEARCH_FOUND");
    assert.equal(foundB.intent, "SEARCH_FOUND");
    assert.equal(foundC.intent, "SEARCH_FOUND");
    assert.equal(foundC.group, "SEARCH");
    assert.notEqual(
        intentDedupeKey({
            module: "A",
            function: "Tìm kiếm khách hàng",
            title: "Hiển thị kết quả tìm kiếm phù hợp",
            type: "POSITIVE"
        }),
        intentDedupeKey({
            module: "A",
            function: "Tìm kiếm đơn vị tính",
            title: "Tìm kiếm đơn vị tính có kết quả",
            type: "POSITIVE",
            operation: "SEARCH"
        })
    );
}

{
    const resolver = new SemanticTestCaseOverlapResolver();
    const result = resolver.resolve([
        {
            id: "TC001",
            module: "Danh mục",
            function: "Tìm kiếm đơn vị tính",
            feature: "Tìm kiếm đơn vị tính",
            title: "Tìm kiếm đơn vị tính thành công với điều kiện hợp lệ",
            type: "POSITIVE",
            operation: "SEARCH",
            expectedResult: "Hiển thị bản ghi phù hợp",
            steps: [{ action: "Thực hiện tìm kiếm" }]
        },
        {
            id: "TC007",
            module: "Danh mục",
            function: "Tìm kiếm đơn vị tính",
            feature: "Tìm kiếm đơn vị tính",
            title: "Tìm kiếm đơn vị tính có kết quả",
            type: "POSITIVE",
            catalogKey: "SEARCH_HIT",
            operation: "SEARCH",
            expectedResult: "Hiển thị các đơn vị tính khớp từ khóa",
            steps: [{ action: "Thực hiện tìm kiếm" }]
        }
    ]);
    assert.equal(result.length, 1, "Search happy path from core + catalog must merge");
    assert.equal(result[0].id, "TC007", "catalog representative should win");
    assert.deepEqual(result[0].mergedTestCaseIds, ["TC001"]);
}

{
    const presented = applyTestCasePresentation([
        {
            id: "TC-CREATE-VAL",
            testcaseId: "TC-CREATE-VAL",
            title: "Bỏ trống Tên",
            feature: "Thêm mới đơn vị tính",
            type: "VALIDATION",
            operation: "CREATE",
            ruleClassification: "REQUIRED"
        },
        {
            id: "TC-UPDATE",
            testcaseId: "TC-UPDATE",
            title: "Cập nhật đơn vị tính thành công",
            feature: "Cập nhật đơn vị tính",
            type: "POSITIVE",
            operation: "UPDATE"
        },
        {
            id: "TC-SEARCH-MISS",
            testcaseId: "TC-SEARCH-MISS",
            title: "Tìm kiếm đơn vị tính không có kết quả",
            feature: "Tìm kiếm đơn vị tính",
            type: "POSITIVE",
            catalogKey: "SEARCH_MISS"
        },
        {
            id: "TC-SEARCH-HIT",
            testcaseId: "TC-SEARCH-HIT",
            title: "Tìm kiếm đơn vị tính có kết quả",
            feature: "Tìm kiếm đơn vị tính",
            type: "POSITIVE",
            catalogKey: "SEARCH_HIT"
        },
        {
            id: "TC-CREATE-FULL",
            testcaseId: "TC-CREATE-FULL",
            title: "Thêm mới đơn vị tính thành công với dữ liệu hợp lệ",
            feature: "Thêm mới đơn vị tính",
            type: "POSITIVE",
            operation: "CREATE"
        },
        {
            id: "TC-CREATE-EMPTY",
            testcaseId: "TC-CREATE-EMPTY",
            title: "Thêm đơn vị tính khi không nhập mã",
            feature: "Thêm mới đơn vị tính",
            type: "POSITIVE",
            catalogKey: "CREATE_AUTO_CODE"
        }
    ]);

    assert.deepEqual(
        presented.map(item => item.displayId),
        ["TC001", "TC002", "TC003", "TC004", "TC005", "TC006"]
    );
    assert.deepEqual(
        presented.map(item => item.intent),
        [
            "SEARCH_FOUND",
            "SEARCH_NOT_FOUND",
            "CREATE_FULL_DATA",
            "CREATE_EMPTY_CODE",
            "VALIDATION_REQUIRED",
            "UPDATE_VALID"
        ]
    );
    assert.deepEqual(
        presented.map(item => item.id),
        [
            "TC-SEARCH-HIT",
            "TC-SEARCH-MISS",
            "TC-CREATE-FULL",
            "TC-CREATE-EMPTY",
            "TC-CREATE-VAL",
            "TC-UPDATE"
        ]
    );

    const afterDelete = applyTestCasePresentation(presented.filter(item => item.id !== "TC-CREATE-FULL"));
    assert.deepEqual(
        afterDelete.map(item => item.displayId),
        ["TC001", "TC002", "TC003", "TC004", "TC005"]
    );
    assert.deepEqual(
        afterDelete.map(item => item.id),
        ["TC-SEARCH-HIT", "TC-SEARCH-MISS", "TC-CREATE-EMPTY", "TC-CREATE-VAL", "TC-UPDATE"]
    );
}

{
    const resolver = new SemanticTestCaseOverlapResolver();
    const customKept = resolver.resolve([
        {
            id: "TC-EDITED",
            module: "Thiết bị",
            function: "Tìm kiếm thiết bị",
            feature: "Tìm kiếm thiết bị",
            title: "Scenario đã chỉnh",
            testScenario: "Tìm kiếm thiết bị thành công với điều kiện hợp lệ",
            scenarioId: "SC-EDITED",
            type: "POSITIVE",
            operation: "SEARCH",
            expectedResult: "Kết quả đã duyệt",
            steps: [{ action: "Thực hiện tìm kiếm" }]
        },
        {
            id: "TC-USER",
            module: "Thiết bị",
            function: "Tìm kiếm thiết bị",
            feature: "Tìm kiếm thiết bị",
            title: "Scenario người dùng thêm",
            testScenario: "Tìm kiếm thiết bị thành công với điều kiện hợp lệ",
            scenarioId: "SC-USER",
            type: "POSITIVE",
            operation: "SEARCH",
            expectedResult: "Kết quả người dùng thêm",
            steps: [{ action: "Thực hiện tìm kiếm" }]
        },
        {
            id: "TC-CATALOG",
            module: "Thiết bị",
            function: "Tìm kiếm thiết bị",
            feature: "Tìm kiếm thiết bị",
            title: "Tìm kiếm thiết bị có kết quả",
            type: "POSITIVE",
            catalogKey: "SEARCH_HIT",
            operation: "SEARCH",
            expectedResult: "Hiển thị các thiết bị khớp từ khóa",
            steps: [{ action: "Thực hiện tìm kiếm" }]
        }
    ]);
    assert.ok(customKept.some(item => item.scenarioId === "SC-USER"));
    assert.ok(customKept.some(item => item.title === "Scenario đã chỉnh"));
}

{
    const resolver = new SemanticTestCaseOverlapResolver();
    const requiredKept = resolver.resolve([
        {
            id: "TC004",
            module: "Danh mục",
            function: "Thêm mới đơn vị tính",
            feature: "Thêm mới đơn vị tính",
            title: "Bỏ trống Tên đơn vị tính",
            type: "VALIDATION",
            operation: "CREATE",
            ruleClassification: "REQUIRED",
            expectedResult: "Hệ thống cảnh báo và không cho phép lưu",
            steps: [{ action: "Bỏ trống trường bắt buộc rồi lưu" }]
        },
        {
            id: "TC049",
            module: "Danh mục",
            function: "Thêm mới đơn vị tính",
            feature: "Thêm mới đơn vị tính",
            title: "Thêm đơn vị tính khi không nhập mã",
            type: "POSITIVE",
            catalogKey: "CREATE_AUTO_CODE",
            operation: "CREATE",
            expectedResult: "Hệ thống tự sinh mã đơn vị tính",
            steps: [{ action: "Để trống mã rồi lưu" }]
        }
    ]);
    assert.equal(requiredKept.length, 2, "required empty name must not merge into empty-code");

    const autoCodeMerged = resolver.resolve([
        {
            id: "TC-WARN",
            module: "Danh mục",
            function: "Thêm mới đơn vị tính",
            feature: "Thêm mới đơn vị tính",
            title: "Hiển thị cảnh báo khi bỏ trống để hệ thống tự sinh",
            type: "VALIDATION",
            operation: "CREATE",
            ruleClassification: "REQUIRED",
            expectedResult: "Hệ thống tự sinh Mã đơn vị tính khi để trống",
            steps: [{ action: "Để trống mã rồi lưu" }]
        },
        {
            id: "TC-CATALOG-CODE",
            module: "Danh mục",
            function: "Thêm mới đơn vị tính",
            feature: "Thêm mới đơn vị tính",
            title: "Thêm đơn vị tính khi không nhập Mã đơn vị tính",
            type: "POSITIVE",
            catalogKey: "CREATE_AUTO_CODE",
            operation: "CREATE",
            expectedResult: "Hệ thống tự sinh Mã đơn vị tính",
            steps: [{ action: "Để trống mã rồi lưu" }]
        }
    ]);
    assert.equal(autoCodeMerged.length, 1, "auto-generate code wording must merge into CREATE_EMPTY_CODE");
    assert.equal(classifyTestCaseIntent(autoCodeMerged[0]).intent, "CREATE_EMPTY_CODE");
}

{
    const mapperSource = fs.readFileSync("./src/web/mappers/PublicTestCaseReviewMapper.js", "utf8");
    assert.match(mapperSource, /presentTestCases/);
    assert.match(mapperSource, /assignDisplayIds/);
    const mapped = new PublicTestCaseReviewMapper().map({
        review: {
            sessionId: "SESSION-1",
            artifact: {
                artifactId: "TESTCASE-1",
                artifactType: "TEST_CASE_REVIEW",
                testCases: [
                    {
                        id: "TC-CREATE-FULL",
                        testcaseId: "TC-CREATE-FULL",
                        title: "Thêm mới đơn vị tính thành công với dữ liệu hợp lệ",
                        feature: "Thêm mới đơn vị tính",
                        type: "POSITIVE",
                        operation: "CREATE",
                        expectedResult: "Lưu thành công",
                        steps: [{ action: "Nhập dữ liệu hợp lệ rồi lưu" }]
                    },
                    {
                        id: "TC-SEARCH-HIT",
                        testcaseId: "TC-SEARCH-HIT",
                        title: "Tìm kiếm đơn vị tính có kết quả",
                        feature: "Tìm kiếm đơn vị tính",
                        type: "POSITIVE",
                        catalogKey: "SEARCH_HIT",
                        expectedResult: "Hiển thị kết quả phù hợp",
                        steps: [{ action: "Thực hiện tìm kiếm" }]
                    }
                ]
            }
        },
        workflow: { status: "AWAITING_TEST_CASE_REVIEW", step: "TEST_CASE_REVIEW" }
    });
    assert.deepEqual(
        mapped.testCases.map(item => item.displayId),
        ["TC001", "TC002"]
    );
    assert.deepEqual(
        mapped.testCases.map(item => item.id),
        ["TC-SEARCH-HIT", "TC-CREATE-FULL"]
    );
    assert.equal(mapped.testCases[0].intent, "SEARCH_FOUND");
}

{
    const mapped = new PublicTestCaseReviewMapper().map({
        review: {
            sessionId: "SESSION-2",
            artifact: {
                artifactId: "TESTCASE-2",
                artifactType: "TEST_CASE_REVIEW",
                testCases: [
                    {
                        id: "TC001",
                        testcaseId: "TC001",
                        title: "Business rule trùng mã",
                        feature: "Thêm mới đơn vị tính",
                        type: "BUSINESS_RULE",
                        operation: "CREATE",
                        expectedResult: "Không cho phép lưu",
                        steps: [{ action: "Nhập mã đã tồn tại rồi lưu" }]
                    },
                    {
                        id: "TC006",
                        testcaseId: "TC006",
                        title: "Tìm kiếm đơn vị tính có kết quả",
                        feature: "Tìm kiếm đơn vị tính",
                        type: "POSITIVE",
                        catalogKey: "SEARCH_HIT",
                        expectedResult: "Hiển thị kết quả phù hợp",
                        steps: [{ action: "Thực hiện tìm kiếm" }]
                    },
                    {
                        id: "TC007",
                        testcaseId: "TC007",
                        title: "Tìm kiếm đơn vị tính không có kết quả",
                        feature: "Tìm kiếm đơn vị tính",
                        type: "POSITIVE",
                        catalogKey: "SEARCH_MISS",
                        expectedResult: "Không hiển thị bản ghi",
                        steps: [{ action: "Thực hiện tìm kiếm" }]
                    }
                ]
            }
        },
        workflow: { status: "AWAITING_TEST_CASE_REVIEW", step: "TEST_CASE_REVIEW" }
    });
    assert.deepEqual(
        mapped.testCases.map(item => `${item.displayId}|${item.id}`),
        ["TC001|TC006", "TC002|TC007", "TC003|TC001"]
    );
}

{
    const listSource = fs.readFileSync("./web-ui/src/components/TestCaseList.jsx", "utf8");
    assert.match(listSource, /testCaseDisplayId/);
    const editorSource = fs.readFileSync("./web-ui/src/components/TestCaseEditor.jsx", "utf8");
    assert.match(editorSource, /testCaseDisplayId/);
}

console.log("TestCase intent presentation test: PASS");
