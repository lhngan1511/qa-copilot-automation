const WorkflowStatus = Object.freeze({
    CREATED: "CREATED",
    RUNNING: "RUNNING",
    WAITING_FOR_REVIEW: "WAITING_FOR_REVIEW",
    PAUSED: "PAUSED",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

export default WorkflowStatus;
