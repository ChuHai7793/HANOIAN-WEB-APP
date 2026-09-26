# Phase 2: REST API CRUD

> **Kết quả:** API thêm/sửa/xoá/xem cho quán, người yêu, liên kết và `/stats`. PATCH sửa từng phần, có kiểm tra `version`. User khác luôn nhận 404. Gắn trùng quán thì 409. Không có truy vấn N+1.
> **Commit:** `feat: CRUD API for places, girlfriends, place links and stats (Phase 2)`

---

## 1. Mục tiêu

Cung cấp đủ API để frontend thay được `localStorage`. Đồng thời áp các nguyên tắc an toàn ngay từ đầu:
- Người dùng chỉ đụng được dữ liệu của mình.
- Dữ liệu sai bị từ chối với thông báo rõ ràng.
- Hai thiết bị sửa cùng lúc thì không âm thầm ghi đè nhau.

---

## 2. Kiến thức cần biết

### 2.1. REST và HTTP

**REST** là cách thiết kế API xoay quanh **tài nguyên (resource)**, mỗi tài nguyên có một URL. **HTTP method** cho biết muốn làm gì với tài nguyên đó:

| Method | Ý nghĩa | Ví dụ | Mã thành công |
|---|---|---|---|
| `GET` | Đọc | `GET /api/v1/places?type=cafe` | 200 OK |
| `POST` | Tạo mới | `POST /api/v1/places` | **201 Created** + header `Location` |
| `PATCH` | Sửa **một phần** | `PATCH /api/v1/places/{id}` | 200 OK |
| `PUT` | Thay **toàn bộ** | (dự án không dùng) | 200 |
| `DELETE` | Xoá | `DELETE /api/v1/places/{id}` | **204 No Content** |

**Mã trạng thái (status code)** hay gặp:

| Mã | Tên | Khi nào |
|---|---|---|
| 400 | Bad Request | Dữ liệu sai định dạng hoặc không hợp lệ |
| 401 | Unauthorized | Chưa đăng nhập hoặc token sai ([Phase 4](05-phase-4-xac-thuc-jwt.md)) |
| 403 | Forbidden | Đã đăng nhập nhưng không có quyền |
| 404 | Not Found | Không có, **hoặc không thuộc về bạn** (xem §2.5) |
| 409 | Conflict | Xung đột: trùng dữ liệu, sai version |
| 415 | Unsupported Media Type | Sai loại file |
| 429 | Too Many Requests | Gửi quá nhanh |
| 500 | Internal Server Error | Lỗi phía server |

**Idempotent:** gọi 1 lần hay 10 lần đều cho cùng một kết quả. `GET`, `PUT`, `DELETE` là idempotent; `POST` thì không, gọi 2 lần tạo ra 2 bản ghi. Phase 5 dùng *Idempotency-Key* để xử lý chuyện này.

**Versioning URL:** tiền tố `/api/v1/`. Khi cần đổi API không tương thích, tạo `/api/v2/` và giữ `v1` cho client cũ.

### 2.2. Kiến trúc 3 tầng: Controller, Service, Repository

```
HTTP request
   ▼
Controller   ← nhận/trả HTTP, validate đầu vào, KHÔNG chứa nghiệp vụ
   ▼
Service      ← nghiệp vụ, transaction, kiểm tra quyền sở hữu
   ▼
Repository   ← truy vấn DB
```

Ví dụ với quán: [PlaceController.java](../backend/src/main/java/com/gfmaster/place/PlaceController.java) → [PlaceService.java](../backend/src/main/java/com/gfmaster/place/PlaceService.java) → [PlaceRepository.java](../backend/src/main/java/com/gfmaster/place/PlaceRepository.java).

**Transaction** là nhóm thao tác DB "được ăn cả, ngã về không". `@Transactional` trên service đảm bảo nếu có lỗi giữa chừng thì mọi thay đổi bị huỷ (**rollback**). `@Transactional(readOnly = true)` báo cho DB và Hibernate biết chỉ đọc, giúp tối ưu.

### 2.3. DTO, record và Bean Validation

**DTO (Data Transfer Object)** là class chỉ để chở dữ liệu qua API, **tách biệt với entity**:

| | Entity | DTO |
|---|---|---|
| Ánh xạ | Bảng DB | JSON request/response |
| Chứa | Mọi cột, kể cả `user`, `passwordHash` | Chỉ field cho phép |
| Mục đích | Lưu trữ | Hợp đồng API |

