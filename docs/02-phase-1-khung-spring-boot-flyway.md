# Phase 1: Khung Spring Boot, schema Flyway, entity JPA

> **Kết quả:** app Spring Boot khởi động được. Flyway tạo đủ 7 bảng và nạp dữ liệu mẫu. Hibernate xác nhận entity khớp schema. `/actuator/health` báo db, redis, rabbit đều UP. Swagger có ở `/api/docs`.
> **Commit:** `feat: Spring Boot backend skeleton with Flyway schema and dev infra (Phase 0-1)`

---

## 1. Mục tiêu

Dựng "bộ xương" cho backend: chưa có API nghiệp vụ nào, nhưng mọi nền móng đã sẵn sàng:
- Cấu hình theo môi trường (dev/test/prod).
- Database có schema quản lý bằng migration.
- Class Java ánh xạ vào bảng.
- Lỗi trả về theo một định dạng thống nhất.
- Test tự động chạy trên database thật.

---

## 2. Kiến thức cần biết

### 2.1. Spring Framework và Spring Boot

**Spring** là framework Java phổ biến nhất để làm backend. Ý tưởng cốt lõi là **IoC (Inversion of Control)** và **DI (Dependency Injection)**:

- Thay vì tự `new` các đối tượng rồi nối chúng với nhau, bạn **khai báo** "class này cần những gì", và Spring tự tạo rồi truyền vào.
- Mỗi đối tượng do Spring quản lý gọi là một **bean**. Class có `@Component`, `@Service`, `@Repository`, `@RestController`, `@Configuration` sẽ được Spring tìm thấy và tạo bean.

```java
@Service
public class PlaceService {
  private final PlaceRepository places;           // cần repository
  public PlaceService(PlaceRepository places) {   // Spring tự truyền vào (constructor injection)
    this.places = places;
  }
}
```

**Lợi ích của DI:** khi test có thể thay dependency thật bằng bản giả. Các class ít phụ thuộc chặt vào nhau, dễ thay thế.

**Spring Boot** là lớp tiện ích bọc ngoài Spring:
- **Starter**: gói dependency theo chủ đề. Thêm `spring-boot-starter-data-jpa` là có đủ JPA, Hibernate, connection pool.
- **Auto-configuration**: thấy thư viện nào trong classpath thì tự cấu hình thư viện đó. Có driver MariaDB và `spring.datasource.url` thì tự tạo kết nối DB.
- **Embedded server**: Tomcat nằm sẵn trong app, chạy bằng `java -jar` là xong, không cần cài server riêng.

**Phiên bản:** dự án dùng **Spring Boot 4.1.1** (Spring Framework 7, Hibernate 7, Jackson 3). Plan ban đầu định dùng 3.5, nhưng 3.5 đã hết hỗ trợ bản miễn phí nên Spring Initializr không còn cung cấp.

### 2.2. Spring Initializr

https://start.spring.io tạo sẵn khung dự án: `pom.xml`, class `main`, Maven Wrapper, thư mục chuẩn. Dự án được tạo bằng lệnh:

```powershell
$deps = 'web,validation,data-jpa,security,oauth2-resource-server,data-redis,rabbitmq,cache,actuator,flyway,mariadb,lombok,springdoc-openapi,testcontainers'
Invoke-WebRequest "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=4.1.1&javaVersion=21&groupId=com.gfmaster&artifactId=backend&packageName=com.gfmaster&baseDir=backend&dependencies=$deps" -OutFile backend.zip
Expand-Archive backend.zip -DestinationPath .
```

Cấu trúc thư mục chuẩn của Maven:
```
backend/
├─ pom.xml
├─ mvnw, mvnw.cmd, .mvn/
└─ src/
   ├─ main/java/com/gfmaster/...     # mã nguồn
   ├─ main/resources/                # application.yml, SQL migration
   ├─ test/java/com/gfmaster/...     # test
   └─ test/resources/                # cấu hình riêng cho test
```

### 2.3. Cấu hình, profile và `@ConfigurationProperties`

