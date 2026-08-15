import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'models/user_session.dart';
import 'services/api_service.dart';

import 'pages/start.dart';
import 'pages/login.dart';
import 'pages/profile.dart';
import 'pages/dashboard.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // [DEBUG] Ensure .env is loaded before anything else
  try {
    await dotenv.load(fileName: '.env');
    print("DEBUG: Dotenv loaded. URL: ${dotenv.env['API_BASE_URL']}");
  } catch (e) {
    print("DEBUG: FAILED to load .env: $e");
  }
  
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
      home: const SessionGate(),
      routes: {
        '/login': (context) => const LoginPage(),
        '/profile': (context) => const ProfileScreen(),
        '/start': (context) => const StartPage(),
      },
    );
  }
}

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
      final session = await SessionManager.loadSession();

      if (session != null) {
        // [DEBUG] Trace the API call
        print("DEBUG: Checking session with: ${ApiService.baseUrl}");
        final result = await ApiService.get('/auth/my-permissions');

        if (result['success'] == true) {
          _destination = const DashboardScreen();
        } else {
          await SessionManager.clearSession();
          _destination = const StartPage();
        }
      } else {
        _destination = const StartPage();
      }
    } catch (e) {
      print("DEBUG: SessionGate error: $e");
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
      return const Scaffold(
        backgroundColor: Color(0xFFF5F5F0),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF5FA9A9)),
        ),
      );
    }
    return _destination!;
  }
}