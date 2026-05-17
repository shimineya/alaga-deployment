import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'pages/start.dart';
import 'pages/login.dart'; // Import your login page
import 'pages/profile.dart'; // Import your profile page

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
      // The page the app loads first
      home: const StartPage(), 
      
      // Defining Named Routes for easy navigation and Logout functionality
      routes: {
        '/login': (context) => const LoginPage(),
        '/profile': (context) => const ProfileScreen(),
        '/start': (context) => const StartPage(),
      },
    );
  }
}