- **[application.yml](../backend/src/main/resources/application.yml)**: cấu hình chung cho mọi môi trường.
- **Profile**: tập cấu hình riêng, bật bằng `spring.profiles.active` hoặc `-Dspring-boot.run.profiles=dev`. File `application-{profile}.yml` **ghi đè** lên file chung:
  - [application-dev.yml](../backend/src/main/resources/application-dev.yml): nạp dữ liệu mẫu, in câu SQL ra log, JWT secret mặc định cho dev.
  - [application-prod.yml](../backend/src/main/resources/application-prod.yml): ẩn chi tiết health, log gọn.
  - [application-test.yml](../backend/src/test/resources/application-test.yml): dùng khi chạy test.
- **Placeholder** `${DB_URL:jdbc:mariadb://localhost:3306/gfmaster}` nghĩa là lấy biến môi trường `DB_URL`, nếu không có thì dùng giá trị sau dấu `:`.

Cấu hình riêng của app (`gfm.*`) được gom vào một record Java có **kiểm tra hợp lệ**: [GfmProperties.java](../backend/src/main/java/com/gfmaster/config/GfmProperties.java).

```java
@Validated
@ConfigurationProperties("gfm")
public record GfmProperties(@Valid @NotNull Jwt jwt, ...) {
  public record Jwt(@NotBlank @Size(min = 32) String secret, ...) {}
}
```

Nếu production quên đặt `JWT_SECRET`, app **từ chối khởi động** ngay, thay vì chạy với secret rỗng. Nguyên tắc này gọi là **fail fast**: phát hiện lỗi cấu hình sớm nhất có thể.

### 2.4. ORM, JPA và Hibernate

Database lưu dữ liệu theo **bảng và dòng**, còn Java làm việc với **đối tượng**. **ORM (Object-Relational Mapping)** là lớp chuyển đổi giữa hai thế giới đó.

- **JPA (Jakarta Persistence API)**: *chuẩn* (bộ interface và annotation) cho ORM trong Java.
- **Hibernate**: *thư viện cài đặt* chuẩn JPA, phổ biến nhất.
- **Spring Data JPA**: tầng trên cùng, chỉ cần khai báo interface là có sẵn các hàm truy vấn.

**Entity** là class ánh xạ vào một bảng:

```java
@Entity @Table(name = "places")
public class Place extends OwnedEntity {
  @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PlaceType type;          // cột type VARCHAR(20)
  private LocalTime openTime;      // cột open_time TIME (tên tự đổi camelCase → snake_case)
  ...
}
```

