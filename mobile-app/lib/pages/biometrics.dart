import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import '../models/user_session.dart';
import 'login.dart';

class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> canCheckBiometrics() async {
    try {
      return await _localAuth.canCheckBiometrics;
    } catch (e) {
      return false;
    }
  }

  Future<bool> isDeviceSupported() async {
    try {
      return await _localAuth.isDeviceSupported();
    } catch (e) {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  Future<bool> authenticate({required String reason}) async {
    try {
      await Future.delayed(const Duration(milliseconds: 300));
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
          useErrorDialogs: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }
}

class RegistrationSuccessPage extends StatelessWidget {
  const RegistrationSuccessPage({super.key});

  @override
  Widget build(BuildContext context) {
    final BiometricService biometricService = BiometricService();

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: ClipRect(
          child: Stack(
            children: [
              // Main content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Spacer(flex: 2),

                    // Check icon
                    Image.asset(
                      'assets/images/check.png',
                      height: 80,
                      width: 80,
                    ),
                    const SizedBox(height: 24),

                    // Title
                    Text(
                      'REGISTRATION\nSUCCESSFUL!',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.poppins(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Subtitle
                    Text(
                      'You are now a registered ka-Alaga! Do you want to enable Biometrics for easier log in?',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.albertSans(
                        fontSize: 14,
                        color: Colors.black,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 40),

                    // Enable button
                    SizedBox(
                      width: 200,
                      child: ElevatedButton(
                        onPressed: () async {
                          final canUse = await biometricService.canCheckBiometrics();
                          final isSupported = await biometricService.isDeviceSupported();
                          final available = await biometricService.getAvailableBiometrics();

                          if (!context.mounted) return;

                          if (!canUse || !isSupported || available.isEmpty) {
                            // Device does not support biometrics — inform the user
                            // and proceed to login without enabling the feature.
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Your device does not support biometric login.',
                                  style: GoogleFonts.albertSans(),
                                ),
                                backgroundColor: Colors.orangeAccent,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const LoginPage()),
                              (route) => false,
                            );
                            return;
                          }

                          final authenticated = await biometricService.authenticate(
                            reason: 'Scan your fingerprint to enable biometric login',
                          );

                          if (!context.mounted) return;

                          if (authenticated) {
                            // [OWASP A07] Persist the opt-in flag in AES-encrypted storage.
                            // This is the single source of truth for whether biometric
                            // login is available on the login screen.
                            await SessionManager.enableBiometrics();

                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Biometric login has been enabled.',
                                  style: GoogleFonts.albertSans(),
                                ),
                                backgroundColor: const Color(0xFF4DB6AC),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } else {
                            // Scan was cancelled or failed — do not enable the feature.
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Biometric scan was not completed. You can enable it later in Settings.',
                                  style: GoogleFonts.albertSans(),
                                ),
                                backgroundColor: Colors.orangeAccent,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }

                          if (context.mounted) {
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const LoginPage()),
                              (route) => false,
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          'Enable',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Skip button — outlined transparent style
                    SizedBox(
                      width: 200,
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(builder: (_) => const LoginPage()),
                            (route) => false,
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          backgroundColor: Colors.transparent,
                          side: const BorderSide(color: Colors.black26, width: 1.2),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25),
                          ),
                        ),
                        child: Text(
                          'Skip',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: Colors.black54,
                          ),
                        ),
                      ),
                    ),

                    const Spacer(flex: 3),
                  ],
                ),
              ),

              // Robot peeking from bottom-left corner
              Positioned(
                bottom: 0,
                left: 0,
                child: Image.asset(
                  'assets/images/nakasilip.png',
                  height: 220,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}