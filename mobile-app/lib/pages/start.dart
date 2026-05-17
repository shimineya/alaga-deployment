import 'package:flutter/material.dart';
import 'intro.dart';
import 'dashboard.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';

class StartPage extends StatefulWidget {
  const StartPage({super.key});

  @override
  State<StartPage> createState() => _StartPageState();
}

class _StartPageState extends State<StartPage> {
  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigateToIntro();
    });
  }

  Future<void> _navigateToIntro() async {
    await Future.delayed(const Duration(seconds: 3));
    final session = await SessionManager.loadSession();

    if (!mounted) return;

    if (session != null) {
      // [OWASP A07] Validate token freshness before trusting cached session.
      // If the JWT has expired (8h) or been revoked by an admin, this call
      // will return a non-success response and we purge the stale session
      // instead of sending the user into a broken Dashboard.
      final check = await ApiService.get('/user/profile');
      if (!mounted) return;

      if (check['success'] == true) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const DashboardScreen()),
        );
        return;
      }

      // Token is expired or revoked -- clear corrupted session state
      await SessionManager.clearSession();
    }

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => IntroPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/images/WELCOME.png',
              width: 200,
              height: 200,
            ),
          ],
        ),
      ),
    );
  }
}