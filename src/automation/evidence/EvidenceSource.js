/**
 * Evidence Source — các nguồn bằng chứng cho Automation Discovery.
 * Theo kiến trúc chính thức: mọi nguồn được lưu RIÊNG, không trộn lẫn.
 */
export const EVIDENCE_SOURCE = Object.freeze({
    /** Playwright Codegen thật (tester chạy codegen trên app) */
    PLAYWRIGHT_CODEGEN: "PLAYWRIGHT_CODEGEN",
    /** Kho locator do tester duy trì (Locator Repository) */
    LOCATOR_REPOSITORY: "LOCATOR_REPOSITORY",
    /** Page Object đã có sẵn */
    PAGE_OBJECTS: "PAGE_OBJECTS",
    /** Automation hiện có (existing tests) */
    EXISTING_AUTOMATION: "EXISTING_AUTOMATION",
    /** AI đề xuất — LUÔN ở trạng thái DRAFT */
    AI_PROPOSAL: "AI_PROPOSAL",
    /** Confirmed Facts — dữ liệu do tester xác nhận trực tiếp */
    CONFIRMED_FACTS: "CONFIRMED_FACTS",
    /** DOM Discovery (tương lai) */
    DOM_DISCOVERY: "DOM_DISCOVERY"
});

/**
 * Nguồn có thể là nguồn "đáng tin" (có thể cung cấp evidence APPROVED ngay từ đầu)
 * hay nguồn "đề xuất" (luôn bắt đầu ở DRAFT).
 * AI_PROPOSAL và DOM_DISCOVERY KHÔNG bao giờ tự động APPROVED.
 */
export function isTrustedSource(source) {
    return [
        EVIDENCE_SOURCE.PLAYWRIGHT_CODEGEN,
        EVIDENCE_SOURCE.LOCATOR_REPOSITORY,
        EVIDENCE_SOURCE.PAGE_OBJECTS,
        EVIDENCE_SOURCE.EXISTING_AUTOMATION,
        EVIDENCE_SOURCE.CONFIRMED_FACTS
    ].includes(source);
}

export function isProposalSource(source) {
    return source === EVIDENCE_SOURCE.AI_PROPOSAL || source === EVIDENCE_SOURCE.DOM_DISCOVERY;
}

export const EVIDENCE_SOURCE_LABELS = Object.freeze({
    [EVIDENCE_SOURCE.PLAYWRIGHT_CODEGEN]: "Playwright Codegen",
    [EVIDENCE_SOURCE.LOCATOR_REPOSITORY]: "Locator Repository",
    [EVIDENCE_SOURCE.PAGE_OBJECTS]: "Page Objects",
    [EVIDENCE_SOURCE.EXISTING_AUTOMATION]: "Existing Automation",
    [EVIDENCE_SOURCE.AI_PROPOSAL]: "AI Proposal (DRAFT)",
    [EVIDENCE_SOURCE.CONFIRMED_FACTS]: "Confirmed Facts",
    [EVIDENCE_SOURCE.DOM_DISCOVERY]: "DOM Discovery (future)"
});

export default {
    EVIDENCE_SOURCE,
    isTrustedSource,
    isProposalSource,
    EVIDENCE_SOURCE_LABELS
};
