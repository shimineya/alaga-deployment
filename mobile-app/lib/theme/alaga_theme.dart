import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Centralized Design System & Color Palette for the ALAGA Mobile Application.
/// Perfectly synchronized with the ALAGA Web App clinical teal & emerald design system.
class AlagaColors {
  AlagaColors._();

  // Primary Clinical Teals (Web App Signature)
  static const Color primary = Color(0xFF00796B);       // Teal 700 - Brand Main
  static const Color primaryDark = Color(0xFF004D40);   // Teal 900 - Hero Deep Pine
  static const Color primaryLight = Color(0xFF4DB6AC);  // Teal 300 - Accent Soft
  static const Color accent = Color(0xFF0D9488);        // Teal 600 - Dynamic Vibrant
  static const Color accentLight = Color(0xFF14B8A6);   // Teal 500 - Highlight
  static const Color mint = Color(0xFF2DD4BF);          // Teal 400 - Mint Glow
  static const Color mintSubtle = Color(0xFFCCFBF1);    // Teal 100 - Pill backgrounds
  static const Color mintUltraLight = Color(0xFFF0FDFA);// Teal 50 - Card background

  // Surfaces & Backgrounds
  static const Color background = Color(0xFFF8FAFC);   // Slate 50 (Web App standard)
  static const Color surface = Color(0xFFFFFFFF);      // Crisp Card White
  static const Color cardBorder = Color(0xFFE2E8F0);   // Slate 200 - Hairline border
  static const Color divider = Color(0xFFF1F5F9);      // Slate 100 - Subtle divider

  // Typography & Neutrals
  static const Color textPrimary = Color(0xFF0F172A);  // Slate 900 - High Contrast
  static const Color textSecondary = Color(0xFF475569);// Slate 600 - Body & Label
  static const Color textMuted = Color(0xFF94A3B8);    // Slate 400 - Hint & Inactive
  static const Color textSubtle = Color(0xFF64748B);   // Slate 500 - Details

  // Clinical Status & Sensor Colors
  static const Color statusNormal = Color(0xFF10B981); // Emerald 500 - Normal
  static const Color statusNormalBg = Color(0xFFDCFCE7);// Emerald 100
  static const Color statusNormalBorder = Color(0xFFBBF7D0);

  static const Color statusCritical = Color(0xFFEF4444);// Red 500 - Critical / Fever / Hypoxia
  static const Color statusCriticalDark = Color(0xFFDC2626);
  static const Color statusCriticalBg = Color(0xFFFEE2E2);// Red 100
  static const Color statusCriticalBorder = Color(0xFFFECACA);

  static const Color statusWarning = Color(0xFFF59E0B); // Amber 500 - Elevated / Warning
  static const Color statusWarningDark = Color(0xFFD97706);
  static const Color statusWarningBg = Color(0xFFFFFBEB);// Amber 50
  static const Color statusWarningBorder = Color(0xFFFDE68A);

  static const Color statusWet = Color(0xFFEA580C);     // Orange 600 - Wet / Change Diaper
  static const Color statusWetBg = Color(0xFFFFF7ED);   // Orange 50
  static const Color statusWetBorder = Color(0xFFFED7AA);

  static const Color statusOxygen = Color(0xFF3B82F6);  // Blue 500 - SpO2
  static const Color statusOxygenBg = Color(0xFFEFF6FF);// Blue 50
  static const Color statusOxygenBorder = Color(0xFFBFDBFE);

  static const Color statusOffline = Color(0xFF64748B); // Slate 500 - Offline
  static const Color statusOfflineBg = Color(0xFFF1F5F9);
  static const Color statusOfflineBorder = Color(0xFFCBD5E1);
}

class AlagaGradients {
  AlagaGradients._();

  // Web App Signature Hero Gradient (Teal 900 to Teal 600)
  static const LinearGradient hero = LinearGradient(
    colors: [Color(0xFF134E4A), Color(0xFF0F766E), Color(0xFF0D9488)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Web App Brand Gradient (Teal 700 to Teal 900)
  static const LinearGradient brand = LinearGradient(
    colors: [Color(0xFF00796B), Color(0xFF004D40)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Web App Accent Gradient (Teal 600 to Teal 500)
  static const LinearGradient accent = LinearGradient(
    colors: [Color(0xFF0D9488), Color(0xFF14B8A6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Soft Mint Header / Card Glow
  static const LinearGradient mintSoft = LinearGradient(
    colors: [Color(0xFFE0F2F1), Color(0xFFB2DFDB)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Clean White to Slate Card Gradient
  static const LinearGradient card = LinearGradient(
    colors: [Colors.white, Color(0xFFF8FAFC)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}

class AlagaTheme {
  AlagaTheme._();

  static ThemeData get themeData {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AlagaColors.primary,
        primary: AlagaColors.primary,
        secondary: AlagaColors.accent,
        surface: AlagaColors.surface,
        error: AlagaColors.statusCritical,
      ),
      scaffoldBackgroundColor: AlagaColors.background,
      textTheme: GoogleFonts.poppinsTextTheme().copyWith(
        bodyMedium: GoogleFonts.albertSans(color: AlagaColors.textSecondary),
        bodySmall: GoogleFonts.albertSans(color: AlagaColors.textMuted),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AlagaColors.background,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: AlagaColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AlagaColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AlagaColors.cardBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AlagaColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AlagaColors.primary,
          side: const BorderSide(color: AlagaColors.primary, width: 1.2),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 13),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AlagaColors.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AlagaColors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AlagaColors.primary, width: 2),
        ),
        hintStyle: GoogleFonts.albertSans(color: AlagaColors.textMuted, fontSize: 13),
      ),
    );
  }
}
