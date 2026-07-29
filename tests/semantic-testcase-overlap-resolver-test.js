import assert from "node:assert/strict";
import SemanticTestCaseOverlapResolver from "../src/resolvers/SemanticTestCaseOverlapResolver.js";

const resolver = new SemanticTestCaseOverlapResolver();

function createCase({
    id,
    scenarioId = `SC-${id}`,
    functionId = "FUNC-ADD",
    operation = "Create",
    classification = "PERMISSION_DENIED",
    source = "Người dùng không có quyền thêm",
    category = "BUSINESS_RULE",
    context = { userHasRequiredPermission: false },
    invalid = {},
    action = {},
    expectedState = { recordChanged: false },
    expectedResult = "Thao tác bị chặn; dữ liệu không thay đổi.",
    executable = true,
    needsClarification = false,
    requiresRuntimeSupport = false,
    targetField = ""
}) {
    return {
        id,
        scenarioId,
        moduleId: "MOD-1",
        functionId,
        function: operation,
        operation,
        type: category,
        ruleClassification: classification,
        sourceItem: {
            category,
            code: `CODE-${id}`,
            reference: `REF-${id}`,
            text: source,
            classification
        },
        targetField,
        testData: {
            valid: {},
            invalid,
            context,
            action,
            expectedState: { ...expectedState, sourceRule: source }
        },
        expectedResult,
        executable,
        needsClarification,
        requiresRuntimeSupport,
        preconditions: ["Người dùng đã đăng nhập"],
        coveredRules: [`RULE-${id}`],
        requirementReferences: [`REF-${id}`]
    };
}

{
    const result = resolver.resolve([
        createCase({ id: "TC1" }),
        createCase({ id: "TC2", category: "EXCEPTION" })
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "TC2");
    assert.deepEqual(result[0].coveredRules, ["RULE-TC1", "RULE-TC2"]);
    assert.deepEqual(result[0].requirementReferences, ["REF-TC1", "REF-TC2"]);
    assert.deepEqual(result[0].relatedScenarioIds, ["SC-TC1"]);
    assert.deepEqual(result[0].mergedTestCaseIds, ["TC1"]);
    assert.equal(result[0].sourceItem.code, "CODE-TC2");
    assert.equal(result[0].sourceItems.length, 2);
    assert.equal(resolver.lastSummary.coveredRulesAfter, resolver.lastSummary.coveredRulesBefore);
    assert.equal(
        resolver.lastSummary.requirementReferencesAfter,
        resolver.lastSummary.requirementReferencesBefore
    );
}

{
    const result = resolver.resolve([
        createCase({ id: "TC1", functionId: "FUNC-ADD", operation: "Create" }),
        createCase({ id: "TC2", functionId: "FUNC-DELETE", operation: "Delete" })
    ]);
    assert.equal(result.length, 2);
}

{
    const access = createCase({ id: "TC1", source: "Người dùng không có quyền xem" });
    const scope = createCase({
        id: "TC2",
        source: "Kết quả phải tuân thủ quyền xem dữ liệu"
    });
    assert.equal(resolver.resolve([access, scope]).length, 2);
}

{
    const common = {
        classification: "DUPLICATE",
        context: { existingRecord: { code: "EXISTING" } },
        invalid: { code: "EXISTING" },
        expectedState: { recordCreated: false }
    };
    assert.equal(
        resolver.resolve([
            createCase({ id: "TC1", source: "Mã phải là duy nhất", ...common }),
            createCase({
                id: "TC2",
                source: "Mã đã tồn tại",
                category: "EXCEPTION",
                ...common
            })
        ]).length,
        1
    );
}

{
    const required = (id, field) =>
        createCase({
            id,
            classification: "REQUIRED",
            source: `${field} không được để trống`,
            invalid: { [field]: "" },
            context: {},
            expectedState: { targetField: field, recordChanged: false },
            targetField: field
        });
    assert.equal(resolver.resolve([required("TC1", "Mã"), required("TC2", "Tên")]).length, 2);
}

{
    const missing = createCase({
        id: "TC1",
        classification: "RECORD_NOT_FOUND",
        context: { targetRecordExists: false },
        invalid: { targetIdentifier: "MISSING" }
    });
    const concurrent = createCase({
        id: "TC2",
        classification: "RECORD_NOT_FOUND",
        context: { targetRecordExists: false, recordExistedAtLoad: true },
        invalid: { targetIdentifier: "MISSING" }
    });
    assert.equal(resolver.resolve([missing, concurrent]).length, 2);
}

{
    const state = createCase({
        id: "TC1",
        classification: "STATE_RESTRICTION",
        context: { targetRecord: { statusCondition: "in use" } }
    });
    const related = createCase({
        id: "TC2",
        classification: "RELATED_DATA",
        context: { targetRecord: { hasRelatedData: true } }
    });
    assert.equal(resolver.resolve([state, related]).length, 2);
}

{
    const empty = createCase({
        id: "TC1",
        classification: "EMPTY_SEARCH",
        source: "Không nhập điều kiện",
        context: {},
        needsClarification: true,
        expectedState: {}
    });
    const noResult = createCase({
        id: "TC2",
        classification: "NO_RESULT",
        source: "Không tìm thấy dữ liệu",
        context: { matchingRecords: [] },
        expectedState: {}
    });
    assert.equal(resolver.resolve([empty, noResult]).length, 2);
}

{
    const search = (id, source, category = "BUSINESS_RULE") =>
        createCase({
            id,
            classification: "SEARCH_MULTI",
            source,
            category,
            context: {},
            needsClarification: true,
            expectedState: {}
        });
    const result = resolver.resolve([
        search("TC1", "Cho phép tìm kiếm bằng một hoặc nhiều điều kiện"),
        search("TC2", "Cho phép tìm kiếm bằng một hoặc nhiều điều kiện", "NEGATIVE"),
        search("TC3", "Các điều kiện được kết hợp theo quy tắc")
    ]);
    assert.equal(result.length, 2);
}

{
    const incomplete = createCase({ id: "TC1", executable: false });
    const executable = createCase({ id: "TC2", executable: true });
    assert.equal(resolver.resolve([incomplete, executable])[0].id, "TC2");
}

{
    const incomplete = createCase({
        id: "TC1",
        executable: false,
        needsClarification: true
    });
    const executable = createCase({ id: "TC2", executable: true });
    assert.equal(resolver.resolve([incomplete, executable]).length, 2);
}

{
    const values = [createCase({ id: "TC1" }), createCase({ id: "TC2", category: "EXCEPTION" })];
    const first = resolver.resolve(values);
    assert.deepEqual(resolver.resolve(first), first);
    assert.deepEqual(resolver.resolve(values), first);
    assert.ok(first.every(item => !Array.isArray(item)));
}

{
    const reviewedArtifact = {
        testCases: [createCase({ id: "TC-USER", scenarioId: "SC-USER" })]
    };
    const resumed = reviewedArtifact.testCases.map(item => structuredClone(item));
    assert.equal(resumed[0].id, "TC-USER");
    assert.equal(
        resumed.some(item => item.id === "TC-DELETED"),
        false
    );
}

console.log("Semantic TestCase overlap resolver test PASSED");
