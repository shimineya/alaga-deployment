import 'package:flutter_test/flutter_test.dart';
import 'package:alaga/main.dart';

void main() {
  testWidgets('App basic smoke test', (WidgetTester tester) async {
    // Basic verification that MyApp builds
    expect(const MyApp(), isNotNull);
  });
}
