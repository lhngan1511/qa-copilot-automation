export const navigationGroups = [
    {
        label: "Workspace",
        items: [
            {
                label: "Dashboard",
                description: "Tổng quan hệ thống",
                to: "/",
                icon: "home",
                end: true
            },
            {
                label: "AI Test Design",
                description: "Tạo và review testcase",
                to: "/workflows/new",
                activePrefix: "/workflows",
                icon: "sparkles"
            }
        ]
    },
    {
        label: "Intelligence",
        items: [
            {
                label: "CodeGen",
                description: "Ghi thao tác và sinh script Playwright",
                to: "/codegen",
                activePrefix: "/codegen",
                icon: "code"
            },
            {
                label: "Automation",
                description: "Automation Workspace — chọn testcase cần ghi",
                to: "/automation",
                activePrefix: "/automation",
                icon: "recording"
            },
            {
                label: "Reports",
                description: "Báo cáo và thống kê",
                icon: "reports",
                soon: true
            }
        ]
    }
];
