import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart'; // [OWASP A02] Secure environment loader
import 'pages/start.dart';

Future<void> main() async {
  // Ensure Flutter engine is initialized before loading assets
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load the environment variables securely
  await dotenv.load(fileName: ".env");
  
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
      ),
      home: const StartPage(),
    );
  }
}