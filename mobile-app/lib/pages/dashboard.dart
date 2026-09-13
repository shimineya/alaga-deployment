import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../models/user_session.dart';
import '../services/api_service.dart';

import 'newdevice.dart';
import 'newpatient.dart';
import 'patientlist.dart';
import 'assignment.dart';
import 'usermanagement.dart';
import 'devicemanagement.dart';
import 'reports.dart';
import 'settings.dart';
import 'profile.dart';
import 'notification.dart';
import 'medicationtracker.dart';
import 'ai_insights.dart';

class DashboardScreen extends StatefulWidget {
  final int initialIndex;
  const DashboardScreen({super.key, this.initialIndex = 2});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with WidgetsBindingObserver {
  static const List<String> _scheduleTypes = [
    'Medication Intake',
    'Patient Repositioning',
    'Doctor Visit',
    'Other Care Task',
  ];

  late int _currentIndex;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  List<Map<String, dynamic>> _patients = [];
  bool _isLoading = true;

  // Slideshow controller and state
  late final PageController _slidePageController;
  int _activeSlide = 0;
  Timer? _slideTimer;
  bool _isChangingSlide = false;
  bool _slidesPrecached = false;

  // Slideshow data with healthcare topics and photos
  final List<Map<String, dynamic>> _slides = [
    {
      'tag': 'MEDICATION',
      'title': 'Daily Dose\nSchedule',
      'desc': 'Keep track of daily prescriptions',
      'image': 'assets/images/takemedicine.jpg',
      'gradient': const [Color(0xFFE57373), Color(0xFFB71C1C)],
    },
    {
      'tag': 'INFANT CARE',
      'title': 'Infant\nMonitoring',
      'desc': 'Smart diaper & wellness alerts',
      'image': 'assets/images/infant.jpg',
      'gradient': const [Color(0xFF5FA9A9), Color(0xFF387E7E)],
    },
    {
      'tag': 'PATIENT CARE',
      'title': 'Bedridden\nSupport',
      'desc': 'Continuous biometric & fall monitoring',
      'image': 'assets/images/bedridden.jpg',
      'gradient': const [Color(0xFF4A90E2), Color(0xFF286AA8)],
    },
  ];

  // Calendar scheduled events keyed by date string (yyyy-MM-dd)
  late final Map<String, List<Map<String, String>>> _events;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _currentIndex = widget.initialIndex;

    // Seed initial event for today's preview
    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
    _events = {
      todayKey: [
        {
          'type': 'Doctor Visit',
          'what': 'Doctor Consultation',
          'when': '3:00 PM',
          'where': 'Room 204',
          'patient': 'Patient 5',
        }
      ]
    };

    _slidePageController = PageController();
    _startSlideTimer();
    _fetchDashboardData();
  }

  void _startSlideTimer() {
    _slideTimer?.cancel();
    _slideTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (!mounted || !_slidePageController.hasClients || _isChangingSlide) {
        return;
      }

      _isChangingSlide = true;
      final currentPage = _slidePageController.page?.round() ?? _activeSlide;
      final next = (currentPage + 1) % _slides.length;
      await _slidePageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
      _isChangingSlide = false;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_slidesPrecached) return;
    _slidesPrecached = true;
    for (final slide in _slides) {
      precacheImage(AssetImage(slide['image'] as String), context);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startSlideTimer();
    } else {
      _slideTimer?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _slideTimer?.cancel();
    _slidePageController.dispose();
    super.dispose();
  }

