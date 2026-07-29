export default function TestDataReadinessBadge({ status }) {
    const normalized =
        status === "READY" ? "READY" : status === "DATA_REQUIRED" ? status : "UNKNOWN";
    const label = {
        READY: "Sẵn sàng",
        DATA_REQUIRED: "Cần nhập dữ liệu",
        UNKNOWN: "Chưa xác định"
    }[normalized];

    return (
        <span
            className={`readiness-badge readiness-badge--${normalized.toLowerCase()}`}
            aria-label={`Readiness: ${label}`}
        >
            {label}
        </span>
    );
}
