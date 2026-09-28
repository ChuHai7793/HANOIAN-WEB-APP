# PLAN — Đưa GF Master (Dating Master) thành web thật có Backend

> Lập: 2026-09-26 · Cập nhật: 2026-09-26 (đổi stack sang Java Spring Boot)
> Mục tiêu: chuyển một SPA Angular đang lưu dữ liệu trong `localStorage` thành web app hoàn chỉnh gồm:
> **Angular** + **Spring Boot API** + **MariaDB** + **Redis** + **RabbitMQ** (+ **MongoDB** khi cần) + lưu trữ ảnh + đăng nhập.
> Chạy local bằng một lệnh, deploy được lên Internet.

---

## 0. Hiện trạng (đã khảo sát code)

| Hạng mục | Hiện có |
|---|---|
| Framework | Angular 21 (standalone components, signals, lazy routes), Tailwind CSS v4, Vitest |
| Thư mục | `GF_Master/frontend/`. Chưa có backend, chưa có git |
| Màn hình | `/cafes`, `/bars`, `/restaurants` (dùng chung `PlaceListComponent` + `place.config.ts`), `/girlfriends`, `/girlfriends/:id` |
| Thực thể | `Place` (type: cafe/restaurant/bar), `Girlfriend`, `PlaceLink` (người yêu ↔ quán đã đi, kèm `herRating`, `memory`, `lastVisitedAt`) |
| Lưu dữ liệu | `StorageService` bọc `localStorage`; `CrudStore<T>` (signal) cho mọi service; dữ liệu mẫu trong `core/data/seed.ts` |
| Ảnh | Nén thành data URL base64 (`core/utils/image.ts`) rồi lưu thẳng vào localStorage, dễ **hết quota** (đã có banner `quotaExceeded`) |
| Bản đồ | Parse toạ độ từ link Google Maps ở client (`gmap-url.ts`). Link rút gọn `maps.app.goo.gl` **không giải được** vì CORS; comment trong code đã ghi "phải có backend gọi hộ" |
| Xoá liên quan | Client tự xoá link trước (`removeByPlace`, `removeByGirlfriend`) rồi mới xoá thực thể |
| Ảnh tĩnh | `frontend/assets/img/{bar,caffe,food}` **chưa được khai báo** trong `angular.json` (chỉ có `public/`) |

**Những hạn chế mà backend sẽ giải quyết**
1. Dữ liệu chỉ nằm trên một trình duyệt: xoá cache là mất, không đồng bộ giữa các thiết bị.
2. Ảnh base64 làm phình localStorage (giới hạn khoảng 5MB).
3. Không có đăng nhập, dữ liệu nhạy cảm (tên, SĐT, ngày sinh) không được bảo vệ.
4. Không giải được link Google Maps rút gọn.
5. Không có validate phía server, không có ràng buộc toàn vẹn, không xử lý sửa đồng thời từ nhiều thiết bị.

---

## 1. Mục tiêu & phạm vi

### 1.1. MVP (bắt buộc để gọi là "web thật")
- [ ] Spring Boot REST API đầy đủ CRUD cho `Place`, `Girlfriend`, `PlaceLink`.
- [ ] MariaDB, quản lý schema bằng **Flyway**, truy cập bằng **Spring Data JPA / Hibernate**.
- [ ] Đăng ký / đăng nhập (email + mật khẩu, JWT). Mỗi user chỉ thấy dữ liệu của mình.
- [ ] Xử lý đồng thời: optimistic locking, idempotency, rate limit, distributed lock (Redis).
- [ ] Xử lý bất đồng bộ qua **RabbitMQ**: sinh thumbnail ảnh, import dữ liệu, dọn ảnh mồ côi.
- [ ] Upload ảnh lên server (lưu file thật, không còn base64 trong DB).
- [ ] API giải link Google Maps rút gọn thành toạ độ (có cache Redis).
- [ ] Frontend chuyển từ localStorage sang gọi API, giữ nguyên UI/UX.
- [ ] Import dữ liệu cũ từ localStorage lên server.
- [ ] Hạ tầng local chạy bằng `docker compose up`.
- [ ] Deploy production có HTTPS + domain.

### 1.2. Để sau (phase mở rộng)
- **MongoDB**: nhật ký hoạt động (activity log), timeline kỷ niệm (xem mục 5.6).
- Bảng `Visit` (nhiều lần đi quán) thay cho `lastVisitedAt`; gợi ý lịch hẹn phía server.
- Nhắc sinh nhật / kỷ niệm qua email (Scheduler, RabbitMQ, mail worker).
- Tìm kiếm, lọc, phân trang phía server.
- Đăng nhập Google (OAuth2), quên mật khẩu.
- PWA / offline.

### 1.3. Ngoài phạm vi
- App mobile native, đa ngôn ngữ, thanh toán, microservices (giữ **1 service Spring Boot duy nhất**; consumer RabbitMQ chạy cùng process).

---

## 2. Công nghệ sử dụng

### 2.1. Tổng quan

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Frontend | **Angular 21** + Tailwind v4 (giữ nguyên) | SPA |
| Ngôn ngữ backend | **Java 21 LTS** | Bật virtual threads (`spring.threads.virtual.enabled=true`) |
| Framework | **Spring Boot 4.1.x** (Spring 7, Hibernate 7, Jackson 3). *Ban đầu dự định 3.5, nhưng 3.5 đã hết hỗ trợ OSS và Initializr không còn cung cấp* | Web, DI, cấu hình |
| Build | **Maven** (kèm `mvnw`) | |
| ORM | **Spring Data JPA + Hibernate** | Entity, repository, optimistic locking `@Version` |
| Migration | **Flyway** (`flyway-core` + `flyway-mysql`, module này hỗ trợ MariaDB) | Toàn bộ DDL nằm trong file SQL có version; Hibernate chỉ `validate` |
| CSDL chính | **MariaDB 11.4 LTS** | Dữ liệu quan hệ: user, place, girlfriend, link, upload, import job |
| CSDL phụ | **MongoDB 8** (chỉ khi cần) | Activity log / timeline, dữ liệu dạng document, ghi nhiều |
| Cache / lock / rate limit | **Redis 7** (Spring Data Redis + Lettuce, **Redisson**, **Bucket4j**) | Refresh token, cache, idempotency key, distributed lock, rate limit, ShedLock |
| Message broker | **RabbitMQ 4** (Spring AMQP) | Xử lý nền: thumbnail ảnh, import, dọn dẹp, sự kiện domain, email |
| Security | **Spring Security 6** + `spring-boot-starter-oauth2-resource-server` (JWT HS256, Nimbus) | Stateless auth |
| Hash mật khẩu | `BCryptPasswordEncoder(12)` | |
| Validation | Jakarta Bean Validation (`spring-boot-starter-validation`) | DTO dạng `record` |
| Mapping | **MapStruct** (+ Lombok cho entity) | Entity ↔ DTO |
| Xử lý ảnh | **Scrimage** (`scrimage-core` + `scrimage-webp`) | Resize, xoay theo EXIF, xuất WebP |
| Lưu ảnh | Dev: thư mục `uploads/` · Prod: S3-compatible (**Cloudflare R2 / MinIO**) qua AWS SDK v2 | Interface `StorageDriver` |
| API docs | **springdoc-openapi** tại `/api/docs` | Swagger UI |
| Lỗi | `ProblemDetail` (RFC 9457) + `@RestControllerAdvice` | |
| Observability | Spring Boot **Actuator** (health: db, redis, rabbit), Micrometer, log JSON (`logstash-logback-encoder`) | |
| Test | JUnit 5, Mockito, AssertJ, **Testcontainers** (MariaDB, Redis, RabbitMQ, Mongo), RestAssured/MockMvc, Awaitility | |
| Reverse proxy | **Caddy** (tự cấp HTTPS) | |
| Container | Docker, Docker Compose | |
| CI | GitHub Actions | |

### 2.2. Nguyên tắc dùng công nghệ
- **Flyway là nguồn sự thật duy nhất của schema.** `spring.jpa.hibernate.ddl-auto=validate`, không bao giờ dùng `update` hay `create`.
- `spring.jpa.open-in-view=false`. Transaction nằm ở tầng service.
- **Redis và RabbitMQ chỉ dùng ở chỗ có việc thật** (xem mục 7). Mỗi tính năng đều có công tắc cấu hình (`gfm.messaging.enabled`, `gfm.cache.enabled`) để test đơn giản hơn.
- **MongoDB không có trong MVP.** Chỉ bật (Spring profile `mongo`) khi làm activity log hoặc timeline.

---

## 3. Kiến trúc tổng thể

```
 Trình duyệt (Angular SPA)
        │ HTTPS (cùng domain: / và /api)
        ▼
┌──────────────────── Caddy (TLS, reverse proxy) ─────────────────────┐
│  /           → file tĩnh Angular                                    │
│  /api/*      → backend:8080                                         │
│  /uploads/*  → backend:8080 (dev) | CDN R2 (prod)                   │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────── Spring Boot app (backend:8080) ────────────────┐
│  Web layer    : Controllers, Security filter chain (JWT),      │
│                 RateLimitFilter (Bucket4j/Redis),              │
│                 IdempotencyFilter (Redis)                      │
│  Service layer: @Transactional, ownership check, @Version      │
│  Data layer   : Spring Data JPA ──► MariaDB (Flyway)           │
│                 Spring Data Mongo ─► MongoDB (tuỳ chọn)        │
│  Cache/lock   : Spring Cache, Redisson, ShedLock ──► Redis     │
│  Messaging    : EventPublisher (AFTER_COMMIT) ──► RabbitMQ     │
│                 @RabbitListener consumers ◄── RabbitMQ         │
│  Storage      : StorageDriver ──► uploads/ | R2                │
└────────────────────────────────────────────────────────────────┘
      │             │              │              │
      ▼             ▼              ▼              ▼
   MariaDB        Redis        RabbitMQ     MongoDB (tuỳ chọn)
```

**Luồng ghi điển hình (tạo quán có ảnh):**
1. `POST /api/v1/uploads/image`: server nén ảnh chính (đồng bộ, dưới 1s), lưu storage, ghi bảng `uploads` (status `READY`), rồi publish `image.uploaded`.
2. Consumer `image.variants` sinh thumbnail 320px ở nền.
3. `POST /api/v1/places` (header `Idempotency-Key`): lưu vào MariaDB trong transaction. Sau commit, publish `place.created`, evict cache `stats`.
4. (Tuỳ chọn) consumer `activity.log` ghi document vào MongoDB.

**Nguyên tắc**
- Frontend và API **cùng origin** ở production, nên cookie refresh token đơn giản và không cần lo CORS.
- Dev: Angular dùng `proxy.conf.json` chuyển `/api` và `/uploads` sang `localhost:8080`.
- Mọi truy vấn đều lọc theo `userId` lấy từ JWT, không tin `userId` do client gửi.
- Event chỉ được publish **sau khi transaction commit** (`@TransactionalEventListener(phase = AFTER_COMMIT)`) để không gửi sự kiện cho dữ liệu đã rollback.

---

## 4. Cấu trúc thư mục đích

