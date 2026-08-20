const GROUP_ORDER = ["SEARCH", "CREATE", "UPDATE", "DELETE", "PERMISSION", "OTHER"];

const INTENT_ORDER = {
    SEARCH: ["SEARCH_FOUND", "SEARCH_NOT_FOUND"],
    CREATE: ["CREATE_FULL_DATA", "CREATE_EMPTY_CODE"],
    UPDATE: ["UPDATE_VALID"],
    DELETE: ["DELETE_VALID"],
    PERMISSION: ["PERMISSION_DENIED"],
    OTHER: []
};

const DEDUPE_INTENTS = new Set([
    "SEARCH_FOUND",
    "SEARCH_NOT_FOUND",
    "CREATE_FULL_DATA",
    "CREATE_EMPTY_CODE",
    "UPDATE_VALID",
    "DELETE_VALID"
]);

const CATALOG_INTENTS = {
    SEARCH_HIT: { group: "SEARCH", intent: "SEARCH_FOUND" },
    SEARCH_MISS: { group: "SEARCH", intent: "SEARCH_NOT_FOUND" },
    CREATE_FULL: { group: "CREATE", intent: "CREATE_FULL_DATA" },
    CREATE_AUTO_CODE: { group: "CREATE", intent: "CREATE_EMPTY_CODE" }
};

const CANONICAL_WORDINGS = {
    SEARCH_FOUND:
        /thanh cong.*(dieu kien hop le|tim kiem)|co ket qua|hien thi ket qua|ket qua tim kiem phu hop|khop voi tu khoa/,
    SEARCH_NOT_FOUND: /khong (co ket qua|tim thay)|khong hien thi ban ghi/,
    CREATE_FULL_DATA: /day du( thong tin)?|du lieu hop le|thanh cong voi du lieu hop le/,
    CREATE_EMPTY_CODE: /khong nhap ma|de trong ma/,
    UPDATE_VALID: /cap nhat.*thanh cong|chinh sua.*thanh cong|sua.*thanh cong/,
    DELETE_VALID: /xoa.*thanh cong/
};

export function classifyTestCaseIntent(testCase = {}) {
    const catalog = String(testCase.catalogKey ?? "").trim().toUpperCase();
    if (CATALOG_INTENTS[catalog]) return { ...CATALOG_INTENTS[catalog] };

    const operation = resolveOperation(testCase);
    const classification = key(testCase.ruleClassification);
    const text = key(
        [
            testCase.title,
            testCase.scenario,
            testCase.testScenario,
            testCase.feature,
            testCase.function,
            testCase.expectedResult
        ].join(" ")
    );
    const type = String(testCase.type ?? "").trim().toUpperCase();
    const positive = type === "POSITIVE" || type === "CONFIRMED_FACT" || !type;

    if (operation === "SEARCH") {
        if (
            ["no result", "empty result"].includes(classification) ||
            /khong (co ket qua|tim thay)|khong hien thi ban ghi/.test(text)
        ) {
            return { group: "SEARCH", intent: "SEARCH_NOT_FOUND" };
        }
        if (classification === "required") return { group: "SEARCH", intent: "SEARCH_REQUIRED" };
        if (positive || /co ket qua|thanh cong|dieu kien hop le|hien thi ket qua/.test(text)) {
            return { group: "SEARCH", intent: "SEARCH_FOUND" };
        }
        return { group: "SEARCH", intent: "SEARCH_OTHER" };
    }

    if (operation === "CREATE") {
        const titleText = key([testCase.title, testCase.scenario, testCase.testScenario].join(" "));
        if (
            /khong nhap ma|de trong ma/.test(titleText) &&
            !/canh bao|bat buoc|khong duoc de trong/.test(titleText)
        ) {
            return { group: "CREATE", intent: "CREATE_EMPTY_CODE" };
        }
        if (classification === "required") return { group: "CREATE", intent: "VALIDATION_REQUIRED" };
        if (classification === "duplicate") return { group: "CREATE", intent: "CREATE_DUPLICATE" };
        if (type === "PERMISSION" || classification === "permission denied") {
            return { group: "PERMISSION", intent: "PERMISSION_DENIED" };
        }
        if (type === "BUSINESS_RULE") return { group: "CREATE", intent: "CREATE_BUSINESS_RULE" };
        if (type === "VALIDATION") return { group: "CREATE", intent: "CREATE_VALIDATION" };
        if (positive || /day du|hop le|thanh cong/.test(text)) {
            return { group: "CREATE", intent: "CREATE_FULL_DATA" };
        }
        return { group: "CREATE", intent: "CREATE_OTHER" };
    }

    if (operation === "UPDATE") {
        if (classification === "required") return { group: "UPDATE", intent: "VALIDATION_REQUIRED" };
        if (type === "PERMISSION" || classification === "permission denied") {
            return { group: "PERMISSION", intent: "PERMISSION_DENIED" };
        }
        if (type === "BUSINESS_RULE") return { group: "UPDATE", intent: "UPDATE_BUSINESS_RULE" };
        if (type === "VALIDATION") return { group: "UPDATE", intent: "UPDATE_VALIDATION" };
        if (positive) return { group: "UPDATE", intent: "UPDATE_VALID" };
        return { group: "UPDATE", intent: "UPDATE_OTHER" };
    }

    if (operation === "DELETE") {
        if (type === "PERMISSION" || classification === "permission denied") {
            return { group: "PERMISSION", intent: "PERMISSION_DENIED" };
        }
        if (type === "BUSINESS_RULE" || classification === "state restriction" || classification === "related data") {
            return { group: "DELETE", intent: "DELETE_BUSINESS_RULE" };
        }
        if (positive) return { group: "DELETE", intent: "DELETE_VALID" };
        return { group: "DELETE", intent: "DELETE_OTHER" };
    }

    if (type === "PERMISSION" || classification === "permission denied") {
        return { group: "PERMISSION", intent: "PERMISSION_DENIED" };
    }
    return { group: "OTHER", intent: type || "OTHER" };
}

