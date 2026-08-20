import assert from "node:assert/strict";
import fs from "node:fs";
import {
    assignDisplayIds,
    createBlankManualTestCase,
    nextDisplayCode,
    nextStableTestCaseId,
    testCaseDisplayId,
    testCaseId
} from "../web-ui/src/utils/testCaseReview.js";

function caseAt(index, extras = {}) {
    const displayId = `TC${String(index + 1).padStart(3, "0")}`;
    return {
        id: extras.id ?? displayId,
        testcaseId: extras.testcaseId ?? extras.id ?? displayId,
        displayId,
        title: extras.title ?? `Case ${displayId}`,
        scenario: extras.scenario ?? `Tình huống ${displayId}`,
        module: extras.module ?? "Danh mục",
        feature: extras.feature ?? "Tìm kiếm",
        type: extras.type ?? "POSITIVE",
        expectedResult: extras.expectedResult ?? "Thành công",
        steps: extras.steps ?? [{ order: 1, action: "Thực hiện", expected: "" }]
    };
}

{
    const six = [0, 1, 2, 3, 4, 5].map(index => caseAt(index));
    assert.equal(nextDisplayCode(six), "TC007");
    const created = createBlankManualTestCase(six);
    assert.equal(created.displayId, "TC007");
    assert.equal(testCaseDisplayId(created), "TC007");
    assert.equal(created.id, "TC007");
    assert.equal(created.testcaseId, "TC007");
}

{
    const sixWithHighStable = [
        caseAt(0, { id: "TC001" }),
        caseAt(1, { id: "TC002" }),
        caseAt(2, { id: "TC003" }),
        caseAt(3, { id: "TC006" }),
        caseAt(4, { id: "TC007" }),
        caseAt(5, { id: "TC009" })
    ];
    assert.equal(nextDisplayCode(sixWithHighStable), "TC007");
    assert.equal(nextStableTestCaseId(sixWithHighStable), "TC010");
    const created = createBlankManualTestCase(sixWithHighStable);
    assert.equal(created.displayId, "TC007", "Add phải đề xuất mã presentation, không lấy TC009 stable");
    assert.equal(testCaseDisplayId(created), "TC007");
    assert.equal(created.id, "TC010");
    assert.equal(created.testcaseId, "TC010");
    assert.equal(
        sixWithHighStable.some(item => testCaseId(item) === created.id),
        false,
        "stable id mới không được trùng testcase hiện có"
    );
}

{
    const original = assignDisplayIds([
        caseAt(0, { id: "TC001" }),
        caseAt(1, { id: "TC002" }),
        caseAt(2, { id: "TC003" }),
        caseAt(3, { id: "TC004" }),
        caseAt(4, { id: "TC005" }),
        caseAt(5, { id: "TC006" })
    ]);
    const afterDelete = assignDisplayIds(original.filter(item => item.id !== "TC003"));
    assert.deepEqual(
        afterDelete.map(item => item.displayId),
        ["TC001", "TC002", "TC003", "TC004", "TC005"]
    );
    assert.deepEqual(
        afterDelete.map(item => item.id),
        ["TC001", "TC002", "TC004", "TC005", "TC006"]
    );
    const created = createBlankManualTestCase(afterDelete);
    assert.equal(created.displayId, "TC006");
    assert.equal(testCaseDisplayId(created), "TC006");
    assert.equal(created.id, "TC007");
}

{
    const previous = {
        id: "TC009",
        testcaseId: "TC009",
        displayId: "TC004",
        title: "Tình huống cũ",
        scenario: "Không được mang sang Add",
        module: "Kho",
        feature: "Create Kho",
        type: "VALIDATION",
        preconditions: ["Đã đăng nhập"],
        testData: { fields: { Mã: { value: "OLD" } }, value: "OLD", requirement: "x", requiresTesterInput: true },
        steps: [{ order: 1, action: "Bước cũ", expected: "Kết quả cũ" }],
        expectedResult: "Kết quả cũ"
    };
    const created = createBlankManualTestCase([previous, caseAt(1, { id: "TC002" })]);
    assert.equal(created.displayId, "TC003");
    assert.notEqual(created.id, "TC009");
    assert.equal(created.title, "");
    assert.equal(created.scenario, "");
    assert.equal(created.module, "");
    assert.equal(created.feature, "");
    assert.equal(created.type, "POSITIVE");
    assert.deepEqual(created.preconditions, []);
    assert.equal(created.testData.value, "");
    assert.deepEqual(created.testData.fields, {});
    assert.equal(created.steps[0].action, "");
    assert.equal(created.expectedResult, "");
    assert.equal(created.source, "MANUAL_TESTER");
}

{
    const editorSource = fs.readFileSync("./web-ui/src/components/TestCaseEditor.jsx", "utf8");
    const formSource = editorSource.slice(
        editorSource.indexOf("testcase-detail-form"),
        editorSource.indexOf("testcase-detail-content")
    );
    const fieldOrder = [
        "Mã testcase",
        "Phân hệ",
        "Chức năng",
        "Loại testcase",
        "Tình huống kiểm tra",
        "Điều kiện tiên quyết",
        "TestDataEditor",
        "Các bước thực hiện",
        "Kết quả mong đợi"
    ];
    const positions = fieldOrder.map(label => formSource.indexOf(label));
    positions.forEach((position, index) => {
        assert.ok(position >= 0, `thiếu field ${fieldOrder[index]}`);
        if (index > 0) {
            assert.ok(
                position > positions[index - 1],
                `${fieldOrder[index]} phải đứng sau ${fieldOrder[index - 1]}`
            );
        }
    });
    assert.match(formSource, /Mã testcase[\s\S]*readOnly/);
    assert.ok(
        formSource.indexOf("Mã testcase") < formSource.indexOf("testcase-detail-form__grid"),
        "Mã testcase phải đứng trước hàng Phân hệ / Chức năng"
    );
}

{
    const panelSource = fs.readFileSync("./web-ui/src/components/TestCaseReviewPanel.jsx", "utf8");
    assert.match(panelSource, /createBlankManualTestCase/);
    assert.doesNotMatch(panelSource, /nextManualTestCase/);
    assert.match(panelSource, /const startCreate = \(\) => \{[\s\S]*createBlankManualTestCase\(draft\)/);
    assert.match(panelSource, /setCreating\(false\);\s*setEditDraft\(null\)/);
    assert.match(
        panelSource,
        /id: testCaseId\(selected\),\s*testcaseId: testCaseId\(selected\)/,
        "Edit không được đổi stable id"
    );
}

console.log("TestCase Review add/edit form test: PASS");