```
GF_Master/
├─ PLAN.md
├─ README.md
├─ .gitignore
├─ .env.example
├─ docker-compose.yml            # dev: mariadb, redis, rabbitmq, adminer, (mongo - profile)
├─ docker-compose.prod.yml       # prod: caddy, backend, mariadb, redis, rabbitmq, (mongo)
├─ Caddyfile
├─ .github/workflows/ci.yml
├─ frontend/                     # Angular (đã có)
│  ├─ proxy.conf.json            # MỚI
│  ├─ Dockerfile                 # MỚI (build → copy dist vào image Caddy)
│  └─ src/
│     ├─ environments/           # MỚI
│     └─ app/
│        ├─ core/
│        │  ├─ api/              # MỚI: interceptors (auth, idempotency, error)
│        │  ├─ auth/             # MỚI: auth.service, auth.guard
│        │  └─ services/         # SỬA: CrudStore gọi HTTP
│        └─ features/auth/       # MỚI: login, register
└─ backend/                      # MỚI
   ├─ pom.xml
   ├─ mvnw, mvnw.cmd, .mvn/
   ├─ Dockerfile
   └─ src/
      ├─ main/
      │  ├─ java/com/gfmaster/
      │  │  ├─ GfMasterApplication.java
      │  │  ├─ config/
      │  │  │  ├─ SecurityConfig.java        # filter chain, CORS, JWT decoder/encoder
      │  │  │  ├─ JacksonConfig.java         # LocalDate "yyyy-MM-dd", LocalTime "HH:mm"
      │  │  │  ├─ RedisConfig.java           # RedisTemplate, CacheManager, Redisson
      │  │  │  ├─ RabbitConfig.java          # exchange, queue, binding, DLQ, converter JSON
      │  │  │  ├─ OpenApiConfig.java
      │  │  │  ├─ SchedulingConfig.java      # ShedLock (Redis)
      │  │  │  └─ GfmProperties.java         # @ConfigurationProperties("gfm")
      │  │  ├─ common/
      │  │  │  ├─ entity/BaseEntity.java     # id UUID, createdAt, updatedAt, version
      │  │  │  ├─ entity/OwnedEntity.java    # + user (ManyToOne)
      │  │  │  ├─ error/GlobalExceptionHandler.java, ErrorCode.java, ApiException.java
      │  │  │  ├─ security/CurrentUser.java  # @AuthenticationPrincipal wrapper
      │  │  │  ├─ web/IdempotencyFilter.java
      │  │  │  └─ web/RateLimitFilter.java
      │  │  ├─ auth/        AuthController, AuthService, JwtService, RefreshTokenStore (Redis), dto/
      │  │  ├─ user/        User, UserRepository, UserService
      │  │  ├─ place/       Place, PlaceType, PriceRange, PlaceRepository, PlaceService,
      │  │  │               PlaceController, dto/(PlaceRequest, PlacePatch, PlaceResponse), PlaceMapper
      │  │  ├─ girlfriend/  Girlfriend, RelationshipStatus, ... (cùng khuôn)
      │  │  ├─ placelink/   PlaceLink, ... (cùng khuôn)
      │  │  ├─ upload/      Upload, UploadController, UploadService, ImageProcessor,
      │  │  │               storage/(StorageDriver, LocalStorageDriver, S3StorageDriver),
      │  │  │               ImageVariantConsumer, OrphanUploadCleanupJob
      │  │  ├─ maps/        MapsController, GmapUrlParser, ShortLinkResolver
      │  │  ├─ importer/    ImportController, ImportService, ImportJob, ImportJobRepository, ImportConsumer
      │  │  ├─ stats/       StatsController, StatsService (@Cacheable)
      │  │  ├─ messaging/   Events (record), DomainEventPublisher, RabbitEventRelay (AFTER_COMMIT),
      │  │  │               ProcessedMessageGuard (Redis, consumer idempotent)
      │  │  └─ activity/    (profile mongo) ActivityLog @Document, ActivityLogRepository, ActivityConsumer, ActivityController
      │  └─ resources/
      │     ├─ application.yml
      │     ├─ application-dev.yml
      │     ├─ application-prod.yml
      │     ├─ db/migration/          # Flyway versioned: V1__init_schema.sql, V2__...
      │     ├─ db/seed/               # Flyway repeatable, chỉ bật ở dev: R__demo_data.sql
      │     └─ seed-assets/           # ảnh mẫu (chuyển từ frontend/assets/img)
      └─ test/java/com/gfmaster/
         ├─ support/IntegrationTest.java   # Testcontainers @ServiceConnection
         ├─ place/PlaceControllerIT.java
         ├─ concurrency/OptimisticLockIT.java, IdempotencyIT.java, LinkRaceIT.java
         └─ ...
```

---

## 5. Thiết kế dữ liệu

### 5.1. Ánh xạ từ model frontend

| Frontend (`core/models`) | MariaDB / JPA | Ghi chú |
|---|---|---|
| `id: string` | `id UUID` (kiểu `UUID` native của MariaDB ≥ 10.7) ↔ `java.util.UUID`, sinh bởi Hibernate `@UuidGenerator` | Frontend vẫn coi là string. Id seed cũ (`place_cafe_1`…) được map sang UUID cố định |
| `createdAt/updatedAt` | `DATETIME(6)` ↔ `Instant`, `@CreationTimestamp/@UpdateTimestamp` | Server quản lý |
| — | `version BIGINT` ↔ `@Version Long` | **Optimistic locking**, trả về cho client |
| `birthday`, `startedDate`, `lastVisitedAt` | `DATE` ↔ `LocalDate` | JSON `yyyy-MM-dd` |
| `openTime/closeTime` | `TIME` ↔ `LocalTime` | JSON `HH:mm` (`@JsonFormat(pattern="HH:mm")`) |
| `hobbies: string[]` | Bảng `girlfriend_hobbies` ↔ `@ElementCollection @OrderColumn` | MariaDB không có kiểu mảng |
| `type`, `priceRange`, `status` | `VARCHAR(20)` ↔ `@Enumerated(EnumType.STRING)` + `CHECK` | Giá trị giữ nguyên chữ thường (`cafe`, `dating`…) để tương thích frontend |
| `lat/lng` | `DECIMAL(9,6)` ↔ `BigDecimal` (hoặc `Double`) | |
| `imageUrl/avatarUrl` | `VARCHAR(1024)`, chỉ chứa URL | **Cấm** data URL |
| `PlaceLink.placeType` | Không lưu, lấy từ `place.type` | Response vẫn trả `placeType` |
| — | `user_id` trên `places`, `girlfriends`, `uploads` | Chủ sở hữu |

**Charset/collation:** `utf8mb4` + `utf8mb4_uca1400_ai_ci` (MariaDB 11). Collation này **không phân biệt dấu và hoa thường**, nên `LIKE '%ca phe%'` khớp "Cà Phê". Rất hợp cho tìm kiếm tiếng Việt.

### 5.2. Flyway: `V1__init_schema.sql`

```sql
-- V1__init_schema.sql
CREATE TABLE users (
  id            UUID         NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(80)  NOT NULL,
  created_at    DATETIME(6)  NOT NULL,
  updated_at    DATETIME(6)  NOT NULL,
  version       BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE places (
  id              UUID          NOT NULL PRIMARY KEY,
  user_id         UUID          NOT NULL,
  type            VARCHAR(20)   NOT NULL,
  name            VARCHAR(120)  NOT NULL,
  address         VARCHAR(255)  NOT NULL DEFAULT '',
  price_range     VARCHAR(20)   NOT NULL,
  rating          TINYINT       NOT NULL,
  open_time       TIME          NOT NULL,
  close_time      TIME          NOT NULL,
  image_url       VARCHAR(1024) NOT NULL DEFAULT '',
  note            TEXT          NOT NULL DEFAULT '',
  google_maps_url VARCHAR(2048) NOT NULL DEFAULT '',
  lat             DECIMAL(9,6)  NULL,
  lng             DECIMAL(9,6)  NULL,
  has_wifi        BOOLEAN       NULL,
  has_parking     BOOLEAN       NULL,
  cuisine         VARCHAR(50)   NULL,
  created_at      DATETIME(6)   NOT NULL,
  updated_at      DATETIME(6)   NOT NULL,
  version         BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_places_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_places_type   CHECK (type IN ('cafe','restaurant','bar')),
  CONSTRAINT ck_places_price  CHECK (price_range IN ('cheap','medium','high','luxury')),
  CONSTRAINT ck_places_rating CHECK (rating BETWEEN 1 AND 5),
  INDEX ix_places_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE girlfriends (
  id           UUID          NOT NULL PRIMARY KEY,
  user_id      UUID          NOT NULL,
  name         VARCHAR(80)   NOT NULL,
  nickname     VARCHAR(80)   NOT NULL DEFAULT '',
  avatar_url   VARCHAR(1024) NOT NULL DEFAULT '',
  birthday     DATE          NULL,
  phone        VARCHAR(20)   NOT NULL DEFAULT '',
  status       VARCHAR(20)   NOT NULL DEFAULT 'dating',
  started_date DATE          NULL,
  note         TEXT          NOT NULL DEFAULT '',
  created_at   DATETIME(6)   NOT NULL,
  updated_at   DATETIME(6)   NOT NULL,
  version      BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_gf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_gf_status CHECK (status IN ('dating','crush','ex','married')),
  INDEX ix_gf_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE girlfriend_hobbies (
  girlfriend_id UUID        NOT NULL,
  position      INT         NOT NULL,
  hobby         VARCHAR(50) NOT NULL,
  PRIMARY KEY (girlfriend_id, position),
  CONSTRAINT fk_hobby_gf FOREIGN KEY (girlfriend_id) REFERENCES girlfriends(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE place_links (
  id              UUID        NOT NULL PRIMARY KEY,
  girlfriend_id   UUID        NOT NULL,
  place_id        UUID        NOT NULL,
  her_rating      TINYINT     NOT NULL,
  last_visited_at DATE        NULL,
  memory          TEXT        NOT NULL DEFAULT '',
  created_at      DATETIME(6) NOT NULL,
  updated_at      DATETIME(6) NOT NULL,
  version         BIGINT      NOT NULL DEFAULT 0,
  CONSTRAINT fk_link_gf    FOREIGN KEY (girlfriend_id) REFERENCES girlfriends(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_place FOREIGN KEY (place_id)      REFERENCES places(id)      ON DELETE CASCADE,
  CONSTRAINT uk_link_gf_place UNIQUE (girlfriend_id, place_id),
  CONSTRAINT ck_link_rating CHECK (her_rating BETWEEN 1 AND 5),
  INDEX ix_link_place (place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE uploads (
  id           UUID          NOT NULL PRIMARY KEY,
  user_id      UUID          NOT NULL,
  storage_key  VARCHAR(255)  NOT NULL,
  url          VARCHAR(1024) NOT NULL,
  thumb_url    VARCHAR(1024) NULL,
  mime_type    VARCHAR(50)   NOT NULL,
  size_bytes   INT           NOT NULL,
  width        INT           NOT NULL,
  height       INT           NOT NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'READY',  -- READY | THUMB_PENDING | FAILED
  created_at   DATETIME(6)   NOT NULL,
  CONSTRAINT fk_upload_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uk_upload_key UNIQUE (storage_key),
  INDEX ix_upload_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE import_jobs (
  id          UUID        NOT NULL PRIMARY KEY,
  user_id     UUID        NOT NULL,
  status      VARCHAR(20) NOT NULL,          -- QUEUED | RUNNING | DONE | FAILED
  payload_key VARCHAR(255) NOT NULL,         -- file JSON gốc trong storage
  stats       JSON        NULL,              -- {"places":12,"girlfriends":3,...}
  error       TEXT        NULL,
  created_at  DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  CONSTRAINT fk_import_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_import_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
```

