export default function formatDate(value) {
    if (!value) return "Chưa có";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa có";

    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}
