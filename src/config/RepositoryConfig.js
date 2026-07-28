import path from "node:path";

export default class RepositoryConfig {
    static resolve({
        type = process.env.REPOSITORY_TYPE || "file",
        dataDir = process.env.DATA_DIR || "./data"
    } = {}) {
        const normalizedType = String(type).trim().toLowerCase();

        if (!["memory", "file"].includes(normalizedType)) {
            throw new Error(`Unsupported repository type: ${normalizedType}`);
        }

        return {
            type: normalizedType,
            dataDir: path.resolve(dataDir)
        };
    }
}