### 5.3. Quy ước Flyway
- Tên file: `V{n}__mo_ta_ngan.sql` (versioned, **không bao giờ sửa file đã chạy**; muốn đổi thì tạo file mới), `R__*.sql` (repeatable).
- `db/migration` chạy ở mọi môi trường. `db/seed/R__demo_data.sql` **chỉ bật ở profile `dev`**:
  ```yaml
  # application-dev.yml
  spring.flyway.locations: classpath:db/migration,classpath:db/seed
  ```
  Script seed phải idempotent: `DELETE FROM users WHERE email='demo@gfmaster.local'` (cascade) rồi `INSERT` lại, dùng UUID cố định. Nội dung port từ `frontend/src/app/core/data/seed.ts`.
- Password hash BCrypt của user demo sinh trước và dán vào script.
- `spring.flyway.validate-on-migrate=true`, `baseline-on-migrate=false`.
- Chạy migration: tự động khi app khởi động; thủ công bằng `./mvnw flyway:info | flyway:migrate` (plugin cấu hình qua biến môi trường).

### 5.4. Entity JPA (mẫu)

```java
@MappedSuperclass
@Getter @Setter
public abstract class BaseEntity {
  @Id @UuidGenerator
  private UUID id;

  @CreationTimestamp @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp @Column(nullable = false)
  private Instant updatedAt;

  @Version
  private Long version;
}

@Entity @Table(name = "places")
@Getter @Setter
public class Place extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private User user;

  @Enumerated(EnumType.STRING) private PlaceType type;      // enum cafe, restaurant, bar (chữ thường)
  private String name;
  private String address;
  @Enumerated(EnumType.STRING) private PriceRange priceRange;
  private int rating;
  private LocalTime openTime;
  private LocalTime closeTime;
  private String imageUrl;
  private String note;
  private String googleMapsUrl;
  private BigDecimal lat;
  private BigDecimal lng;
  private Boolean hasWifi;
  private Boolean hasParking;
  private String cuisine;
}

@Entity @Table(name = "place_links")
public class PlaceLink extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "girlfriend_id")
  @OnDelete(action = OnDeleteAction.CASCADE)      // để DB tự cascade, Hibernate không load để xoá
  private Girlfriend girlfriend;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "place_id")
  @OnDelete(action = OnDeleteAction.CASCADE)
  private Place place;

  private int herRating;
  private LocalDate lastVisitedAt;
  private String memory;
}

@Entity @Table(name = "girlfriends")
public class Girlfriend extends BaseEntity {
  // ...
  @ElementCollection
  @CollectionTable(name = "girlfriend_hobbies", joinColumns = @JoinColumn(name = "girlfriend_id"))
  @OrderColumn(name = "position")
  @Column(name = "hobby")
  private List<String> hobbies = new ArrayList<>();
}
```

**Lưu ý Hibernate**
- Không map `@OneToMany(cascade = REMOVE)` từ Place sang PlaceLink. Việc xoá liên kết để DB lo (`ON DELETE CASCADE`), tránh N+1 khi xoá.
- Enum dùng tên chữ thường (`cafe`, `restaurant`, `bar`…) để giá trị trong DB và JSON trùng với frontend.
- Tránh N+1: `@EntityGraph(attributePaths = "place")` cho `findByGirlfriendIdAndGirlfriendUserId(...)`; `placeCount` lấy bằng query projection `select g.id, count(l) ... group by g.id`.
- `spring.jpa.properties.hibernate.jdbc.batch_size=50` cho import.

### 5.5. Repository (mẫu, luôn kèm `userId`)

```java
public interface PlaceRepository extends JpaRepository<Place, UUID> {
  List<Place> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
  List<Place> findAllByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, PlaceType type);
  Optional<Place> findByIdAndUserId(UUID id, UUID userId);
  long deleteByIdAndUserId(UUID id, UUID userId);

  @Query("select p.type as type, count(p) as total from Place p where p.user.id = :userId group by p.type")
  List<TypeCount> countByType(UUID userId);
}
```

### 5.6. MongoDB: khi nào mới cần?

MVP **không dùng**. Bật khi làm một trong các tính năng sau, vì dữ liệu có dạng document, ghi nhiều, schema linh hoạt:

| Collection | Nội dung | Lý do chọn Mongo |
|---|---|---|
| `activity_logs` | `{ userId, action: "PLACE_CREATED", entityType, entityId, snapshot, diff, at }` | Ghi liên tục (append-only), đọc theo timeline, không cần join. Dùng TTL index để tự xoá sau 180 ngày |
| `memories` (phase mở rộng) | Kỷ niệm của một buổi hẹn: nhiều ảnh, cảm xúc, tag, nhiều trường tuỳ biến | Cấu trúc lồng nhau, thay đổi thường xuyên |
| `import_payloads` | JSON gốc từ localStorage (thay vì lưu file) | Lưu nguyên khối, tiện debug |

Luồng: service publish event lên RabbitMQ, `ActivityConsumer` ghi vào Mongo. Mongo gặp sự cố thì không ảnh hưởng luồng chính.
Cấu hình: Spring profile `mongo`, `@ConditionalOnProperty("gfm.mongo.enabled")`; docker compose dùng `profiles: ["mongo"]`.

---

## 6. Thiết kế API

Base URL `/api/v1`, JSON `camelCase`. Mọi endpoint (trừ `auth/*`, `actuator/health`) yêu cầu `Authorization: Bearer <accessToken>`.

**Quy ước chung**
- Response của mọi entity có `id`, `version`, `createdAt`, `updatedAt`.
- `PATCH` **bắt buộc gửi `version`** (hoặc header `If-Match: "<version>"`). Nếu lệch, trả `409 VERSION_CONFLICT` kèm bản mới nhất.
- `POST` tạo mới nên có header `Idempotency-Key: <uuid>` (frontend tự sinh). Gửi lại cùng key trong 24h thì trả lại đúng response cũ, không tạo bản ghi trùng.

### 6.1. Auth

| Method | Path | Body | Trả về |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName }` | `201 { accessToken, user }` + cookie `rt` |
| POST | `/auth/login` | `{ email, password }` | `200 { accessToken, user }` + cookie `rt` |
| POST | `/auth/refresh` | (cookie `rt`) | `200 { accessToken }` + **xoay vòng** cookie `rt` |
| POST | `/auth/logout` | (cookie `rt`) | `204`, xoá token trong Redis, xoá cookie |
| POST | `/auth/logout-all` | — | `204`, thu hồi mọi phiên |
| GET | `/auth/me` | — | `{ id, email, displayName }` |

- Access token JWT HS256, TTL 15 phút, claim `sub=userId`, `email`.
- Refresh token: chuỗi ngẫu nhiên 256-bit. **Lưu trong Redis**: `rt:{sha256(token)} → {userId, family, ua}` với TTL 30 ngày; set `user:{id}:rt` để thu hồi hàng loạt. Bật AOF cho Redis để không mất phiên khi restart.
- Phát hiện dùng lại token đã bị xoay (reuse detection): thu hồi toàn bộ "family" đó.
- Cookie: `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000`.
- Rate limit: login/register 5 lần/phút/IP (Bucket4j + Redis).

### 6.2. Places

| Method | Path | Mô tả |
|---|---|---|
| GET | `/places?type=cafe` | Danh sách của user (MVP: frontend lấy hết rồi lọc/sắp xếp ở client như hiện tại) |
| GET | `/places?type=&q=&priceRange=&sort=&page=&size=` | *(phase mở rộng)* lọc và phân trang phía server |
| GET | `/places/{id}` | Chi tiết + danh sách người yêu đã đi cùng (cho `place-detail`) |
| POST | `/places` | Tạo (`Idempotency-Key`) |
| PATCH | `/places/{id}` | Sửa một phần, **kèm `version`** |
| DELETE | `/places/{id}` | Xoá (DB cascade link), trả `204` |

`PlaceRequest` (record + Bean Validation):
```java
public record PlaceRequest(
  @NotNull PlaceType type,
  @NotBlank @Size(max = 120) String name,
  @Size(max = 255) String address,
  @NotNull PriceRange priceRange,
  @Min(1) @Max(5) int rating,
  @NotNull @JsonFormat(pattern = "HH:mm") LocalTime openTime,
  @NotNull @JsonFormat(pattern = "HH:mm") LocalTime closeTime,
  @Size(max = 1024) @Pattern(regexp = "^(https?://|/uploads/).*|^$") String imageUrl,  // chặn data:
  @Size(max = 2000) String note,
  @Size(max = 2048) String googleMapsUrl,
  @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
  @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
  Boolean hasWifi, Boolean hasParking,
  @Size(max = 50) String cuisine
) {}
```
Server: có `googleMapsUrl` mà thiếu `lat/lng` thì chạy `GmapUrlParser` (port từ `gmap-url.ts`). `type = restaurant` thì bỏ `hasWifi/hasParking`; `type != restaurant` thì bỏ `cuisine`.

### 6.3. Girlfriends

| Method | Path | Mô tả |
|---|---|---|
| GET | `/girlfriends` | Danh sách kèm `placeCount` (thay `countFor()`) |
| GET | `/girlfriends/{id}` | Chi tiết |
| POST | `/girlfriends` | Tạo |
| PATCH | `/girlfriends/{id}` | Sửa (kèm `version`) |
| DELETE | `/girlfriends/{id}` | Xoá (cascade link) |
| GET | `/girlfriends/{id}/links?type=cafe` | Các quán đã gắn, **join sẵn `place`**, sort `herRating desc` (thay `linkedOf()`) |
| GET | `/girlfriends/{id}/suggestion` | *(phase mở rộng)* gợi ý Ăn tối → Cafe → Bar |

### 6.4. Place links

| Method | Path | Body |
|---|---|---|
| GET | `/place-links?girlfriendId=` | — |
| POST | `/place-links` | `{ girlfriendId, placeId, herRating, lastVisitedAt, memory }` |
| PATCH | `/place-links/{id}` | `{ herRating?, lastVisitedAt?, memory?, version }` |
| DELETE | `/place-links/{id}` | — |

- Service kiểm tra `girlfriend.user` và `place.user` đều là user hiện tại (chống gắn chéo dữ liệu người khác).
- Trùng cặp (girlfriend, place): unique constraint bắn `DataIntegrityViolationException`, trả `409 LINK_ALREADY_EXISTS`.
- Response luôn có `placeType` (từ `place.type`).

### 6.5. Uploads, Maps, Import, Stats

| Method | Path | Mô tả |
|---|---|---|
| POST | `/uploads/image` | `multipart/form-data`, field `file`, tối đa 12MB (`spring.servlet.multipart.max-file-size=12MB`). Chỉ nhận JPEG/PNG/WebP (kiểm tra magic bytes). **Đồng bộ:** xoay EXIF, resize cạnh dài 1200px, WebP q≈0.78, bỏ metadata. Trả `201 { id, url, width, height, sizeBytes, status }`. **Bất đồng bộ:** publish `image.uploaded`, consumer sinh thumbnail 320px, cập nhật `thumb_url` |
| DELETE | `/uploads/{id}` | Xoá ảnh của chính mình (xoá file qua event `upload.deleted`) |
| GET | `/maps/resolve?url=` | Giải link `maps.app.goo.gl` / `goo.gl/maps`: `HttpClient` với redirect thủ công (tối đa 5 lần), **whitelist host Google**, chỉ `https`, timeout 5s, rồi `GmapUrlParser`. Kết quả cache Redis 7 ngày (`@Cacheable("gmap-resolve")`). Trả `{ lat, lng, resolvedUrl }` |
| POST | `/import/local-storage` | Body `{ places, girlfriends, placeLinks }` (tối đa 20MB). Lưu payload vào storage, tạo `import_jobs` (QUEUED), publish `import.requested`, trả **`202 { jobId }`** |
| GET | `/import/jobs/{id}` | `{ status, stats, error }`, frontend poll 1s/lần |
| GET | `/stats` | `{ cafes, bars, restaurants, girlfriends }` cho badge sidebar. Cache Redis, evict khi có thay đổi |
| POST | `/demo/reset` | *(chỉ profile dev)* xoá dữ liệu user và nạp lại bộ mẫu |
| GET | `/actuator/health` | Public: `{status}`; chi tiết (db/redis/rabbit) chỉ trong mạng nội bộ |

### 6.6. Chuẩn lỗi (ProblemDetail, RFC 9457)

```json
{
  "type": "https://gfmaster.app/errors/version-conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "Dữ liệu đã bị thay đổi ở thiết bị khác.",
  "instance": "/api/v1/places/5f1c...",
  "code": "VERSION_CONFLICT",
  "current": { "...bản mới nhất..." },
  "traceId": "4bf92f35..."
}
```

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_FAILED` (+ `errors: [{field, message}]`) | `MethodArgumentNotValidException` |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | Thiếu / hết hạn token |
| 404 | `NOT_FOUND` | Không có, **hoặc không thuộc về user** (không trả 403 để không lộ sự tồn tại) |
| 409 | `VERSION_CONFLICT` | `ObjectOptimisticLockingFailureException` |
| 409 | `LINK_ALREADY_EXISTS`, `EMAIL_TAKEN` | `DataIntegrityViolationException` (phân biệt theo tên constraint) |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Cùng key đang được xử lý |
| 413 | `FILE_TOO_LARGE` | `MaxUploadSizeExceededException` |
| 423 | `IMPORT_RUNNING` | Đang có import khác của user này (Redisson lock) |
| 429 | `RATE_LIMITED` (+ header `Retry-After`) | Bucket4j |

