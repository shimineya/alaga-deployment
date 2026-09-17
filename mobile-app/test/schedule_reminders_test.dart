import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:alaga/services/schedule_reminder_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <MethodCall>[];
  var permission = true;
  var exact = true;
  var nextId = 100;
  setUp(() {
    calls.clear();
    permission = true;
    exact = true;
    FlutterSecureStorage.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('alaga/schedule_reminders'), (call) async {
        calls.add(call);
        switch (call.method) {
          case 'requestPermission': return permission;
          case 'exactAllowed': return exact;
          case 'schedule': return ++nextId;
          default: return null;
        }
      },
    );
  });
  final future = DateTime.now().add(const Duration(days: 1));

  test('saving persists schedule and submits the exact due time', () async {
    final saved = await ScheduleReminderService.save(1, 'tomorrow', future, {'what': 'Care task'});
    expect((await ScheduleReminderService.load(1))['tomorrow']!.single, saved);
    final scheduled = calls.singleWhere((c) => c.method == 'schedule');
    expect(scheduled.arguments['at'], future.millisecondsSinceEpoch);
    expect(scheduled.arguments['owner'], 1);
  });
  test('denied notifications and past times do not save appointments', () async {
    permission = false;
    await expectLater(ScheduleReminderService.save(1, 'tomorrow', future, {}), throwsStateError);
    expect(await ScheduleReminderService.load(1), isEmpty);
    await expectLater(ScheduleReminderService.save(1, 'past', DateTime(2020), {}), throwsStateError);
    expect(calls.where((c) => c.method == 'schedule'), isEmpty);
  });
  test('missing alarm permission opens settings without saving', () async {
    exact = false;
    await expectLater(ScheduleReminderService.save(1, 'tomorrow', future, {}), throwsStateError);
    expect(calls.any((c) => c.method == 'openExactSettings'), true);
    expect(await ScheduleReminderService.load(1), isEmpty);
  });
  test('deleting cancels its reminder and preserves the other account', () async {
    final first = await ScheduleReminderService.save(1, 'tomorrow', future, {});
    await ScheduleReminderService.save(2, 'tomorrow', future, {});
    await ScheduleReminderService.delete(1, 'tomorrow', first['id']!);
    expect(await ScheduleReminderService.load(1), isEmpty);
    expect((await ScheduleReminderService.load(2))['tomorrow'], hasLength(1));
    expect(calls.lastWhere((c) => c.method == 'cancel').arguments['id'], int.parse(first['id']!));
  });
}