**Vì sao không trả thẳng entity?**
1. **Bảo mật:** entity `User` có `passwordHash`. Trả nhầm là lộ.
2. **Mass assignment:** nếu nhận thẳng entity, client gửi thêm `"user": {...}` hay `"version": 999` là sửa được thứ không được phép sửa. DTO chỉ có các field cho phép.
3. **Ổn định:** đổi DB thì không nhất thiết đổi API, và ngược lại.

Dự án dùng **Java record**: class bất biến, gọn, tự có constructor, getter, `equals`:

```java
public record PlaceRequest(
    @NotNull PlaceType type,
    @NotBlank @Size(max = 120) String name,
    @Min(1) @Max(5) int rating,
    @Pattern(regexp = "^$|^(https?://|/uploads/).*") String imageUrl,   // chặn "data:" base64
    ...) {}
```

**Bean Validation (Jakarta Validation):** annotation khai báo ràng buộc như `@NotBlank`, `@Size`, `@Min`, `@Pattern`, `@Email`. Thêm `@Valid` trước `@RequestBody` thì Spring tự kiểm tra, sai thì trả 400 kèm danh sách field lỗi.

**Mỗi thực thể có 3 DTO:**

| DTO | Dùng cho | Đặc điểm |
|---|---|---|
| `XxxRequest` | `POST` | Field bắt buộc có `@NotNull`/`@NotBlank` |
| `XxxPatch` | `PATCH` | Mọi field tuỳ chọn, **riêng `version` bắt buộc** |
| `XxxResponse` | Mọi response | Thêm `id`, `version`, `createdAt`, `updatedAt` |

`@JsonIgnoreProperties({"id", "createdAt", "updatedAt", ...})` trên request: frontend gửi kèm cả object (có sẵn `id`, `createdAt`) cũng không bị báo lỗi. Các field **lạ khác** vẫn bị từ chối (`fail-on-unknown-properties: true`).

**MapStruct** sinh code chuyển Entity ↔ DTO lúc biên dịch (không dùng reflection nên nhanh). Ví dụ [PlaceMapper.java](../backend/src/main/java/com/gfmaster/place/PlaceMapper.java):

```java
@Mapper(config = MapperConfigDefaults.class)
public interface PlaceMapper {
  PlaceResponse toResponse(Place place);     // MapStruct tự sinh phần thân hàm
  Place toEntity(PlaceRequest request);
}
```

Cấu hình `unmappedTargetPolicy = ERROR`: nếu thêm cột mà quên map, **build thất bại**, không lặng lẽ để trống.

### 2.4. Optimistic locking và `version`

**Vấn đề "lost update":** điện thoại và laptop cùng mở một quán. Điện thoại đổi tên và lưu, sau đó laptop đổi giờ và lưu. Laptop gửi cả object cũ nên **ghi đè mất** tên mới của điện thoại.

**Hai cách giải:**
- **Pessimistic locking**: khoá dòng trong lúc sửa, người khác phải chờ. An toàn nhưng chậm, dễ kẹt.
- **Optimistic locking**: không khoá gì. Mỗi dòng có số `version`; khi ghi thì kiểm tra version có còn như lúc đọc không. Hợp khi xung đột **hiếm**, đúng với app này.

**Cách hoạt động:**
1. `GET` trả về `"version": 3`.
2. Client `PATCH` gửi kèm `"version": 3`.
3. Server so sánh. Nếu DB vẫn là 3 thì ghi, và Hibernate tăng lên 4. Nếu đã là 4 (người khác vừa sửa) thì trả **409 `VERSION_CONFLICT`** kèm bản mới nhất trong trường `current`.
4. Ngoài ra, Hibernate chạy `UPDATE ... WHERE id = ? AND version = ?`. Nếu hai request cùng vượt qua bước 3 trong tích tắc, câu UPDATE thứ hai không khớp dòng nào và ném `ObjectOptimisticLockingFailureException`, cũng thành 409.

```java
// PlaceService.update
Place place = load(userId, id);
if (!Objects.equals(place.getVersion(), patch.value().version())) {
  throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", mapper.toResponse(place));
}
```

### 2.5. IDOR và "404 thay vì 403"

**IDOR (Insecure Direct Object Reference)** là lỗ hổng bảo mật rất phổ biến: API nhận `id` từ client mà không kiểm tra id đó **có thuộc về người gọi không**. Kẻ tấn công chỉ cần đổi `id` trên URL là đọc được dữ liệu người khác.