Frontend có interceptor dịch `code` sang thông báo tiếng Việt.

---

## 7. Xử lý đồng thời (Concurrency): Redis + RabbitMQ + JPA

### 7.1. Các tình huống cần xử lý

| # | Tình huống | Giải pháp | Công nghệ |
|---|---|---|---|
| 1 | Sửa cùng một quán ở 2 thiết bị, bản sau đè bản trước (lost update) | **Optimistic locking** `@Version`; client gửi `version`, lệch thì 409 kèm bản mới | JPA / Hibernate |
| 2 | Bấm "Lưu" 2 lần hoặc mạng chập chờn tự retry, tạo 2 bản ghi trùng | **Idempotency-Key** | Redis |
| 3 | 2 request gắn cùng quán cho cùng người yêu cùng lúc | **Unique constraint** trong DB, trả 409 | MariaDB |
| 4 | Import chạy 2 lần song song cho cùng user | **Distributed lock** `lock:import:{userId}` | Redis (Redisson) |
| 5 | Xử lý ảnh / import nặng làm chậm request | Đẩy việc nặng vào **queue**, trả 202 | RabbitMQ |
| 6 | Job định kỳ chạy trùng khi scale ra nhiều instance | **ShedLock** | Redis |
| 7 | Consumer nhận lại cùng một message (at-least-once) | **Consumer idempotent** (ghi `messageId` đã xử lý) | Redis |
| 8 | Brute-force login / spam API | **Rate limit** token bucket dùng chung giữa các instance | Redis (Bucket4j) |
| 9 | Event gửi đi nhưng transaction rollback | Publish **AFTER_COMMIT**; nâng cấp lên Outbox khi cần | Spring + RabbitMQ |
| 10 | Giới hạn tải cho các endpoint gọi ra ngoài (maps resolve) | Cache kết quả + rate limit riêng 20 req/phút/user | Redis |

### 7.2. Optimistic locking (chi tiết)
- Mọi entity kế thừa `BaseEntity` có `@Version Long version`.
- Service `update`:
  ```java
  @Transactional
  public PlaceResponse update(UUID userId, UUID id, PlacePatch patch) {
    Place place = repo.findByIdAndUserId(id, userId).orElseThrow(NotFound::new);
    if (!Objects.equals(place.getVersion(), patch.version())) {
      throw new VersionConflictException(mapper.toResponse(place));
    }
    mapper.apply(patch, place);           // Hibernate tăng version khi flush
    return mapper.toResponse(repo.saveAndFlush(place));
  }
  ```
  Race giữa hai transaction cùng qua bước kiểm tra thì Hibernate vẫn ném `ObjectOptimisticLockingFailureException` lúc flush (`UPDATE ... WHERE id=? AND version=?`), handler cũng trả 409.
- Frontend nhận 409: hiện dialog "Dữ liệu đã được sửa ở thiết bị khác. Tải bản mới / Ghi đè". Ghi đè nghĩa là gửi lại với `version` mới.

### 7.3. Idempotency-Key (Redis)
- `IdempotencyFilter` áp dụng cho `POST` có header `Idempotency-Key`:
  1. `SET idem:{userId}:{key} "IN_PROGRESS" NX EX 86400`
  2. Không set được: đọc giá trị. Nếu `IN_PROGRESS` thì trả 409; nếu là response đã lưu thì trả lại nguyên (status + body).
  3. Set được: cho request đi tiếp, xong thì ghi `{status, body}` vào key. Lỗi 5xx thì xoá key để client retry được.
- Frontend: `idempotencyInterceptor` tự gắn `crypto.randomUUID()` cho mỗi lần submit form (giữ nguyên key khi retry).

### 7.4. Redis: danh sách key

| Key | Kiểu | TTL | Mục đích |
|---|---|---|---|
| `rt:{hash}` | Hash | 30 ngày | Refresh token |
| `user:{id}:rt` | Set | 30 ngày | Thu hồi mọi phiên |
| `idem:{userId}:{key}` | String (JSON) | 24h | Idempotency |
| `rl:{scope}:{ip\|userId}` | Bucket4j state | tự quản | Rate limit |
| `lock:import:{userId}` | Redisson lock | lease 10 phút | Chặn import song song |
| `cache:stats::{userId}` | String | 10 phút | Badge sidebar |
| `cache:gmap-resolve::{url}` | String | 7 ngày | Kết quả giải link Maps |
| `msg:done:{messageId}` | String | 7 ngày | Consumer idempotent |
| `shedlock:{jobName}` | String | theo job | ShedLock |

Cấu hình Redis: `appendonly yes`, `maxmemory 256mb`, `maxmemory-policy volatile-lru` (chỉ đẩy ra những key có TTL).

### 7.5. RabbitMQ: topology

```
Exchange: gfm.events (topic, durable)
│
├─ routing key image.uploaded      → queue gfm.image.variants      (consumer: ImageVariantConsumer)
├─ routing key upload.deleted      → queue gfm.storage.cleanup     (consumer: StorageCleanupConsumer)
├─ routing key import.requested    → queue gfm.import              (consumer: ImportConsumer, concurrency=1..2)
├─ routing key *.created|updated|deleted
│                                  → queue gfm.activity            (consumer: ActivityConsumer → MongoDB, chỉ khi bật mongo)
├─ routing key place.*|girlfriend.*|link.*
│                                  → queue gfm.cache.evict         (evict cache stats)
└─ routing key reminder.*          → queue gfm.mail                (phase mở rộng: gửi email)

Exchange: gfm.dlx (direct) → mỗi queue có <queue>.dlq tương ứng
```

**Cấu hình consumer**
- `acknowledge-mode: auto` + retry của Spring AMQP: 3 lần, backoff 1s → 2s → 4s, sau đó `RejectAndDontRequeueRecoverer` đẩy vào DLQ.
- `prefetch: 10` (import: `prefetch: 1`).
- Message dạng JSON (`Jackson2JsonMessageConverter`), có `messageId` (UUID) + header `x-user-id`.
- Consumer idempotent: `SET msg:done:{messageId} 1 NX EX 604800`. Không set được tức là đã xử lý, bỏ qua.
- Publisher confirms + mandatory returns bật để phát hiện message không tới được queue.

**Publish sau commit**
```java
// Service
eventPublisher.publishEvent(new PlaceCreated(userId, place.getId()));

// Relay
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void relay(DomainEvent e) {
  rabbitTemplate.convertAndSend("gfm.events", e.routingKey(), e, msg -> {
    msg.getMessageProperties().setMessageId(UUID.randomUUID().toString());
    return msg;
  });
}
```
> Rủi ro: app crash giữa commit và publish thì mất event. Với MVP chấp nhận được (thumbnail, cache, log đều tự phục hồi hoặc không quan trọng). Nếu cần đảm bảo tuyệt đối thì nâng cấp **Transactional Outbox**: bảng `outbox_events` được ghi trong cùng transaction, một job (ShedLock) đọc và publish.

### 7.6. Luồng import bất đồng bộ
1. `POST /import/local-storage`: validate kích thước, `tryLock("lock:import:{userId}", 0s)`. Không lấy được lock thì trả 423.
2. Lưu payload JSON vào storage, tạo `import_jobs(QUEUED)`, publish `import.requested`, trả `202 {jobId}`.
3. `ImportConsumer`: đặt status `RUNNING`, trong **một transaction** tạo girlfriends, places (map id cũ → UUID mới), placeLinks; ảnh `data:` được decode, qua `ImageProcessor`, lưu storage, tạo `uploads`. Xong thì `DONE` + `stats`, lỗi thì `FAILED` + `error` (transaction rollback). Cuối cùng unlock.
4. Frontend poll `GET /import/jobs/{id}` cho tới `DONE/FAILED`.

### 7.7. Job định kỳ (ShedLock + Redis)
- `OrphanUploadCleanupJob` (03:00 hằng ngày): tìm `uploads` tạo cách đây quá 7 ngày mà URL không còn được `places.image_url` / `girlfriends.avatar_url` tham chiếu, rồi publish `upload.deleted`.
- `ImportJobCleanup`: xoá payload import đã `DONE` quá 3 ngày.
- *(Mở rộng)* `BirthdayReminderJob` (08:00): tìm sinh nhật trong 3 ngày tới, publish `reminder.birthday`.

---

## 8. Bảo mật (checklist)

