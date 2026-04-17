import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart'; 
import 'register.dart';

class IntroPage extends StatefulWidget {
  const IntroPage({super.key});

  @override
  State<IntroPage> createState() => _IntroPageState();
}

class _IntroPageState extends State<IntroPage> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  void _navigateToRegister() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const RegisterPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      body: SafeArea(
        child: Column(
          children: [
            // Skip button (top right)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Align(
                alignment: Alignment.topRight,
                child: TextButton(
                  onPressed: _navigateToRegister,
                  child: Text(
                    'Skip',
                    style: GoogleFonts.poppins(
                      color: Colors.black,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),

            // PageView with intro screens
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const BouncingScrollPhysics(),
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                children: [
                  Transform.translate(
                    offset: const Offset(0, -20),
                    child: const _IntroContent(
                      image: 'assets/images/monitor.png',
                      title: 'Your Patient\'s Wellness,\nMonitored with Ease',
                      description:
                          'Track vital signs and bed-wetting events effortlessly through a clean, intuitive dashboard designed for its users.',
                      imageHeight: 350,
                    ),
                  ),
                  Transform.translate(
                    offset: const Offset(0, -40),
                    child: const _IntroContent(
                      image: 'assets/images/lola.png',
                      title: 'Smarter Care,\nRight When It Matters',
                      description:
                          'Get instant alerts for critical changes so you can respond quickly and provide better patient care.',
                      imageHeight: 380,
                    ),
                  ),
                  const _IntroContent(
                    image: 'assets/images/nurse.png',
                    title: 'Know More,\nRespond Better',
                    description:
                        'Access real-time data and history to make informed decisions and ensure your patients receive the best support.',
                    imageHeight: 300,
                  ),
                ],
              ),
            ),

            // Page indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (index) {
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: _currentPage == index ? 24 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _currentPage == index
                        ? const Color(0xFF5FA9A9)
                        : const Color(0xFFD9D9D9),
                    borderRadius: BorderRadius.circular(4),
                  ),
                );
              }),
            ),

            const SizedBox(height: 32),

            // Next / Get Started button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 80, vertical: 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (_currentPage < 2) {
                      _pageController.animateToPage(
                        _currentPage + 1,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      _navigateToRegister();
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5FA9A9),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: Text(
                    _currentPage < 2 ? 'Next' : 'Get Started',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

class _IntroContent extends StatelessWidget {
  final String image;
  final String title;
  final String description;
  final double imageHeight;

  const _IntroContent({
    required this.image,
    required this.title,
    required this.description,
    this.imageHeight = 300,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            image,
            height: imageHeight,
            fit: BoxFit.contain,
          ),

          const SizedBox(height: 40),

          // Using GoogleFonts for Poppins titles
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: Colors.black,
              height: 1.2,
            ),
          ),

          const SizedBox(height: 16),

          // Using your working local 'AlbertSans' for description
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'AlbertSans', // Back to your local font
              fontSize: 14,
              color: Colors.black87,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}