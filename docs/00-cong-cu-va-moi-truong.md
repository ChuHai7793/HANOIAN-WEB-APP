# Công cụ và môi trường phát triển

File này giải thích **từng công cụ** dự án dùng: nó là gì, tại sao cần, cài thế nào và dùng các lệnh nào. Đọc xong bạn sẽ dựng được môi trường chạy dự án trên một máy Windows mới.

---

## 1. Tổng quan: cần cài những gì?

| Công cụ | Phiên bản | Dùng cho | Kiểm tra đã cài |
|---|---|---|---|
| Git | 2.4x+ | Quản lý phiên bản mã nguồn | `git --version` |
| Docker Desktop | 4.x (Engine 29+) | Chạy MariaDB, Redis, RabbitMQ | `docker version` |
| JDK | **21** (LTS) | Biên dịch và chạy backend Java | `java -version` |
| Maven | *không cần cài* | Build backend (dùng Maven Wrapper `mvnw`) | `.\mvnw.cmd -v` |
| Node.js | 20+ (kèm npm) | Chạy công cụ build Angular | `node -v`, `npm -v` |
| Angular CLI | 21 (cài theo dự án) | Build/serve/test frontend | `npx ng version` |
| VS Code | mới nhất | Soạn code | — |
| curl | có sẵn trên Windows 11 | Gọi thử API từ terminal | `curl.exe --version` |

---

## 2. Terminal: PowerShell và Git Bash

**Terminal (shell)** là chương trình cho phép gõ lệnh để điều khiển máy tính. Trên Windows có hai loại hay dùng:

| | PowerShell | Git Bash |
|---|---|---|
| Có sẵn | Có sẵn trên Windows | Đi kèm khi cài Git |
| Cú pháp | Riêng của Microsoft (`$env:X`, `Get-ChildItem`) | Giống Linux (`export X=`, `ls`, `grep`) |
| Chạy Maven Wrapper | `.\mvnw.cmd ...` | `./mvnw ...` |
| Nối lệnh | `;` hoặc `if ($?) { ... }` | `&&` |

Các lệnh trong tài liệu này viết cho **PowerShell**, trừ khi ghi rõ là Git Bash.

> **Lưu ý PowerShell 5.1:** lệnh `Invoke-RestMethod` có thể hiển thị sai dấu tiếng Việt, vì nó tự đoán bảng mã khi server không ghi rõ `charset`. Dữ liệu thật vẫn đúng. Khi cần xem chính xác, dùng `curl.exe` hoặc mở bằng trình duyệt.

---

## 3. Git và GitHub

### 3.1. Khái niệm

- **Git**: hệ thống quản lý phiên bản. Nó ghi lại lịch sử thay đổi của mã nguồn, để xem lại, quay về bản cũ hoặc làm song song nhiều hướng.
- **Repository (repo)**: thư mục được Git theo dõi. Thông tin lịch sử nằm trong thư mục ẩn `.git/`.
- **Commit**: một "ảnh chụp" trạng thái mã nguồn, kèm lời mô tả (commit message). Mỗi commit có một mã băm (hash) như `8ce24fd`.
- **Branch (nhánh)**: một dòng lịch sử commit. Dự án dùng `main` (ổn định) và `dev` (đang phát triển).
- **Remote**: bản sao repo trên máy chủ khác, ở đây là GitHub. Tên mặc định là `origin`.
- **Push / Pull / Fetch**: đẩy commit lên remote / kéo về và gộp / chỉ tải về để xem.
- **Staging area**: vùng "chuẩn bị commit". Lệnh `git add` đưa thay đổi vào đây, `git commit` chụp lại.

### 3.2. Lệnh hay dùng

```powershell
git status                      # đang thay đổi gì
git add -A                      # đưa mọi thay đổi vào staging
git commit -m "feat: ..."       # tạo commit
git log --oneline -n 10         # xem 10 commit gần nhất
git switch dev                  # chuyển sang nhánh dev
git checkout -b ten-nhanh main  # tạo nhánh mới từ main và chuyển sang
git push                        # đẩy nhánh hiện tại lên GitHub
git push -u origin dev          # lần đầu đẩy nhánh dev, ghi nhớ nhánh theo dõi
```

