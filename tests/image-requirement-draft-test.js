import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ImageRequirementDraftService from "../src/requirements/ImageRequirementDraftService.js";
import RequirementMarkdownRenderer from "../src/requirements/RequirementMarkdownRenderer.js";
import MarkdownParser from "../src/parsers/MarkdownParser.js";
import RequirementUploadService from "../src/services/RequirementUploadService.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "qa-image-requirement-"));
const document = {
    module: {
        name: "Danh mục đơn vị tính",
        purpose: "Quản lý danh mục đơn vị tính.",
        description: "Cho phép thêm và tìm kiếm.",
        permissions: ["Người dùng đã đăng nhập."],
        sharedData: [{ "Trường": "Tên đơn vị tính", "Control Type": "TextBox", "Nguồn dữ liệu": "Người dùng nhập", "Bắt buộc": "Có", "Mô tả": "Tên hiển thị" }],
        relationships: ["Tên không được để trống."]
    },
    features: [{
        name: "Thêm mới đơn vị tính", description: "Thêm dữ liệu.", preconditions: ["Đã đăng nhập."],
        inputs: [{ "Trường": "Tên đơn vị tính", "Bắt buộc": "Có", "Quy tắc": "Không để trống" }],
        mainFlow: ["Mở biểu mẫu.", "Nhấn Lưu."], businessRules: ["Tên bắt buộc."], validations: ["Không chỉ chứa khoảng trắng."],
        expectedResults: ["Thêm thành công."], exceptions: ["Thiếu tên."],
        automation: { screen: "UnitOfMeasure", operation: "Create", priority: "High", candidate: true, tags: ["smoke"] }
    }]
};
const provider = { async analyzeRequirementImages() { return { observations: [{ text: "Có nút Lưu", evidence: "Ảnh 1" }], inferences: [{ text: "Tên bắt buộc", evidence: "Dấu *", confidence: .9, needsConfirmation: true }], questions: ["Giới hạn độ dài?"], document, model: "fake", usage: { totalTokens: 100 } }; } };
const upload = new RequirementUploadService({ uploadDir: path.join(temp, "uploads") });
const service = new ImageRequirementDraftService({ dataDir: temp, provider, requirementUploadService: upload });
const image = { name: "screen.png", mimeType: "image/png", data: Buffer.from("fake-png").toString("base64") };
const draft = await service.analyze({ projectId: "PRJ-A", images: [image] });
assert.match(draft.markdownContent, /^# Module: Danh mục đơn vị tính/m);
assert.match(draft.markdownContent, /## Feature: Thêm mới đơn vị tính/);
assert.match(draft.markdownContent, /Screen: UnitOfMeasure/);
assert.deepEqual(new MarkdownParser().parse(draft.markdownContent).features[0].validationRules, ["Không chỉ chứa khoảng trắng."]);
assert.equal(draft.inferences[0].needsConfirmation, true);
assert.throws(() => service.confirm({ projectId: "PRJ-B", draftId: draft.draftId }), /Không tìm thấy/);
const confirmed = service.confirm({ projectId: "PRJ-A", draftId: draft.draftId, markdownContent: draft.markdownContent });
assert.equal(confirmed.status, "CONFIRMED");
assert.ok(fs.existsSync(upload.resolve(confirmed.requirementId, "PRJ-A")));
assert.throws(() => upload.resolve(confirmed.requirementId, "PRJ-B"), /Project hiện tại/);

let calls = 0;
const collapsedDocument = { ...document, features: [{ ...document.features[0], name: "Quản lý đơn vị tính", automation: { ...document.features[0].automation, operation: "CRUD" } }] };
const splitDocument = {
    ...document,
    features: [
        { ...document.features[0], name: "Thêm mới đơn vị tính", sourceImages: [1], automation: { ...document.features[0].automation, operation: "Create" } },
        { ...document.features[0], name: "Xóa đơn vị tính", sourceImages: [2], automation: { ...document.features[0].automation, operation: "Delete" } }
    ]
};
const retryProvider = { async analyzeRequirementImages(args) { calls += 1; assert.equal(args.analysisMode, "FEATURES"); return { document: calls === 1 ? collapsedDocument : splitDocument }; } };
const retryService = new ImageRequirementDraftService({ dataDir: path.join(temp, "retry"), provider: retryProvider, requirementUploadService: upload });
const splitDraft = await retryService.analyze({ projectId: "PRJ-A", images: [image, { ...image, name: "delete.png" }], analysisMode: "FEATURES" });
assert.equal(calls, 2);
assert.match(splitDraft.markdownContent, /## Feature: Thêm mới đơn vị tính/);
assert.match(splitDraft.markdownContent, /## Feature: Xóa đơn vị tính/);

let transientCalls = 0;
const transientProvider = {
    async analyzeRequirementImages() {
        transientCalls += 1;
        if (transientCalls < 3) throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
        return { document };
    }
};
const transientService = new ImageRequirementDraftService({
    dataDir: path.join(temp, "transient"),
    provider: transientProvider,
    requirementUploadService: upload,
    retryDelays: [0, 0]
});
await transientService.analyze({ projectId: "PRJ-A", images: [image] });
assert.equal(transientCalls, 3);

const busyService = new ImageRequirementDraftService({
    dataDir: path.join(temp, "busy"),
    provider: { async analyzeRequirementImages() { throw new Error("503 high demand"); } },
    requirementUploadService: upload,
    retryDelays: [0, 0]
});
await assert.rejects(
    () => busyService.analyze({ projectId: "PRJ-A", images: [image] }),
    error => error.code === "AI_PROVIDER_BUSY" && error.statusCode === 503 && /quá tải tạm thời/.test(error.message)
);

const legacyDraft = { ...draft, draftId: "DRAFT-LEGACY", imageHashes: ["one", "two"], analysisMode: undefined, document: collapsedDocument, markdownContent: new RequirementMarkdownRenderer().render(collapsedDocument) };
service.write(legacyDraft);
assert.throws(() => service.confirm({ projectId: "PRJ-A", draftId: legacyDraft.draftId }), /gộp nhiều ảnh/);
console.log("Image requirement draft test: PASS");
