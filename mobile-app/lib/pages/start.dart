import 'package:flutter/material.dart';
import 'intro.dart';

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
    await Future.delayed(Duration(seconds: 3));
    
        if (!mounted) return;
    
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => IntroPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Color(0xFFF5F5F0),
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