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
                label: "Automation Intelligence",
                description: "Sinh mã và thực thi testcase (sẽ có)",
                to: "/automation/workspaces/new",
                activePrefix: "/automation",
                icon: "automation"
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
