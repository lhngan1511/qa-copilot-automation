# Quy Tắc Report (Allure & tương đương)

> Áp dụng cho **mọi** script automation sinh ra, bất kể framework (Playwright, Selenium, Appium) hay ngôn ngữ.
>
> **Nguyên tắc gốc:** Report phải đọc hiểu được bởi người **không xem code** — QA lead, BA, PM. Nhìn vào Test Body là biết test đã làm gì, ở bước nào, kết quả ra sao.

---

## 1. Metadata Bắt Buộc Cho Mỗi Test

Mỗi test case **PHẢI** khai báo đủ 5 mục sau. Thiếu bất kỳ mục nào = chưa đạt Definition of Done.

| Mục | Nội dung | Ví dụ |
|---|---|---|
| **Tên test (title)** | Mô tả hành vi bằng **Tiếng Việt**, không phải tên hàm | `Đăng nhập thành công với tài khoản admin hợp lệ` |
| **Description** | 1–2 câu: test kiểm tra gì, điều kiện gì, kỳ vọng gì | `Kiểm tra người dùng đăng nhập bằng email và mật khẩu hợp lệ thì được chuyển vào Dashboard và thấy menu điều hướng.` |
| **Severity** | `blocker` / `critical` / `normal` / `minor` / `trivial` | `blocker` cho luồng login |
| **Tags / Labels** | Nhóm chạy: `smoke`, `regression`, tên module | `smoke`, `login` |
| **TC ID** | Mã manual test case để truy vết ngược | `CRM_LOGIN_TC_001` |

**KHÔNG** để tên test hiển thị trong report là tên hàm kiểu `test_login_with_valid_credentials` — đó là tên code, không phải tên test case.

**TC ID** gắn qua label riêng (không nhét vào title) để truy vết ngược về manual test case.

---

## 2. Test Body — Mô Tả Từng Bước

Toàn bộ thân test **PHẢI** được bọc trong các **step có tên mô tả bằng Tiếng Việt**.

### Cấu trúc chuẩn — bám theo Arrange / Act / Assert

```
▼ Test body
  ▸ Arrange: Mở trang Login
  ▸ Act: Đăng nhập bằng tài khoản admin
  ▸ Assert: Hệ thống chuyển vào Dashboard
  ▸ trang_thai_cuoi_cua_test  (ảnh)
```

### Quy tắc đặt tên step

| ✅ Đúng | ❌ Sai |
|---|---|
| `Act: Đăng nhập bằng tài khoản admin` | `login()` |
| `Assert: Hệ thống chuyển vào Dashboard` | `check url` |
| `Arrange: Mở trang Login` | `step 1` |

- Bắt đầu bằng tiền tố `Arrange:` / `Act:` / `Assert:` để người đọc biết đang ở giai đoạn nào
- Tên step mô tả **hành vi nghiệp vụ**, không mô tả thao tác DOM
- Step con (sub-step) sinh tự động từ method của Page Object — đánh dấu method POM bằng step API tương ứng

### Không được để test body rỗng step

Test mà Test Body chỉ hiện 1 dòng phẳng = **fail review**. Tối thiểu phải có 3 step Arrange / Act / Assert.

---

## 3. Screenshot — Đính Kèm Ở Cuối MỌI Test

**Bắt buộc** đính kèm ảnh chụp màn hình ở **cuối mỗi test case**, **không phân biệt PASS hay FAIL**.

| Trường hợp | Ảnh đính kèm | Tên attachment |
|---|---|---|
| Test **PASSED** | Ảnh trạng thái cuối cùng — bằng chứng test đã chạy thật | `trang_thai_cuoi_cua_test` |
| Test **FAILED** | Ảnh tại thời điểm fail | `trang_thai_khi_that_bai` |

Lý do bắt buộc cả khi PASS: report có ảnh mới chứng minh được test **thực sự chạy trên UI** chứ không phải pass giả do assertion yếu.

**Quy tắc:**
- Chụp trong teardown (`afterEach` / `@AfterMethod` / fixture finalizer) — **không** rải lệnh chụp trong thân test
- Mỗi test **1 ảnh cuối** là đủ; chụp thêm chỉ ở milestone thật sự quan trọng
- Tên attachment giữ **cố định** để so sánh giữa các lần chạy
- Ảnh full-page nếu nội dung cần kiểm tra nằm ngoài viewport

---

## 4. CẤM Đính Kèm stdout / stderr

Report **KHÔNG** được chứa attachment `stdout`, `stderr`.

| Framework | Cách tắt |
|---|---|
| **pytest + allure-pytest** | Thêm `--allure-no-capture` vào `addopts` trong `pyproject.toml` / `pytest.ini` |
| **Playwright TS** | Không attach mặc định — chỉ cần **không** dùng `console.log` trong test |
| **TestNG + allure-testng** | Không attach mặc định — chỉ cần **không** dùng `System.out.println` |

