import crypto from "node:crypto";
import pg from "pg";
import ProjectRepository from "./ProjectRepository.js";

const { Pool } = pg;

export default class PostgresProjectRepository extends ProjectRepository {
    constructor({ connectionString, ssl = false } = {}) {
        super();
        if (!connectionString) throw new Error("DATABASE_URL bắt buộc khi PROJECT_REPOSITORY_TYPE=postgres.");
        this.pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false });
    }
    async initialize() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS qa_projects (
                project_id text PRIMARY KEY,
                code text NOT NULL DEFAULT '',
                name text NOT NULL,
                description text NOT NULL DEFAULT '',
                status text NOT NULL DEFAULT 'ACTIVE',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS qa_projects_code_unique
                ON qa_projects (lower(code)) WHERE code <> '' AND status <> 'DELETED';
            CREATE TABLE IF NOT EXISTS qa_project_records (
                project_id text NOT NULL REFERENCES qa_projects(project_id) ON DELETE CASCADE,
                record_type text NOT NULL,
                record_id text NOT NULL,
                payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (project_id, record_type, record_id)
            );
            CREATE INDEX IF NOT EXISTS qa_project_records_lookup
                ON qa_project_records(project_id, record_type, updated_at DESC);
        `);
    }
    map(row) { return row ? { projectId: row.project_id, code: row.code, name: row.name, description: row.description, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null; }
    async list() { const r = await this.pool.query("SELECT * FROM qa_projects WHERE status <> 'DELETED' ORDER BY updated_at DESC"); return r.rows.map(x => this.map(x)); }
    async getById(projectId) { const r = await this.pool.query("SELECT * FROM qa_projects WHERE project_id=$1 AND status <> 'DELETED'", [projectId]); return this.map(r.rows[0]); }
    async create({ name, code = "", description = "" }) {
        const id = `PRJ-${crypto.randomUUID()}`;
        const r = await this.pool.query("INSERT INTO qa_projects(project_id,code,name,description) VALUES($1,$2,$3,$4) RETURNING *", [id, code, name, description]);
        return this.map(r.rows[0]);
    }
    async update(projectId, patch) {
        const current = await this.getById(projectId); if (!current) return null;
        const r = await this.pool.query("UPDATE qa_projects SET code=$2,name=$3,description=$4,status=$5,updated_at=now() WHERE project_id=$1 RETURNING *", [projectId, patch.code ?? current.code, patch.name ?? current.name, patch.description ?? current.description, patch.status ?? current.status]);
        return this.map(r.rows[0]);
    }
    async delete(projectId) {
        const r = await this.pool.query("UPDATE qa_projects SET status='DELETED',updated_at=now() WHERE project_id=$1 AND status <> 'DELETED' RETURNING *", [projectId]);
        return this.map(r.rows[0]);
    }
}