- [ ] `SecurityFilterChain`: stateless, tắt CSRF cho `/api/**` (dùng Bearer). Riêng `/auth/refresh` và `/auth/logout` dùng cookie `SameSite=Strict` và kiểm tra header `Origin`.
- [ ] Mọi truy vấn qua `findByIdAndUserId` / `deleteByIdAndUserId` → không IDOR. Viết test cho từng controller: user B nhận 404.
- [ ] DTO chỉ chứa field cho phép (record), không bind trực tiếp vào entity. Jackson `FAIL_ON_UNKNOWN_PROPERTIES=true` cho request.
- [ ] CORS chỉ cho `http://localhost:4200` ở dev; prod cùng origin.
- [ ] Header bảo mật: Spring Security mặc định + CSP/HSTS ở Caddy.
- [ ] Rate limit toàn cục 100 req/phút/user, auth 5 req/phút/IP, maps 20 req/phút/user.
- [ ] Upload: kiểm tra magic bytes, tên file do server sinh (`{userId}/{yyyy}/{MM}/{uuid}.webp`), không phục vụ file ngoài thư mục upload.
- [ ] `/maps/resolve`: whitelist host (`maps.app.goo.gl`, `goo.gl`, `www.google.com`, `maps.google.com`, `google.com`), chặn IP private (chống SSRF).
- [ ] Actuator: public chỉ `health` (không chi tiết); endpoint khác chỉ trong mạng nội bộ.
- [ ] RabbitMQ management (15672), Redis, MariaDB, Mongo **không mở ra Internet**.
- [ ] Secret qua biến môi trường; app không khởi động nếu thiếu (`@Validated @ConfigurationProperties`).
- [ ] Log không ghi mật khẩu, token, số điện thoại.
- [ ] Backup DB hằng ngày (mục 13.3).

---

## 9. Thay đổi phía Frontend (Angular)

Mục tiêu: **giữ nguyên API công khai của các service** (`items()`, `cafes()`, `byId()`, `create()`, `update()`, `remove()`…) để component phải sửa ít nhất.

### 9.1. Hạ tầng
1. `app.config.ts`: `provideHttpClient(withFetch(), withInterceptors([authInterceptor, idempotencyInterceptor, errorInterceptor]))`.
2. `src/environments/*`: `apiBaseUrl: '/api/v1'`.
3. `proxy.conf.json`:
   ```json
   {
     "/api":     { "target": "http://localhost:8080", "secure": false },
     "/uploads": { "target": "http://localhost:8080", "secure": false }
   }
   ```
   `angular.json` → `serve.options.proxyConfig: "proxy.conf.json"`.
4. `authInterceptor`: gắn `Authorization`. Gặp 401 `TOKEN_EXPIRED` thì gọi `/auth/refresh` (dùng chung một Promise khi nhiều request cùng lỗi) rồi thử lại. Refresh thất bại thì chuyển `/login`.
5. `idempotencyInterceptor`: gắn `Idempotency-Key` cho POST (lấy từ `HttpContext` nếu form đã sinh sẵn để retry giữ nguyên key).
6. `errorInterceptor`: map `code` sang câu tiếng Việt và đẩy ra `ToastService` (component toast mới trong `shared/ui/`).

### 9.2. Auth
- `core/auth/auth.service.ts`: signal `user`, access token **giữ trong bộ nhớ** (không lưu localStorage); `login()`, `register()`, `logout()`, `restoreSession()` gọi qua `provideAppInitializer`.
- `core/auth/auth.guard.ts` (`canMatch`) cho route Shell.
- `features/auth/login.page.ts`, `register.page.ts`, style Tailwind giống form hiện có.
- `app.routes.ts`: thêm `/login`, `/register` ngoài Shell.
- `ShellComponent`: menu user + Đăng xuất; bỏ banner `quotaExceeded`.

### 9.3. Viết lại `CrudStore<T>`
```ts
export interface Entity { id: string; version?: number; }

export abstract class CrudStore<T extends Entity> {
  protected readonly http = inject(HttpClient);
  private readonly state = signal<T[]>([]);
  readonly items = this.state.asReadonly();
  readonly loading = signal(false);
  readonly loaded = signal(false);

  protected constructor(private readonly endpoint: string) {}

  async load(): Promise<void>                        // GET /{endpoint}
  byId(id: string): T | undefined                    // như cũ
  async create(data: Omit<T, 'id'|'version'|'createdAt'|'updatedAt'>): Promise<T>
  async update(id: string, changes: Partial<T>): Promise<void>
      // optimistic: cập nhật state ngay, PATCH kèm version hiện tại;
      // 409 VERSION_CONFLICT → thay bằng bản `current` từ server + báo người dùng;
      // lỗi khác → rollback + toast
  async remove(id: string): Promise<void>            // optimistic + rollback
  dropLocal(predicate: (item: T) => boolean): void   // chỉ xoá trong state (server đã cascade)
}
```
- `PlaceService`, `GirlfriendService`, `PlaceLinkService` chỉ đổi constructor; các `computed` (`cafes`, `bars`, `restaurants`, `forGirlfriend`, `linkedPlaceIds`…) **giữ nguyên**.
- `removeByGirlfriend/removeByPlace` đổi thành `dropLocal(...)`.
- `DataBootstrapService.loadAll()` chạy sau khi đăng nhập (dữ liệu nhỏ, tải hết 3 bảng một lần để giữ nguyên logic lọc/sắp xếp client).
- Thêm `version: number` vào 3 interface model.
- Xoá `StorageService` và `seed.ts` khỏi frontend (seed đã chuyển sang Flyway).

### 9.4. Component cần sửa

| File | Thay đổi |
|---|---|
| `features/places/place-list.component.ts` | `handleSave` / `confirmDelete` thành async, thêm trạng thái `saving`; lỗi thì giữ form; `removeByPlace` đổi thành `dropLocal` |
| `features/places/place-form.component.ts` | Dán link rút gọn thì gọi `/maps/resolve`, điền `lat/lng`, hiện spinner |
| `features/places/place-detail.component.ts` | Không đổi logic |
| `features/girlfriends/girlfriend-list.page.ts` | Async create/update/remove; bỏ gọi API `removeByGirlfriend` |
| `features/girlfriends/girlfriend-detail.page.ts` | `saveProfile`, `saveLink`, `confirmUnlink` thành async; xử lý 409 (gắn trùng / xung đột version) |
| `features/girlfriends/link-place-dialog.component.ts` | Không đổi |
| `shared/ui/image-picker.component.ts` | Vẫn nén ở client (tiết kiệm băng thông) rồi `POST /uploads/image` bằng `FormData`, có progress (`reportProgress`), emit URL server trả về |
| `layout/shell.component.ts` | Badge vẫn dùng `computed` từ store; thêm menu user |
| `core/utils/image.ts` | Thêm `dataUrlToBlob()` |
| **MỚI** `shared/ui/conflict-dialog.component.ts` | Dialog xung đột version |

### 9.5. Import dữ liệu localStorage cũ
- Sau lần đăng nhập đầu: có key `gfm.places | gfm.girlfriends | gfm.placeLinks` khác seed mặc định thì hỏi "Tải dữ liệu cũ lên tài khoản?".
- Đồng ý: `POST /import/local-storage` → nhận `jobId` → poll → `DONE` thì đổi tên key thành `gfm.*.imported` (không xoá hẳn) → `loadAll()`.

### 9.6. Ảnh tĩnh
- Ảnh trong `frontend/assets/img` chuyển sang `backend/src/main/resources/seed-assets/`. Seed dev copy chúng vào storage và gán `image_url`. Nếu muốn frontend phục vụ trực tiếp thì chuyển vào `frontend/public/img/` (vì `assets/` chưa được cấu hình trong `angular.json`).

---

## 10. Cấu hình backend

### 10.1. Dependencies chính (`pom.xml`)
```
spring-boot-starter-web
spring-boot-starter-validation
spring-boot-starter-data-jpa
spring-boot-starter-security
spring-boot-starter-oauth2-resource-server
spring-boot-starter-data-redis
spring-boot-starter-amqp
spring-boot-starter-cache
spring-boot-starter-actuator
spring-boot-starter-data-mongodb          (optional, profile mongo)
org.flywaydb:flyway-core
org.flywaydb:flyway-mysql                  (hỗ trợ MariaDB)
org.mariadb.jdbc:mariadb-java-client
org.redisson:redisson-spring-boot-starter
com.bucket4j:bucket4j_jdk17-lettuce         (rate limit phân tán)
net.javacrumbs.shedlock:shedlock-spring + shedlock-provider-redis-spring
org.springdoc:springdoc-openapi-starter-webmvc-ui
org.mapstruct:mapstruct (+ processor), org.projectlombok:lombok
com.sksamuel.scrimage:scrimage-core + scrimage-webp
software.amazon.awssdk:s3                  (R2/MinIO)
net.logstash.logback:logstash-logback-encoder
-- test --
spring-boot-starter-test, spring-security-test, spring-boot-testcontainers,
org.testcontainers:mariadb, rabbitmq, mongodb, (redis qua GenericContainer / testcontainers-redis),
io.rest-assured:rest-assured, org.awaitility:awaitility
```

### 10.2. `application.yml` (rút gọn)
```yaml
spring:
  application.name: gf-master
  threads.virtual.enabled: true
  datasource:
    url: ${DB_URL:jdbc:mariadb://localhost:3306/gfmaster}
    username: ${DB_USER:gfm}
    password: ${DB_PASSWORD:gfm}
    hikari.maximum-pool-size: 10
  jpa:
    open-in-view: false
    hibernate.ddl-auto: validate
    properties.hibernate:
      jdbc.batch_size: 50
      order_inserts: true
      jdbc.time_zone: UTC
  flyway:
    enabled: true
    locations: classpath:db/migration
  data.redis:
    host: ${REDIS_HOST:localhost}
    port: 6379
    password: ${REDIS_PASSWORD:}
  rabbitmq:
    host: ${RABBIT_HOST:localhost}
    username: ${RABBIT_USER:gfm}
    password: ${RABBIT_PASSWORD:gfm}
    publisher-confirm-type: correlated
    publisher-returns: true
    listener.simple:
      prefetch: 10
      retry: { enabled: true, max-attempts: 3, initial-interval: 1s, multiplier: 2 }
      default-requeue-rejected: false
  cache.type: redis
  servlet.multipart: { max-file-size: 12MB, max-request-size: 13MB }
  jackson:
    default-property-inclusion: non_null
    deserialization.fail-on-unknown-properties: true

server:
  port: 8080
  forward-headers-strategy: framework

management:
  endpoints.web.exposure.include: health,info,prometheus
  endpoint.health.probes.enabled: true

gfm:
  jwt:
    secret: ${JWT_SECRET}           # >= 32 bytes, bắt buộc
    access-ttl: 15m
    refresh-ttl: 30d
  cors-origins: ${CORS_ORIGINS:http://localhost:4200}
  storage:
    driver: ${STORAGE_DRIVER:local} # local | s3
    local-dir: ${UPLOAD_DIR:./uploads}
    public-base-url: ${PUBLIC_UPLOAD_BASE_URL:/uploads}
    s3: { endpoint: ${S3_ENDPOINT:}, bucket: ${S3_BUCKET:}, access-key: ${S3_ACCESS_KEY:}, secret-key: ${S3_SECRET_KEY:} }
  messaging.enabled: true
  mongo.enabled: false
```