> ⚠️ `--allure-no-capture` tắt luôn cả attachment `log`. Nếu vẫn cần log nghiệp vụ, attach thủ công một khối log đã chọn lọc — **không** đổ toàn bộ output thô vào report.

Ghi log dùng **logger framework** (Log4j / logging / winston), không dùng `print` / `console.log` — đây cũng là anti-pattern đã cấm ở `automation_rules.md`.

---

## 5. Bảng API Theo Framework

| Mục | Playwright + TS | Pytest (Python) | TestNG (Java) |
|---|---|---|---|
| Tên test | `allure.displayName()` | `@allure.title(...)` | `@Description` + `ITestListener` |
| Description | `allure.description()` | `@allure.description(...)` | `@Description(...)` |
| Severity | `allure.severity()` | `@allure.severity(...)` | `@Severity(SeverityLevel.X)` |
| Tag / Label | `allure.tags()` | `@allure.tag(...)` | `@Story` / `@Feature` |
| TC ID | `allure.label('testId', ...)` | `@allure.label('testId', ...)` | `Allure.label("testId", ...)` |
| Step | `test.step('...', async () => {})` | `with allure.step('...')` | `@Step("...")` / `Allure.step(...)` |
| Attach ảnh | `testInfo.attach(name, {body, contentType})` | `allure.attach(png, name, PNG)` | `Allure.addAttachment(name, stream)` |

Cấu hình reporting cho từng stack xem thêm tại [`.claude/skills/skills-framework-architect/SKILL.md`](../skills/skills-framework-architect/SKILL.md) mục **Framework Components → 8. Reporting**.

---

## 6. Thư Mục Output — Gom Hết Vào `reports/`

**Toàn bộ** sản phẩm sinh ra khi chạy test PHẢI nằm trong **một thư mục `reports/` duy nhất** ở gốc project. **CẤM** rải file report ra root.

```text
project-root/
└── reports/                      # ← Toàn bộ output nằm trong đây
    ├── allure-results/           # Raw results (JSON) — input cho allure generate
    ├── allure-report/            # HTML report nhiều file (mở bằng allure open)
    ├── allure-report-single/     # Report gộp 1 file — tiện gửi qua chat/email
    ├── html/                     # HTML report của runner (pytest-html / Playwright HTML)
    ├── logs/                     # Log file thực thi
    └── screenshots/              # Ảnh chụp lưu ra đĩa
```

Thư mục con khác (video, trace…) **được phép thêm**, miễn nằm trong `reports/`.

### Cấu hình theo stack

| Stack | Nơi khai báo | Giá trị |
|---|---|---|
| **Playwright TS** | `playwright.config.ts` | `['html', { outputFolder: 'reports/html' }]` · `['allure-playwright', { resultsDir: 'reports/allure-results' }]` · `outputDir: 'reports/test-artifacts'` |
| **Pytest** | `pyproject.toml` → `addopts` | `--alluredir=reports/allure-results --html=reports/html/index.html` |
| **TestNG + Maven** | `pom.xml` → surefire `systemPropertyVariables` | `allure.results.directory` = `${project.basedir}/reports/allure-results` · surefire `reportsDirectory` = `${project.basedir}/reports/surefire` |
| **Log file** | Log4j2 / `logging` / winston | Ghi vào `reports/logs/` |
| **Screenshot lưu đĩa** | `ScreenshotUtil` | Ghi vào `reports/screenshots/` |

### Lệnh sinh report

```bash
allure generate reports/allure-results -o reports/allure-report --clean
allure generate reports/allure-results -o reports/allure-report-single --single-file --clean
```

### Quy tắc kèm theo

- **`.gitignore` PHẢI có dòng `reports/`** — không commit output test lên repo
- **CI upload artifact** trỏ vào `reports/` (1 artifact duy nhất, không upload lẻ từng thư mục)
- **KHÔNG** để thư mục mặc định của tool nằm ở root: `allure-results/`, `test-results/`, `playwright-report/`, `target/surefire-reports/` — phải trỏ lại vào `reports/`
- Ảnh trong `reports/screenshots/` chụp hệ thống thật, **thường chứa dữ liệu khách hàng** — thêm lý do nữa để không commit

---

## 7. Checklist Review Report

Trước khi bàn giao script, mở report lên và kiểm:

- [ ] Tên test hiển thị bằng Tiếng Việt, **không** phải tên hàm
- [ ] Có Description giải thích test kiểm tra gì
- [ ] Có Severity + Tags + TC ID
- [ ] Test Body có step Arrange / Act / Assert, tên step đọc hiểu được
- [ ] Có ảnh `trang_thai_cuoi_cua_test` ở cuối **mọi** test PASSED
- [ ] Test FAILED có ảnh tại thời điểm fail
- [ ] **Không** có attachment `stdout` / `stderr`
- [ ] Toàn bộ output nằm trong `reports/` — root project sạch, không có `allure-results/` / `test-results/` / `playwright-report/` lạc ra ngoài
- [ ] `.gitignore` đã có `reports/`
