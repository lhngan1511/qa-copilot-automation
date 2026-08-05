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
                description: "Sinh mã và thực thi testcase",
                to: "/automation/workspaces/new",
                activePrefix: "/automation",
                icon: "automation"
            },
            {
                label: "CodeGen",
                description: "Thư viện CodeGen",
                icon: "code",
                soon: true
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
