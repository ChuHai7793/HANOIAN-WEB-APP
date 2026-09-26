# Phase 3: Nối frontend với API và upload ảnh

> **Kết quả:** Angular đọc/ghi dữ liệu qua REST API thay cho `localStorage`, giao diện giữ nguyên. Chọn ảnh thì ảnh được nén rồi upload lên server. Lỗi hiển thị bằng thông báo tiếng Việt.
> **Commit:** `feat: connect Angular frontend to API and add synchronous image upload (Phase 3)`

> **Điều chỉnh so với plan gốc:** phần upload ảnh *đồng bộ* được kéo từ Phase 6 lên Phase 3. Từ Phase 2 server đã chặn ảnh base64, nên nếu chờ tới Phase 6 thì chức năng chọn ảnh sẽ hỏng suốt 3 phase.

---

## 1. Mục tiêu

- Thay tầng lưu trữ của frontend (localStorage) bằng HTTP, **sửa component ít nhất có thể**.
- Giao diện vẫn phản hồi tức thì, dù mỗi thao tác giờ phải đi qua mạng.
- Ảnh lưu thành file thật trên server, không nhồi base64 vào dữ liệu nữa.

---

## 2. Kiến thức cần biết (frontend)

### 2.1. SPA và Angular

**SPA (Single Page Application):** trình duyệt tải **một** trang HTML. Sau đó JavaScript tự vẽ các "trang" khác và gọi API lấy dữ liệu, không tải lại cả trang. Angular là framework để xây SPA.

Các khái niệm Angular dùng trong dự án:

| Khái niệm | Giải thích |
|---|---|
| **Component** | Một phần giao diện: class TypeScript + template HTML. *Standalone component* tự khai báo mình cần gì (`imports: [...]`), không cần `NgModule`. |
| **Service** | Class chứa logic dùng chung (gọi API, giữ state). `@Injectable({ providedIn: 'root' })` = một instance cho cả app (**singleton**). |
| **DI (`inject()`)** | Giống Spring: `inject(HttpClient)` để Angular tự đưa dependency vào. |
| **Signal** | Giá trị "phản ứng": `signal([])` giữ state; component đọc bằng `items()`; state đổi thì giao diện tự vẽ lại. |
| **`computed`** | Signal suy ra từ signal khác, tự tính lại khi nguồn đổi: `cafes = computed(() => items().filter(...))`. |
| **Router** | Ánh xạ URL → component; **lazy loading** (`loadComponent`) chỉ tải code của trang khi vào trang đó. |
| **Control flow** | `@if`, `@for`, `@else` ngay trong template. |

### 2.2. HttpClient, Observable và Promise

`HttpClient` là dịch vụ gọi HTTP của Angular. Nó trả về **Observable** (thư viện **RxJS**): một "luồng" có thể phát nhiều giá trị theo thời gian.

- Request thường chỉ phát **1** giá trị (response), nên được chuyển sang **Promise** bằng `firstValueFrom(...)` để viết `async/await` cho dễ đọc:
  ```ts
  const rows = await firstValueFrom(this.http.get<Place[]>('/api/v1/places'));
  ```
- Upload có % tiến trình phát **nhiều** sự kiện (`UploadProgress`… rồi `Response`), nên dùng Observable với `tap(...)` và `lastValueFrom(...)`.

**Observable là "lười" (lazy):** request chỉ được gửi khi có ai *subscribe*. `firstValueFrom` tự subscribe.

### 2.3. Interceptor và HttpContext

**Interceptor** là hàm chen vào **mọi** request/response của HttpClient, như "middleware" phía client. Dùng để làm việc chung một lần thay vì lặp ở mỗi chỗ gọi API.

- [error.interceptor.ts](../frontend/src/app/core/api/error.interceptor.ts): lỗi HTTP nào cũng được dịch sang tiếng Việt và hiện **toast** (thông báo nổi góc màn hình).
- (Phase 4) `auth.interceptor.ts`: gắn token, tự refresh.

**HttpContext** gắn "cờ" riêng cho từng request để interceptor đọc. Ví dụ `SILENT_ERRORS = true` nghĩa là request này tự xử lý lỗi, không hiện toast chung. Các cờ nằm ở [http-context.ts](../frontend/src/app/core/api/http-context.ts).

### 2.4. Dev proxy, same-origin và CORS

**Origin** = `scheme + host + port`, ví dụ `http://localhost:4200`. Trình duyệt áp **Same-Origin Policy**: JavaScript ở origin A **không được đọc** response từ origin B, trừ khi B cho phép bằng header **CORS** (`Access-Control-Allow-Origin`). Khi phát triển, frontend chạy ở `:4200` còn backend ở `:8080`, tức là **khác origin**.

