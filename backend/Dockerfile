# Build
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests

# Run: image Ubuntu (glibc), vì scrimage-webp gọi binary cwebp/dwebp đóng gói sẵn; Alpine (musl) không chạy được
FROM eclipse-temurin:21-jre
WORKDIR /app
# /app thuộc user app: STORAGE_DRIVER=local cần tạo ./uploads, ./uploads-incoming trong đây
RUN useradd --system --uid 10001 app && chown app /app
COPY --from=build /src/target/*.jar app.jar
USER app
# Heap theo RAM của container (gói 512MB của Render), chết hẳn khi OOM để Render khởi động lại
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
