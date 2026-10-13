import 'package:http/http.dart' as http;

import '../../app/config.dart';

/// HTTP client dùng chung. Sau này thay bằng client sinh từ OpenAPI (packages/gfm_api).
class ApiClient {
  ApiClient({http.Client? client, String baseUrl = apiBase})
      : _client = client ?? http.Client(),
        _base = Uri.parse(baseUrl);

  final http.Client _client;
  final Uri _base;

  /// Backend đã sẵn sàng nhận request chưa (cùng đường dẫn Render dùng để health check).
  Future<bool> isServerReady() async {
    try {
      final res = await _client
          .get(_base.resolve('/actuator/health/readiness'))
          .timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