Có hai cách giải:
1. Bật CORS ở backend. Làm được, nhưng cookie và header phức tạp hơn.
2. **Proxy:** frontend chỉ gọi `/api/...` trên chính `:4200`; dev server của Angular chuyển tiếp sang `:8080`. Với trình duyệt thì mọi thứ **cùng origin**.

Dự án chọn cách 2, giống hệt production (nơi Caddy làm proxy). [proxy.conf.json](../frontend/proxy.conf.json):

```json
{
  "/api":     { "target": "http://localhost:8080", "secure": false },
  "/uploads": { "target": "http://localhost:8080", "secure": false }
}
```

Khai báo trong [angular.json](../frontend/angular.json) → `serve.options.proxyConfig`. Nhờ vậy code frontend chỉ có một hằng `API_BASE = '/api/v1'` ([api.ts](../frontend/src/app/core/api/api.ts)), không cần thư mục `environments/`.

### 2.5. Optimistic UI và rollback

**Vấn đề:** mỗi thao tác giờ mất 50–300 ms qua mạng. Nếu chờ server trả lời mới cập nhật giao diện, app có cảm giác "ì".

**Optimistic update (cập nhật lạc quan):** cập nhật giao diện **ngay** như thể đã thành công, rồi mới gửi request. Nếu server báo lỗi thì **hoàn tác (rollback)** về trạng thái cũ.

```
Bấm Xoá → quán biến mất ngay → DELETE /places/{id}
                                 ├─ 204 → xong
                                 ├─ 404 → coi như xong (đã bị xoá ở thiết bị khác)
                                 └─ lỗi khác → hiện lại quán + toast lỗi
```

Riêng khi **sửa** và gặp **409 VERSION_CONFLICT**, không rollback về bản cũ của mình mà **thay bằng bản `current`** server gửi kèm: đó là dữ liệu mới nhất.

### 2.6. App initializer

`provideAppInitializer(fn)` chạy `fn` (có thể async) **trước khi** app hiển thị. Dự án dùng nó để tải dữ liệu trước, tránh chớp nháy "Chưa có quán nào" rồi mới hiện danh sách. Hàm này **không bao giờ reject**: server lỗi thì app vẫn khởi động và hiện banner "Thử lại".

---

## 3. Kiến thức cần biết (upload ảnh)

### 3.1. multipart/form-data

JSON không chở file nhị phân hiệu quả (phải đổi sang base64, to thêm ~33%). HTML form upload file dùng định dạng **`multipart/form-data`**: body chia thành nhiều "phần", mỗi phần có header riêng và có thể chứa byte nhị phân. Trên frontend dùng `FormData`:

```ts
const form = new FormData();
form.append('file', blob, 'image.webp');
this.http.post('/api/v1/uploads/image', form, { reportProgress: true, observe: 'events' });
```

Trên Spring: `@RequestParam("file") MultipartFile file`. Giới hạn kích thước cấu hình ở `spring.servlet.multipart.max-file-size: 12MB`.

### 3.2. Không tin client: magic bytes

Tên file `.png` và header `Content-Type: image/png` đều do **client tự khai**, giả được dễ dàng. Server kiểm tra **magic bytes**, tức vài byte đầu file đặc trưng cho từng định dạng:

