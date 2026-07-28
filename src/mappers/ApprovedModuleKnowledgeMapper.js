import RequirementKnowledge from "../models/RequirementKnowledge.js";

export default class ApprovedModuleKnowledgeMapper {
    map(moduleArtifact, fallbackRequirement = null) {
        if (!moduleArtifact || typeof moduleArtifact !== "object") {
            throw new Error("Approved Module Artifact is required.");
        }

        if (moduleArtifact.artifactType !== "MODULE_REVIEW") {
            throw new Error("Artifact type must be MODULE_REVIEW.");
        }

        if (moduleArtifact.approvalStatus !== "approved") {
            throw new Error("Module Artifact must be approved.");
        }

        const embedded =
            moduleArtifact.knowledge &&
            typeof moduleArtifact.knowledge === "object" &&
            !Array.isArray(moduleArtifact.knowledge)
                ? moduleArtifact.knowledge
                : {};
        const knowledge = new RequirementKnowledge(embedded);
        const primaryModule = moduleArtifact.module ?? this.getLegacyModule(moduleArtifact);
        const primaryFunctions =
            Array.isArray(moduleArtifact.functions) && moduleArtifact.functions.length > 0
                ? moduleArtifact.functions
                : this.getLegacyFunctions(moduleArtifact, primaryModule, fallbackRequirement);

        if (primaryModule) {
            knowledge.setModule(primaryModule);
        }

        knowledge.setFunctions(primaryFunctions);
        knowledge.notes = this.normalizeStrings(moduleArtifact.notes ?? embedded.notes);
        knowledge.confidence =
            typeof moduleArtifact.confidence === "number"
                ? moduleArtifact.confidence
                : typeof embedded.confidence === "number"
                  ? embedded.confidence
                  : 0;
        knowledge.source =
            typeof moduleArtifact.source === "string" && moduleArtifact.source.trim()
                ? moduleArtifact.source.trim()
                : typeof embedded.source === "string"
                  ? embedded.source
                  : "";

        return new RequirementKnowledge(knowledge.toJSON());
    }

    getLegacyModule(artifact) {
        const item = Array.isArray(artifact.modules) ? artifact.modules[0] : null;
        const name = typeof item?.module === "string" ? item.module.trim() : "";

        return name ? { id: "MOD001", name } : null;
    }

    getLegacyFunctions(artifact, module, fallbackRequirement) {
        const item = Array.isArray(artifact.modules) ? artifact.modules[0] : null;
        const features = Array.isArray(item?.features)
            ? item.features
            : Array.isArray(fallbackRequirement?.features)
              ? fallbackRequirement.features
              : [];
        const moduleId =
            typeof module?.id === "string" && module.id.trim() ? module.id.trim() : "MOD001";

        return features.map((feature, index) => ({
            id: `FUNC${String(index + 1).padStart(3, "0")}`,
            moduleId,
            name:
                typeof feature === "string"
                    ? feature
                    : feature?.name ?? feature?.feature ?? feature?.title
        }));
    }

    normalizeStrings(values) {
        return Array.isArray(values)
            ? [...new Set(values.filter(value => typeof value === "string").map(value => value.trim()))]
                  .filter(Boolean)
            : [];
    }
}
