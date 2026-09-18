import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:alaga/models/user_session.dart';

UserSession account(int id, String role, {String token = 'token'}) =>
    UserSession(
      id: id,
      username: role,
      email: 'shared@example.test',
      role: role,
      name: role,
      token: token,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('alaga/schedule_reminders'), (_) async => null);
    FlutterSecureStorage.setMockInitialValues({});
    UserSession.current = null;
  });

  test('each account opts in separately and logout preserves both enrollments',
      () async {
    await SessionManager.saveSession(account(1, 'parent'));
    await SessionManager.enableBiometrics();
    await SessionManager.saveSession(account(2, 'caregiver'));
    expect(await SessionManager.isBiometricEnabled(), false);
    expect((await SessionManager.loadBiometricSessions()).single.id, 1);
    await SessionManager.enableBiometrics();
    await SessionManager.clearSession();
    expect((await SessionManager.loadBiometricSessions()).map((s) => s.id),
        [1, 2]);
  });

  test('refreshing or disabling one account leaves the other account intact',
      () async {
    for (final session in [account(1, 'parent'), account(2, 'caregiver')]) {
      await SessionManager.saveSession(session);
      await SessionManager.enableBiometrics();
    }
    await SessionManager.saveSession(account(1, 'parent', token: 'new-token'));
    final sessions = await SessionManager.loadBiometricSessions();
    expect(sessions.first.token, 'new-token');
    expect(sessions.last.token, 'token');
    await SessionManager.disableBiometrics();
    expect((await SessionManager.loadBiometricSessions()).single.id, 2);
  });

  test('refreshing an access token preserves the biometric credential',
      () async {
    await SessionManager.saveSession(account(1, 'parent'));
    await SessionManager.enableBiometrics(biometricToken: 'biometric-token');

    await SessionManager.saveSession(
        account(1, 'parent', token: 'new-access-token'));

    final saved = (await SessionManager.loadBiometricSessions()).single;
    expect(saved.token, 'new-access-token');
    expect(saved.biometricToken, 'biometric-token');
  });

  test(
      'legacy enrollment migrates without enrolling the newly signed-in account',
      () async {
    FlutterSecureStorage.setMockInitialValues({
      'ALAGA_BIOMETRIC_ENABLED': 'true',
      'ALAGA_BIOMETRIC_SESSION': jsonEncode(account(1, 'parent').toJson()),
    });
    await SessionManager.saveSession(account(2, 'caregiver'));
    expect(await SessionManager.isBiometricEnabled(), false);
    expect((await SessionManager.loadBiometricSessions()).single.id, 1);
  });
}
