# QA Copilot Requirement Specification V1

## Mục tiêu

Chuẩn hóa tài liệu Requirement để AI và Parser có thể phân tích thống nhất.

Một Requirement gồm:

- Module
- Thông tin chung
- Danh sách Feature
- Automation Metadata

---

# Module

```md
# Module: <Tên Module>
```

Ví dụ

```md
# Module: Thiết bị
```

---

# Thông tin chung

## Mục đích

Mô tả mục đích của module.

## Mô tả

Mô tả tổng quan nghiệp vụ.

## Quyền truy cập

Danh sách quyền.

## Dữ liệu dùng chung

Các trường dùng chung.

## Quan hệ dữ liệu

Các ràng buộc dữ liệu.

---

# Features

Mỗi Feature bắt đầu bằng:

```md
## Feature: <Tên Feature>
```

Ví dụ

```md
## Feature: Thêm thiết bị
```

---

# Cấu trúc Feature

Một Feature luôn gồm:

```text
Mô tả

Điều kiện tiên quyết

Input

Luồng chính

Quy tắc nghiệp vụ

Validation

Kết quả mong đợi

Ngoại lệ

Automation
```

---

# Automation

```md
### Automation

Screen: Device

Operation: Create
```

Operation được chuẩn hóa:

- Create
- Read
- Update
- Delete
- Search
- Login
- Logout
- Import
- Export
- Upload
- Download
- Approve
- Reject
- Print