| Định dạng | Byte đầu file |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` (`.PNG....`) |
| WebP | `RIFF` + 4 byte kích thước + `WEBP` |

Xem [ImageProcessor.java](../backend/src/main/java/com/gfmaster/upload/ImageProcessor.java). File không khớp bị trả **415 `UNSUPPORTED_IMAGE`**.

### 3.3. Xử lý ảnh: EXIF, resize, WebP

- **EXIF**: metadata nhúng trong ảnh chụp: hướng xoay, thời gian, **toạ độ GPS**, loại máy. Server làm hai việc:
  1. **Xoay ảnh theo EXIF orientation**, vì ảnh điện thoại thường lưu nằm ngang kèm cờ "xoay 90°".
  2. **Mã hoá lại ảnh**, nhờ đó toàn bộ metadata bị bỏ và **không lộ vị trí** người chụp.
- **Resize**: cạnh dài tối đa 1200px, **không phóng to** ảnh nhỏ.
- **WebP**: định dạng ảnh của Google, nhẹ hơn JPEG ~25–35% với cùng chất lượng. Chất lượng `q = 78`.
- Thư viện **Scrimage**: `scrimage-webp` đóng gói sẵn công cụ `cwebp`/`dwebp` cho Windows/Linux/macOS.

**Nén hai lần có thừa không?** Frontend nén ở client (canvas, ≤1200px) để **tiết kiệm băng thông**: ảnh 5MB từ điện thoại chỉ còn vài trăm KB trước khi gửi. Server vẫn xử lý lại vì **không tin client**.

### 3.4. Storage driver và path traversal

[StorageDriver.java](../backend/src/main/java/com/gfmaster/upload/storage/StorageDriver.java) là **interface** với `put(key, bytes)` và `delete(key)`. Hiện có [LocalStorageDriver.java](../backend/src/main/java/com/gfmaster/upload/storage/LocalStorageDriver.java) ghi vào thư mục `uploads/`. Production (Phase 10) sẽ thêm driver S3/R2 **mà không phải sửa chỗ nào khác**. Đây là nguyên tắc *lập trình theo interface*.

**Tên file do server sinh:** `{userId}/{yyyy}/{MM}/{uuid}.webp`. Không bao giờ dùng tên client gửi.

**Path traversal** là tấn công dùng `../` để thoát khỏi thư mục được phép, ví dụ `GET /uploads/../../application.yml`. Driver chuẩn hoá đường dẫn rồi kiểm tra `target.startsWith(root)`. Spring `ResourceHandler` cũng tự chặn `..`.

### 3.5. Cache-Control immutable

Tên file ảnh là UUID, **không bao giờ đổi nội dung** (sửa ảnh = file mới, tên mới). Vì vậy server trả:

```
Cache-Control: max-age=31536000, public, immutable
```

Trình duyệt và CDN giữ ảnh 1 năm, không hỏi lại server.

---

## 4. Các bước thực hiện

### Bước 1: Backend upload

1. `StorageDriver` + `LocalStorageDriver` (§3.4).
2. `ImageProcessor` (§3.2, §3.3). Thêm `scrimage-core` và `scrimage-webp` vào [pom.xml](../backend/pom.xml).
3. [UploadService.java](../backend/src/main/java/com/gfmaster/upload/UploadService.java): xử lý ảnh → lưu file → ghi bảng `uploads` (status `READY`).
4. [UploadController.java](../backend/src/main/java/com/gfmaster/upload/UploadController.java): `POST /api/v1/uploads/image` (201) và `DELETE /api/v1/uploads/{id}` (chỉ chủ sở hữu).
5. [WebConfig.java](../backend/src/main/java/com/gfmaster/config/WebConfig.java): phục vụ file `/uploads/**` từ thư mục local, với Cache-Control ở §3.5.
6. Test [UploadControllerIT.java](../backend/src/test/java/com/gfmaster/upload/UploadControllerIT.java): ảnh 2400×1200 thành 1200×600 WebP; ảnh nhỏ không bị phóng to; file text đội lốt `.png` trả 415; user khác xoá không được; path traversal bị chặn.

### Bước 2: Tầng API frontend

1. [api.ts](../frontend/src/app/core/api/api.ts): `API_BASE`, kiểu `ApiProblem`, hàm `errorMessage(err)` dịch `code` sang câu tiếng Việt.
2. [toast.service.ts](../frontend/src/app/core/services/toast.service.ts) và [toast-host.component.ts](../frontend/src/app/shared/ui/toast-host.component.ts): thông báo nổi, tự ẩn, không chồng câu trùng.
3. [error.interceptor.ts](../frontend/src/app/core/api/error.interceptor.ts).
4. [app.config.ts](../frontend/src/app/app.config.ts): `provideHttpClient(withFetch(), withInterceptors([...]))`.
5. [proxy.conf.json](../frontend/proxy.conf.json) + `angular.json`.

### Bước 3: Viết lại `CrudStore`

[crud-store.ts](../frontend/src/app/core/services/crud-store.ts) là lớp cha của `PlaceService`, `GirlfriendService`, `PlaceLinkService`. **API công khai giữ nguyên** (`items()`, `byId()`, `create()`, `update()`, `remove()`), chỉ đổi bên trong:

| Hàm | Trước | Sau |
|---|---|---|
| constructor | đọc localStorage + seed | chỉ nhận đường dẫn API (`'places'`) |
| `load()` | — | `GET` rồi đổ vào signal |
| `create` | thêm vào mảng | `POST`, thêm bản server trả về (có `id` thật) |
| `update` | gộp vào mảng | optimistic → `PATCH` kèm `version` → thay bằng bản server / `current` / rollback |
| `remove` | lọc khỏi mảng | optimistic → `DELETE` → rollback nếu lỗi (trừ 404) |
| `dropLocal` | — | chỉ xoá khỏi state (server đã cascade) |

Mỗi service có thể **chuẩn hoá dữ liệu** qua `fromApi`/`toApi`. Ví dụ ngày trống: server dùng `null`, giao diện dùng `''`. Xem [girlfriend.service.ts](../frontend/src/app/core/services/girlfriend.service.ts).

Các field chỉ đọc (`id`, `version`, `createdAt`, `updatedAt`) bị bỏ khỏi body trước khi gửi.

### Bước 4: Tải dữ liệu lúc khởi động

[data-bootstrap.service.ts](../frontend/src/app/core/services/data-bootstrap.service.ts) tải cả 3 bảng song song (`Promise.all`). Dữ liệu nhỏ nên tải hết một lần, và mọi logic lọc/sắp xếp phía client **giữ nguyên**. Shell hiện banner "Thử lại" khi `status === 'error'`.

### Bước 5: Sửa component

Các hàm lưu/xoá thành `async`, có cờ `saving` chống bấm hai lần, và **lỗi thì giữ form mở**:

```ts
protected async handleSave(place: Place): Promise<void> {
  if (this.saving()) return;
  this.saving.set(true);
  try {
    existing ? await this.placeService.update(existing.id, data)
             : await this.placeService.create(data);
    this.closeForm();                // chỉ đóng khi thành công
  } catch {
    // giữ form mở; toast đã do errorInterceptor hiện
  } finally {
    this.saving.set(false);
  }
}
```

Sau khi xoá quán hoặc người yêu thành công, gọi `linkService.dropByPlace(id)` / `dropByGirlfriend(id)` để bỏ các link khỏi state (server đã tự xoá).

Model thêm trường `version: number`, form điền `version: existing?.version ?? 0`.

### Bước 6: Image picker upload thật

[image-picker.component.ts](../frontend/src/app/shared/ui/image-picker.component.ts):
1. Nén ảnh bằng **canvas** thành `Blob` WebP (≤1200px), qua `fileToCompressedBlob` trong [image.ts](../frontend/src/app/core/utils/image.ts).
2. Upload qua [upload.service.ts](../frontend/src/app/core/services/upload.service.ts), hiện **% tiến trình** từ sự kiện `HttpEventType.UploadProgress`.
3. Nhận `url` dạng `/uploads/...` rồi đặt vào ô ảnh.

### Bước 7: Dọn dẹp

Xoá `StorageService`, `seed.ts` (seed đã chuyển sang Flyway) và banner "bộ nhớ đầy".

### Bước 8: Unit test frontend

**Vitest** là framework test JavaScript nhanh, Angular 21 dùng qua `ng test`. **HttpTestingController** là "backend giả": test chỉ định request nào được trả gì, không gửi mạng thật.

[crud-store.spec.ts](../frontend/src/app/core/services/crud-store.spec.ts) có 8 test:
- `load` đổ vào signal.
- `create` bỏ field chỉ đọc.
- `update` optimistic và gửi kèm version.
- 409 thì thay bằng `current`; lỗi khác thì rollback.
- `remove` lỗi thì trả lại; 404 coi như thành công.
- Chuẩn hoá ngày `null` ↔ `''`.

---

## 5. Kiểm tra kết quả

```powershell
cd D:\GF_Master\frontend
npx ng build --configuration development   # build qua = không có lỗi TypeScript
npx ng test --watch=false                  # unit test
```

Kiểm tra end-to-end qua proxy, khi backend (8080) và `npm start` (4200) đang chạy:

| Kiểm tra | Kết quả mong đợi |
|---|---|
| `GET http://localhost:4200/api/v1/places` | Danh sách quán, giờ `"08:00"` |
| Upload JPEG 2000×1500 qua `:4200` | 1200×900 WebP, `url` bắt đầu bằng `/uploads/` |
| `GET http://localhost:4200/uploads/...` | 200, `image/webp` |
| Tạo quán với `imageUrl: "data:image/png;base64,..."` | 400 `VALIDATION_FAILED`, field `imageUrl` |

---

## 6. Lỗi đã gặp và bài học

- **Lần đầu `ng serve` mất ~17 phút**, có thể do antivirus quét `node_modules`. Xem cách khắc phục ở [00 §6](00-cong-cu-va-moi-truong.md#6-nodejs-npm-và-angular-cli).
- **Dữ liệu cũ trong localStorage không hiện nữa.** Dữ liệu không bị xoá, chỉ không còn được đọc. Việc đưa nó lên server là **Phase 8 (Import)**.
- **PowerShell `Set-Location` không đổi thư mục của .NET:** `[IO.File]::ReadAllText('relative\path')` đọc theo thư mục làm việc của process, không theo `Set-Location`. Luôn dùng **đường dẫn tuyệt đối** trong script.

---

**Trước:** [Phase 2](03-phase-2-crud-api.md) · **Tiếp theo:** [Phase 4: Xác thực JWT](05-phase-4-xac-thuc-jwt.md)