### 10.3. Biến môi trường (`.env.example`)
```dotenv
SPRING_PROFILES_ACTIVE=dev
DB_URL=jdbc:mariadb://localhost:3306/gfmaster
DB_USER=gfm
DB_PASSWORD=gfm
MARIADB_ROOT_PASSWORD=root
REDIS_HOST=localhost
REDIS_PASSWORD=
RABBIT_HOST=localhost
RABBIT_USER=gfm
RABBIT_PASSWORD=gfm
MONGO_URI=mongodb://localhost:27017/gfmaster
JWT_SECRET=change-me-please-at-least-32-bytes-long-xxxx
CORS_ORIGINS=http://localhost:4200
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
PUBLIC_UPLOAD_BASE_URL=/uploads
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

---

## 11. Môi trường phát triển

### 11.1. `docker-compose.yml` (dev, chỉ hạ tầng)
```yaml
services:
  mariadb:
    image: mariadb:11.4
    environment:
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD:-root}
      MARIADB_DATABASE: gfmaster
      MARIADB_USER: gfm
      MARIADB_PASSWORD: gfm
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_uca1400_ai_ci"]
    ports: ["3306:3306"]
    volumes: [mariadb:/var/lib/mysql]
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "volatile-lru"]
    ports: ["6379:6379"]
    volumes: [redis:/data]

  rabbitmq:
    image: rabbitmq:4-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: gfm
      RABBITMQ_DEFAULT_PASS: gfm
    ports: ["5672:5672", "15672:15672"]   # UI: http://localhost:15672
    volumes: [rabbitmq:/var/lib/rabbitmq]

  adminer:                                  # xem DB: http://localhost:8081
    image: adminer
    ports: ["8081:8080"]

  mongo:                                    # chỉ chạy khi: docker compose --profile mongo up
    image: mongo:8
    profiles: ["mongo"]
    ports: ["27017:27017"]
    volumes: [mongo:/data/db]