### 3.3. Quy ước commit message

Dự án dùng kiểu **Conventional Commits**: `loại: mô tả ngắn`.

| Loại | Khi nào |
|---|---|
| `feat` | Thêm tính năng |
| `fix` | Sửa lỗi |
| `chore` | Việc lặt vặt (cấu hình, dọn dẹp) |
| `docs` | Tài liệu |
| `test` | Thêm hoặc sửa test |

### 3.4. Viết lại lịch sử và `--force-with-lease`

Sửa commit đã push (ví dụ xoá thông tin trong message) sẽ **đổi hash** của commit. GitHub sẽ từ chối push thường vì lịch sử không còn nối tiếp. Khi đó phải dùng:

```powershell
git push --force-with-lease origin dev
```

`--force-with-lease` an toàn hơn `--force`: nó **từ chối** ghi đè nếu trên GitHub có commit mà máy bạn chưa biết, nên bạn không lỡ xoá việc của người khác. Mọi người đã clone repo sẽ phải chạy `git fetch` rồi `git reset --hard origin/dev`.

### 3.5. Xác thực với GitHub

Máy Windows cài Git có sẵn **Git Credential Manager (GCM)**. Lần đầu push qua HTTPS, GCM mở trình duyệt để đăng nhập GitHub rồi lưu thông tin đăng nhập, nên các lần sau không cần làm lại. Muốn đổi tài khoản: mở *Credential Manager* của Windows → *Windows Credentials* → xoá mục `git:https://github.com`.

---

## 4. Docker và Docker Compose

### 4.1. Vì sao cần Docker?

Backend cần MariaDB, Redis, RabbitMQ. Cài trực tiếp từng thứ lên Windows thì lâu, dễ xung đột phiên bản, và mỗi máy mỗi khác. **Docker** chạy mỗi phần mềm trong một "hộp" cô lập, cấu hình giống hệt nhau trên mọi máy, xoá đi cũng không để lại rác.

### 4.2. Khái niệm

| Khái niệm | Giải thích | Ví dụ trong dự án |
|---|---|---|
| **Image** | Bản đóng gói chỉ đọc gồm phần mềm và mọi thứ nó cần. Giống "file cài đặt". | `mariadb:11.4`, `redis:7-alpine` |
| **Tag** | Nhãn phiên bản của image (sau dấu `:`). `alpine` = bản dựng trên Alpine Linux, rất nhẹ. | `11.4`, `7-alpine`, `4-management-alpine` |
| **Container** | Một phiên bản **đang chạy** của image. Có thể chạy nhiều container từ một image. | Container `mariadb` |
| **Port mapping** | Nối cổng trên máy thật với cổng trong container: `"3306:3306"` = máy:container. | App trên máy gọi `localhost:3306` |
| **Volume** | Vùng lưu trữ nằm ngoài container để dữ liệu **không mất** khi xoá/tạo lại container. | `mariadb:/var/lib/mysql` |
| **Healthcheck** | Lệnh Docker chạy định kỳ để biết dịch vụ đã sẵn sàng chưa (không chỉ "đã khởi động"). | `healthcheck.sh --connect` |
| **Docker Compose** | Khai báo nhiều container trong một file YAML và bật/tắt cùng lúc. | [docker-compose.yml](../docker-compose.yml) |
| **Profile (Compose)** | Nhóm dịch vụ chỉ chạy khi được yêu cầu. | `mongo` chỉ chạy với `--profile mongo` |
| **Docker Desktop** | Ứng dụng Windows chứa Docker Engine, chạy qua WSL2. **Phải mở nó trước** khi dùng lệnh `docker`. | — |

### 4.3. Lệnh hay dùng

