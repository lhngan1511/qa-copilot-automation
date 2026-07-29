export function extractWorkflowId(result) {
    const workflowId = result?.workflow?.id;

    if (typeof workflowId !== "string" || !workflowId.trim()) {
        throw new Error("Không thể xác định workflow ID từ phản hồi của backend.");
    }

    return workflowId.trim();
}
