import 'package:alaga/models/user_session.dart';
import 'package:flutter_test/flutter_test.dart';

UserSession sessionFor(String role) => UserSession(
      id: 1,
      username: 'test-user',
      email: 'test@example.com',
      role: role,
      name: 'Test User',
      token: 'token',
    );

void main() {
  test('parent and caregiver roles can use the mobile app', () {
    expect(sessionFor('parent').canUseMobileApp, isTrue);
    expect(sessionFor('caregiver').canUseMobileApp, isTrue);
    expect(sessionFor(' Parent ').canUseMobileApp, isTrue);
  });

  test('web-only roles cannot use the mobile app', () {
    for (final role in [
      'admin',
      'facility_admin',
      'medical_staff',
      'system_admin',
      'sysadmin',
    ]) {
      expect(sessionFor(role).canUseMobileApp, isFalse, reason: role);
    }
  });
}
