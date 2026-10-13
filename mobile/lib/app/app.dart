import 'package:flutter/material.dart';

import '../core/api/api_client.dart';
import 'config.dart';

class GfmApp extends StatelessWidget {
  const GfmApp({super.key, this.api});

  final ApiClient? api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GF Master',
      theme: ThemeData(colorSchemeSeed: Colors.pink, useMaterial3: true),
      home: ServerStatusPage(api: api ?? ApiClient()),
    );
  }
}

/// Màn hình tạm: kiểm tra app gọi được backend. Thay bằng màn hình đăng nhập khi làm features/auth.
class ServerStatusPage extends StatefulWidget {
  const ServerStatusPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<ServerStatusPage> createState() => _ServerStatusPageState();
}

class _ServerStatusPageState extends State<ServerStatusPage> {
  late Future<bool> _ready = widget.api.isServerReady();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('GF Master')),
      body: Center(
        child: FutureBuilder<bool>(
          future: _ready,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const CircularProgressIndicator();
            }
            final ok = snap.data ?? false;
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(ok ? Icons.check_circle : Icons.error, size: 48, color: ok ? Colors.green : Colors.red),
                const SizedBox(height: 12),
                Text(ok ? 'Đã kết nối backend' : 'Không kết nối được backend'),
                Text(apiBase, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => setState(() => _ready = widget.api.isServerReady()),
                  child: const Text('Thử lại'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