**Cách chống trong dự án:** *mọi* truy vấn đều kèm `userId` lấy từ phía server (từ Phase 4 là từ JWT), **không bao giờ** lấy từ client:

```java
places.findByIdAndUserId(id, userId)       // không phải findById(id)
places.deleteByIdAndUserId(id, userId)
links.findByIdAndGirlfriendUserId(id, userId)   // link: chủ sở hữu qua girlfriend.user
```

Khi gắn link, service kiểm tra **cả** người yêu lẫn quán đều thuộc user hiện tại. Nếu không kiểm tra, có thể gắn quán của người khác vào người yêu của mình.

**Vì sao trả 404 chứ không phải 403?** 403 ("bạn không có quyền") ngầm xác nhận **"id này có tồn tại"**, tức là lộ thông tin. 404 thì không phân biệt được "không có" với "không phải của bạn".

### 2.6. Cascade: để DB lo hay để JPA lo?

Xoá một quán thì các `place_links` của nó cũng phải mất. Có hai cách:

| | JPA cascade (`@OneToMany(cascade = REMOVE)`) | DB cascade (`ON DELETE CASCADE`) |
|---|---|---|
| Cách làm | Hibernate `SELECT` mọi link, rồi `DELETE` từng cái | DB tự xoá trong một câu lệnh |
| Hiệu năng | N+1 câu lệnh | 1 câu lệnh |
| Chọn | ✗ | ✓ |

Dự án chọn **DB cascade** và báo cho Hibernate bằng `@OnDelete(action = CASCADE)`. Frontend cũng phải xoá link khỏi state của nó (`dropByPlace`), xem [Phase 3](04-phase-3-frontend-noi-api-upload.md).

### 2.7. Ràng buộc unique → 409

Gắn cùng một quán cho cùng một người hai lần: thay vì tự `SELECT` kiểm tra trước (vẫn bị *race condition* nếu hai request đến cùng lúc), dự án **để DB kiểm tra** bằng `UNIQUE (girlfriend_id, place_id)`. DB ném `DataIntegrityViolationException`; handler tìm tên constraint trong thông báo lỗi để chọn mã:

```java
Map.of("uk_link_gf_place", ErrorCode.LINK_ALREADY_EXISTS,
       "uk_users_email",   ErrorCode.EMAIL_TAKEN)
```

**Race condition:** kết quả phụ thuộc vào thứ tự ngẫu nhiên của các thao tác chạy song song. Ràng buộc trong DB là cách chắc chắn nhất để chống nó.

### 2.8. PATCH: "không gửi" khác "gửi null"

Với PATCH, hai request này có ý nghĩa khác nhau:

```json
{ "name": "Mới", "version": 0 }                  // chỉ đổi tên, GIỮ NGUYÊN toạ độ
{ "lat": null, "lng": null, "version": 1 }       // XOÁ toạ độ
```

Nhưng khi Jackson đọc vào record, **cả hai trường hợp `lat` đều thành `null`**. Không phân biệt được.

**Giải pháp:** [PatchReader.java](../backend/src/main/java/com/gfmaster/common/web/PatchReader.java) nhận JSON thô (`JsonNode`), ghi lại **danh sách key có mặt**, rồi mới parse và validate. Kết quả là một [Patch.java](../backend/src/main/java/com/gfmaster/common/web/Patch.java) gồm `value` và `fields`:

```java
patch
  .set("name", p.name(), place::setName)            // bắt buộc: có mặt VÀ khác null mới ghi
  .setNullable("lat", p.lat(), place::setLat)       // tuỳ chọn: có mặt là ghi, kể cả null
```

| Field | Không gửi | Gửi `null` | Gửi giá trị |
|---|---|---|---|
| Bắt buộc (`name`, `type`…) | Giữ | **Bỏ qua** | Ghi |
| Tuỳ chọn (`lat`, `cuisine`, `birthday`…) | Giữ | **Xoá** | Ghi |

### 2.9. Vấn đề N+1 và cách tránh

**N+1:** lấy danh sách N người yêu tốn 1 câu SQL. Sau đó, với **mỗi** người, Hibernate chạy thêm 1 câu để lấy `hobbies`. Tổng cộng N+1 câu: 100 người là 101 lần gọi DB.

Nguyên nhân: quan hệ **lazy** (tải chậm). Dữ liệu con chỉ được tải khi truy cập lần đầu.

**Cách tránh trong dự án:**