  Future<void> _fetchDashboardData() async {
    final result = await ApiService.get('/caregiver/patients');
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (result['success'] == true && result['data'] != null) {
        _patients = List<Map<String, dynamic>>.from(result['data']);
      } else {
        _patients = [];
      }
    });
  }

  Future<void> _refreshDashboard() async {
    await SessionManager.loadSession();
    await _fetchDashboardData();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final String today = DateFormat('MMMM d, y').format(DateTime.now());

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF5F5F0),
      drawer: Drawer(
        backgroundColor: const Color(0xFF1B393D),
        child: Column(
          children: [
            _buildDrawerHeader(),
            const Divider(color: Colors.white24, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 10),
                children: [
                  _drawerItem(
                      'home', 'Dashboard', const DashboardScreen(), true),
                  _drawerItem(
                      'add', 'Enroll Patient', const NewPatientScreen(), false,
                      onReturn: _fetchDashboardData),
                  _drawerItem(
                      'device', 'Register Device', const NewDeviceScreen(), false,
                      onReturn: _fetchDashboardData),
                  _drawerItem(
                      'list', 'Patient List', PatientListScreen(), false),
                  _drawerItem('assignment', 'Assignment Tracker',
                      const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management',
                      const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management',
                      const DeviceManagementScreen(), false),
                  _drawerItem('report', 'AI Insights (OC-SVM)',
                      const AiInsightsScreen(), false),
                  _drawerItem('medicine', 'Medication Tracker',
                      const MedicationTrackerScreen(), false),
                  _drawerItem(
                      'report', 'Reports', const ReportsScreen(), false),
                  _drawerItem(
                      'profile', 'Profile', const ProfileScreen(), false,
                      onReturn: () => setState(() {})),
                  _drawerItem('setting', 'Settings', SettingsScreen(), false),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshDashboard,
                color: const Color(0xFF4DB6AC),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              IconButton(
                                onPressed: () =>
                                    _scaffoldKey.currentState?.openDrawer(),
                                icon: const Icon(Icons.menu,
                                    size: 32, color: Colors.black87),
                              ),
                              Padding(
                                  padding: const EdgeInsets.only(top: 8.0),
                                  child: _buildGreeting(today)),
                            ],
                          ),
                          const SizedBox(height: 35),
                          Text("PATIENT MONITORING",
                              style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  color: const Color(0xFF5FA9A9),
                                  fontWeight: FontWeight.w500)),
                          Text("DASHBOARD",
                              style: GoogleFonts.poppins(
                                  fontSize: 22, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 20),

                          // Top row: Slideshow widget + Full-Month Mini Calendar widget
                          _buildTopWidgetsRow(),
                          const SizedBox(height: 16),

                          // Dynamic Appointment Banner
                          _buildAppointmentBanner(),
                          const SizedBox(height: 20),
                        ]),
                      ),
                    ),
                    if (_isLoading)
                      const SliverToBoxAdapter(
                          child: Padding(
                              padding: EdgeInsets.all(40),
                              child:
                                  Center(child: CircularProgressIndicator())))
                    else if (_patients.isEmpty)
                      SliverFillRemaining(
                          child: Center(
                              child: Text("No patients assigned.",
                                  style: GoogleFonts.albertSans())))
                    else
                      SliverPadding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 24, vertical: 10),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) =>
                                _buildPatientCard(_patients[index]),
                            childCount: _patients.length,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Top row: Interactive Slideshow + Full-Month Mini Calendar
  // ─────────────────────────────────────────────────────────
  Widget _buildTopWidgetsRow() {
    return SizedBox(
      height: 165,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Slideshow Card
          Expanded(
            flex: 3,
            child: _buildSlideshowWidget(),
          ),
          const SizedBox(width: 12),
          // 2. Full Month Mini Calendar (Expandable)
          Expanded(
            flex: 2,
            child: GestureDetector(
              onTap: _openCalendarPopup,
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.black12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: _buildMiniCalendarPreview(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Slideshow Component with Auto-Rotation & Visual Placeholders
  // ─────────────────────────────────────────────────────────
  Future<void> _showSlideImage(Map<String, dynamic> slide) async {
    _slideTimer?.cancel();

    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Close image preview',
      barrierColor: Colors.black.withValues(alpha: 0.82),
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (dialogContext, _, __) {
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.of(dialogContext).pop(),
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.asset(
                    slide['image'] as String,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.broken_image_outlined,
                      size: 72,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
      transitionBuilder: (_, animation, __, child) {
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.96, end: 1).animate(animation),
            child: child,
          ),
        );
      },
    );

    if (mounted) _startSlideTimer();
  }

  Widget _buildSlideshowWidget() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          PageView.builder(
            controller: _slidePageController,
            onPageChanged: (index) {
              setState(() => _activeSlide = index);
            },
            itemCount: _slides.length,
            itemBuilder: (context, index) {
              final slide = _slides[index];
              return Semantics(
                button: true,
                label: 'View ${slide['tag']} image',
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _showSlideImage(slide),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: slide['gradient'] as List<Color>,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Stack(
                      children: [
                        // Decorative background shapes
                        Positioned(
                          right: -20,
                          top: -20,
                          child: Container(
                            width: 90,
                            height: 90,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.1),
                            ),
                          ),
                        ),
                        // Image on right (fully contained with subtle rounded corners)
                        Positioned(
                          right: 8,
                          top: 12,
                          bottom: 12,
                          width: 85,
                          child: Center(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.asset(
                                slide['image'] as String,
                                fit: BoxFit.cover,
                                cacheWidth: 400,
                                errorBuilder: (_, __, ___) => const Icon(
                                  Icons.health_and_safety,
                                  size: 50,
                                  color: Colors.white38,
                                ),
                              ),
                            ),
                          ),
                        ),
                        // Text details on left
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 12, 98, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.25),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  slide['tag'] as String,
                                  style: GoogleFonts.poppins(
                                    fontSize: 8.5,
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    slide['title'] as String,
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      height: 1.15,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    slide['desc'] as String,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.albertSans(
                                      fontSize: 9.5,
                                      color:
                                          Colors.white.withValues(alpha: 0.85),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          // Slideshow indicator dots at bottom left
          Positioned(
            bottom: 8,
            left: 14,
            child: Row(
              children: List.generate(
                _slides.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.only(right: 4),
                  width: _activeSlide == i ? 14 : 5,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _activeSlide == i ? Colors.white : Colors.white54,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Full-Month Mini Calendar Grid on Dashboard
  // ─────────────────────────────────────────────────────────
  Widget _buildMiniCalendarPreview() {
    final now = DateTime.now();
    final monthName = DateFormat('MMM yyyy').format(now).toUpperCase();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final firstWeekday =
        DateTime(now.year, now.month, 1).weekday % 7; // Sunday start (0..6)

    const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 7, 6, 6),
      child: Column(
        mainAxisSize: MainAxisSize.max,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with Expand icon
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                monthName,
                style: GoogleFonts.poppins(
                  color: const Color(0xFF5FA9A9),
                  fontWeight: FontWeight.bold,
                  fontSize: 10,
                  letterSpacing: 0.4,
                ),
              ),
              const Icon(
                Icons.open_in_full,
                size: 10.5,
                color: Color(0xFF5FA9A9),
              ),
            ],
          ),
          const SizedBox(height: 3),
          // Weekday header row
          Row(
            children: weekdayLabels
                .map((d) => Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: GoogleFonts.albertSans(
                            fontSize: 7.5,
                            color: Colors.black45,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 2),
          // Days grid for full month
          Expanded(
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: 1.5,
                crossAxisSpacing: 1.5,
                childAspectRatio: 1.0,
              ),
              itemCount: firstWeekday + daysInMonth,
              itemBuilder: (context, index) {
                if (index < firstWeekday) return const SizedBox.shrink();
                final day = index - firstWeekday + 1;
                final isToday = day == now.day;

                final dayDate = DateTime(now.year, now.month, day);
                final dateKey = DateFormat('yyyy-MM-dd').format(dayDate);
                final hasEvent = _events.containsKey(dateKey) &&
                    _events[dateKey]!.isNotEmpty;

                return Center(
                  child: Container(
                    width: 14.5,
                    height: 14.5,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: isToday
                          ? const Color(0xFF5FA9A9)
                          : hasEvent
                              ? const Color(0x335FA9A9)
                              : Colors.transparent,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$day',
                      style: GoogleFonts.albertSans(
                        fontSize: 7.5,
                        color: isToday
                            ? Colors.white
                            : hasEvent
                                ? const Color(0xFF1B393D)
                                : Colors.black87,
                        fontWeight: isToday || hasEvent
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Dynamic Appointment Banner
  // ─────────────────────────────────────────────────────────
  Widget _buildAppointmentBanner() {
    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final todayEvents = _events[todayKey] ?? [];

    return GestureDetector(
      onTap: _openCalendarPopup,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: const Color(0xFF5FA9A9),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF5FA9A9).withValues(alpha: 0.3),
              blurRadius: 6,
              offset: const Offset(0, 2),
            )
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.event_note, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                todayEvents.isNotEmpty
                    ? ((todayEvents.first['patient'] != null &&
                            todayEvents.first['patient']!.trim().isNotEmpty)
                        ? "${todayEvents.first['patient']}: ${todayEvents.first['what']} today at ${todayEvents.first['when']}"
                        : "${todayEvents.first['what']} today at ${todayEvents.first['when']}")
                    : "No appointments scheduled today. Tap here to view calendar.",
                style: GoogleFonts.albertSans(
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                  fontSize: 12.5,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white70, size: 18),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Smooth Calendar & Scheduling Pop-up Modal
  // ─────────────────────────────────────────────────────────
  void _openCalendarPopup() {
    DateTime selectedDay = DateTime.now();

    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final now = DateTime.now();
            final today = DateTime(now.year, now.month, now.day);
            final selectedDateOnly =
                DateTime(selectedDay.year, selectedDay.month, selectedDay.day);
            final isPastDate = selectedDateOnly.isBefore(today);

            final key = DateFormat('yyyy-MM-dd').format(selectedDay);
            final dayEvents = _events[key] ?? [];

            return Dialog(
              backgroundColor: const Color(0xFFF5F5F0),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24)),
              insetPadding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 30),
              child: ConstrainedBox(
                constraints:
                    const BoxConstraints(maxWidth: 440, maxHeight: 680),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF5FA9A9)
                                      .withValues(alpha: 0.15),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.calendar_month,
                                    color: Color(0xFF5FA9A9), size: 20),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Calendar & Schedule',
                                style: GoogleFonts.poppins(
                                    fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          IconButton(
                            onPressed: () => Navigator.pop(context),
                            icon:
                                const Icon(Icons.close, color: Colors.black54),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Flexible(
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Full Interactive Month Calendar
                              Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme:
                                      Theme.of(context).colorScheme.copyWith(
                                            primary: const Color(0xFF5FA9A9),
                                            onPrimary: Colors.white,
                                            onSurface: Colors.black,
                                          ),
                                ),
                                child: CalendarDatePicker(
                                  initialDate: selectedDay,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime(2030),
                                  onDateChanged: (date) {
                                    setDialogState(() => selectedDay = date);
                                  },
                                ),
                              ),
                              const Divider(height: 20),
                              // Selected Date Heading
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    DateFormat('EEEE, MMMM d, y')
                                        .format(selectedDay),
                                    style: GoogleFonts.poppins(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13.5),
                                  ),
                                  if (dayEvents.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF5FA9A9),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        '${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}',
                                        style: GoogleFonts.albertSans(
                                            fontSize: 11,
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              // Events list for selected date
                              if (dayEvents.isEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 20, horizontal: 16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: Colors.black12),
                                  ),
                                  child: Center(
                                    child: Column(
                                      children: [
                                        const Icon(Icons.event_busy,
                                            color: Colors.black26, size: 28),
                                        const SizedBox(height: 6),
                                        Text(
                                          'No appointments or tasks for this day.',
                                          style: GoogleFonts.albertSans(
                                              fontSize: 12.5,
                                              color: Colors.black54),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              else
                                ...dayEvents.asMap().entries.map((entry) {
                                  final index = entry.key;
                                  final e = entry.value;
                                  return _buildEventTile(e, onDelete: () {
                                    setDialogState(() {
                                      _events[key]?.removeAt(index);
                                    });
                                    setState(() {});
                                  });
                                }),
                              const SizedBox(height: 16),
                              // Add / Schedule Event Button or Past Date Notice
                              if (isPastDate)
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 13, horizontal: 16),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade200,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: Colors.black12),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.block,
                                          color: Colors.black45, size: 18),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Cannot schedule on past dates',
                                        style: GoogleFonts.poppins(
                                          color: Colors.black54,
                                          fontWeight: FontWeight.w500,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: () async {
                                      final newEvent = await _showAddEventForm(
                                          context, selectedDay);
                                      if (newEvent != null) {
                                        setDialogState(() {
                                          _events.putIfAbsent(key, () => []);
                                          _events[key]!.add(newEvent);
                                        });
                                        setState(() {});
                                      }
                                    },
                                    icon: const Icon(Icons.add,
                                        color: Colors.white, size: 18),
                                    label: Text(
                                      'Schedule Appointment',
                                      style: GoogleFonts.poppins(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13.5),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF5FA9A9),
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 13),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(14)),
                                      elevation: 0,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildEventTile(Map<String, String> event, {VoidCallback? onDelete}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.black12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF5FA9A9).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.access_time,
                color: Color(0xFF5FA9A9), size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (event['type']?.isNotEmpty == true) ...[
                  Text(
                    event['type']!,
                    style: GoogleFonts.albertSans(
                      fontSize: 10.5,
                      color: const Color(0xFF5FA9A9),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                ],
                Text(event['what'] ?? '',
                    style: GoogleFonts.poppins(
                        fontWeight: FontWeight.bold, fontSize: 13.5)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text('Time: ${event['when'] ?? ''}',
                        style: GoogleFonts.albertSans(
                            fontSize: 11.5,
                            color: Colors.black87,
                            fontWeight: FontWeight.w500)),
                    if (event['where']?.isNotEmpty == true) ...[
                      const Text(' • ',
                          style: TextStyle(color: Colors.black38)),
                      Expanded(
                          child: Text('${event['where']}',
                              style: GoogleFonts.albertSans(
                                  fontSize: 11.5, color: Colors.black54),
                              overflow: TextOverflow.ellipsis)),
                    ]
                  ],
                ),
                if (event['patient']?.isNotEmpty == true) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.person_outline,
                          size: 13, color: Color(0xFF5FA9A9)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text('Patient: ${event['patient']}',
                            style: GoogleFonts.albertSans(
                                fontSize: 11.5,
                                color: const Color(0xFF5FA9A9),
                                fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                ]
              ],
            ),
          ),
          if (onDelete != null)
            IconButton(
              icon: const Icon(Icons.delete_outline,
                  color: Colors.redAccent, size: 18),
              onPressed: onDelete,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────
  // Add Event Form with Time Picker and Patient Input Field
  // ─────────────────────────────────────────────────────────
  Future<Map<String, String>?> _showAddEventForm(
      BuildContext context, DateTime day) async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final targetDay = DateTime(day.year, day.month, day.day);

    if (targetDay.isBefore(today)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Cannot schedule appointments for past dates."),
          backgroundColor: Colors.redAccent,
        ),
      );
      return null;
    }

    final patientController = TextEditingController();
    final whatController = TextEditingController();
    final whenController = TextEditingController(
        text: DateFormat('h:mm a').format(DateTime.now()));
    final whereController = TextEditingController();
    String? selectedScheduleType;

    return showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            final maxSheetHeight = MediaQuery.of(context).size.height * 0.85;

            return Container(
              constraints: BoxConstraints(maxHeight: maxSheetHeight),
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F0),
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(24),
                    topRight: Radius.circular(24)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsets.only(bottom: bottomInset),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                                color: Colors.black26,
                                borderRadius: BorderRadius.circular(4)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Schedule Appointment',
                                    style: GoogleFonts.poppins(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold)),
                                Text(DateFormat('EEEE, MMMM d, y').format(day),
                                    style: GoogleFonts.albertSans(
                                        fontSize: 11.5,
                                        color: Colors.black54)),
                              ],
                            ),
                            IconButton(
                              onPressed: () => Navigator.pop(context),
                              icon: const Icon(Icons.close,
                                  color: Colors.black45, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text('Schedule Type',
                            style: GoogleFonts.poppins(
                                fontSize: 12.5, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 5),
                        DropdownButtonFormField<String>(
                          initialValue: selectedScheduleType,
                          isExpanded: true,
                          hint: Text('Select a schedule type',
                              style: GoogleFonts.albertSans(fontSize: 13.5)),
                          icon: const Icon(Icons.arrow_drop_down,
                              color: Color(0xFF5FA9A9)),
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: Colors.black12)),
                            enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide:
                                    const BorderSide(color: Colors.black12)),
                          ),
                          items: _scheduleTypes
                              .map((type) => DropdownMenuItem<String>(
                                    value: type,
                                    child: Text(type,
                                        style: GoogleFonts.albertSans(
                                            fontSize: 13.5)),
                                  ))
                              .toList(),
                          onChanged: (value) =>
                              setSheetState(() => selectedScheduleType = value),
                        ),
                        const SizedBox(height: 12),
                        _formField(
                          'Patient Name',
                          patientController,
                          hint: 'e.g. Maria Santos or Patient 1',
                          prefixIcon: const Icon(Icons.person_outline,
                              color: Color(0xFF5FA9A9), size: 20),
                        ),
                        if (_patients.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: _patients.map((p) {
                              final name = p['name']?.toString() ?? '';
                              if (name.isEmpty) return const SizedBox.shrink();
                              return InkWell(
                                onTap: () {
                                  setSheetState(() {
                                    patientController.text = name;
                                  });
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 9, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF5FA9A9)
                                        .withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color: const Color(0xFF5FA9A9)
                                            .withValues(alpha: 0.35)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.person,
                                          size: 13, color: Color(0xFF5FA9A9)),
                                      const SizedBox(width: 4),
                                      Text(
                                        name,
                                        style: GoogleFonts.albertSans(
                                            fontSize: 11.5,
                                            color: const Color(0xFF1B393D),
                                            fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                        const SizedBox(height: 12),
                        _formField('Event / Purpose', whatController,
                            hint: 'e.g. Doctor Consultation, Blood Test',
                            prefixIcon: const Icon(Icons.description_outlined,
                                color: Color(0xFF5FA9A9), size: 20)),
                        const SizedBox(height: 12),
                        // Time Picker Field
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Time',
                                style: GoogleFonts.poppins(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600)),
                            const SizedBox(height: 5),
                            GestureDetector(
                              onTap: () async {
                                final pickedTime = await showTimePicker(
                                  context: context,
                                  initialTime: TimeOfDay.now(),
                                );
                                if (pickedTime != null) {
                                  setSheetState(() {
                                    final now = DateTime.now();
                                    final dt = DateTime(
                                        now.year,
                                        now.month,
                                        now.day,
                                        pickedTime.hour,
                                        pickedTime.minute);
                                    whenController.text =
                                        DateFormat('h:mm a').format(dt);
                                  });
                                }
                              },
                              child: AbsorbPointer(
                                child: TextField(
                                  controller: whenController,
                                  style: GoogleFonts.albertSans(fontSize: 13.5),
                                  decoration: InputDecoration(
                                    prefixIcon: const Icon(Icons.access_time,
                                        color: Color(0xFF5FA9A9), size: 20),
                                    filled: true,
                                    fillColor: Colors.white,
                                    contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 10),
                                    border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.black12)),
                                    enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.black12)),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _formField('Location / Clinic (Optional)', whereController,
                            hint: 'e.g. Room 204, City Hospital',
                            prefixIcon: const Icon(Icons.location_on_outlined,
                                color: Color(0xFF5FA9A9), size: 20)),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () {
                              if (selectedScheduleType == null ||
                                 patientController.text.trim().isEmpty ||
                                 whatController.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Please select a schedule type, enter patient name, and event purpose.')),
                                );
                                return;
                              }
                              Navigator.pop(context, {
                                'type': selectedScheduleType!,
                                'patient': patientController.text.trim(),
                                'what': whatController.text.trim(),
                                'when': whenController.text.trim(),
                                'where': whereController.text.trim(),
                              });
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF5FA9A9),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16)),
                              elevation: 0,
                            ),
                            child: Text('Save Appointment',
                                style: GoogleFonts.poppins(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _formField(String label, TextEditingController controller,
      {String? hint, Widget? prefixIcon}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style:
                GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          style: GoogleFonts.albertSans(fontSize: 14),
          decoration: InputDecoration(
            prefixIcon: prefixIcon,
            hintText: hint,
            hintStyle:
                GoogleFonts.albertSans(fontSize: 13, color: Colors.black38),
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Colors.black12),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Colors.black12),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: Color(0xFF5FA9A9), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPatientCard(Map<String, dynamic> patient) {
    final telemetry = patient['latest_telemetry'] ?? {};
    final bool isDeviceActive = patient['device_status'] == 'active';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(patient['name'] ?? 'Unknown',
                      style: GoogleFonts.poppins(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                  Text("Room: ${patient['room'] ?? '---'}",
                      style: GoogleFonts.albertSans(
                          fontSize: 12, color: Colors.grey)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    color: isDeviceActive
                        ? Colors.green.withValues(alpha: 0.1)
                        : Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8)),
                child: Text(isDeviceActive ? "ACTIVE" : "INACTIVE",
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isDeviceActive ? Colors.green : Colors.red)),
              )
            ],
          ),
          const Divider(height: 20),
          Row(
            children: [
              Expanded(
                  child: _vitalStat(
                      "BPM",
                      telemetry['heart_rate']?.toString() ?? "--",
                      Icons.favorite,
                      Colors.red)),
              Expanded(
                  child: _vitalStat(
                      "TEMP",
                      "${telemetry['temperature'] ?? '--'}°C",
                      Icons.thermostat,
                      Colors.orange)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _vitalStat("SpO2", "${telemetry['spo2'] ?? '--'}%",
                      Icons.water_drop, Colors.blue)),
              Expanded(
                  child: _vitalStat(
                      "MOISTURE",
                      telemetry['moisture'] == 100 ? 'Wet' : 'Dry',
                      Icons.dry,
                      telemetry['moisture'] == 100
                          ? Colors.blue
                          : Colors.teal)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _vitalStat(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, size: 20, color: color),
        Text(value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey)),
      ],
    );
  }

  Widget _buildGreeting(String date) {
    final userName = UserSession.current?.name ?? 'User';
    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text.rich(TextSpan(children: [
              TextSpan(
                  text: "Hello, ",
                  style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black)),
              TextSpan(
                  text: userName,
                  style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF5FA9A9))),
              TextSpan(
                  text: "!",
                  style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black)),
            ])),
            Text(date,
                style: GoogleFonts.albertSans(
                    fontSize: 11, color: Colors.black45)),
          ],
        ),
        const SizedBox(width: 10),
        Builder(builder: (_) {
          final session = UserSession.current;
          final picUrl = session?.profilePictureUrl;
          final initial = (session?.name.isNotEmpty == true)
              ? session!.name[0].toUpperCase()
              : 'U';
          return CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF5FA9A9),
            backgroundImage: ApiService.getImageProvider(picUrl),
            child: (picUrl == null || picUrl.isEmpty)
                ? Text(initial,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 17))
                : null,
          );
        }),
      ],
    );
  }

  Widget _buildDrawerHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Row(
        children: [
          Image.asset('assets/images/alagahead.png', width: 45),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("ALAGA",
                  style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16)),
              Text("Patient Monitoring",
                  style:
                      GoogleFonts.poppins(color: Colors.white70, fontSize: 12)),
            ],
          )
        ],
      ),
    );
  }


  Widget _drawerItem(
      String icon, String title, Widget destination, bool isSelected,
      {VoidCallback? onReturn}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected
            ? Colors.white.withValues(alpha: 0.1)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: Image.asset('assets/images/$icon.png',
            width: 22, color: Colors.white),
        title: Text(title,
            style: GoogleFonts.poppins(color: Colors.white, fontSize: 13)),
        onTap: () {
          Navigator.pop(context);
          if (!isSelected) {
            Navigator.push(context,
                MaterialPageRoute(builder: (context) => destination)).then((_) {
              if (mounted) {
                setState(() => _currentIndex = 2);
                onReturn?.call();
              }
            });
          }
        },
      ),
    );
  }

  Widget _buildBottomNav() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
            color: const Color(0xFF5FA9A9),
            borderRadius: BorderRadius.circular(50)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _navItem(0, 'heart'),
            _navItem(1, 'bell'),
            _navItem(2, 'home'),
            _navItem(3, 'device'),
            _navItem(4, 'profile'),
          ],
        ),
      ),
    );
  }

  Widget _navItem(int index, String icon) {
    bool selected = _currentIndex == index;
    return GestureDetector(
      onTap: () async {
        if (index == 2) {
          if (_currentIndex != 2) {
            setState(() => _currentIndex = 2);
          }
          return;
        }

        setState(() => _currentIndex = index);
        switch (index) {
          case 0:
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => PatientListScreen(
                  onBack: () {
                    if (mounted) setState(() => _currentIndex = 2);
                  },
                ),
              ),
            );
            break;
          case 1:
            await Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (context) => const NotificationScreen()),
            );
            break;
          case 3:
            await Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (context) => const DeviceManagementScreen()),
            );
            break;
          case 4:
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ProfileScreen(
                  onBack: () {
                    if (mounted) setState(() => _currentIndex = 2);
                  },
                ),
              ),
            );
            break;
        }
        if (mounted) {
          setState(() => _currentIndex = 2);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            shape: BoxShape.circle),
        child: Image.asset('assets/images/$icon.png',
            width: 24,
            color: selected ? const Color(0xFF5FA9A9) : Colors.white),
      ),
    );
  }
}
