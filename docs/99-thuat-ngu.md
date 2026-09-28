# Bảng thuật ngữ

Tra nhanh các thuật ngữ dùng trong dự án. Cột **Xem** trỏ tới phần giải thích kỹ.

| Thuật ngữ | Giải thích ngắn | Xem |
|---|---|---|
| **401 / 403 / 404 / 409 / 429** | Mã HTTP: chưa đăng nhập / không có quyền / không thấy / xung đột / quá nhiều request | [P2 §2.1](03-phase-2-crud-api.md#21-rest-và-http) |
| **Access token** | JWT ngắn hạn (15 phút), gửi kèm mọi request API qua header `Authorization: Bearer` | [P4 §2.4](05-phase-4-xac-thuc-jwt.md#24-access-token-và-refresh-token) |
| **ACID** | Bốn tính chất của transaction: Atomic (trọn vẹn), Consistent (nhất quán), Isolated (cô lập), Durable (bền vững) | [P2 §2.2](03-phase-2-crud-api.md#22-kiến-trúc-3-tầng-controller-service-repository) |
| **Ack** | Consumer báo broker đã xử lý xong; chỉ khi đó message mới bị xoá khỏi queue | [P6 §2.6](07-phase-6-rabbitmq.md#26-ack-prefetch-và-vì-sao-message-nằm-chờ) |
| **Actuator** | Module Spring Boot cung cấp endpoint vận hành như `/actuator/health` | [P1 §2.8](02-phase-1-khung-spring-boot-flyway.md#28-actuator-và-openapiswagger) |
| **Adminer** | Web UI xem và sửa database, http://localhost:8081 | [00 §4.7](00-cong-cu-va-moi-truong.md#47-giao-diện-web-đi-kèm) |
| **AFTER_COMMIT** | Chỉ chạy listener sau khi transaction commit thành công (`@TransactionalEventListener`) | [P6 §2.3](07-phase-6-rabbitmq.md#23-publish-sau-commit-after_commit) |
| **Annotation processor** | Chương trình chạy lúc biên dịch Java để sinh code (Lombok, MapStruct) | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **AOF (Append Only File)** | Chế độ Redis ghi mọi lệnh ra đĩa, khởi động lại không mất dữ liệu | [P0 §2.6](01-phase-0-chuan-bi.md#26-cấu-hình-đáng-chú-ý-trong-docker-composeyml) |
| **App initializer** | Hàm Angular chạy trước khi app hiển thị (khôi phục phiên, tải dữ liệu) | [P3 §2.6](04-phase-3-frontend-noi-api-upload.md#26-app-initializer) |
| **At-least-once** | Mỗi message được giao ít nhất một lần, có thể trùng; consumer phải idempotent | [P6 §2.4](07-phase-6-rabbitmq.md#24-at-least-once-và-consumer-idempotent) |
| **Authentication / Authorization** | Xác thực (bạn là ai) / Phân quyền (bạn được làm gì) | [P4 §2.1](05-phase-4-xac-thuc-jwt.md#21-authentication-và-authorization) |
| **Awaitility** | Thư viện test chờ điều kiện đúng (có hạn giờ) thay cho `Thread.sleep` | [P6 Bước 7](07-phase-6-rabbitmq.md#bước-7-test) |
| **Base64 / Base64URL** | Cách biểu diễn byte bằng ký tự chữ-số; bản URL thay `+/` bằng `-_`. **Không phải mã hoá bí mật** | [P4 §2.3](05-phase-4-xac-thuc-jwt.md#23-jwt-json-web-token) |
| **BCrypt** | Hàm hash mật khẩu chậm có chủ đích, có salt ngẫu nhiên | [P1 §2.11](02-phase-1-khung-spring-boot-flyway.md#211-bcrypt-để-tạo-user-demo) |
| **Bean** | Đối tượng do Spring tạo và quản lý | [P1 §2.1](02-phase-1-khung-spring-boot-flyway.md#21-spring-framework-và-spring-boot) |
| **Bean Validation** | Kiểm tra dữ liệu bằng annotation như `@NotBlank`, `@Size`, `@Min` | [P2 §2.3](03-phase-2-crud-api.md#23-dto-record-và-bean-validation) |
| **Bearer token** | Header `Authorization: Bearer <token>`: ai *cầm* (bear) token thì được coi là chủ | [P4 §2.4](05-phase-4-xac-thuc-jwt.md#24-access-token-và-refresh-token) |
| **BOM (Byte Order Mark)** | 3 byte `EF BB BF` đầu file UTF-8; làm `javac` lỗi | [P1 §5.3](02-phase-1-khung-spring-boot-flyway.md#53-file-có-bom-làm-javac-lỗi) |
| **Brute force** | Thử liên tục rất nhiều mật khẩu; chống bằng rate limit và BCrypt | [P4 §2.10](05-phase-4-xac-thuc-jwt.md#210-rate-limiting-thuật-toán-token-bucket) |
| **Bucket4j** | Thư viện Java cài đặt thuật toán token bucket, lưu trạng thái trong Redis | [P4 §2.10](05-phase-4-xac-thuc-jwt.md#210-rate-limiting-thuật-toán-token-bucket) |
| **Cache invalidation** | Quyết định khi nào xoá dữ liệu cache đã cũ | [P6 §2.8](07-phase-6-rabbitmq.md#28-spring-cache-trên-redis) |
| **Cache-Control** | Header HTTP chỉ dẫn trình duyệt/CDN giữ bản sao bao lâu | [P3 §3.5](04-phase-3-frontend-noi-api-upload.md#35-cache-control-immutable) |
| **Caddy** | Web server/reverse proxy tự cấp HTTPS (Phase 10) | [README](README.md#bức-tranh-tổng-thể) |
| **Cascade (DB)** | `ON DELETE CASCADE`: xoá dòng cha thì DB tự xoá dòng con | [P2 §2.6](03-phase-2-crud-api.md#26-cascade-để-db-lo-hay-để-jpa-lo) |
| **Claim** | Một trường thông tin trong payload JWT (`sub`, `exp`, `iss`, `jti`…) | [P4 §2.3](05-phase-4-xac-thuc-jwt.md#23-jwt-json-web-token) |
| **Collation** | Quy tắc so sánh/sắp xếp chuỗi; `ai_ci` = không phân biệt dấu và hoa thường | [P0 §2.6](01-phase-0-chuan-bi.md#26-cấu-hình-đáng-chú-ý-trong-docker-composeyml) |
| **Component (Angular)** | Một phần giao diện: class + template | [P3 §2.1](04-phase-3-frontend-noi-api-upload.md#21-spa-và-angular) |
| **computed** | Signal suy ra từ signal khác, tự tính lại | [P3 §2.1](04-phase-3-frontend-noi-api-upload.md#21-spa-và-angular) |
| **Constraint** | Ràng buộc trong DB: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK | [P1 §2.6](02-phase-1-khung-spring-boot-flyway.md#26-kiểu-dữ-liệu-mariadb-được-dùng) |
| **Container / Image** | Image = bản đóng gói phần mềm; container = image đang chạy | [00 §4.3](00-cong-cu-va-moi-truong.md#43-khái-niệm) |
| **ContentCachingResponseWrapper** | Bọc response để giữ bản sao body, đọc lại được sau khi controller ghi | [P5 §2.4](06-phase-5-concurrency.md#24-luồng-idempotencyfilter-trên-redis) |
| **Conventional Commits** | Quy ước commit message dạng `feat: ...`, `fix: ...` | [00 §3.3](00-cong-cu-va-moi-truong.md#33-quy-ước-commit-message) |
| **Cookie httpOnly / Secure / SameSite** | Thuộc tính cookie: JS không đọc được / chỉ gửi qua HTTPS / không gửi từ site khác | [P4 §2.5](05-phase-4-xac-thuc-jwt.md#25-cookie-httponly-secure-samesite-path) |
| **CORS** | Cơ chế server cho phép JS ở origin khác đọc response | [P3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors) |
| **CountDownLatch** | Bộ đếm lùi; luồng `await()` đứng chờ tới khi về 0, dùng làm "cổng xuất phát" trong test song song | [P5 §2.7](06-phase-5-concurrency.md#27-test-đồng-thời-executorservice-và-countdownlatch) |
| **CRLF / LF** | Ký tự xuống dòng Windows (`\r\n`) / Linux (`\n`) | [P0 §2.3](01-phase-0-chuan-bi.md#23-gitattributes-và-vấn-đề-xuống-dòng-line-endings) |
| **CRUD** | Create, Read, Update, Delete: bốn thao tác cơ bản với dữ liệu | [P2](03-phase-2-crud-api.md) |
| **CSRF** | Trang lạ lợi dụng cookie của bạn để gửi request thay bạn | [P4 §2.6](05-phase-4-xac-thuc-jwt.md#26-csrf-và-kiểm-tra-origin) |
| **DI / IoC** | Dependency Injection / Inversion of Control: framework tạo và truyền dependency | [P1 §2.1](02-phase-1-khung-spring-boot-flyway.md#21-spring-framework-và-spring-boot) |
| **DLQ (Dead Letter Queue)** | Queue chứa message lỗi hết lượt retry, để xem và xử lý tay | [P6 §2.5](07-phase-6-rabbitmq.md#25-retry-và-dead-letter-queue-dlq) |
| **Docker Compose** | Khai báo nhiều container trong một file YAML | [00 §4](00-cong-cu-va-moi-truong.md#4-docker-và-docker-compose) |
| **DTO** | Object chỉ để truyền dữ liệu qua API, tách khỏi entity | [P2 §2.3](03-phase-2-crud-api.md#23-dto-record-và-bean-validation) |
| **Entity** | Class Java ánh xạ vào một bảng DB | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **@EntityGraph** | Chỉ định Hibernate tải kèm quan hệ bằng JOIN, tránh N+1 | [P2 §2.9](03-phase-2-crud-api.md#29-vấn-đề-n1-và-cách-tránh) |
| **Environment variable** | Biến `TÊN=giá trị` truyền cho chương trình khi chạy | [P0 §2.4](01-phase-0-chuan-bi.md#24-biến-môi-trường-và-env) |
| **Exchange / Binding / Routing key** | Exchange nhận message; binding là luật chuyển sang queue theo routing key | [P6 §2.2](07-phase-6-rabbitmq.md#22-exchange-queue-binding-routing-key) |
| **ExecutorService** | Nhóm luồng (thread pool) chạy nhiều tác vụ song song | [P5 §2.7](06-phase-5-concurrency.md#27-test-đồng-thời-executorservice-và-countdownlatch) |
| **EXIF** | Metadata trong ảnh (hướng xoay, GPS…); server bỏ khi mã hoá lại | [P3 §3.3](04-phase-3-frontend-noi-api-upload.md#33-xử-lý-ảnh-exif-resize-webp) |
| **Fail fast** | Phát hiện lỗi cấu hình ngay lúc khởi động thay vì lúc chạy | [P1 §2.3](02-phase-1-khung-spring-boot-flyway.md#23-cấu-hình-profile-và-configurationproperties) |
| **Failsafe / Surefire** | Plugin Maven chạy test tích hợp `*IT` / unit test `*Test` | [P1 §2.10](02-phase-1-khung-spring-boot-flyway.md#210-kiểm-thử-với-testcontainers) |
| **Family (refresh token)** | Chuỗi các refresh token nối tiếp nhau từ một lần đăng nhập | [P4 §2.7](05-phase-4-xac-thuc-jwt.md#27-token-rotation-và-reuse-detection) |
| **Filter chain** | Chuỗi filter Spring Security chạy trước controller | [P4 §2.11](05-phase-4-xac-thuc-jwt.md#211-spring-security-filter-chain-và-resource-server) |
| **Flyway** | Công cụ quản lý migration schema DB bằng file SQL đánh số | [P1 §2.5](02-phase-1-khung-spring-boot-flyway.md#25-migration-với-flyway) |
| **`--force-with-lease`** | Force push an toàn: từ chối nếu remote có commit lạ | [00 §3.4](00-cong-cu-va-moi-truong.md#34-viết-lại-lịch-sử-và---force-with-lease) |
| **FormData / multipart** | Định dạng body HTTP chở file nhị phân | [P3 §3.1](04-phase-3-frontend-noi-api-upload.md#31-multipartform-data) |
| **Guard (Angular)** | Hàm chạy trước khi vào route, dùng để chặn/chuyển hướng | [P4 §2.12](05-phase-4-xac-thuc-jwt.md#212-frontend-guard-interceptor-refresh-open-redirect) |
| **Hash (mật mã)** | Hàm một chiều: dễ tính, không suy ngược (SHA-256, BCrypt) | [P4 §2.8](05-phase-4-xac-thuc-jwt.md#28-redis-cấu-trúc-lưu-refresh-token) |
| **Healthcheck** | Lệnh kiểm tra dịch vụ đã sẵn sàng | [00 §4.3](00-cong-cu-va-moi-truong.md#43-khái-niệm) |
| **Hibernate** | Thư viện ORM cài đặt chuẩn JPA | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **HS256 (HMAC-SHA256)** | Thuật toán ký JWT bằng một khoá bí mật dùng chung | [P4 §2.3](05-phase-4-xac-thuc-jwt.md#23-jwt-json-web-token) |
| **HttpClient / HttpContext** | Dịch vụ gọi HTTP của Angular / cờ gắn riêng cho từng request | [P3 §2.2–2.3](04-phase-3-frontend-noi-api-upload.md#22-httpclient-observable-và-promise) |
| **IDOR** | Lỗ hổng đổi `id` trên URL là đọc được dữ liệu người khác | [P2 §2.5](03-phase-2-crud-api.md#25-idor-và-404-thay-vì-403) |
| **Idempotency-Key** | Mã client gắn vào POST; gửi lại cùng mã thì server trả kết quả cũ, không tạo thêm | [P5 §2.3](06-phase-5-concurrency.md#23-idempotency-và-idempotency-key) |
| **Idempotent** | Gọi nhiều lần cho cùng kết quả như gọi một lần | [P2 §2.1](03-phase-2-crud-api.md#21-rest-và-http) |
| **Interceptor** | Hàm chen vào mọi request/response HTTP phía client | [P3 §2.3](04-phase-3-frontend-noi-api-upload.md#23-interceptor-và-httpcontext) |
| **Jackson** | Thư viện chuyển Java ↔ JSON; Boot 4 dùng Jackson 3 (`tools.jackson`) | [P1 §2.9](02-phase-1-khung-spring-boot-flyway.md#29-jackson-chuyển-đổi-json) |
| **JDK / JRE / JVM** | Bộ phát triển / môi trường chạy / máy ảo Java | [00 §5.1](00-cong-cu-va-moi-truong.md#51-jdk-và-jre) |
| **JPA** | Chuẩn ORM của Java | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **JsonPath** | Cú pháp truy cập JSON trong test (`$.name`, `$[0].id`) | [P2 §3 Bước 6](03-phase-2-crud-api.md#bước-6-test) |
| **JWT** | Token có chữ ký gồm header.payload.signature | [P4 §2.3](05-phase-4-xac-thuc-jwt.md#23-jwt-json-web-token) |
| **Lazy loading** | Chỉ tải dữ liệu/code khi thật sự cần (quan hệ JPA, route Angular) | [P2 §2.9](03-phase-2-crud-api.md#29-vấn-đề-n1-và-cách-tránh) |
| **Lombok** | Sinh getter/setter/constructor lúc biên dịch | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **Lost update** | Hai người sửa cùng lúc, bản sau ghi đè mất bản trước | [P2 §2.4](03-phase-2-crud-api.md#24-optimistic-locking-và-version), [P5 §2.1](06-phase-5-concurrency.md#21-race-condition-và-lost-update) |
| **Lua script (Redis)** | Đoạn lệnh chạy nguyên tử trên Redis | [P4 §2.8](05-phase-4-xac-thuc-jwt.md#28-redis-cấu-trúc-lưu-refresh-token) |
| **Magic bytes** | Vài byte đầu file cho biết định dạng thật | [P3 §3.2](04-phase-3-frontend-noi-api-upload.md#32-không-tin-client-magic-bytes) |
| **MapStruct** | Sinh code chuyển Entity ↔ DTO lúc biên dịch | [P2 §2.3](03-phase-2-crud-api.md#23-dto-record-và-bean-validation) |
| **MariaDB** | CSDL quan hệ, fork mã nguồn mở của MySQL | [P0 §2.5](01-phase-0-chuan-bi.md#25-ba-dịch-vụ-hạ-tầng-dùng-để-làm-gì) |
| **Mass assignment** | Client gửi thêm field để sửa thứ không được phép | [P2 §2.3](03-phase-2-crud-api.md#23-dto-record-và-bean-validation) |
| **Maven / Maven Wrapper** | Công cụ build Java / script `mvnw` tự tải đúng phiên bản Maven | [00 §5](00-cong-cu-va-moi-truong.md#5-java-jdk-và-maven) |
| **Message broker** | Trung gian chuyển tin nhắn qua hàng đợi (RabbitMQ) | [P0 §2.5](01-phase-0-chuan-bi.md#25-ba-dịch-vụ-hạ-tầng-dùng-để-làm-gì) |
| **Microtask / Macrotask** | Hai hàng đợi việc của JavaScript; microtask (Promise) chạy trước | [P4 §5.3](05-phase-4-xac-thuc-jwt.md#53-unit-test-angular-chờ-không-đủ-microtask) |
| **Migration** | File SQL thay đổi schema, chạy theo thứ tự đúng một lần | [P1 §2.5](02-phase-1-khung-spring-boot-flyway.md#25-migration-với-flyway) |
| **MockMvc** | Gửi request giả vào Spring MVC trong test, không mở cổng mạng | [P2 §3 Bước 6](03-phase-2-crud-api.md#bước-6-test) |
| **Monorepo** | Frontend + backend trong cùng một repo | [P0 §2.1](01-phase-0-chuan-bi.md#21-monorepo) |
| **N+1** | 1 truy vấn danh sách + N truy vấn con cho từng dòng | [P2 §2.9](03-phase-2-crud-api.md#29-vấn-đề-n1-và-cách-tránh) |
| **Network (Docker)** | Mạng riêng Compose tạo cho dự án; container gọi nhau bằng tên service | [00 §4.4](00-cong-cu-va-moi-truong.md#44-docker-hoạt-động-thế-nào) |
| **Observable** | Luồng giá trị theo thời gian (RxJS); HttpClient trả về kiểu này | [P3 §2.2](04-phase-3-frontend-noi-api-upload.md#22-httpclient-observable-và-promise) |
| **Open redirect** | Lợi dụng tham số chuyển hướng để đưa người dùng sang trang lạ | [P4 §2.12](05-phase-4-xac-thuc-jwt.md#212-frontend-guard-interceptor-refresh-open-redirect) |
| **OpenAPI / Swagger** | Chuẩn mô tả API / trang web đọc và gọi thử API (`/api/docs`) | [P1 §2.8](02-phase-1-khung-spring-boot-flyway.md#28-actuator-và-openapiswagger) |
| **Optimistic locking** | Không khoá; kiểm `version` lúc ghi, lệch thì 409 | [P2 §2.4](03-phase-2-crud-api.md#24-optimistic-locking-và-version) |
| **Optimistic UI** | Cập nhật giao diện trước, lỗi thì hoàn tác | [P3 §2.5](04-phase-3-frontend-noi-api-upload.md#25-optimistic-ui-và-rollback) |
| **Origin** | scheme + host + port, ví dụ `http://localhost:4200` | [P3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors) |
| **ORM** | Lớp chuyển đổi giữa bảng DB và đối tượng | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **PATCH semantics** | Sửa một phần; phân biệt "không gửi" với "gửi null" | [P2 §2.8](03-phase-2-crud-api.md#28-patch-không-gửi-khác-gửi-null) |
| **Path traversal** | Dùng `../` để thoát khỏi thư mục được phép | [P3 §3.4](04-phase-3-frontend-noi-api-upload.md#34-storage-driver-và-path-traversal) |
| **Pessimistic locking** | Khoá bản ghi ngay lúc đọc (`SELECT ... FOR UPDATE`), người khác phải chờ | [P5 §2.2](06-phase-5-concurrency.md#22-optimistic-locking-nhắc-lại) |
| **Poison message** | Message luôn làm consumer lỗi; requeue mãi sẽ chặn cả queue | [P6 §2.5](07-phase-6-rabbitmq.md#25-retry-và-dead-letter-queue-dlq) |
| **Port mapping** | Nối cổng máy thật với cổng trong container, `"máy:container"` | [00 §4.3](00-cong-cu-va-moi-truong.md#43-khái-niệm) |
| **ProblemDetail (RFC 9457)** | Chuẩn định dạng JSON cho lỗi API | [P1 §2.7](02-phase-1-khung-spring-boot-flyway.md#27-chuẩn-lỗi-problemdetail-rfc-9457) |
| **Profile (Spring)** | Tập cấu hình theo môi trường: dev/test/prod | [P1 §2.3](02-phase-1-khung-spring-boot-flyway.md#23-cấu-hình-profile-và-configurationproperties) |
| **Projection** | Truy vấn chỉ lấy vài cột vào interface nhỏ | [P2 §2.9](03-phase-2-crud-api.md#29-vấn-đề-n1-và-cách-tránh) |
| **Proxy (dev)** | Angular dev server chuyển `/api` sang backend để cùng origin | [P3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors) |
| **RabbitMQ** | Message broker dùng cho việc chạy nền | [P0 §2.5](01-phase-0-chuan-bi.md#25-ba-dịch-vụ-hạ-tầng-dùng-để-làm-gì), [P6 §2.1](07-phase-6-rabbitmq.md#21-vì-sao-cần-message-broker) |
| **Race condition** | Kết quả phụ thuộc thứ tự ngẫu nhiên của thao tác song song | [P2 §2.7](03-phase-2-crud-api.md#27-ràng-buộc-unique--409) |
| **Rate limiting** | Giới hạn số request trong một khoảng thời gian | [P4 §2.10](05-phase-4-xac-thuc-jwt.md#210-rate-limiting-thuật-toán-token-bucket) |
| **Record (Java)** | Class bất biến gọn, tự có constructor/getter/equals | [P2 §2.3](03-phase-2-crud-api.md#23-dto-record-và-bean-validation) |
| **Redis** | Kho key-value trong RAM, có TTL | [P0 §2.5](01-phase-0-chuan-bi.md#25-ba-dịch-vụ-hạ-tầng-dùng-để-làm-gì) |
| **Refresh token** | Token dài hạn trong cookie httpOnly, dùng để lấy access token mới | [P4 §2.4](05-phase-4-xac-thuc-jwt.md#24-access-token-và-refresh-token) |
| **Repository** | Interface truy vấn DB; Spring Data sinh SQL từ tên hàm | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **Resource server** | App nhận Bearer token và kiểm tra nó (Spring Security) | [P4 §2.11](05-phase-4-xac-thuc-jwt.md#211-spring-security-filter-chain-và-resource-server) |
| **REST** | Kiểu thiết kế API theo tài nguyên + HTTP method | [P2 §2.1](03-phase-2-crud-api.md#21-rest-và-http) |
| **Reuse detection** | Token đã xoay mà bị dùng lại thì thu hồi cả family | [P4 §2.7](05-phase-4-xac-thuc-jwt.md#27-token-rotation-và-reuse-detection) |
| **Reverse proxy** | Server đứng trước app, nhận request rồi chuyển tiếp (Caddy) | [README](README.md#bức-tranh-tổng-thể) |
| **Rollback** | Huỷ thay đổi: transaction DB lỗi, hoặc optimistic UI lỗi | [P2 §2.2](03-phase-2-crud-api.md#22-kiến-trúc-3-tầng-controller-service-repository) |
| **Rotation** | Mỗi lần refresh phát token mới, token cũ hết giá trị | [P4 §2.7](05-phase-4-xac-thuc-jwt.md#27-token-rotation-và-reuse-detection) |
| **Salt** | Chuỗi ngẫu nhiên trộn vào trước khi hash mật khẩu | [P1 §2.11](02-phase-1-khung-spring-boot-flyway.md#211-bcrypt-để-tạo-user-demo) |
| **Same-Origin Policy** | Trình duyệt chặn JS đọc response từ origin khác | [P3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors) |
| **Scrimage** | Thư viện xử lý ảnh Java (resize, WebP) | [P3 §3.3](04-phase-3-frontend-noi-api-upload.md#33-xử-lý-ảnh-exif-resize-webp) |
| **Sealed interface** | Interface chỉ cho phép một danh sách class cố định implement (Java 17+) | [P6 Bước 2](07-phase-6-rabbitmq.md#bước-2-sự-kiện-và-publish-sau-commit) |
| **SecurityContext** | Nơi Spring Security lưu "ai đang gọi" cho request hiện tại | [P4 §2.11](05-phase-4-xac-thuc-jwt.md#211-spring-security-filter-chain-và-resource-server) |
| **Seed** | Dữ liệu mẫu nạp sẵn cho môi trường dev | [P1 Bước 5](02-phase-1-khung-spring-boot-flyway.md#bước-5-dữ-liệu-mẫu-r__demo_datasql) |
| **SET NX** | Lệnh Redis chỉ ghi khi key chưa tồn tại, nguyên tử: nhiều request cùng lúc thì chỉ một bên thắng | [P5 §2.4](06-phase-5-concurrency.md#24-luồng-idempotencyfilter-trên-redis) |
| **Service (Compose)** | Một mục trong `services:`; mỗi service chạy thành một container | [00 §4.5](00-cong-cu-va-moi-truong.md#45-đọc-hiểu-một-service-trong-docker-composeyml) |
| **ShedLock** | Khoá trong Redis để job định kỳ chỉ chạy trên một instance | [P6 §2.9](07-phase-6-rabbitmq.md#29-job-định-kỳ-và-shedlock) |
| **Signal** | Giá trị phản ứng của Angular; đổi thì giao diện tự vẽ lại | [P3 §2.1](04-phase-3-frontend-noi-api-upload.md#21-spa-và-angular) |
| **Signed URL** | URL có chữ ký và hạn dùng, để chia sẻ file riêng tư | [P4 §5.4](05-phase-4-xac-thuc-jwt.md#54-hạn-chế-đã-biết) |
| **Single-flight** | Nhiều lời gọi cùng lúc dùng chung một kết quả (refresh một lần) | [P4 §2.12](05-phase-4-xac-thuc-jwt.md#212-frontend-guard-interceptor-refresh-open-redirect) |
| **SPA** | Ứng dụng web một trang; JS tự vẽ các trang và gọi API | [P3 §2.1](04-phase-3-frontend-noi-api-upload.md#21-spa-và-angular) |
| **Spring Boot / Starter** | Spring kèm auto-config / gói dependency theo chủ đề | [P1 §2.1](02-phase-1-khung-spring-boot-flyway.md#21-spring-framework-và-spring-boot) |
| **Stateless** | Server không giữ trạng thái phiên; mọi thông tin nằm trong token | [P4 §2.2](05-phase-4-xac-thuc-jwt.md#22-session-truyền-thống-và-token-stateless) |
| **Storage driver** | Interface lưu file; thay local bằng S3 mà không sửa chỗ khác | [P3 §3.4](04-phase-3-frontend-noi-api-upload.md#34-storage-driver-và-path-traversal) |
| **Testcontainers** | Thư viện bật container Docker thật khi chạy test | [P1 §2.10](02-phase-1-khung-spring-boot-flyway.md#210-kiểm-thử-với-testcontainers) |
| **Thumbnail** | Ảnh thu nhỏ (320px) sinh ở nền sau khi upload | [P6 Bước 4](07-phase-6-rabbitmq.md#bước-4-thumbnail-và-xoá-file) |
| **Timing attack** | Suy ra thông tin từ thời gian phản hồi | [P4 §2.9](05-phase-4-xac-thuc-jwt.md#29-bảo-vệ-mật-khẩu-và-chống-dò-email) |
| **Toast** | Thông báo nổi góc màn hình, tự ẩn | [P3 Bước 2](04-phase-3-frontend-noi-api-upload.md#bước-2-tầng-api-frontend) |
| **Token bucket** | Thuật toán rate limit: xô token nạp dần | [P4 §2.10](05-phase-4-xac-thuc-jwt.md#210-rate-limiting-thuật-toán-token-bucket) |
| **Transaction** | Nhóm thao tác DB "được ăn cả, ngã về không" | [P2 §2.2](03-phase-2-crud-api.md#22-kiến-trúc-3-tầng-controller-service-repository) |
| **Transactional Outbox** | Ghi message vào bảng trong cùng transaction rồi job gửi đi, không mất event | [P6 §2.3](07-phase-6-rabbitmq.md#23-publish-sau-commit-after_commit) |
| **TTL** | Thời gian sống của key Redis, hết hạn thì tự xoá | [P4 §2.8](05-phase-4-xac-thuc-jwt.md#28-redis-cấu-trúc-lưu-refresh-token) |
| **User enumeration** | Dò xem email nào đã đăng ký qua khác biệt thông báo lỗi | [P4 §2.9](05-phase-4-xac-thuc-jwt.md#29-bảo-vệ-mật-khẩu-và-chống-dò-email) |
| **utf8mb4** | Bảng mã MariaDB lưu được mọi ký tự Unicode, kể cả emoji | [P0 §2.6](01-phase-0-chuan-bi.md#26-cấu-hình-đáng-chú-ý-trong-docker-composeyml) |
| **UUID** | Mã định danh 128-bit ngẫu nhiên, khó đoán | [P1 §2.4](02-phase-1-khung-spring-boot-flyway.md#24-orm-jpa-và-hibernate) |
| **Version (entity)** | Số tăng sau mỗi lần ghi, dùng cho optimistic locking | [P2 §2.4](03-phase-2-crud-api.md#24-optimistic-locking-và-version) |
| **Virtual threads** | Luồng nhẹ của Java 21, chịu được nhiều request đồng thời | [P1 Bước 2](02-phase-1-khung-spring-boot-flyway.md#bước-2-viết-cấu-hình) |
| **Vitest / HttpTestingController** | Framework test JS / backend giả của Angular trong test | [P3 Bước 8](04-phase-3-frontend-noi-api-upload.md#bước-8-unit-test-frontend) |
| **Volume (Docker)** | Vùng lưu dữ liệu ngoài container, không mất khi xoá container | [00 §4.3](00-cong-cu-va-moi-truong.md#43-khái-niệm) |
| **WebP** | Định dạng ảnh nhẹ hơn JPEG ~25–35% | [P3 §3.3](04-phase-3-frontend-noi-api-upload.md#33-xử-lý-ảnh-exif-resize-webp) |
| **WSL 2** | Máy ảo Linux nhẹ tích hợp trong Windows; Docker Desktop chạy trên nó | [00 §4.2](00-cong-cu-va-moi-truong.md#42-cài-đặt-và-cấu-hình-docker-desktop) |
| **XSS** | Chèn JavaScript độc vào trang để đánh cắp dữ liệu/token | [P4 §2.4](05-phase-4-xac-thuc-jwt.md#24-access-token-và-refresh-token) |