```powershell
docker compose up -d            # bật tất cả dịch vụ ở nền (-d = detached)
docker compose ps               # xem trạng thái, cột STATUS có "(healthy)" là sẵn sàng
docker compose logs -f mariadb  # xem log của một dịch vụ (Ctrl+C để thoát)
docker compose stop             # tạm dừng (giữ dữ liệu)
docker compose down             # xoá container (vẫn giữ volume = giữ dữ liệu)
docker compose down -v          # xoá cả volume = XOÁ SẠCH dữ liệu, cẩn thận
docker compose exec mariadb mariadb -ugfm -pgfm gfmaster   # mở MariaDB shell
```

### 4.4. Giao diện web đi kèm

| Công cụ | Địa chỉ | Đăng nhập |
|---|---|---|
| **Adminer**: xem/sửa database qua web | http://localhost:8081 | System: *MySQL*, Server: `mariadb`, User `gfm`, Pass `gfm`, DB `gfmaster` |
| **RabbitMQ Management**: xem queue/message | http://localhost:15672 | `gfm` / `gfm` |

---

## 5. Java, JDK và Maven

### 5.1. JDK và JRE

- **JVM (Java Virtual Machine)**: máy ảo chạy bytecode Java, nhờ đó "viết một lần, chạy mọi nơi".
- **JRE**: JVM kèm thư viện chuẩn, đủ để **chạy** chương trình Java.
- **JDK**: JRE kèm công cụ **phát triển** (`javac` biên dịch, `jar`, `javap`…). Lập trình thì cần JDK.
- **LTS (Long-Term Support)**: phiên bản được hỗ trợ dài hạn. Dự án dùng **Java 21 LTS**, có *virtual threads* (luồng nhẹ, xem [Phase 1](02-phase-1-khung-spring-boot-flyway.md)).

Kiểm tra: `java -version` phải in ra `21.x`.

### 5.2. Maven

**Maven** là công cụ build cho Java:
- Tải các **dependency** (thư viện) khai báo trong [pom.xml](../backend/pom.xml) từ kho Maven Central về `~/.m2/repository`.
- Biên dịch, chạy test, đóng gói thành file `.jar`.

**POM (Project Object Model)**, tức file `pom.xml`, mô tả dự án: tên, phiên bản Java, dependency, plugin.

**Vòng đời (lifecycle) Maven** gồm các phase chạy nối tiếp. Gọi một phase thì mọi phase trước nó cũng chạy:

```
validate → compile → test → package → integration-test → verify → install
```

| Lệnh | Làm gì |
|---|---|
| `.\mvnw.cmd compile` | Biên dịch mã nguồn |
| `.\mvnw.cmd test` | Chạy unit test (file `*Test.java`, plugin *Surefire*) |
| `.\mvnw.cmd verify` | Chạy cả test tích hợp (file `*IT.java`, plugin *Failsafe*) |
| `.\mvnw.cmd package -DskipTests` | Đóng gói `.jar`, bỏ qua test |
| `.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"` | Chạy app với profile dev |

### 5.3. Maven Wrapper (`mvnw`)

Dự án **không bắt bạn cài Maven**. File `mvnw` (Linux/macOS/Git Bash) và `mvnw.cmd` (Windows) là **Maven Wrapper**: lần đầu chạy, nó tự tải đúng phiên bản Maven ghi trong `.mvn/wrapper/maven-wrapper.properties`. Mọi người trong nhóm và máy CI đều dùng cùng một phiên bản.

