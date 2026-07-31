export default function slugify(value) {
    return String(value ?? "")
        .trim()
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