export function intentDedupeKey(testCase = {}) {
    const { group, intent } = classifyTestCaseIntent(testCase);
    if (!DEDUPE_INTENTS.has(intent)) return "";
    if (!String(testCase.catalogKey ?? "").trim() && !matchesCanonicalWording(testCase, intent)) {
        return "";
    }
    return [key(testCase.moduleId || testCase.module), key(functionKey(testCase)), group, intent].join("|");
}

function matchesCanonicalWording(testCase, intent) {
    const pattern = CANONICAL_WORDINGS[intent];
    if (!pattern) return false;
    return pattern.test(key(testCase.title ?? ""));
}

export function applyTestCasePresentation(testCases = []) {
    const list = Array.isArray(testCases) ? testCases.map(item => ({ ...item })) : [];
    const decorated = list.map(testCase => {
        const classified = classifyTestCaseIntent(testCase);
        return {
            ...testCase,
            intentGroup: classified.group,
            intent: classified.intent
        };
    });
    decorated.sort(compareTestCases);
    return decorated.map((testCase, index) => ({
        ...testCase,
        displayId: formatDisplayId(index + 1)
    }));
}

export function formatDisplayId(index) {
    return `TC${String(index).padStart(3, "0")}`;
}

export function compareTestCases(left, right) {
    const leftGroup = GROUP_ORDER.indexOf(left.intentGroup) === -1 ? GROUP_ORDER.length : GROUP_ORDER.indexOf(left.intentGroup);
    const rightGroup = GROUP_ORDER.indexOf(right.intentGroup) === -1 ? GROUP_ORDER.length : GROUP_ORDER.indexOf(right.intentGroup);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    const leftIntents = INTENT_ORDER[left.intentGroup] ?? [];
    const rightIntents = INTENT_ORDER[right.intentGroup] ?? [];
    const leftIntent = leftIntents.indexOf(left.intent);
    const rightIntent = rightIntents.indexOf(right.intent);
    const leftRank = leftIntent === -1 ? leftIntents.length : leftIntent;
    const rightRank = rightIntent === -1 ? rightIntents.length : rightIntent;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const byFunction = key(functionKey(left)).localeCompare(key(functionKey(right)), "vi");
    if (byFunction !== 0) return byFunction;
    return key(left.id || left.testcaseId).localeCompare(key(right.id || right.testcaseId));
}

export function resolveOperation(testCase = {}) {
    const explicit = String(
        testCase.operation ?? testCase.automation?.operation ?? testCase.automationHints?.operation ?? ""
    )
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "");
    if (/CREATE|ADD/.test(explicit)) return "CREATE";
    if (/UPDATE|EDIT/.test(explicit)) return "UPDATE";
    if (/DELETE|REMOVE/.test(explicit)) return "DELETE";
    if (/SEARCH|FIND/.test(explicit)) return "SEARCH";

    const text = key(`${testCase.function ?? ""} ${testCase.feature ?? ""} ${testCase.title ?? ""} ${testCase.scenario ?? ""}`);
    if (/tim kiem|tra cuu|\bloc\b/.test(text)) return "SEARCH";
    if (/them moi|tao moi|\bthem\b|\btao\b/.test(text)) return "CREATE";
    if (/cap nhat|chinh sua|\bsua\b/.test(text)) return "UPDATE";
    if (/\bxoa\b/.test(text)) return "DELETE";
    return "OTHER";
}

function functionKey(testCase) {
    return testCase.functionId || testCase.function || testCase.feature || "";
}

function key(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
