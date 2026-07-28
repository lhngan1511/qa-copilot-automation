export default class WorkflowRegistry {
    constructor() {
        this.workflows = new Map();
    }

    register(name, workflow) {
        if (!name || typeof name !== "string") {
            throw new Error("Workflow name is required.");
        }

        if (!workflow) {
            throw new Error("Workflow instance is required.");
        }

        if (this.workflows.has(name)) {
            throw new Error(`Workflow '${name}' is already registered.`);
        }

        this.workflows.set(name, workflow);

        return workflow;
    }

    get(name) {
        return this.workflows.get(name);
    }

    has(name) {
        return this.workflows.has(name);
    }

    getAll() {
        return [...this.workflows.values()];
    }

    getNames() {
        return [...this.workflows.keys()];
    }

    remove(name) {
        return this.workflows.delete(name);
    }

    clear() {
        this.workflows.clear();
    }
}
