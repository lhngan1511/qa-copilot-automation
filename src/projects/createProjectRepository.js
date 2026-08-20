import FileProjectRepository from "./FileProjectRepository.js";
import PostgresProjectRepository from "./PostgresProjectRepository.js";

export default async function createProjectRepository({ dataDir = "./data" } = {}) {
    const type = String(process.env.PROJECT_REPOSITORY_TYPE ?? (process.env.DATABASE_URL ? "postgres" : "file")).toLowerCase();
    const repository = type === "postgres"
        ? new PostgresProjectRepository({ connectionString: process.env.DATABASE_URL, ssl: String(process.env.DATABASE_SSL ?? "false").toLowerCase() === "true" })
        : new FileProjectRepository({ dataDir });
    await repository.initialize();
    return repository;
}