| Chỗ | Kỹ thuật |
|---|---|
| Danh sách người yêu + hobbies | `@EntityGraph(attributePaths = "hobbies")`: tải kèm bằng JOIN |
| Danh sách link + place | `@EntityGraph(attributePaths = "place")` |
| `placeCount` của từng người yêu | **Projection + GROUP BY**: một câu `select girlfriend.id, count(l) ... group by girlfriend.id` |
| Badge `/stats` | `countByType` bằng GROUP BY |

**Projection** là truy vấn chỉ lấy vài cột vào một interface nhỏ, không tải cả entity:
```java
interface GirlfriendLinkCount { UUID getGirlfriendId(); long getTotal(); }
```

**Cách kiểm tra:** bật log SQL ở dev (`logging.level.org.hibernate.SQL: debug`), gọi endpoint và đếm số câu `select`. Số câu phải không tăng theo số dòng dữ liệu.

---

## 3. Các bước thực hiện

### Bước 1: Hạ tầng dùng chung

1. `@CurrentUser UUID userId`: annotation cho tham số controller, lấy user hiện tại. Ở Phase 2 tạm đọc header `X-Debug-User` (chỉ bật ở dev/test); **Phase 4 thay bằng JWT**. File: [CurrentUserArgumentResolver.java](../backend/src/main/java/com/gfmaster/common/security/CurrentUserArgumentResolver.java), đăng ký trong [WebConfig.java](../backend/src/main/java/com/gfmaster/config/WebConfig.java).
2. `Patch` và `PatchReader` (§2.8).
3. [MapperConfigDefaults.java](../backend/src/main/java/com/gfmaster/common/web/MapperConfigDefaults.java): cấu hình MapStruct chung.
4. Thêm MapStruct vào [pom.xml](../backend/pom.xml). **Thứ tự annotation processor quan trọng:** Lombok → `lombok-mapstruct-binding` → MapStruct. MapStruct cần thấy getter/setter mà Lombok sinh ra.

### Bước 2: Module Place

- DTO: [PlaceRequest](../backend/src/main/java/com/gfmaster/place/dto/PlaceRequest.java), [PlacePatch](../backend/src/main/java/com/gfmaster/place/dto/PlacePatch.java), [PlaceResponse](../backend/src/main/java/com/gfmaster/place/dto/PlaceResponse.java).
- Mapper, Service, Controller.
- Quy tắc nghiệp vụ `normalizeTypeFields`: quán ăn không có wifi/parking; cafe/bar không có ẩm thực. Server tự bỏ field không hợp loại quán.

### Bước 3: Module Girlfriend

Giống Place, thêm:
- `placeCount` trong response (§2.9).
- PATCH `hobbies` **thay toàn bộ danh sách**. Phải dùng `getHobbies().clear(); addAll(...)` thay vì `setHobbies(new list)`, vì Hibernate đang theo dõi đúng instance collection cũ.

### Bước 4: Module PlaceLink

- `POST /place-links`: kiểm tra quyền sở hữu cả hai phía (§2.5). Trùng cặp thì 409 (§2.7).
- `PATCH` **không cho đổi** `girlfriendId`/`placeId`; muốn đổi thì xoá rồi tạo lại.
- `GET /girlfriends/{id}/links?type=cafe` trả `[{ link, place }]`, sắp xếp `herRating` giảm dần rồi tới ngày đi gần nhất. Endpoint này thay cho hàm `linkedOf()` từng nằm ở frontend.
- `GET /place-links?girlfriendId=&placeId=`: lọc tuỳ chọn.

### Bước 5: Stats

[StatsController.java](../backend/src/main/java/com/gfmaster/stats/StatsController.java) trả `{ cafes, bars, restaurants, girlfriends }` cho badge ở sidebar.

### Bước 6: Test

- Helper [ApiTestSupport.java](../backend/src/test/java/com/gfmaster/support/ApiTestSupport.java): `newUser()` tạo user riêng cho **mỗi test**, nên các test không ảnh hưởng nhau. Có sẵn `getAs`/`postAs`/`patchAs`/`deleteAs` và các hàm tạo dữ liệu mẫu.
- **MockMvc**: gửi request giả vào Spring MVC mà không cần mở cổng mạng thật. Kiểm tra JSON trả về bằng **JsonPath** (`$.name`, `$[0].place.name`, `$[?(@.name == 'Mai')].placeCount`).
- Test file: [PlaceControllerIT](../backend/src/test/java/com/gfmaster/place/PlaceControllerIT.java), [GirlfriendControllerIT](../backend/src/test/java/com/gfmaster/girlfriend/GirlfriendControllerIT.java), [PlaceLinkControllerIT](../backend/src/test/java/com/gfmaster/placelink/PlaceLinkControllerIT.java).

