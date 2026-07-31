class TestData {
    constructor({ fields = {}, requirement = "", value = "", requiresTesterInput = false } = {}) {
        this.fields =
            fields && typeof fields === "object" && !Array.isArray(fields)
                ? structuredClone(fields)
                : {};
        this.requirement = typeof requirement === "string" ? requirement.trim() : "";
        this.value = typeof value === "string" ? value.trim() : "";
        this.requiresTesterInput = requiresTesterInput === true;
    }
}

export default TestData;
