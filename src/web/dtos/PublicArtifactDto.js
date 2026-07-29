export default class PublicArtifactDto {
    static create(artifact = {}) {
        const id = artifact.artifactId ?? artifact.id ?? "";
        const type = artifact.artifactType ?? artifact.type ?? "";

        return {
            id,
            type,
            name: artifact.title ?? artifact.name ?? type,
            status: artifact.approvalStatus ?? artifact.status ?? null,
            revision: Number.isFinite(artifact.revision) ? artifact.revision : null,
            downloadAvailable: false
        };
    }
}
