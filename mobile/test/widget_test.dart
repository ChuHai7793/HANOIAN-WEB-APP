import 'package:flutter_test/flutter_test.dart';
import 'package:gf_master/app/app.dart';
import 'package:gf_master/core/api/api_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('báo đã kết nối khi readiness trả 200', (tester) async {
    late Uri called;
    final api = ApiClient(
      baseUrl: 'http://test/api/v1',
      client: MockClient((req) async {
        called = req.url;
        return http.Response('{"status":"UP"}', 200);
      }),
    );
    await tester.pumpWidget(GfmApp(api: api));
    await tester.pumpAndSettle();

    expect(called.toString(), 'http://test/actuator/health/readiness');
    expect(find.text('Đã kết nối backend'), findsOneWidget);
  });

  testWidgets('báo lỗi khi backend không trả 200', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test/api/v1',
      client: MockClient((_) async => http.Response('', 503)),
    );
    await tester.pumpWidget(GfmApp(api: api));
    await tester.pumpAndSettle();

    expect(find.text('Không kết nối được backend'), findsOneWidget);
  });
}
