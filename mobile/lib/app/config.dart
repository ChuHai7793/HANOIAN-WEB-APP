/// Địa chỉ API, truyền lúc build/chạy:
/// `flutter run --dart-define=API_BASE=http://10.0.2.2:8080/api/v1` (emulator gọi backend trên máy).
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8080/api/v1');