Dự án có một class cha chung là [BaseEntity.java](../backend/src/main/java/com/gfmaster/common/entity/BaseEntity.java). Mọi entity kế thừa nó để có sẵn:
- `id UUID`: sinh bởi `@UuidGenerator`. Dùng **UUID** thay số tự tăng vì id khó đoán, và có thể sinh ở bất kỳ đâu mà không cần hỏi DB.
- `createdAt`, `updatedAt`: Hibernate tự điền nhờ `@CreationTimestamp` và `@UpdateTimestamp`.
- `version`: dùng cho **optimistic locking** (giải thích ở [Phase 2](03-phase-2-crud-api.md#24-optimistic-locking-và-version)).

[OwnedEntity.java](../backend/src/main/java/com/gfmaster/common/entity/OwnedEntity.java) thêm quan hệ `user` (**ManyToOne**: nhiều quán thuộc một user) cho các bảng có chủ sở hữu.

**Repository** là interface truy vấn. Spring Data **tự sinh câu SQL từ tên hàm**, gọi là *derived query*:

```java
public interface PlaceRepository extends JpaRepository<Place, UUID> {
  List<Place> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
  // → SELECT ... FROM places WHERE user_id = ? ORDER BY created_at DESC
  Optional<Place> findByIdAndUserId(UUID id, UUID userId);
}
```

**Lombok:** annotation `@Getter` và `@Setter` sinh getter/setter lúc biên dịch, đỡ phải viết tay. Lombok là *annotation processor*, tức chương trình chạy trong lúc `javac` biên dịch.

### 2.5. Migration với Flyway

**Vấn đề:** schema database thay đổi theo thời gian (thêm bảng, thêm cột). Làm sao để mọi máy dev, máy test và production đều có **đúng cùng một schema**, và biết DB đang ở phiên bản nào?

**Flyway** giải quyết bằng **migration**: các file SQL đánh số, chạy đúng một lần theo thứ tự:

```
src/main/resources/db/migration/
  V1__init_schema.sql      ← chạy lần đầu
  V2__add_visits.sql       ← thêm sau này
```

- Khi app khởi động, Flyway so danh sách file với bảng `flyway_schema_history` trong DB và chạy các file chưa chạy.
- **Versioned migration** (`V{n}__mo_ta.sql`) **không bao giờ được sửa** sau khi đã chạy. Flyway lưu checksum, nên sửa file sẽ làm app báo lỗi. Muốn đổi schema thì tạo file mới.
- **Repeatable migration** (`R__mo_ta.sql`) chạy lại **mỗi khi nội dung thay đổi**. Dự án dùng loại này cho dữ liệu mẫu: [R__demo_data.sql](../backend/src/main/resources/db/seed/R__demo_data.sql).

Dự án đặt nguyên tắc: **Flyway là nguồn sự thật duy nhất của schema.** Hibernate chỉ được **kiểm tra**, không được tự sửa bảng:

```yaml
spring.jpa.hibernate.ddl-auto: validate   # KHÔNG dùng update/create
```

Với `validate`, entity và bảng lệch nhau thì app không khởi động. Lỗi lộ ra ngay trên máy dev, không đợi tới production.

### 2.6. Kiểu dữ liệu MariaDB được dùng

| Kiểu SQL | Kiểu Java | Ghi chú |
|---|---|---|
| `UUID` | `UUID` | Kiểu native của MariaDB ≥ 10.7, lưu 16 byte |
| `VARCHAR(n)` | `String` | Chuỗi có độ dài tối đa |
| `TEXT` | `String` | Chuỗi dài (ghi chú, kỷ niệm) |
| `TINYINT` | `int` + `@JdbcTypeCode(TINYINT)` | Điểm 1–5 |
| `DECIMAL(9,6)` | `BigDecimal` | Toạ độ, chính xác đến ~0.1 m |
| `DATE` | `LocalDate` | Ngày không có giờ (sinh nhật) |
| `TIME` | `LocalTime` | Giờ không có ngày (giờ mở cửa) |
| `DATETIME(6)` | `Instant` | Thời điểm, chính xác micro-giây, lưu theo UTC |
| `BOOLEAN` | `Boolean` | Thực chất là `TINYINT(1)` |

**Ràng buộc (constraint)** trong [V1__init_schema.sql](../backend/src/main/resources/db/migration/V1__init_schema.sql):
- `PRIMARY KEY`: khoá chính, duy nhất, không null.
- `FOREIGN KEY ... ON DELETE CASCADE`: khoá ngoại. Xoá dòng cha thì DB **tự xoá** các dòng con, ví dụ xoá user thì xoá hết quán của user đó.
- `UNIQUE`: không trùng, ví dụ `uk_users_email`, `uk_link_gf_place`.
- `CHECK`: giá trị phải thoả điều kiện, ví dụ `rating BETWEEN 1 AND 5`.
- `INDEX`: chỉ mục giúp tìm nhanh, ví dụ `ix_places_user_type (user_id, type)`.

### 2.7. Chuẩn lỗi ProblemDetail (RFC 9457)

Mọi lỗi API trả về **cùng một định dạng JSON**, để frontend xử lý thống nhất:

```json
{
  "type": "https://gfmaster.app/errors/version-conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "Dữ liệu đã bị thay đổi ở thiết bị khác.",
  "instance": "/api/v1/places/5f1c...",
  "code": "VERSION_CONFLICT"
}
```

**RFC 9457** là chuẩn Internet cho định dạng này, và Spring có sẵn class `ProblemDetail`. Dự án thêm trường `code` để frontend dịch sang tiếng Việt.

- [ErrorCode.java](../backend/src/main/java/com/gfmaster/common/error/ErrorCode.java): danh sách mã lỗi, kèm HTTP status và câu mặc định.
- [ApiException.java](../backend/src/main/java/com/gfmaster/common/error/ApiException.java): exception nghiệp vụ mang theo `ErrorCode`.
- [GlobalExceptionHandler.java](../backend/src/main/java/com/gfmaster/common/error/GlobalExceptionHandler.java): `@RestControllerAdvice` "bắt" mọi exception ném ra từ controller và chuyển thành ProblemDetail. Ví dụ:
  - `DataIntegrityViolationException` (vi phạm unique) → 409, chọn mã theo tên constraint.
  - `MethodArgumentNotValidException` (validate thất bại) → 400, kèm danh sách field lỗi.

### 2.8. Actuator và OpenAPI/Swagger

- **Spring Boot Actuator**: endpoint vận hành. `/actuator/health` kiểm tra DB, Redis và RabbitMQ còn kết nối được không. Công cụ giám sát (UptimeRobot, Docker healthcheck) sẽ gọi endpoint này.
- **OpenAPI**: chuẩn mô tả REST API bằng JSON/YAML. **springdoc-openapi** đọc các controller rồi tự sinh tài liệu. **Swagger UI** là trang web để đọc và *gọi thử* API: http://localhost:8080/api/docs.

### 2.9. Jackson: chuyển đổi JSON

**Jackson** chuyển đối tượng Java thành JSON và ngược lại. Spring Boot 4 dùng **Jackson 3** (package `tools.jackson.*`, khác package `com.fasterxml.jackson.*` của Jackson 2).

[JacksonConfig.java](../backend/src/main/java/com/gfmaster/config/JacksonConfig.java) cấu hình `LocalTime` thành `"HH:mm"` cho khớp ô chọn giờ ở frontend. Mặc định Jackson ghi `"08:00:00"`, có cả giây.

### 2.10. Kiểm thử với Testcontainers

**Test tích hợp (integration test)** chạy app thật, với database thật. Nó bắt được những lỗi mà unit test với mock không thấy: sai kiểu cột, sai câu SQL, sai ràng buộc.

**Testcontainers** là thư viện tự bật container Docker (MariaDB, Redis, RabbitMQ) khi test chạy, rồi tự tắt khi xong. Mỗi lần test đều có môi trường sạch và giống production.

[TestcontainersConfiguration.java](../backend/src/test/java/com/gfmaster/TestcontainersConfiguration.java):

```java
@Bean @ServiceConnection
MariaDBContainer mariaDbContainer() {
  return new MariaDBContainer(DockerImageName.parse("mariadb:11.4"));
}
```

`@ServiceConnection` tự đưa host, port, user, password của container vào cấu hình Spring, không cần khai báo `spring.datasource.url` cho test.

**Surefire vs Failsafe:** hai plugin Maven chạy test.

| | Surefire | Failsafe |
|---|---|---|
| Chạy file | `*Test.java` | `*IT.java` |
| Phase Maven | `test` | `integration-test`, `verify` |
| Dùng cho | Unit test nhanh | Test tích hợp cần Docker |

Annotation dùng chung [IntegrationTest.java](../backend/src/test/java/com/gfmaster/support/IntegrationTest.java) gom `@SpringBootTest`, `@AutoConfigureMockMvc`, `@ActiveProfiles("test")` và `@Import(TestcontainersConfiguration.class)`.

### 2.11. BCrypt (để tạo user demo)

Mật khẩu **không bao giờ lưu dạng gốc**. Chỉ lưu **hash**: kết quả của một hàm một chiều, không suy ngược lại được.

**BCrypt** là hàm hash dành riêng cho mật khẩu:
- **Chậm có chủ đích**: tham số *cost* 12 ≈ 250 ms mỗi lần, nên kẻ tấn công không thử nhanh hàng tỉ mật khẩu được.
- **Tự thêm salt ngẫu nhiên**: hai người cùng mật khẩu vẫn có hash khác nhau.

Hash có dạng `$2a$12$y0orC.uq...`, trong đó `2a` là phiên bản và `12` là cost.

---

## 3. Các bước thực hiện

### Bước 1: Tạo project

Dùng lệnh ở [§2.2](#22-spring-initializr). Sau đó xoá file mẫu (`HELP.md`, `application.properties`) và dùng YAML cho dễ đọc.

### Bước 2: Viết cấu hình

1. [application.yml](../backend/src/main/resources/application.yml). Các điểm quan trọng:
   - `spring.threads.virtual.enabled: true`: bật **virtual threads** của Java 21. Mỗi request chạy trên một luồng nhẹ, chịu được nhiều request đồng thời mà không cần lập trình bất đồng bộ.
   - `spring.jpa.open-in-view: false`: không giữ kết nối DB mở trong lúc render response. Mọi truy vấn phải nằm trong tầng service, tránh truy vấn "lén" ngoài transaction.
   - `hibernate.ddl-auto: validate` (xem §2.5).
   - `jdbc.time_zone: UTC`: mọi thời điểm lưu theo UTC.
   - `type.java_time_use_direct_jdbc: true`: thêm ở Phase 2, xem [bài học về múi giờ](03-phase-2-crud-api.md#51-cột-time-bị-lệch-8-tiếng).
   - `jackson.deserialization.fail-on-unknown-properties: true`: client gửi field lạ thì báo lỗi, không lặng lẽ bỏ qua.
2. [application-dev.yml](../backend/src/main/resources/application-dev.yml), [application-prod.yml](../backend/src/main/resources/application-prod.yml).
3. [GfmProperties.java](../backend/src/main/java/com/gfmaster/config/GfmProperties.java) và `@ConfigurationPropertiesScan` trong [GfMasterApplication.java](../backend/src/main/java/com/gfmaster/GfMasterApplication.java).

### Bước 3: Viết migration `V1__init_schema.sql`

Tạo 7 bảng: `users`, `places`, `girlfriends`, `girlfriend_hobbies`, `place_links`, `uploads`, `import_jobs`. Thiết kế chi tiết nằm ở [PLAN.md §5](../PLAN.md). Mọi bảng dùng `ENGINE=InnoDB` (hỗ trợ transaction và khoá ngoại) và collation `utf8mb4_uca1400_ai_ci`.

Vài quyết định thiết kế:
- **`hobbies` tách thành bảng riêng** `girlfriend_hobbies (girlfriend_id, position, hobby)`, vì MariaDB không có kiểu mảng. Cột `position` giữ thứ tự.
- **`place_links` không có `user_id`.** Chủ sở hữu suy ra qua `girlfriend.user_id`. Cặp `(girlfriend_id, place_id)` là `UNIQUE`: một người không bị gắn trùng một quán hai lần.
- **`placeType` không lưu trong `place_links`.** Lấy từ `places.type` để không bao giờ lệch.

### Bước 4: Viết entity và repository

Mỗi bảng có một entity và một repository. Riêng `girlfriend_hobbies` là `@ElementCollection` của `Girlfriend`, không phải entity riêng:

```java
@ElementCollection
@CollectionTable(name = "girlfriend_hobbies", joinColumns = @JoinColumn(name = "girlfriend_id"))
@OrderColumn(name = "position")      // giữ thứ tự
@Column(name = "hobby")
private List<String> hobbies = new ArrayList<>();
```

Quan hệ `PlaceLink` → `Place` có `@OnDelete(action = CASCADE)`: báo Hibernate rằng **DB tự xoá** link khi xoá place. Hibernate không cần tải hết link lên rồi xoá từng cái. Plan cố ý **không** map `@OneToMany(cascade = REMOVE)` từ Place sang PlaceLink.

`Upload` và `ImportJob` không kế thừa `BaseEntity` vì bảng của chúng không có `updated_at`/`version`: chỉ ghi thêm, ít khi sửa.

### Bước 5: Dữ liệu mẫu `R__demo_data.sql`

Chuyển dữ liệu từ `frontend/src/app/core/data/seed.ts` sang SQL:
- **Idempotent** (chạy nhiều lần vẫn cùng kết quả): đầu file `DELETE FROM users WHERE email='demo@gfmaster.local'`. Cascade xoá hết dữ liệu con, rồi `INSERT` lại.
- **UUID cố định** (`10000000-...-0001` cho quán, `20000000-...` cho người yêu) để dễ nhận biết và dễ test.
- **Hash BCrypt** của `Demo@12345` được sinh trước bằng Java rồi dán vào.

Seed chỉ bật ở dev:
```yaml
# application-dev.yml
spring.flyway.locations: classpath:db/migration,classpath:db/seed
```

### Bước 6: Xử lý lỗi, Swagger

Viết `ErrorCode`, `ApiException`, `GlobalExceptionHandler` (§2.7) và [OpenApiConfig.java](../backend/src/main/java/com/gfmaster/config/OpenApiConfig.java). Ở Phase 1, `SecurityConfig` tạm mở mọi `/api/**`; Phase 4 mới khoá lại.

### Bước 7: Test tích hợp

- [BootstrapIT.java](../backend/src/test/java/com/gfmaster/BootstrapIT.java): Flyway tạo đủ bảng; health UP cho db/redis/rabbit; Swagger trả JSON; route lạ bị chặn.
- [SchemaMappingIT.java](../backend/src/test/java/com/gfmaster/SchemaMappingIT.java): ghi và đọc entity thật. Kiểm tra UUID, enum, hobbies giữ đúng thứ tự, xoá place thì link mất, user khác không đọc được.

Thêm `maven-failsafe-plugin` vào [pom.xml](../backend/pom.xml) để `verify` chạy file `*IT.java`.

---

## 4. Kiểm tra kết quả

```powershell
# Test (cần Docker đang chạy)
cd D:\GF_Master\backend
.\mvnw.cmd verify           # mong đợi: Tests run: ..., Failures: 0, BUILD SUCCESS

# Chạy app dev
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

Ở terminal khác:
```powershell
Invoke-RestMethod http://localhost:8080/actuator/health | ConvertTo-Json -Depth 3
# status UP, components.db / redis / rabbit đều UP

# Flyway đã chạy những gì, dữ liệu mẫu đủ chưa
docker compose exec -T mariadb mariadb -ugfm -pgfm gfmaster -e "select version, description, success from flyway_schema_history; select count(*) from places;"
# V1 init schema | demo data (R) | 10 quán

# Tìm không dấu hoạt động (nhờ collation ai_ci)
docker compose exec -T mariadb mariadb -ugfm -pgfm gfmaster -e "select name from places where name like '%cong ca phe%';"
# → Cộng Cà Phê
```

Mở http://localhost:8080/api/docs để thấy Swagger UI.

---

## 5. Lỗi đã gặp và bài học

### 5.1. Hibernate validate báo sai kiểu cột

Với `ddl-auto: validate`, Hibernate so kiểu **nó mong đợi** với kiểu **có trong DB**. Mấy chỗ dễ lệch:

| Trường hợp | Hibernate mặc định mong | DB có | Cách sửa |
|---|---|---|---|
| `int rating` | `INTEGER` | `TINYINT` | `@JdbcTypeCode(SqlTypes.TINYINT)` |
| `enum` với MariaDB | kiểu `ENUM(...)` native | `VARCHAR(20)` | `@JdbcTypeCode(SqlTypes.VARCHAR)` |
| `String note` | `VARCHAR(255)` | `TEXT` | `@Column(columnDefinition = "text")` |
| `Instant` | `timestamp_utc` | `DATETIME(6)` | `hibernate.type.preferred_instant_jdbc_type: TIMESTAMP` |

**Bài học:** đừng để Hibernate tự sinh bảng rồi quên. Viết SQL bằng tay (Flyway) và để Hibernate *kiểm tra*, lệch là biết ngay.

### 5.2. Enum viết thường

Frontend dùng giá trị `'cafe'`, `'restaurant'`. Để DB và JSON trùng nhau, không cần chuyển đổi, enum Java được viết thường: `enum PlaceType { cafe, restaurant, bar }`. Cách này trái quy ước đặt tên Java (hằng số thường viết HOA), nhưng đổi lại được sự đơn giản.

### 5.3. File có BOM làm `javac` lỗi

Trên PowerShell 5.1, `Set-Content -Encoding utf8` ghi thêm **BOM** (3 byte `EF BB BF` ở đầu file). `javac` báo `illegal character: '\ufeff'`. Muốn ghi file UTF-8 không BOM, dùng `[IO.File]::WriteAllText(path, text)` hoặc lưu từ VS Code.

---

**Trước:** [Phase 0](01-phase-0-chuan-bi.md) · **Tiếp theo:** [Phase 2: CRUD API](03-phase-2-crud-api.md)