Các nhóm tình huống được test:

| Nhóm | Ví dụ |
|---|---|
| Đúng | Tạo trả 201 + `Location`; giờ ở dạng `HH:mm`; danh sách lọc theo loại |
| PATCH | Chỉ đổi field gửi; `null` xoá field tuỳ chọn; version tăng |
| Xung đột | Version cũ → 409 kèm `current`; thiếu version → 400 |
| Validate | Tên rỗng, rating 9, ảnh `data:` → 400 liệt kê đủ field; enum lạ, field lạ → 400 |
| Bảo mật | User khác GET/PATCH/DELETE đều 404; không gắn được quán của người khác |
| Toàn vẹn | Xoá quán thì link mất; gắn trùng → 409 |

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend
.\mvnw.cmd verify
```

Thử bằng Swagger: http://localhost:8080/api/docs. Từ Phase 4 trở đi phải bấm **Authorize** và dán access token, lấy từ `POST /api/v1/auth/login`.

Đếm câu SQL để kiểm tra N+1, với app chạy profile dev:

| Endpoint | Số dòng | Số câu SQL |
|---|---|---|
| `GET /places` | 10 | 1 |
| `GET /girlfriends` | 2 | 2 (danh sách + đếm link) |
| `GET /place-links` | 4 | 1 |
| `GET /girlfriends/{id}/links` | 3 | 2 |
| `GET /stats` | — | 2 |

---

## 5. Lỗi đã gặp và bài học

### 5.1. Cột TIME bị lệch 8 tiếng

**Triệu chứng:** seed ghi giờ mở cửa `08:00`, API trả `16:00`. Test không phát hiện, vì test ghi rồi đọc lại **qua cùng một đường**: lệch lúc ghi, lệch ngược lúc đọc, triệt tiêu nhau.

**Nguyên nhân:**
- Cấu hình `hibernate.jdbc.time_zone: UTC` khiến Hibernate chuyển `LocalTime` qua `java.sql.Time` + `Calendar(UTC)`.
- `java.sql.Time` thực chất là thời điểm vào ngày **1970-01-01** theo múi giờ JVM.
- Máy dev ở `Asia/Ho_Chi_Minh`, mà **năm 1970 Sài Gòn dùng UTC+8**, không phải +7. Vì thế lệch đúng 8 tiếng.

**Sửa:** thêm vào `application.yml`
```yaml
spring.jpa.properties.hibernate.type.java_time_use_direct_jdbc: true
```
Hibernate truyền thẳng `LocalTime`/`LocalDate` xuống driver, không quy đổi múi giờ.

**Test hồi quy** `timeColumnsAreNotShiftedByJvmTimezone`: ghi qua API rồi đọc bằng **SQL thô**, và ngược lại, không chỉ round-trip. Đã xác nhận test này **fail** khi tắt bản sửa.

**Bài học:**
- Giá trị "không có múi giờ" (giờ mở cửa, ngày sinh) không bao giờ được đi qua bước chuyển đổi múi giờ.
- Test round-trip có thể che lỗi đối xứng. Hãy kiểm tra dữ liệu ở **tầng thấp nhất** (SQL).

### 5.2. MapStruct `@Condition` lỗi với record

Ý định ban đầu là dùng `@Condition` + `@SourcePropertyName` của MapStruct để áp PATCH theo danh sách field. Kết quả: lỗi *FreeMarker template error* bên trong MapStruct 1.6 khi nguồn là **record**. Thử `appliesTo = PROPERTIES` cũng không được.

**Quyết định:** viết tay phần áp PATCH bằng helper `Patch.set/setNullable`, gọn và dễ đọc. MapStruct chỉ dùng cho `toEntity`/`toResponse`.

**Bài học:** khi một thư viện chống lại bạn ở một trường hợp đặc biệt, 15 dòng code tự viết dễ hiểu thường tốt hơn một mẹo cấu hình khó hiểu.

---

**Trước:** [Phase 1](02-phase-1-khung-spring-boot-flyway.md) · **Tiếp theo:** [Phase 3: Nối frontend với API](04-phase-3-frontend-noi-api-upload.md)
