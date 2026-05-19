import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

// [INTEGRATION] Import session management and API service for auto-login
import 'models/user_session.dart';
import 'services/api_service.dart';

import 'pages/start.dart';
import 'pages/login.dart';
import 'pages/profile.dart';
import 'pages/dashboard.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Alaga',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6ECCD9)),
        useMaterial3: true,
      ),
      // [INTEGRATION] Use a FutureBuilder to check for a saved session on startup.
      // If a valid session exists, skip the intro/login and go straight to the dashboard.
      home: const SessionGate(),

      // Defining Named Routes for easy navigation and Logout functionality
      routes: {
        '/login': (context) => const LoginPage(),
        '/profile': (context) => const ProfileScreen(),
        '/start': (context) => const StartPage(),
      },
    );
  }
}

// [INTEGRATION] SessionGate checks for a persisted session on app startup.
// If a valid JWT exists, it validates it against the backend before granting access.
// If the token is expired or invalid, the session is cleared and the user sees the intro flow.
class SessionGate extends StatefulWidget {
  const SessionGate({super.key});

  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  bool _isLoading = true;
  Widget? _destination;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    try {
      // [OWASP A07] Load the session from encrypted secure storage
      final session = await SessionManager.loadSession();

      if (session != null) {
        // Validate the token against the backend
        // [OWASP A01] This ensures expired or revoked tokens are rejected.
        final result = await ApiService.get('/auth/my-permissions');

        if (result['success'] == true) {
          // Token is valid -- go directly to the dashboard
          _destination = const DashboardScreen();
        } else {
          // Token is expired or invalid -- clear the session
          await SessionManager.clearSession();
          _destination = const StartPage();
        }
      } else {
        // No saved session -- show the intro/login flow
        _destination = const StartPage();
      }
    } catch (e) {
      // Safety fallback -- if anything goes wrong, start fresh
      await SessionManager.clearSession();
      _destination = const StartPage();
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      // Show a minimal loading indicator while checking the session
      return const Scaffold(
        backgroundColor: Color(0xFFF5F5F0),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(0xFF5FA9A9),
          ),
        ),
      );
    }
    return _destination!;
  }
}