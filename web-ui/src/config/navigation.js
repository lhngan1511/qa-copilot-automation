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
                label: "Automation Intelligence",
                description: "Automation Intelligence",
                icon: "automation",
                soon: true
            },
            {
                label: "CodeGen",
                description: "AI Code Generation",
                icon: "code",
                soon: true
            },
            {
                label: "Reports",
                description: "Báo cáo & thống kê",
                icon: "reports",
                soon: true
            }
        ]
    }
];