volumes: { mariadb: {}, redis: {}, rabbitmq: {}, mongo: {} }
```

### 11.2. Chạy local
```bash
# 1. Hạ tầng
docker compose up -d
# 2. Backend (Flyway tự migrate + seed demo ở profile dev)
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # http://localhost:8080/api/docs
# 3. Frontend
cd ../frontend && npm start                              # http://localhost:4200
# Đăng nhập demo: demo@gfmaster.local / Demo@12345
```
Có thể dùng `spring-boot-docker-compose` để Spring tự bật `docker-compose.yml` khi chạy app ở dev.

---

## 12. Kiểm thử

| Loại | Công cụ | Nội dung tối thiểu |
|---|---|---|
| Unit | JUnit 5 + Mockito | `GmapUrlParser` (các dạng `@lat,lng`, `!3d!4d`, `?q=`, toạ độ thô, input hỏng), `JwtService`, `RefreshTokenStore` (xoay vòng, reuse detection), mapper |
| Repository | `@DataJpaTest` + Testcontainers MariaDB | Flyway chạy sạch từ đầu; unique `(girlfriend_id, place_id)`; cascade khi xoá place/girlfriend; `@ElementCollection` hobbies giữ thứ tự |
| Integration API | `@SpringBootTest` + Testcontainers (MariaDB, Redis, RabbitMQ) + RestAssured | register → login → CRUD place/girlfriend/link; user B nhận 404 với dữ liệu user A; validate lỗi 400; upload hợp lệ/không hợp lệ; refresh/logout |
| **Concurrency** | `ExecutorService` + `CountDownLatch` | (1) 2 luồng PATCH cùng `version` → đúng 1 thành công, 1 nhận 409. (2) 10 luồng POST cùng `Idempotency-Key` → chỉ 1 bản ghi. (3) 2 luồng gắn cùng link → 1 bản 201, 1 bản 409. (4) 2 import song song → 1 bản 202, 1 bản 423 |
| Messaging | Testcontainers RabbitMQ + Awaitility | Upload xong thì thumbnail được sinh; consumer ném lỗi 3 lần thì message vào DLQ; gửi trùng `messageId` chỉ xử lý 1 lần; import `DONE` |
| Mongo (khi bật) | Testcontainers MongoDB | Event ghi được `activity_logs` |
| Frontend unit | Vitest | `CrudStore` + `HttpTestingController`: optimistic update, rollback, 409 conflict; `authInterceptor` chỉ refresh 1 lần |
| E2E | Playwright | Đăng nhập → thêm quán có ảnh → thêm người yêu → gắn quán → gợi ý lịch hẹn → reload vẫn còn → trình duyệt khác thấy cùng dữ liệu → sửa đồng thời 2 tab hiện dialog xung đột |

Mục tiêu coverage service ≥ 70% (JaCoCo). CI chạy được Testcontainers trên GitHub Actions (có sẵn Docker).

---

## 13. Deploy production

### 13.1. Phương án khuyến nghị: 1 VPS (≥ 2 vCPU / **4GB RAM**, Ubuntu 24.04)
Stack có JVM + MariaDB + Redis + RabbitMQ (+ Mongo) nên 2GB RAM là không đủ.

| Container | Giới hạn RAM gợi ý |
|---|---|
| backend (JVM, `-XX:MaxRAMPercentage=75`) | 768MB |
| mariadb (`innodb_buffer_pool_size=256M`) | 512MB |
| rabbitmq | 400MB |
| redis | 300MB |
| mongo (nếu bật, `--wiredTigerCacheSizeGB 0.25`) | 512MB |
| caddy | 64MB |

`docker-compose.prod.yml`: như dev nhưng **không publish port** của DB/Redis/Rabbit/Mongo, thêm `backend` và `caddy`, `restart: unless-stopped`, secret lấy từ `.env` trên server.

`backend/Dockerfile`:
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./mvnw -B -DskipTests package && java -Djarmode=tools -jar target/*.jar extract --layers --destination extracted

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build /app/extracted/dependencies/ ./
COPY --from=build /app/extracted/spring-boot-loader/ ./
COPY --from=build /app/extracted/snapshot-dependencies/ ./
COPY --from=build /app/extracted/application/ ./
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

`Caddyfile`:
```
gfmaster.example.com {
  encode zstd gzip
  header Strict-Transport-Security "max-age=31536000"
  handle /api/*     { reverse_proxy backend:8080 }
  handle /uploads/* { reverse_proxy backend:8080 }
  handle {
    root * /srv/www
    try_files {path} /index.html
    file_server
  }
}
```

### 13.2. Phương án managed (ít vận hành, tốn phí hơn)
- Frontend: Cloudflare Pages / Vercel (rewrite `/api/*` sang backend).
- Backend: Render / Railway / Fly.io (Docker image).
- MariaDB: SkySQL / Aiven for MySQL · Redis: Upstash / Redis Cloud · RabbitMQ: CloudAMQP · Mongo: Atlas (free tier).
- Khác domain thì cookie cần `SameSite=None; Secure` + CORS `allowCredentials`. Nên dùng rewrite để cùng domain.

### 13.3. Vận hành
- **Backup:** `mariadb-dump --single-transaction` hằng ngày, nén, đẩy lên R2, giữ 14 bản. Mongo dùng `mongodump`. RabbitMQ export definitions (`rabbitmqctl export_definitions`) sau mỗi lần đổi topology. Thử restore 1 lần/tháng.
- **Monitoring:** UptimeRobot ping `/actuator/health`; (tuỳ chọn) Prometheus + Grafana đọc `/actuator/prometheus`; cảnh báo khi DLQ có message (`rabbitmq_queue_messages{queue=~".*dlq"} > 0`).
- **Log:** JSON stdout, xem bằng `docker compose logs`; mỗi request có `traceId` (Micrometer Tracing) trả về trong ProblemDetail.
- **CI/CD (GitHub Actions):**
  - `backend`: `./mvnw verify` (unit + Testcontainers IT) → build image → push GHCR.
  - `frontend`: `npm ci && npm run build && npm test`.
  - Deploy: push `main` → SSH vào VPS `docker compose pull && docker compose up -d` (Flyway tự migrate khi app khởi động).

---

## 14. Lộ trình triển khai (theo phase, có tiêu chí hoàn thành)

> Ước lượng cho 1 người làm bán thời gian. Mỗi phase kết thúc phải chạy được.

### Phase 0: Chuẩn bị (0.5 ngày) ✅
- [x] `git init` ở `GF_Master/`, `.gitignore` gốc (node_modules, dist, .angular, target, .env, uploads).
- [x] Commit trạng thái frontend hiện tại làm mốc. *(Chưa tạo repo GitHub, cần người dùng tự tạo.)*
- [x] `docker-compose.yml` hạ tầng (mục 11.1).
- **Xong khi:** `docker compose up -d` chạy xanh; vào được Adminer và RabbitMQ UI.

### Phase 1: Khung Spring Boot + Flyway (1 ngày) ✅
- [x] Tạo project bằng Spring Initializr (Java 21, Maven, package `com.gfmaster`, **Spring Boot 4.1.1**). Các thư viện Redisson/Bucket4j/ShedLock/MapStruct/Scrimage/S3 sẽ thêm ở phase dùng tới.
- [x] `application*.yml`, `GfmProperties`, `JacksonConfig`, `OpenApiConfig`, `GlobalExceptionHandler` (ProblemDetail).
- [x] `V1__init_schema.sql`, `BaseEntity`, entity + repository cho 6 bảng; `ddl-auto=validate` chạy qua.
- [x] `R__demo_data.sql` (profile dev).
- [x] `BootstrapIT`, `SchemaMappingIT` (Testcontainers) xanh với `./mvnw verify`.
- *Ghi chú:* `SecurityConfig` tạm thời `permitAll` cho `/api/**` đến Phase 4.
- **Xong khi:** app khởi động, Flyway tạo bảng, `/actuator/health` báo `db`, `redis`, `rabbit` đều UP; `/api/docs` hiện Swagger.

### Phase 2: CRUD với JPA (2–3 ngày) ✅
- [x] DTO record + MapStruct cho Place, Girlfriend, PlaceLink.
- [x] Service + Controller (tạm dùng user demo cố định qua header giả ở profile dev).
- [x] `placeCount`, `/girlfriends/{id}/links` với `@EntityGraph`, `/stats`.
- [x] Map `DataIntegrityViolationException` sang 409 theo tên constraint.
- [x] Integration test CRUD + cascade (26 test, gồm IDOR, validate, 409).
- **Xong khi:** mọi thao tác chạy qua Swagger; xoá place thì link mất; không có N+1 (kiểm tra bằng log SQL: mỗi endpoint danh sách 1–2 câu SQL).

**Quyết định trong Phase 2**
- User hiện tại: `@CurrentUser UUID` đọc header `X-Debug-User` (chỉ khi `gfm.debug-user-header=true`, bật ở dev/test; thiếu header thì dùng user demo). Phase 4 thay bằng JWT.
- PATCH nhận JSON thô (`PatchReader`) để phân biệt "không gửi" và "gửi null": field tuỳ chọn (`lat`, `lng`, `hasWifi`, `hasParking`, `cuisine`, `birthday`, `startedDate`, `lastVisitedAt`) gửi `null` thì xoá; field bắt buộc gửi `null` thì bỏ qua. Phần áp PATCH viết tay (MapStruct `@Condition` + `@SourcePropertyName` lỗi khi nguồn là record); MapStruct chỉ dùng cho `toEntity`/`toResponse`.
- Kiểm tra `version` và trả 409 `VERSION_CONFLICT` kèm `current` đã làm luôn ở Phase 2 (Phase 5 còn Idempotency + dialog + test đồng thời).
- Request bỏ qua các field chỉ đọc mà client gửi kèm (`id`, `createdAt`, `updatedAt`, `placeType`, `placeCount`); field lạ khác vẫn bị từ chối (400).
- `GET /places/{id}` chỉ trả quán; danh sách người yêu đã đi cùng lấy qua `GET /place-links?placeId=`.
- `GET /girlfriends/{id}/links` trả `[{ link, place }]`, sắp xếp `herRating` giảm dần rồi `lastVisitedAt` mới nhất.
- `hibernate.type.java_time_use_direct_jdbc=true`: nếu không, `jdbc.time_zone=UTC` làm cột TIME lệch theo múi giờ JVM (08:00 thành 16:00 trên máy UTC+7). Có test hồi quy.

### Phase 3: Nối frontend với API + upload ảnh đồng bộ (2.5 ngày) ✅
> **Điều chỉnh so với bản đầu:** phần upload ảnh *đồng bộ* được kéo từ Phase 6 lên đây. Lý do: từ Phase 2 server đã chặn ảnh base64 (`data:`), nếu chờ tới Phase 6 thì chức năng chọn ảnh sẽ hỏng suốt Phase 3–5, trái với tiêu chí "mọi màn hình hoạt động như cũ". Phần *bất đồng bộ* (thumbnail qua RabbitMQ, dọn ảnh mồ côi) vẫn ở Phase 6.

Backend
- [x] `StorageDriver` + `LocalStorageDriver` (chặn path traversal), phục vụ `/uploads/**` bằng ResourceHandler, cache 1 năm (tên file là UUID).
- [x] `ImageProcessor` (Scrimage): kiểm tra magic bytes JPEG/PNG/WebP, xoay EXIF, cạnh dài ≤ 1200px (không phóng to), WebP q78, bỏ metadata.
- [x] `POST /api/v1/uploads/image` (201, lưu bảng `uploads` status `READY`), `DELETE /api/v1/uploads/{id}` (chỉ chủ sở hữu); mã lỗi `UNSUPPORTED_IMAGE` (415).
- [x] `UploadControllerIT` (resize, không upscale, chặn file giả đuôi ảnh, xoá chỉ chủ sở hữu, chặn traversal).

Frontend
- [x] `provideHttpClient(withFetch(), withInterceptors([errorInterceptor]))`, `proxy.conf.json` (`/api`, `/uploads` → 8080). Không dùng `environments/`: dev và prod đều cùng origin nên hằng `API_BASE = '/api/v1'` là đủ.
- [x] Viết lại `CrudStore` (optimistic update/remove + rollback; 409 `VERSION_CONFLICT` thay bằng `current`; 404 khi xoá coi như thành công), `DataBootstrapService` (chạy trong `provideAppInitializer`, không bao giờ reject; banner "Thử lại" khi lỗi), thêm `version` vào model.
- [x] Service chuẩn hoá ngày: server `null` ↔ giao diện `''` (`birthday`, `startedDate`, `lastVisitedAt`).
- [x] Component: `handleSave`/`confirmDelete`/`saveProfile`/`saveLink`/`confirmUnlink` thành async, có cờ `saving`, lỗi thì giữ form; `removeByPlace/removeByGirlfriend` đổi thành `dropByPlace/dropByGirlfriend` (chỉ xoá state, server đã cascade).
- [x] `ToastService` + `ToastHostComponent`, `errorInterceptor` dịch `code` sang tiếng Việt.
- [x] `image-picker`: nén ở client thành Blob (≤1200px) → upload có % tiến trình → nhận URL `/uploads/...`.
- [x] Xoá `StorageService`, `seed.ts`, banner `quotaExceeded`.
- [x] Unit test Vitest `crud-store.spec.ts` (8 test).
- **Xong khi:** mọi màn hình hoạt động như cũ, dữ liệu còn sau reload và trên trình duyệt khác; chọn ảnh upload lên server.
- *Đã kiểm chứng ở mức HTTP qua proxy dev (4200 → 8080): danh sách, upload, tải ảnh, tạo quán có ảnh, chặn data URL. Chưa có test E2E trên trình duyệt thật (Playwright ở Phase 9).*

### Phase 4: Spring Security + JWT + Redis (2–3 ngày) ✅
- [x] `SecurityConfig`, `JwtConfig` + `JwtService` (NimbusJwtEncoder/Decoder HS256, kiểm tra issuer, claim `jti` để mỗi token là duy nhất), `AuthController`.
- [x] `RefreshTokenStore` trên Redis: chỉ lưu SHA-256 của token; xoay vòng; đánh dấu `used` bằng Lua script nguyên tử; dùng lại token đã xoay thì thu hồi cả family; logout (thu hồi family hiện tại), logout-all.
- [x] Bucket4j rate limit (Lettuce, dùng lại RedisClient của Spring): login/register 5/phút/IP, API 100/phút/user; 429 `RATE_LIMITED` + `Retry-After`.
- [x] Gắn `userId` từ JWT (`@CurrentUser` đọc `sub`); bỏ header tạm `X-Debug-User`; test IDOR giữ nguyên, nay chạy bằng JWT thật.
- [x] 401/403 của Spring Security trả ProblemDetail (`UNAUTHORIZED`, `TOKEN_EXPIRED`, `FORBIDDEN`); mã mới `INVALID_CREDENTIALS`.
- [x] Frontend: `AuthService` (access token chỉ trong bộ nhớ), `authInterceptor` (401 → refresh một lần dùng chung cho mọi request → gửi lại; thất bại → `/login?returnUrl=`), `authGuard`/`guestGuard` (`canMatch`), trang Login/Register, menu người dùng + Đăng xuất / Đăng xuất mọi thiết bị, `restoreSession` trong `provideAppInitializer`.
- [x] Test: `AuthControllerIT` (13 test), `auth.interceptor.spec.ts` (4 test). Tổng backend 44, frontend 12.
- **Xong khi:** chưa đăng nhập thì bị chuyển `/login`; F5 vẫn giữ phiên; login sai 6 lần/phút thì 429; user B không đọc được dữ liệu user A.

**Quyết định trong Phase 4**
- `/auth/refresh` trả cả `user` (không chỉ `accessToken`) để F5 không cần gọi thêm `/auth/me`.
- Origin lạ gọi `/auth/refresh`/`/auth/logout` bị CORS filter chặn 403 trước; kiểm tra Origin trong controller là lớp thứ hai.
- `GET /uploads/**` công khai vì `<img>` không gửi được Bearer; tên file là UUID khó đoán. Nếu cần riêng tư tuyệt đối thì chuyển sang URL ký (signed URL) ở Phase 10.
- Dev: cookie `rt` không đặt `Secure` (`gfm.auth.cookie-secure=false`) vì chạy http; prod bắt buộc `Secure`.
- Hạn chế đã biết: hai tab cùng refresh đúng một lúc có thể bị coi là dùng lại token và bị đăng xuất. Nếu gặp thực tế thì thêm khoảng ân hạn vài giây cho token vừa xoay.

### Phase 5: Concurrency (2 ngày) ✅
- [x] `@Version` + kiểm tra `version` trong PATCH; handler 409 kèm `current` *(đã có từ Phase 2)*.
- [x] `IdempotencyFilter` (Redis) + `idempotencyInterceptor` ở frontend.
- [x] `ConflictDialogComponent` ở frontend (Tải bản mới / Ghi đè).
- [x] Bộ test concurrency (mục 12): `ConcurrencyIT` 3 test song song, `IdempotencyIT` 8 test. Tổng backend 55, frontend 17.
- **Xong khi:** ~~4~~ 3 test concurrency xanh (test import song song chuyển sang Phase 8, vì cần tính năng import); mở 2 tab sửa cùng một quán thì tab sau thấy dialog xung đột; bấm "Lưu" liên tục không tạo bản trùng.

**Quyết định trong Phase 5**
- Redis giữ hai TTL: `in-progress-ttl: 5m` (app chết giữa chừng thì key tự nhả) và `ttl: 24h` cho kết quả đã xong. Không lưu 5xx/401/403/429 để client thử lại được với cùng key; 4xx khác được lưu và trả lại.
- Key gắn với đường dẫn: dùng lại key cho endpoint khác thì trả 422 `IDEMPOTENCY_KEY_REUSED`. Không so hash của body (frontend luôn sinh key theo body).
- `/auth/**` không áp dụng idempotency để không lưu access token vào Redis.
- Frontend giữ key theo **nội dung body** trong `CrudStore.create()`: gửi lại đúng dữ liệu cũ sau lỗi thì dùng key cũ, thành công thì bỏ key. Component không phải tự quản lý key.
- Dialog xung đột do `CrudStore` gọi qua `ConflictService` (Promise), nên component không cần sửa. Đóng dialog = "Tải bản mới". 409 do Hibernate phát hiện (không kèm `current`) thì frontend tự `GET` lại.

### Phase 6: RabbitMQ: thumbnail, dọn dẹp, cache stats (1.5–2 ngày) ✅
> Upload đồng bộ (`StorageDriver`, `ImageProcessor`, `UploadController`, `image-picker`, chặn `data:`) đã làm ở Phase 3. Phase này chỉ còn phần bất đồng bộ.
- [x] `RabbitConfig` (exchange, queue, DLQ, JSON converter, confirms), `DomainEventPublisher` + relay AFTER_COMMIT, `ProcessedMessageGuard`.
- [x] `UploadService` publish `image.uploaded` (status `THUMB_PENDING`); consumer sinh thumbnail 320px, cập nhật `thumb_url` + `READY`.
- [x] Xoá ảnh qua event `upload.deleted` → consumer xoá file (thay cho xoá file đồng bộ).
- [x] `OrphanUploadCleanupJob` + ShedLock.
- [x] Cache `/stats` bằng Redis (`@Cacheable`), evict qua queue `gfm.cache.evict`.
- [x] Chuyển ảnh `frontend/assets/img` sang `backend/seed-assets` *(làm cùng Phase 7)*: seed thay bằng 16 quán thật ở Hà Nội, `SeedAssetLoader` (profile dev) nạp ảnh vào `/uploads/seed/`. Ảnh `nik.png` chưa dùng vì không xác định được quán.
- Test: `UploadMessagingIT` (5), `StatsCacheIT` (3), `ProcessedMessageGuardIT` (3), `DirectEventDispatcherIT` (2). Tổng backend 68.
- **Xong khi:** upload ảnh xong vài giây sau có thumbnail; tắt consumer thì message nằm chờ trong queue, bật lại thì tự xử lý; message lỗi vào DLQ.

**Quyết định trong Phase 6**
- Một class `EventConsumers` chứa cả 3 `@RabbitListener` (thay cho 3 class consumer riêng như dự kiến): mỗi listener chỉ 1 dòng gọi sang service.
- `DomainEvent` là `sealed interface` với 3 record (`ImageUploaded`, `UploadsDeleted`, `EntityChanged`); `EntityChanged` cho routing key `place.*` / `girlfriend.*`. Link chưa phát event vì chưa có queue nào cần.
- `gfm.messaging.enabled=false`: không nạp bean Rabbit, `DirectEventDispatcher` xử lý event ngay sau commit. `ThumbnailService` dùng `REQUIRES_NEW` (trong AFTER_COMMIT, `REQUIRED` nhập vào transaction đã commit và không lưu gì).
- Thumbnail đặt cạnh ảnh gốc (`abc.webp` → `abc-320.webp`); xoá upload thì xoá cả hai. `UploadResponse.status` giờ là `THUMB_PENDING` ngay sau upload.
- Cache dùng serializer JSON gắn đúng kiểu (không lưu `@class`), key `cache:stats::{userId}`, TTL 10 phút. `@CacheEvict(beforeInvocation = true)` để xoá ngay (`evictIfPresent`), vì `evict()` mặc định được phép trễ.
- Test chỉ dùng một Spring context: không dùng `@TestPropertySource` riêng cho nhánh tắt RabbitMQ (context thứ hai kéo theo bộ container thứ hai và làm hỏng context đầu).
- ShedLock key `shedlock:gfm:orphan-upload-cleanup`; job xoá theo lô 200 bản, mỗi lô một transaction.
- Frontend chưa hiển thị thumbnail (xem hạn chế trong docs/07).

### Phase 7: Google Maps resolve + cache Redis (0.5–1 ngày) ✅
- [x] `GmapUrlParser` (port + unit test), `ShortLinkResolver` (java.net.http.HttpClient, whitelist, timeout).
- [x] `@Cacheable("gmap-resolve")` TTL 7 ngày, rate limit riêng (20/phút/user).
- [x] `place-form` tự gọi resolve.
- **Xong khi:** dán link `maps.app.goo.gl` thì tự điền toạ độ; lần thứ hai trả về ngay từ cache.
- *Đã chạy resolver với Google thật (link danh sách quán → `lat = null` đúng thiết kế); chưa thử với link rút gọn của một địa điểm cụ thể.*
- Test: `GmapUrlParserTest` (16), `ShortLinkResolverTest` (17), `MapsControllerIT` (5), `DemoSeedIT` (2); frontend `gmap-url.spec`, `maps.service.spec`. Tổng backend 108, frontend 30.

**Quyết định trong Phase 7**
- Chống SSRF ở **mọi bước** redirect: `https`, cổng mặc định, không `user@`, host khớp tuyệt đối allowlist (`maps.app.goo.gl`, `goo.gl`, `google.com`, `www.google.com`, `maps.google.com`, `google.com.vn`, `www.google.com.vn`); ngay trước khi gọi, mọi IP của host phải công khai. Redirect thủ công, tối đa 5.
- Link hợp lệ nhưng không có toạ độ → `200 {lat: null, lng: null, resolvedUrl}` (có cache); lỗi mạng → 502 `MAPS_RESOLVE_FAILED` (không cache); URL bị chặn → 400 `MAPS_URL_NOT_ALLOWED`.
- `consent.google.com`: không gọi, lấy tham số `continue`.
- Parser ưu tiên `!3d!4d` (vị trí ghim) trước `@lat,lng` (tâm bản đồ); frontend đổi theo.
- `PlaceService` tự điền `lat/lng` từ link đầy đủ khi thiếu (chỉ parse, không gọi mạng).
- Seed Hà Nội: số liệu tra từ nguồn công khai, thiếu thì để NULL; `seed-assets/` nằm ngoài `src/main/resources` để không vào jar prod.

### Phase 8: Import bất đồng bộ (1–1.5 ngày) ✅
- [x] `ImportController` (202 + jobId), khoá Redis (`SET NX` + token, thay cho Redisson), consumer (một transaction, decode ảnh).
- [x] `GET /import/jobs/{id}`; dialog + polling ở frontend.
- **Xong khi:** dữ liệu localStorage cũ (kèm ảnh) xuất hiện đầy đủ trên tài khoản; import lần hai trong lúc lần một đang chạy thì nhận 423.
- Test: `ImportIT` (4), `ConcurrencyIT` thêm ca (4), `DirectEventDispatcherIT` thêm ca import; frontend `legacy-import.service.spec` (7). Tổng backend 114, frontend 37. *Chưa thử dialog trên trình duyệt thật.*

**Quyết định trong Phase 8**
- Khoá `lock:import:{userId}` bằng `SET NX EX 10m` với token ngẫu nhiên, nhả bằng Lua so-sánh-rồi-xoá. Không dùng Redisson: khoá lấy ở request nhưng nhả ở consumer (luồng/instance khác), RLock gắn với luồng.
- Payload lưu cột `import_jobs.payload` (migration V2) thay vì storage (storage local là công khai qua `/uploads/**`); DONE thì xoá; `ImportJobCleanup` (mỗi giờ, ShedLock) xoá payload job xong quá 3 ngày, đánh FAILED job kẹt quá 1 giờ. Giới hạn 10MB (< max_allowed_packet 16MB), đếm byte khi đọc.
- Dòng hỏng bị **bỏ qua** (ghi lý do vào `stats.skippedReasons`, tối đa 20), không từ chối cả file; mỗi dòng qua đúng DTO + Bean Validation + service như API.
- DONE ghi cùng transaction với dữ liệu nhập ⇒ giao lại message an toàn. `REQUIRES_NEW` cho mọi transaction của `run()`.
- `UploadService` xoá file vừa ghi khi transaction rollback (áp dụng cả upload thường).
- Frontend bỏ qua bộ dữ liệu mẫu cũ còn nguyên; xong thì đổi tên key thành `gfm.*.imported`, "Không nhập" thành `gfm.*.skipped`.

### Phase 9: Hoàn thiện & bảo mật (1–2 ngày)
- [ ] Rà checklist mục 8.
- [ ] Loading skeleton / empty / error state; trang 404; `girlfriends/:id` không tồn tại.
- [ ] Log JSON + traceId; Actuator metrics.
- [ ] `README.md` gốc; Playwright e2e cho luồng chính.

### Phase 10: Deploy (1–2 ngày)
- [ ] Dockerfile backend (layered) + frontend (Caddy), `docker-compose.prod.yml`, `Caddyfile`.
- [ ] VPS 4GB, domain, DNS; secret mạnh; R2 (nếu dùng) với `StorageDriver=s3`.
- [ ] GitHub Actions CI/CD.
- [ ] Cron backup MariaDB (+ Mongo), thử restore; cảnh báo DLQ.
- **Xong khi:** truy cập `https://<domain>` từ điện thoại, đăng ký và dùng đầy đủ; health được monitor; backup chạy hằng ngày.

### Phase 11: Mở rộng (tuỳ chọn, sau MVP)
- [ ] **MongoDB**: `ActivityConsumer` → `activity_logs` (TTL index), trang "Nhật ký hoạt động".
- [ ] Bảng `visits` (Flyway `V2__visits.sql`) thay `lastVisitedAt`; `memories` (Mongo) nhiều ảnh cho mỗi buổi hẹn.
- [ ] `GET /girlfriends/{id}/suggestion` phía server.
- [ ] `BirthdayReminderJob` → `reminder.birthday` → `MailConsumer` (Spring Mail / Resend).
- [ ] Tìm kiếm + phân trang phía server (Spring Data `Pageable`, `Specification`; tận dụng collation `ai_ci` cho tìm không dấu).
- [ ] Transactional Outbox thay cho publish AFTER_COMMIT.
- [ ] OAuth2 Google login, quên mật khẩu.
- [ ] PWA + offline.

**Tổng MVP (Phase 0–10): khoảng 16–21 ngày công.** (Phase 3 tăng 0.5 ngày, Phase 6 giảm tương ứng do chuyển phần upload đồng bộ.)

---

## 15. Rủi ro & cách xử lý

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| **Over-engineering**: RabbitMQ/Redis/Mongo nặng so với quy mô app | Tốn thời gian, RAM, chi phí vận hành | Chỉ dùng ở chỗ có việc thật (mục 7); Mongo để phase mở rộng; công tắc `gfm.messaging.enabled` để chạy đơn giản khi cần |
| Component đang giả định thao tác đồng bộ | Lỗi UI khi chuyển async | Optimistic update trong `CrudStore`; sửa theo bảng 9.4; test lại từng màn |
| Mất event giữa commit và publish | Thiếu thumbnail/log | Chấp nhận ở MVP (job dọn dẹp tự bù); nâng cấp Outbox khi cần |
| Consumer xử lý trùng message | Dữ liệu nhân đôi | `ProcessedMessageGuard` (Redis) + thao tác idempotent |
| Redis mất dữ liệu | Người dùng phải đăng nhập lại, mất idempotency key | Bật AOF; không lưu dữ liệu nghiệp vụ duy nhất trong Redis |
| Sai lệch schema Flyway và entity | App không khởi động | `ddl-auto=validate` + `@DataJpaTest` Testcontainers trong CI |
| Sửa file migration đã chạy | Checksum lỗi ở môi trường khác | Quy ước: chỉ thêm file mới; review PR |
| Link Google Maps rút gọn đổi định dạng / Google chặn bot | Resolve thất bại | Vẫn cho nhập toạ độ tay (đã có), trả lỗi thân thiện |
| Import lỗi làm mất dữ liệu cũ | Mất dữ liệu người dùng | Transaction; không xoá key localStorage, chỉ đổi tên |
| Lộ dữ liệu cá nhân | Nghiêm trọng | Auth bắt buộc, lọc theo `userId`, HTTPS, không mở cổng hạ tầng, backup mã hoá |
| Lệch type giữa Angular và Java | Bug runtime | Sinh TypeScript client từ OpenAPI (`openapi-typescript` / `ng-openapi-gen`) ở Phase 9 |

---

## 16. Quyết định cần chốt trước khi code

1. **Một hay nhiều người dùng?** Kế hoạch mặc định là nhiều user.
2. **Spring Boot 3.5 hay 4.x?** Mặc định 3.5 (ổn định với Redisson, ShedLock, springdoc), nâng cấp sau.
3. **Maven hay Gradle?** Mặc định Maven.
4. **Có dùng MongoDB ngay không?** Mặc định: không, để Phase 11.
5. **Nơi deploy:** VPS 4GB tự quản hay dịch vụ managed?
6. **Lưu ảnh:** volume VPS hay Cloudflare R2?
7. **Domain** sẽ dùng.

---

## 17. Định nghĩa "Hoàn thành" cho MVP

- [ ] `git clone` → `docker compose up -d` → chạy backend + frontend theo README trong ≤ 10 phút.
- [ ] Toàn bộ schema do Flyway quản lý; Hibernate `validate` chạy qua.
- [ ] Tất cả tính năng hiện có của frontend hoạt động với dữ liệu từ server.
- [ ] Đăng nhập trên 2 thiết bị thấy cùng dữ liệu; sửa đồng thời được phát hiện (409 + dialog).
- [ ] Không tạo bản ghi trùng khi double-submit (Idempotency-Key).
- [ ] Ảnh lưu thành file, thumbnail sinh qua RabbitMQ, message lỗi vào DLQ.
- [ ] Link Google Maps rút gọn được giải tự động (có cache Redis).
- [ ] Test unit + integration + concurrency xanh trên CI (Testcontainers).
- [ ] Web chạy trên domain thật với HTTPS, có backup DB hằng ngày.
