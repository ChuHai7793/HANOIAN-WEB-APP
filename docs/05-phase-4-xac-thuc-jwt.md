# Phase 4: Xác thực bằng JWT, refresh token trong Redis, rate limit

> **Kết quả:** muốn dùng app phải đăng ký/đăng nhập; mỗi tài khoản chỉ thấy dữ liệu của mình. F5 vẫn giữ phiên. Đăng nhập sai quá 5 lần/phút thì bị chặn tạm thời. Có Đăng xuất và Đăng xuất mọi thiết bị.
> **Commit:** `feat: JWT authentication with Redis refresh tokens and rate limiting (Phase 4)`

---

## 1. Mục tiêu

- Thay header tạm `X-Debug-User` bằng **danh tính thật**, đã xác minh.
- Chống các kiểu tấn công phổ biến: đánh cắp phiên, CSRF, dò mật khẩu, dò email tồn tại.
- Giữ trải nghiệm mượt: không bắt đăng nhập lại mỗi 15 phút.

---

## 2. Kiến thức cần biết

### 2.1. Authentication và Authorization

| | Authentication (xác thực) | Authorization (phân quyền) |
|---|---|---|
| Câu hỏi | **Bạn là ai?** | **Bạn được làm gì?** |
| Cách làm | Mật khẩu → token | Kiểm tra quyền trên từng tài nguyên |
| Lỗi | 401 Unauthorized | 403 Forbidden / 404 (xem [Phase 2 §2.5](03-phase-2-crud-api.md#25-idor-và-404-thay-vì-403)) |

Phase 4 lo **authentication**. **Authorization** của app này rất đơn giản: "chỉ chủ sở hữu", và đã làm từ Phase 2 bằng `findByIdAndUserId`.

### 2.2. Session truyền thống và token stateless

- **Session phía server (stateful):** đăng nhập xong, server tạo session lưu trong bộ nhớ và gửi cookie `SESSIONID`. Mỗi request, server tra session. Khó mở rộng ra nhiều server, vì session nằm ở server nào?
- **Token (stateless):** server phát một **token có chữ ký**, chứa sẵn thông tin người dùng. Mỗi request, server chỉ cần **kiểm chữ ký**, không tra cứu gì. Server nào cũng kiểm được, dễ chạy nhiều instance.

Dự án dùng token cho API (`SessionCreationPolicy.STATELESS`).

### 2.3. JWT (JSON Web Token)

JWT là chuỗi gồm 3 phần, cách nhau bằng dấu chấm, mỗi phần mã hoá **Base64URL**:

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiIwMDAw...In0 . k3Xz9...
      header                   payload            signature
```

| Phần | Nội dung | Ví dụ trong dự án |
|---|---|---|
| **Header** | Thuật toán ký | `{"alg":"HS256"}` |
| **Payload (claims)** | Thông tin | `sub` = userId, `email`, `iss` = `"gf-master"`, `iat` = lúc phát, `exp` = hết hạn, `jti` = id duy nhất |
| **Signature** | Chữ ký của header+payload bằng khoá bí mật | Chống sửa đổi |

**Quan trọng:**
- Payload **chỉ được mã hoá Base64, không được mã hoá bí mật**. Ai cũng đọc được (thử dán vào https://jwt.io). **Không bao giờ để mật khẩu hay dữ liệu nhạy cảm trong JWT.**
- Chữ ký đảm bảo **không ai sửa được** payload. Đổi `sub` thành id người khác thì chữ ký sai và bị từ chối.
- **Claim chuẩn:** `sub` (subject, *ai*), `iss` (issuer, *ai phát*), `exp` (expiration), `iat` (issued at), `jti` (JWT ID).

**HS256 (HMAC-SHA256):** ký và kiểm bằng **cùng một khoá bí mật** (đối xứng), chính là `JWT_SECRET` ≥ 32 byte. Đơn giản, hợp khi chỉ có một backend vừa phát vừa kiểm token. Hệ thống nhiều bên thì dùng RS256/ES256 (khoá công khai/bí mật).

**Nimbus JOSE+JWT** là thư viện Spring Security dùng để ký/kiểm JWT. Xem [JwtConfig.java](../backend/src/main/java/com/gfmaster/config/JwtConfig.java) và [JwtService.java](../backend/src/main/java/com/gfmaster/auth/JwtService.java).

### 2.4. Access token và refresh token

JWT có một điểm yếu: **không thu hồi được** trước khi hết hạn, vì server không lưu gì. Bị lộ thì kẻ gian dùng được tới `exp`. Cách giải là dùng **hai loại token**:

| | Access token | Refresh token |
|---|---|---|
| Dạng | JWT | Chuỗi ngẫu nhiên 256-bit |
| Sống | **15 phút** | **30 ngày** |
| Gửi kèm | Mọi request API, header `Authorization: Bearer <token>` | **Chỉ** `POST /auth/refresh` |
| Lưu ở client | **Bộ nhớ JS** (biến), mất khi F5 | **Cookie httpOnly** |
| Lưu ở server | Không lưu gì (stateless) | Redis, **thu hồi được** |

**Luồng:**
```
Đăng nhập ─► { accessToken }  +  Set-Cookie: rt=...
   │
   ├─ gọi API với Bearer accessToken ... 15 phút sau → 401 TOKEN_EXPIRED
   │
   └─► POST /auth/refresh (trình duyệt tự gửi cookie rt)
          ─► accessToken mới + cookie rt MỚI (token cũ hết giá trị)
```

**F5 trang:** access token trong bộ nhớ mất, nhưng cookie `rt` vẫn còn. App gọi `/auth/refresh` lúc khởi động để lấy lại phiên.

**Vì sao không để access token trong `localStorage`?** Bất kỳ đoạn JavaScript nào chạy trên trang (kể cả mã độc chèn qua lỗ hổng **XSS**) đều đọc được `localStorage`. Giữ token trong biến JS khó lấy hơn, và nó chỉ sống 15 phút.

### 2.5. Cookie: HttpOnly, Secure, SameSite, Path

Cookie `rt` được đặt bởi [RefreshCookie.java](../backend/src/main/java/com/gfmaster/auth/RefreshCookie.java):

```
Set-Cookie: rt=3I6cVEMQ...; Path=/api/v1/auth; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict
```

| Thuộc tính | Ý nghĩa | Chống gì |
|---|---|---|
| `HttpOnly` | JavaScript **không đọc được** (`document.cookie` không thấy) | XSS đánh cắp token |
| `Secure` | Chỉ gửi qua HTTPS | Nghe lén trên mạng. **Dev tắt** (`gfm.auth.cookie-secure=false`) vì chạy http |
| `SameSite=Strict` | Trình duyệt **không gửi** cookie khi request xuất phát từ trang web khác | CSRF |
| `Path=/api/v1/auth` | Chỉ gửi cho các URL dưới đường dẫn này | Giảm phạm vi lộ |
| `Max-Age` | Số giây tồn tại. `0` = xoá ngay | — |

### 2.6. CSRF và kiểm tra Origin

**CSRF (Cross-Site Request Forgery):** bạn đang đăng nhập app, rồi vào trang `evil.com`. Trang đó bí mật gửi `POST https://app/api/v1/auth/logout`. Trình duyệt **tự đính kèm cookie** của app nên request thực hiện dưới danh nghĩa bạn.

**Dự án chống CSRF bằng nhiều lớp:**
1. **API chính dùng Bearer token trong header**, không dùng cookie. Trang lạ không đọc được token nên không gọi được API. Vì vậy CSRF protection mặc định của Spring được tắt (`csrf.disable()`).
2. Hai endpoint dùng cookie (`/auth/refresh`, `/auth/logout`) được bảo vệ bởi:
   - `SameSite=Strict`: cookie không đi kèm request từ site khác.
   - **CORS filter:** request có `Origin` lạ bị Spring chặn 403.
   - **Kiểm tra `Origin` trong controller:** lớp thứ hai, phòng khi cấu hình CORS bị nới lỏng về sau.

### 2.7. Token rotation và reuse detection

**Rotation (xoay vòng):** mỗi lần refresh, token cũ **hết giá trị** và được thay bằng token mới.

**Reuse detection (phát hiện dùng lại):** nếu một token **đã dùng rồi** lại được gửi lên, nghĩa là có hai người cùng cầm token đó, tức đã **bị đánh cắp**. Server thu hồi **toàn bộ chuỗi** (*family*), bắt cả người thật lẫn kẻ gian đăng nhập lại.

```
Đăng nhập → rt1 ─┬─ (chủ thật) refresh → rt2 → refresh → rt3 ...
                 │
                 └─ (kẻ gian, đã trộm rt1) refresh bằng rt1
                        → rt1 đã "used" → THU HỒI cả family (rt1, rt2, rt3)
                        → cả hai phải đăng nhập lại
```

### 2.8. Redis: cấu trúc lưu refresh token

[RefreshTokenStore.java](../backend/src/main/java/com/gfmaster/auth/RefreshTokenStore.java) lưu:

| Key | Kiểu Redis | Nội dung | TTL |
|---|---|---|---|
| `rt:{sha256(token)}` | **Hash** (bảng field→value) | `userId`, `family`, `ua` (trình duyệt), `used` | 30 ngày |
| `user:{id}:rt` | **Set** (tập không trùng) | Mọi hash của user | 30 ngày |
| `rtf:{family}` | Set | Mọi hash cùng một chuỗi xoay | 30 ngày |

- **Chỉ lưu SHA-256 của token**, không lưu token gốc. Lộ dữ liệu Redis thì cũng không dùng được. Đây là cùng tư tưởng với việc hash mật khẩu.
- **TTL (Time To Live):** Redis **tự xoá** key khi hết hạn, không cần job dọn dẹp.
- **Logout** thu hồi family của token hiện tại. **Logout-all** xoá mọi hash trong `user:{id}:rt`.

**Tính nguyên tử (atomicity) và Lua script:** hai request refresh cùng một token đến **cùng lúc**. Nếu làm "đọc `used` → nếu 0 thì ghi 1" bằng hai lệnh riêng, cả hai request có thể cùng đọc được 0. Redis chạy **Lua script** như một khối không bị chen ngang:

```lua
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
return redis.call('HINCRBY', KEYS[1], 'used', 1)
```

Kết quả `1` là lần dùng đầu, hợp lệ. Kết quả `2` trở lên là bị dùng lại, nên thu hồi family.

### 2.9. Bảo vệ mật khẩu và chống dò email

- **BCrypt cost 12** (xem [Phase 1 §2.11](02-phase-1-khung-spring-boot-flyway.md#211-bcrypt-để-tạo-user-demo)). BCrypt chỉ dùng **72 byte đầu** của mật khẩu, nên form giới hạn 8–72 ký tự.
- **Cùng một thông báo lỗi** cho "email không tồn tại" và "sai mật khẩu" (`INVALID_CREDENTIALS`). Nếu báo khác nhau, kẻ gian biết được email nào đã đăng ký (**user enumeration**).
- **Chống timing attack:** email không tồn tại thì server **vẫn chạy BCrypt** trên một hash giả. Nếu không, response trả nhanh hơn ~250 ms và lộ ra email không có thật. Xem `dummyHash` trong [AuthService.java](../backend/src/main/java/com/gfmaster/auth/AuthService.java).
- Email được **chuẩn hoá** (trim + chữ thường) trước khi lưu và so sánh.

### 2.10. Rate limiting: thuật toán token bucket

**Rate limit** giới hạn số request trong một khoảng thời gian, để chống dò mật khẩu (brute force) và spam.

**Token bucket (xô token):** mỗi người (hoặc IP) có một "xô" chứa tối đa N token. Mỗi request lấy 1 token; xô được **nạp lại dần đều** theo thời gian. Xô rỗng thì request bị từ chối với **429 Too Many Requests** và header **`Retry-After: <số giây>`**.

| Phạm vi | Key | Giới hạn |
|---|---|---|
| Login/Register | `rl:auth:{IP}` | 5 lần/phút |
| API còn lại | `rl:api:{userId}` | 100 lần/phút |

**Bucket4j** là thư viện token bucket cho Java. Trạng thái bucket lưu trong **Redis**, nên nhiều instance backend dùng chung một giới hạn (*distributed rate limiting*). Xem [RateLimiter.java](../backend/src/main/java/com/gfmaster/common/web/RateLimiter.java) và [RateLimitFilter.java](../backend/src/main/java/com/gfmaster/common/web/RateLimitFilter.java).

> Khi chạy sau reverse proxy (Caddy), `request.getRemoteAddr()` sẽ là IP của proxy. Cấu hình `server.forward-headers-strategy: framework` khiến Spring đọc IP thật từ header `X-Forwarded-For`.

### 2.11. Spring Security: filter chain và resource server

**Spring Security** là một chuỗi **filter** chạy **trước** controller. Mỗi filter lo một việc:

```
Request → CorsFilter → BearerTokenAuthenticationFilter → RateLimitFilter → AuthorizationFilter → Controller
              │                  │                             │                    │
        chặn Origin lạ    đọc & kiểm JWT, đặt           giới hạn tần suất    kiểm route có cần
                          SecurityContext                                    đăng nhập không
```

- **OAuth2 Resource Server:** module của Spring Security cho kiểu app "nhận Bearer token và kiểm tra nó". Ta chỉ cần cung cấp bean `JwtDecoder`.
- **SecurityContext:** nơi lưu "ai đang gọi" cho request hiện tại. [CurrentUserArgumentResolver.java](../backend/src/main/java/com/gfmaster/common/security/CurrentUserArgumentResolver.java) đọc claim `sub` từ đây để cung cấp `@CurrentUser UUID userId`.
- **AuthenticationEntryPoint / AccessDeniedHandler:** quyết định response khi thiếu hoặc sai token (401) và khi không đủ quyền (403). Mặc định Spring trả body rỗng. [ProblemSecurityHandlers.java](../backend/src/main/java/com/gfmaster/common/security/ProblemSecurityHandlers.java) trả **ProblemDetail**, có `code: TOKEN_EXPIRED` để frontend biết cần refresh.

Quy tắc truy cập trong [SecurityConfig.java](../backend/src/main/java/com/gfmaster/config/SecurityConfig.java):

| Đường dẫn | Quyền |
|---|---|
| `POST /api/v1/auth/{register,login,refresh,logout}` | Ai cũng gọi được |
| `/actuator/health`, `/api/docs/**` | Ai cũng gọi được |
| `GET /uploads/**` | Ai cũng xem được (thẻ `<img>` không gửi được Bearer; tên file là UUID khó đoán) |
| `/api/**` còn lại | **Phải có JWT hợp lệ** |
| Mọi thứ khác | Chặn (`denyAll`) |

### 2.12. Frontend: guard, interceptor refresh, open redirect

- **Route guard (`canMatch`):** hàm Angular chạy trước khi vào route. [auth.guard.ts](../frontend/src/app/core/auth/auth.guard.ts):
  - `authGuard`: chưa đăng nhập thì chuyển về `/login?returnUrl=/trang-dinh-vao`.
  - `guestGuard`: đã đăng nhập mà vào `/login` thì chuyển vào app.
- **Interceptor tự refresh:** [auth.interceptor.ts](../frontend/src/app/core/api/auth.interceptor.ts)
  1. Gắn `Authorization: Bearer` cho mọi request `/api`.
  2. Gặp 401 thì gọi `refreshAccessToken()` rồi **gửi lại** request với token mới.
  3. **Single-flight:** 5 request cùng gặp 401 thì chỉ gọi refresh **một lần**. Mọi request chờ chung một Promise, xem `refreshing ??= ...` trong [auth.service.ts](../frontend/src/app/core/auth/auth.service.ts).
  4. Refresh thất bại thì kết thúc phiên và về `/login`.
- **Thứ tự interceptor** `[errorInterceptor, authInterceptor]`: `errorInterceptor` đứng **ngoài cùng**, nên chỉ thấy lỗi *cuối cùng*. 401 đã được tự refresh thành công sẽ không hiện toast.
- **Open redirect:** kẻ gian gửi link `/login?returnUrl=https://evil.com`, nạn nhân đăng nhập xong bị đưa sang trang giả. Hàm `safeReturnUrl` chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng `/`, không chấp nhận `//`. Xem [login.page.ts](../frontend/src/app/features/auth/login.page.ts).

---

## 3. Các bước thực hiện

### Bước 1: Cấu hình

- [GfmProperties.java](../backend/src/main/java/com/gfmaster/config/GfmProperties.java): thêm `auth.cookieSecure`, `rateLimit.authPerMinute` và `rateLimit.apiPerMinute`; bỏ `debugUserHeader`.
- `application.yml`: `rate-limit.auth-per-minute: 5`, `api-per-minute: 100`, `auth.cookie-secure: true`. Dev đặt `cookie-secure: false`. Test đặt `api-per-minute: 1000` để không bị giới hạn khi chạy test dày đặc.
- Thêm `bucket4j_jdk17-lettuce` vào `pom.xml`.

### Bước 2: JWT

[JwtConfig.java](../backend/src/main/java/com/gfmaster/config/JwtConfig.java) tạo 3 bean:
- `SecretKey`: khoá HMAC từ `JWT_SECRET`.
- `JwtEncoder`: ký token.
- `JwtDecoder`: kiểm chữ ký, `exp` và `iss = "gf-master"`.

[JwtService.java](../backend/src/main/java/com/gfmaster/auth/JwtService.java) phát access token, có `jti` ngẫu nhiên.

### Bước 3: Refresh token và auth API

- `RefreshTokenStore` (§2.7, §2.8).
- [AuthService.java](../backend/src/main/java/com/gfmaster/auth/AuthService.java): `register`, `login`, `refresh`, `logout`, `logoutAll`, `me`.
- [AuthController.java](../backend/src/main/java/com/gfmaster/auth/AuthController.java): các endpoint dưới `/api/v1/auth`, đặt/xoá cookie, kiểm tra Origin. Refresh thất bại thì **xoá cookie** để trình duyệt thôi gửi token hỏng.
- DTO trong [AuthDtos.java](../backend/src/main/java/com/gfmaster/auth/dto/AuthDtos.java). Mã lỗi mới: `INVALID_CREDENTIALS`, `FORBIDDEN`.

| Endpoint | Body | Trả về |
|---|---|---|
| `POST /auth/register` | `{email, password, displayName}` | 201 `{accessToken, expiresIn, user}` + cookie |
| `POST /auth/login` | `{email, password}` | 200 như trên |
| `POST /auth/refresh` | (cookie) | 200 như trên + cookie mới |
| `POST /auth/logout` | (cookie) | 204 + xoá cookie |
| `POST /auth/logout-all` | (Bearer) | 204 |
| `GET /auth/me` | (Bearer) | `{id, email, displayName}` |

### Bước 4: Security

1. [SecurityConfig.java](../backend/src/main/java/com/gfmaster/config/SecurityConfig.java): quy tắc ở §2.11, bật `oauth2ResourceServer().jwt()`, gắn `RateLimitFilter` **sau** `BearerTokenAuthenticationFilter` (để filter biết userId), bean `BCryptPasswordEncoder(12)`.
2. `CurrentUserArgumentResolver`: đọc `sub` từ JWT thay cho header tạm.
3. `ProblemSecurityHandlers`: 401/403 dạng ProblemDetail.
4. `RateLimiter` + `RateLimitFilter`. `RateLimitFilter` **không** đánh dấu `@Component`, vì nếu có, Spring Boot sẽ tự đăng ký thêm nó vào servlet filter chain và filter **chạy 2 lần**.

### Bước 5: Test backend

- [ApiTestSupport.java](../backend/src/test/java/com/gfmaster/support/ApiTestSupport.java) giờ gọi API bằng **JWT thật** (`jwt.issueAccessToken(user, ...)`). Nhờ đó mọi test IDOR ở Phase 2 chạy lại được qua đường xác thực thật.
- [AuthControllerIT.java](../backend/src/test/java/com/gfmaster/auth/AuthControllerIT.java) có 13 test:
  - Cookie đủ thuộc tính.
  - Email trùng, không phân biệt hoa thường.
  - Sai mật khẩu và email lạ cho cùng một lỗi.
  - Token rác, token hết hạn (`TOKEN_EXPIRED`), chữ ký giả.
  - Rotation; dùng lại token cũ thì thu hồi cả chuỗi.
  - Logout, logout-all.
  - Origin lạ.
  - 6 lần login thì bị 429; IP khác không bị ảnh hưởng.
- Mỗi test dùng một **IP giả riêng** (`setRemoteAddr`) để không dính giới hạn 5 lần/phút của test khác.

### Bước 6: Frontend

1. [auth.service.ts](../frontend/src/app/core/auth/auth.service.ts): `user` signal, access token trong biến, `login`/`register`/`restoreSession`/`refreshAccessToken`/`logout`/`logoutAll`/`onSessionExpired`.
2. [auth.interceptor.ts](../frontend/src/app/core/api/auth.interceptor.ts) và [http-context.ts](../frontend/src/app/core/api/http-context.ts) (`SKIP_AUTH`, `SILENT_ERRORS`). Hai cờ này tách ra file riêng để tránh **import vòng** giữa service và interceptor.
3. [auth.guard.ts](../frontend/src/app/core/auth/auth.guard.ts), rồi gắn vào [app.routes.ts](../frontend/src/app/app.routes.ts).
4. Trang [login.page.ts](../frontend/src/app/features/auth/login.page.ts) và [register.page.ts](../frontend/src/app/features/auth/register.page.ts) dùng **Reactive Forms** (`FormBuilder`, `Validators`).
5. [app.config.ts](../frontend/src/app/app.config.ts): initializer gọi `restoreSession()`, rồi `loadAll()` nếu còn phiên.
6. [shell.component.ts](../frontend/src/app/layout/shell.component.ts): tên người dùng, nút Đăng xuất và Mọi thiết bị.
7. Unit test [auth.interceptor.spec.ts](../frontend/src/app/core/api/auth.interceptor.spec.ts): gắn Bearer cho `/api`, không gắn cho `/uploads`, 2 request cùng 401 chỉ refresh 1 lần, refresh lỗi thì về `/login`.

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend;  .\mvnw.cmd verify           # 44 test
cd D:\GF_Master\frontend; npx ng test --watch=false    # 12 test
```

Kiểm tra end-to-end qua proxy 4200 bằng curl có lưu cookie (giống trình duyệt):

| # | Thao tác | Mong đợi |
|---|---|---|
| 1 | `GET /api/v1/places` không token | **401** |
| 2 | `POST /api/v1/auth/login` demo | 200, token dài ~236 ký tự, `expiresIn: 900`, cookie `rt` HttpOnly, Path `/api/v1/auth` |
| 3 | `GET /api/v1/places` với Bearer | 10 quán |
| 4 | `POST /api/v1/auth/refresh` với cookie | 200, token mới **khác** token cũ |
| 5 | `POST /api/v1/auth/logout` | 204 |
| 6 | Refresh lại sau logout | **401** |
| 7 | Đăng nhập sai liên tục | `401 401 401 401 429 429` (lần login đúng ở bước 2 đã tính vào quota 5/phút) |

Trên trình duyệt: mở http://localhost:4200. App tự chuyển tới `/login`; đăng nhập `demo@gfmaster.local` / `Demo@12345`; F5 vẫn giữ phiên; bấm Đăng xuất thì quay về `/login`.

---

## 5. Lỗi đã gặp và bài học

### 5.1. Access token trùng nhau khi refresh trong cùng một giây

**Triệu chứng:** kiểm tra end-to-end, token sau refresh **giống hệt** token cũ.
**Nguyên nhân:** claim chỉ có `sub`, `email`, `iat`, `exp` tính theo **giây**. Cùng giây thì cùng nội dung, và HS256 là thuật toán **tất định** (cùng input, cùng chữ ký).
**Sửa:** thêm claim `jti` (UUID ngẫu nhiên). Test `refreshRotatesCookie` kiểm tra hai token khác nhau.

### 5.2. Origin lạ bị chặn bởi CORS trước khi vào controller

Test kỳ vọng body ProblemDetail `FORBIDDEN`, nhưng thực tế nhận chuỗi `Invalid CORS request`. Lý do: CORS filter của Spring chặn trước khi request tới controller. Về bảo mật đây là **tốt hơn**, nên test được sửa để chỉ kiểm tra mã 403.

### 5.3. Unit test Angular chờ không đủ microtask

Chuỗi `refreshAccessToken().then().finally()` → `from()` → `switchMap()` cần nhiều **microtask**, nên hai lần `await Promise.resolve()` không đủ để request thứ hai được gửi. Test đổi sang chờ một **macrotask** `await new Promise(r => setTimeout(r, 0))`: lúc đó mọi microtask chắc chắn đã chạy xong.

> **Microtask và macrotask:** JavaScript có hai hàng đợi việc. Microtask (callback của Promise) luôn chạy hết **trước** macrotask kế tiếp (`setTimeout`, sự kiện).

### 5.4. Hạn chế đã biết

- **Hai tab cùng refresh đúng một lúc** có thể bị coi là "dùng lại token" và bị đăng xuất. Chuyện này hiếm, vì mỗi tab refresh 15 phút một lần. Nếu gặp thực tế, sẽ thêm *grace period* vài giây cho token vừa xoay.
- **Ảnh `/uploads/**` công khai** với ai có URL. Nếu cần riêng tư tuyệt đối, chuyển sang **signed URL** (URL có chữ ký và hạn dùng) ở Phase 10.

---

**Trước:** [Phase 3](04-phase-3-frontend-noi-api-upload.md) · **Tiếp theo:** [Phase 5](06-phase-5-concurrency.md) · **Tra cứu:** [Thuật ngữ](99-thuat-ngu.md)