> Trên PowerShell phải gõ `.\mvnw.cmd`, có `.\` ở đầu, vì PowerShell không tự tìm lệnh trong thư mục hiện tại.

---

## 6. Node.js, npm và Angular CLI

- **Node.js**: môi trường chạy JavaScript ngoài trình duyệt. Frontend không *chạy* trên Node, nhưng **công cụ build** (Angular CLI, Vite, TypeScript compiler) thì cần Node.
- **npm**: trình quản lý package của Node. Đọc [package.json](../frontend/package.json) và tải thư viện vào `node_modules/`.
- **package-lock.json**: ghi chính xác phiên bản đã cài, để mọi máy cài giống nhau. Luôn commit file này.
- **npx**: chạy một lệnh từ package đã cài trong dự án mà không cần cài toàn cục, ví dụ `npx ng build`.
- **Angular CLI (`ng`)**: công cụ dòng lệnh của Angular.

| Lệnh | Làm gì |
|---|---|
| `npm install` | Cài dependency (lần đầu hoặc khi `package.json` đổi) |
| `npm start` (= `ng serve`) | Chạy dev server tại http://localhost:4200, tự reload khi sửa code |
| `npx ng build` | Build bản production vào `dist/` |
| `npx ng test --watch=false` | Chạy unit test một lần (Vitest) |

> **Lần đầu `ng serve` có thể rất chậm** (trên máy dev từng mất ~17 phút) do Windows Defender quét hàng chục nghìn file trong `node_modules`. Cách khắc phục: thêm thư mục `D:\GF_Master\frontend` vào *Windows Security → Virus & threat protection → Exclusions*.

---

## 7. VS Code: extension nên cài

| Extension | Để làm gì |
|---|---|
| *Extension Pack for Java* (Microsoft) | Gợi ý code, báo lỗi, chạy test Java |
| *Spring Boot Extension Pack* | Hỗ trợ `application.yml`, dashboard Spring |
| *Angular Language Service* | Gợi ý và kiểm tra lỗi trong template Angular |
| *Tailwind CSS IntelliSense* | Gợi ý class Tailwind |
| *Docker* | Xem container, log |
| *GitLens* | Xem ai sửa dòng nào, lịch sử file |

> Khi vừa tạo file mới, VS Code đôi khi báo lỗi đỏ kiểu "cannot be resolved" do chưa kịp đọc lại. Nếu `mvnw compile` hoặc `ng build` chạy qua thì code đúng, chỉ là IDE chưa cập nhật.

---

## 8. curl: gọi thử API

**curl** gửi HTTP request từ terminal. Trên PowerShell phải gõ `curl.exe`, vì `curl` bị gán cho `Invoke-WebRequest`.

```powershell
# GET, hiển thị mã trạng thái
curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/actuator/health

# POST JSON (PowerShell cần escape dấu ")
curl.exe -s -H "Content-Type: application/json" `
  -d '{\"email\":\"demo@gfmaster.local\",\"password\":\"Demo@12345\"}' `
  http://localhost:4200/api/v1/auth/login

# Lưu / gửi cookie như trình duyệt
curl.exe -c cookies.txt ...   # lưu cookie nhận được
curl.exe -b cookies.txt ...   # gửi kèm cookie đã lưu

# Upload file multipart
curl.exe -F "file=@anh.jpg;type=image/jpeg" -H "Authorization: Bearer <token>" `
  http://localhost:4200/api/v1/uploads/image
```

---

## 9. Checklist dựng môi trường trên máy mới

1. Cài **Git**, rồi đặt tên và email:
   `git config --global user.name "Tên"` và `git config --global user.email "email@..."`.
2. Cài **Docker Desktop**, mở lên, chờ biểu tượng cá voi chuyển sang trạng thái "running".
3. Cài **JDK 21**, ví dụ Eclipse Temurin hoặc Oracle JDK. Kiểm tra bằng `java -version`.
4. Cài **Node.js** bản LTS. Kiểm tra bằng `node -v`.
5. Clone repo: `git clone https://github.com/ChuHai7793/HANOIAN-WEB-APP.git D:\GF_Master`, rồi `git switch dev`.
6. `docker compose up -d`, chờ `docker compose ps` báo `healthy`.
7. `cd backend; .\mvnw.cmd verify`. Lần đầu mất vài phút để tải dependency và image test.
8. `cd frontend; npm install; npm start`.
9. Chạy backend (xem [README](README.md#chạy-nhanh-toàn-bộ-dự-án)), mở http://localhost:4200.
