import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../models/user_session.dart';
import '../services/api_service.dart';
import '../services/schedule_reminder_service.dart';
import '../services/app_preferences.dart';
import '../services/alert_notification_service.dart';

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
import '../widgets/patient_profile_modal.dart';

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
  List<dynamic> _clinicalAlerts = [];
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
  final Map<String, List<Map<String, String>>> _events = {};
  bool _eventsReady = false;
  Timer? _scheduleTimer;
  Timer? _dataRefreshTimer;
  StreamSubscription? _alertSyncSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _currentIndex = widget.initialIndex;

    _loadSchedules();
    _scheduleTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });

    _slidePageController = PageController();
    _startSlideTimer();
    _fetchDashboardData();
    _configureDataRefresh();
    AlertNotificationService.initialize();
    AlertNotificationService.startMonitoring();

    // Re-fetch dashboard when an alert arrives or is acknowledged in real-time
    _alertSyncSub = AlertNotificationService.onAlertUpdate.listen((_) {
      if (mounted) _fetchDashboardData();
    });
  }

  void _configureDataRefresh() {
    _dataRefreshTimer?.cancel();
    final setting = AppPreferences.dataRefresh.value;
    if (setting == 'Manual') return;
    final interval = setting == 'Every 5 Mins'
        ? const Duration(minutes: 5)
        : const Duration(seconds: 30);
    _dataRefreshTimer = Timer.periodic(interval, (_) {
      if (mounted) _fetchDashboardData();
    });
  }

  Future<void> _loadSchedules() async {
    final owner = UserSession.current?.id;
    if (owner == null) return;
    try {
      final saved = await ScheduleReminderService.load(owner);
      if (!mounted) return;
      setState(() {
        _events.clear();
        _events.addAll(saved);
        _eventsReady = true;
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Could not load your saved appointments. Reopen the dashboard to retry.'),
        ));
      }
    }
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
    _alertSyncSub?.cancel();
    _scheduleTimer?.cancel();
    _dataRefreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _slideTimer?.cancel();
    _slidePageController.dispose();
    super.dispose();
  }

  Future<void> _fetchDashboardData() async {
    try {
      final results = await Future.wait([
        ApiService.get('/caregiver/patients'),
        ApiService.get('/api/alerts/clinical'),
      ]);
      final result = results[0];
      final alertResult = results[1];

      // Check for any urgent clinical alerts or careteam invites
      AlertNotificationService.checkAlerts();
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (result['success'] == true && result['data'] != null) {
          _patients = List<Map<String, dynamic>>.from(result['data']);
        } else {
          _patients = [];
        }

        if (alertResult['success'] == true && alertResult['data'] != null) {
          _clinicalAlerts = List<dynamic>.from(alertResult['data']);
        } else {
          _clinicalAlerts = [];
        }
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _refreshDashboard() async {
    await SessionManager.loadSession();
    await _fetchDashboardData();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final datePattern = AppPreferences.dateFormat.value == 'DD/MM/YYYY'
        ? 'd, MMMM yyyy'
        : 'MMMM d, yyyy';
    final String today = DateFormat(datePattern).format(DateTime.now());

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
                  if (UserSession.current?.role.toLowerCase() != 'caregiver')
                    _drawerItem('add', 'Enroll Patient',
                        const NewPatientScreen(), false,
                        onReturn: _fetchDashboardData),
                  _drawerItem('device', 'Register Device',
                      const NewDeviceScreen(), false,
                      onReturn: _fetchDashboardData),
                  _drawerItem(
                      'list', 'Patient List', PatientListScreen(), false),
                  _drawerItem('assignment', 'Care Assignments',
                      const AssignmentScreen(), false),
                  _drawerItem('userM', 'User Management',
                      const UserManagementScreen(), false),
                  _drawerItem('deviceM', 'Device Management',
                      const DeviceManagementScreen(), false),
                  _drawerItem('medicine', 'Medication Tracker',
                      const MedicationTrackerScreen(), false),
                  _drawerItem(
                      'report', 'Reports', const ReportsScreen(), false),
                  _drawerItem(
                      'vital', 'AI Insights', const AiInsightsScreen(), false),
                  _drawerItem(
                      'profile', 'Profile', const ProfileScreen(), false,
                      onReturn: () => setState(() {})),
                  _drawerItem('setting', 'Settings', SettingsScreen(), false,
                      onReturn: () {
                    _configureDataRefresh();
                    setState(() {});
                  }),
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
                          const SizedBox(height: 16),

                          // Active Alert Notifications Banner on Dashboard
                          _buildActiveAlertsBanner(),

                          // Patients Section Header with Alert Quick Button
                          _buildPatientsSectionHeader(),
                          const SizedBox(height: 6),
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
    final now = DateTime.now();
    final missedCutoff = now.subtract(const Duration(minutes: 5));
    final missed = _events.values.expand((day) => day).where((event) {
      final at = DateTime.tryParse(event['scheduledAt'] ?? '');
      return event['ignored'] != 'true' &&
          at != null &&
          !at.isAfter(missedCutoff);
    }).toList()
      ..sort((a, b) => a['scheduledAt']!.compareTo(b['scheduledAt']!));
    if (missed.isNotEmpty) {
      return Column(
        children: missed.map((event) {
          final at = DateTime.parse(event['scheduledAt']!).toLocal();
          final details = [
            event['type'],
            event['patient'],
            event['what'],
            DateFormat('MMM d, yyyy • h:mm a').format(at),
            event['where']
          ]
              .whereType<String>()
              .where((text) => text.trim().isNotEmpty)
              .join(' • ');
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Dismissible(
              key: ValueKey('missed-${event['id']}'),
              direction: DismissDirection.horizontal,
              confirmDismiss: (_) async {
                try {
                  await ScheduleReminderService.ignore(
                      UserSession.current!.id, event['id']!);
                  return true;
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text(
                            'Could not ignore this reminder. Please try again.')));
                  }
                  return false;
                }
              },
              onDismissed: (_) => setState(() => event['ignored'] = 'true'),
              background: Container(
                alignment: Alignment.center,
                child:
                    const Text('Ignore', style: TextStyle(color: Colors.red)),
              ),
              child: Material(
                color: const Color(0xFFB71C1C),
                borderRadius: BorderRadius.circular(14),
                child: ListTile(
                  onTap: _openCalendarPopup,
                  leading: const Icon(Icons.event_busy, color: Colors.white),
                  title: Text('Schedule Missed: $details',
                      style: GoogleFonts.albertSans(
                          color: Colors.white, fontSize: 13)),
                  subtitle: const Text('Swipe to ignore',
                      style: TextStyle(color: Colors.white70)),
                ),
              ),
            ),
          );
        }).toList(),
      );
    }
    final upcomingEvents = _events.values.expand((day) => day).where((event) {
      final at = DateTime.tryParse(event['scheduledAt'] ?? '');
      return event['ignored'] != 'true' &&
          at != null &&
          at.isAfter(missedCutoff);
    }).toList()
      ..sort(
          (a, b) => (a['scheduledAt'] ?? '').compareTo(b['scheduledAt'] ?? ''));

    String bannerText;
    if (upcomingEvents.isNotEmpty) {
      final next = upcomingEvents.first;
      final nextAt =
          DateTime.tryParse(next['scheduledAt'] ?? '')?.toLocal() ?? now;
      final patient = next['patient']?.trim() ?? '';
      final what = (next['what']?.trim().isNotEmpty == true)
          ? next['what']!.trim()
          : (next['type']?.trim().isNotEmpty == true
              ? next['type']!.trim()
              : 'Scheduled Appointment');
      final when = next['when']?.trim() ?? DateFormat('h:mm a').format(nextAt);

      String dateText;
      final isSameDay = nextAt.year == now.year &&
          nextAt.month == now.month &&
          nextAt.day == now.day;
      final tomorrow = now.add(const Duration(days: 1));
      final isTomorrow = nextAt.year == tomorrow.year &&
          nextAt.month == tomorrow.month &&
          nextAt.day == tomorrow.day;

      if (isSameDay) {
        dateText = 'today at $when';
      } else if (isTomorrow) {
        dateText = 'tomorrow at $when';
      } else {
        dateText = 'on ${DateFormat('MMM d').format(nextAt)} at $when';
      }

      if (patient.isNotEmpty) {
        bannerText = 'Upcoming: $patient — $what ($dateText)';
      } else {
        bannerText = 'Upcoming: $what ($dateText)';
      }
    } else {
      bannerText = 'No upcoming schedules. Tap here to view calendar.';
    }

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
                bannerText,
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
                                  final e = entry.value;
                                  return _buildEventTile(e, onDelete: () async {
                                    final seriesId = e['seriesId'];
                                    final isSeries = seriesId != null &&
                                        seriesId.isNotEmpty &&
                                        (e['totalOccurrences'] ?? '1') != '1';

                                    if (isSeries) {
                                      final choice = await showDialog<String>(
                                        context: context,
                                        builder: (dialogCtx) => AlertDialog(
                                          shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(16)),
                                          title: Text(
                                              'Delete Recurring Appointment',
                                              style: GoogleFonts.poppins(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 16)),
                                          content: Text(
                                            'This appointment repeats ${e['recurrence'] ?? 'periodically'}. What would you like to delete?',
                                            style: GoogleFonts.albertSans(
                                                fontSize: 13),
                                          ),
                                          actions: [
                                            TextButton(
                                              onPressed: () =>
                                                  Navigator.pop(dialogCtx, 'cancel'),
                                              child: Text('Cancel',
                                                  style: GoogleFonts.poppins(
                                                      color: Colors.black54)),
                                            ),
                                            TextButton(
                                              onPressed: () =>
                                                  Navigator.pop(dialogCtx, 'one'),
                                              child: Text('This Event Only',
                                                  style: GoogleFonts.poppins(
                                                      color: Colors.orange.shade800,
                                                      fontWeight: FontWeight.w600)),
                                            ),
                                            ElevatedButton(
                                              onPressed: () =>
                                                  Navigator.pop(dialogCtx, 'all'),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: Colors.redAccent,
                                                shape: RoundedRectangleBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(8)),
                                              ),
                                              child: Text('All Occurrences',
                                                  style: GoogleFonts.poppins(
                                                      color: Colors.white,
                                                      fontWeight:
                                                          FontWeight.bold)),
                                            ),
                                          ],
                                        ),
                                      );

                                      if (choice == null ||
                                          choice == 'cancel' ||
                                          !mounted ||
                                          !context.mounted) return;

                                      try {
                                        if (choice == 'all') {
                                          await ScheduleReminderService.deleteSeries(
                                              UserSession.current!.id, seriesId);
                                        } else {
                                          await ScheduleReminderService.delete(
                                              UserSession.current!.id,
                                              key,
                                              e['id']!);
                                        }
                                        await _loadSchedules();
                                        if (!mounted || !context.mounted) return;
                                        setDialogState(() {});
                                        setState(() {});
                                      } catch (_) {
                                        if (mounted) {
                                          ScaffoldMessenger.of(this.context)
                                              .showSnackBar(const SnackBar(
                                                  content: Text(
                                                      'Could not delete reminder. Please try again.')));
                                        }
                                      }
                                    } else {
                                      try {
                                        await ScheduleReminderService.delete(
                                            UserSession.current!.id,
                                            key,
                                            e['id']!);
                                        await _loadSchedules();
                                        if (!mounted || !context.mounted) return;
                                        setDialogState(() {});
                                        setState(() {});
                                      } catch (_) {
                                        if (mounted) {
                                          ScaffoldMessenger.of(this.context)
                                              .showSnackBar(const SnackBar(
                                                  content: Text(
                                                      'Could not delete this reminder. Please try again.')));
                                        }
                                      }
                                    }
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
                                      if (!_eventsReady) return;
                                      final newEvents = await _showAddEventForm(
                                          context, selectedDay);
                                      if (newEvents != null &&
                                          newEvents.isNotEmpty &&
                                          mounted &&
                                          context.mounted) {
                                        await _loadSchedules();
                                        setDialogState(() {});
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
                ],
                if (event['recurrence']?.isNotEmpty == true &&
                    event['recurrence'] != 'Does not repeat') ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF5FA9A9).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF5FA9A9).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.repeat_rounded, size: 12, color: Color(0xFF2F7D7B)),
                        const SizedBox(width: 4),
                        Text(
                          'Repeats: ${event['recurrence']}${event['occurrenceIndex'] != null ? ' (${event['occurrenceIndex']}/${event['totalOccurrences']})' : ''}',
                          style: GoogleFonts.albertSans(
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF2F7D7B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
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

  String _getRecurrenceDescription(String recurrence, DateTime targetDay) {
    final rec = recurrence.toLowerCase();
    if (rec.contains('daily')) {
      return 'Repeats every day for the next 30 days (30 reminders scheduled).';
    } else if (rec.contains('weekly')) {
      final weekday = DateFormat('EEEE').format(targetDay);
      return 'Repeats weekly on every $weekday for 12 weeks (12 reminders scheduled).';
    } else if (rec.contains('monthly')) {
      return 'Repeats on day ${targetDay.day} of every month for 12 months (12 reminders scheduled).';
    } else if (rec.contains('6 month') || rec.contains('semi')) {
      return 'Repeats every 6 months for the next 3 years (6 reminders scheduled).';
    } else if (rec.contains('annual') || rec.contains('year')) {
      final dateStr = DateFormat('MMMM d').format(targetDay);
      return 'Repeats on $dateStr once every year for 5 years (5 reminders scheduled).';
    }
    return '';
  }

  // ─────────────────────────────────────────────────────────
  // Add Event Form with Time Picker, Patient Input, and Recurrence
  // ─────────────────────────────────────────────────────────
  Future<List<Map<String, String>>?> _showAddEventForm(
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

    final isCaregiver = UserSession.current?.role.toLowerCase() == 'caregiver';
    List<Map<String, dynamic>> assignedPatients = [];
    if (isCaregiver) {
      try {
        final result = await ApiService.get('/caregiver/patients');
        if (result['success'] == true && result['data'] is List) {
          assignedPatients = List<Map<String, dynamic>>.from(result['data']);
        }
      } catch (_) {
        // Allow caregiver to continue scheduling even if network/endpoint fails
      }
    }
    String? selectedPatientId;
    bool manualPatient = assignedPatients.isEmpty;
    final patientController = TextEditingController();
    final whatController = TextEditingController();
    final whenController = TextEditingController(
        text: DateFormat('h:mm a').format(DateTime.now()));
    final whereController = TextEditingController();
    String? selectedScheduleType;
    String selectedRecurrence = 'Does not repeat';
    final List<String> recurrenceOptions = const [
      'Does not repeat',
      'Daily',
      'Weekly',
      'Monthly',
      'Every 6 Months',
      'Annually',
    ];
    bool saving = false;

    return showModalBottomSheet<List<Map<String, String>>>(
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
                                        fontSize: 11.5, color: Colors.black54)),
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
                        if (isCaregiver && assignedPatients.isNotEmpty) ...[
                          DropdownButtonFormField<String>(
                            initialValue:
                                manualPatient ? 'manual' : selectedPatientId,
                            isExpanded: true,
                            dropdownColor: Colors.white,
                            style: GoogleFonts.albertSans(
                                color: Colors.black87, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'Assigned Patient',
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
                            items: [
                              const DropdownMenuItem(
                                  value: 'manual',
                                  child: Text('Enter patient manually')),
                              ...assignedPatients
                                  .map((patient) => DropdownMenuItem(
                                        value: patient['patient_id'].toString(),
                                        child: Text(patient['name']
                                                ?.toString() ??
                                            'Patient ${patient['patient_id']}'),
                                      ))
                            ],
                            onChanged: saving
                                ? null
                                : (id) => setSheetState(() {
                                      manualPatient = id == 'manual';
                                      if (manualPatient) {
                                        selectedPatientId = null;
                                        patientController.clear();
                                        return;
                                      }
                                      selectedPatientId = id;
                                      final patient =
                                          assignedPatients.firstWhere((p) =>
                                              p['patient_id'].toString() == id);
                                      patientController.text =
                                          patient['name']?.toString() ??
                                              'Patient $id';
                                    }),
                          ),
                          const SizedBox(height: 12),
                        ],
                        if (isCaregiver && assignedPatients.isEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: Text(
                              'No patients are assigned to you. You can enter a patient name manually.',
                              style: GoogleFonts.albertSans(
                                  fontSize: 12, color: Colors.black54),
                            ),
                          ),
                        ],
                        if (!isCaregiver || manualPatient)
                          _formField(
                            'Patient Name',
                            patientController,
                            hint: 'e.g. Maria Santos or Patient 1',
                            prefixIcon: const Icon(Icons.person_outline,
                                color: Color(0xFF5FA9A9), size: 20),
                          ),
                        if (!isCaregiver && _patients.isNotEmpty) ...[
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
                        _formField(
                            'Location / Clinic (Optional)', whereController,
                            hint: 'e.g. Room 204, City Hospital',
                            prefixIcon: const Icon(Icons.location_on_outlined,
                                color: Color(0xFF5FA9A9), size: 20)),
                        const SizedBox(height: 12),
                        // Repeat / Recurrence Selector
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Repeat / Recurrence',
                                style: GoogleFonts.poppins(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600)),
                            const SizedBox(height: 5),
                            DropdownButtonFormField<String>(
                              initialValue: selectedRecurrence,
                              isExpanded: true,
                              icon: const Icon(Icons.repeat_rounded,
                                  color: Color(0xFF5FA9A9)),
                              decoration: InputDecoration(
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
                              items: recurrenceOptions.map((r) {
                                String subtitle = '';
                                if (r == 'Daily') subtitle = ' (Every day)';
                                if (r == 'Weekly') subtitle = ' (Every week)';
                                if (r == 'Monthly') subtitle = ' (Every month)';
                                if (r == 'Every 6 Months') subtitle = ' (Every 6 months)';
                                if (r == 'Annually') subtitle = ' (Every year)';
                                return DropdownMenuItem<String>(
                                  value: r,
                                  child: Text(
                                    '$r$subtitle',
                                    style: GoogleFonts.albertSans(fontSize: 13.5),
                                  ),
                                );
                              }).toList(),
                              onChanged: saving
                                  ? null
                                  : (val) {
                                      if (val != null) {
                                        setSheetState(
                                            () => selectedRecurrence = val);
                                      }
                                    },
                            ),
                            if (selectedRecurrence != 'Does not repeat') ...[
                              const SizedBox(height: 4),
                              Text(
                                _getRecurrenceDescription(
                                    selectedRecurrence, targetDay),
                                style: GoogleFonts.albertSans(
                                    fontSize: 11,
                                    color: const Color(0xFF2F7D7B),
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: saving
                                ? null
                                : () async {
                                    final enteredPatient =
                                        patientController.text.trim();
                                    if (selectedScheduleType == null ||
                                        enteredPatient.isEmpty ||
                                        whatController.text.trim().isEmpty) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        const SnackBar(
                                            content: Text(
                                                'Please select a schedule type, enter patient name, and event purpose.')),
                                      );
                                      return;
                                    }
                                    DateTime at;
                                    try {
                                      final time = DateFormat('h:mm a')
                                          .parseStrict(
                                              whenController.text.trim());
                                      at = DateTime(
                                          targetDay.year,
                                          targetDay.month,
                                          targetDay.day,
                                          time.hour,
                                          time.minute);
                                      if (!at.isAfter(DateTime.now()))
                                        throw const FormatException();
                                    } catch (_) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(
                                              content: Text(
                                                  'Choose a future date and time for the reminder.')));
                                      return;
                                    }
                                    setSheetState(() => saving = true);
                                    try {
                                      bool isRegistered = false;
                                      if (isCaregiver) {
                                        if (!manualPatient &&
                                            selectedPatientId != null) {
                                          isRegistered = true;
                                        } else {
                                          isRegistered = assignedPatients.any(
                                              (p) =>
                                                  p['name']
                                                      ?.toString()
                                                      .trim()
                                                      .toLowerCase() ==
                                                  enteredPatient.toLowerCase());
                                        }
                                      } else {
                                        isRegistered = _patients.any((p) =>
                                            p['name']
                                                ?.toString()
                                                .trim()
                                                .toLowerCase() ==
                                            enteredPatient.toLowerCase());
                                      }

                                      if (!isRegistered) {
                                        final proceed = await showDialog<bool>(
                                          context: context,
                                          builder: (dialogContext) =>
                                              AlertDialog(
                                            shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(16)),
                                            title: Text('Confirm Appointment',
                                                style: GoogleFonts.poppins(
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            content: Text(
                                              'Patient is not registered in the system, they cannot be monitored. Continue?',
                                              style: GoogleFonts.albertSans(
                                                  fontSize: 14),
                                            ),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext, false),
                                                  child: Text('Cancel',
                                                      style:
                                                          GoogleFonts.poppins(
                                                              color: Colors
                                                                  .black54))),
                                              ElevatedButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext, true),
                                                  style:
                                                      ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        const Color(0xFF5FA9A9),
                                                    shape:
                                                        RoundedRectangleBorder(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        8)),
                                                  ),
                                                  child: Text('Continue',
                                                      style:
                                                          GoogleFonts.poppins(
                                                              color:
                                                                  Colors.white,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600))),
                                            ],
                                          ),
                                        );
                                        if (!context.mounted) return;
                                        if (proceed != true) {
                                          setSheetState(() => saving = false);
                                          return;
                                        }
                                      }

                                      final baseEvent = {
                                        'type': selectedScheduleType!,
                                        'patient': enteredPatient,
                                        if (isCaregiver &&
                                            selectedPatientId != null &&
                                            !manualPatient)
                                          'patientId': selectedPatientId!,
                                        'what': whatController.text.trim(),
                                        'when': whenController.text.trim(),
                                        'where':
                                            whereController.text.trim(),
                                      };

                                      final savedList =
                                          await ScheduleReminderService
                                              .saveAppointmentSeries(
                                        UserSession.current!.id,
                                        at,
                                        baseEvent,
                                        selectedRecurrence,
                                      );

                                      if (!mounted || !context.mounted) return;
                                      Navigator.pop(context, savedList);
                                      ScaffoldMessenger.of(this.context)
                                          .showSnackBar(SnackBar(
                                        content: Text(
                                          selectedRecurrence == 'Does not repeat'
                                              ? (ScheduleReminderService.supported
                                                  ? 'Appointment saved with a phone reminder.'
                                                  : 'Appointment saved. Phone reminders are available on Android.')
                                              : 'Recurring appointment ($selectedRecurrence) saved with ${savedList.length} reminders scheduled!',
                                        ),
                                        backgroundColor: const Color(0xFF2F7D7B),
                                      ));
                                    } catch (error) {
                                      if (!context.mounted) return;
                                      setSheetState(() => saving = false);
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                              content: Text(error.toString())));
                                    }
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

  Widget _buildActiveAlertsBanner() {
    final unackAlerts = _clinicalAlerts.where((a) {
      final status = (a['status'] ?? '').toString();
      final flagCount = (a['flag_count'] as num?)?.toInt() ?? 0;
      return status != 'Acknowledged' && flagCount < 5;
    }).toList();

    if (unackAlerts.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEF4444), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEF4444).withValues(alpha: 0.12),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "Active Clinical Alerts (${unackAlerts.length})",
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF991B1B),
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NotificationScreen(initialClinical: true),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Text(
                        "Review All",
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward, size: 12, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...unackAlerts.take(2).map((alert) {
            final patientName = alert['patient_name'] ?? 'Assigned Patient';
            final msg = alert['message'] ?? 'Vital sign anomaly detected';
            final sev = (alert['severity'] ?? 'Warning').toString();
            final isCritical = sev.toLowerCase() == 'critical';

            return InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => NotificationScreen(
                      initialSearch: patientName,
                      initialClinical: true,
                    ),
                  ),
                );
              },
              child: Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isCritical ? const Color(0xFFFCA5A5) : const Color(0xFFFED7AA),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isCritical ? Icons.error : Icons.warning_amber,
                      size: 16,
                      color: isCritical ? const Color(0xFFDC2626) : const Color(0xFFEA580C),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            patientName,
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            msg,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.albertSans(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isCritical ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        sev.toUpperCase(),
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: isCritical ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildPatientsSectionHeader() {
    final unackAlerts = _clinicalAlerts.where((a) {
      final status = (a['status'] ?? '').toString();
      final flagCount = (a['flag_count'] as num?)?.toInt() ?? 0;
      return status != 'Acknowledged' && flagCount < 5;
    }).toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(
                "ASSIGNED PATIENTS",
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: const Color(0xFF5FA9A9),
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2F1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  "${_patients.length}",
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF00796B),
                  ),
                ),
              ),
            ],
          ),
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const NotificationScreen(initialClinical: true),
                ),
              );
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: unackAlerts.isNotEmpty ? const Color(0xFFFEF2F2) : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: unackAlerts.isNotEmpty ? const Color(0xFFEF4444) : const Color(0xFFCBD5E1),
                  width: unackAlerts.isNotEmpty ? 1.5 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    unackAlerts.isNotEmpty ? Icons.warning_amber_rounded : Icons.notifications_none,
                    size: 15,
                    color: unackAlerts.isNotEmpty ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    unackAlerts.isNotEmpty ? "${unackAlerts.length} Alerts" : "Alerts Hub",
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: unackAlerts.isNotEmpty ? const Color(0xFFDC2626) : const Color(0xFF475569),
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 9,
                    color: unackAlerts.isNotEmpty ? const Color(0xFFDC2626) : const Color(0xFF94A3B8),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientCard(Map<String, dynamic> patient) {
    final telemetry = patient['latest_telemetry'] ?? {};
    final bool isDeviceActive = patient['device_status'] == 'active';

    final patientId = patient['patient_id']?.toString() ?? patient['id']?.toString();
    final patientName = (patient['name'] ?? '').toString().toLowerCase().trim();

    final patientAlerts = _clinicalAlerts.where((a) {
      final aPid = a['patient_id']?.toString();
      final aName = (a['patient_name'] ?? '').toString().toLowerCase().trim();
      final isMatch = (patientId != null && aPid == patientId) || (patientName.isNotEmpty && aName == patientName);
      final isUnack = (a['status'] ?? '').toString() != 'Acknowledged' &&
                      ((a['flag_count'] as num?)?.toInt() ?? 0) < 5;
      return isMatch && isUnack;
    }).toList();
    final bool hasActiveAlerts = patientAlerts.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: hasActiveAlerts ? const Color(0xFFFFF1F2) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasActiveAlerts ? const Color(0xFFEF4444) : Colors.black12,
          width: hasActiveAlerts ? 2.0 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: hasActiveAlerts
                ? const Color(0xFFEF4444).withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: hasActiveAlerts ? 8 : 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => showPatientProfileModal(context, patient),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasActiveAlerts)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFDC2626)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            patientAlerts.first['message'] ?? 'Clinical anomaly detected',
                            style: GoogleFonts.albertSans(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFB91C1C),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            "${patientAlerts.length} UNRESOLVED",
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          patient['name'] ?? 'Unknown',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: hasActiveAlerts ? const Color(0xFF881337) : Colors.black,
                          ),
                        ),
                        Text(
                          "Room: ${patient['room'] ?? '---'}",
                          style: GoogleFonts.albertSans(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDeviceActive
                            ? Colors.green.withValues(alpha: 0.1)
                            : Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isDeviceActive ? "ACTIVE" : "INACTIVE",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isDeviceActive ? Colors.green : Colors.red,
                        ),
                      ),
                    ),
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
                        Colors.red,
                      ),
                    ),
                    Expanded(
                      child: _vitalStat(
                        "TEMP",
                        "${telemetry['temperature'] ?? '--'}°C",
                        Icons.thermostat,
                        Colors.orange,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _vitalStat(
                        "SpO2",
                        "${telemetry['spo2'] ?? '--'}%",
                        Icons.water_drop,
                        Colors.blue,
                      ),
                    ),
                    Expanded(
                      child: _vitalStat(
                        "MOISTURE",
                        telemetry['moisture'] == 100 ? 'Wet' : 'Dry',
                        Icons.dry,
                        telemetry['moisture'] == 100 ? Colors.blue : Colors.teal,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                // Action Buttons: Profile and Clinical Alerts Button
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => showPatientProfileModal(context, patient),
                        icon: const Icon(Icons.person_outline, size: 15),
                        label: const Text("Profile", style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF1B393D),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => NotificationScreen(
                                initialSearch: patient['name'],
                                initialClinical: true,
                              ),
                            ),
                          );
                        },
                        icon: Icon(
                          hasActiveAlerts ? Icons.warning_amber_rounded : Icons.notifications_none,
                          size: 15,
                          color: Colors.white,
                        ),
                        label: Text(
                          hasActiveAlerts ? "Alerts (${patientAlerts.length})" : "Clinical Alerts",
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: hasActiveAlerts ? const Color(0xFFDC2626) : const Color(0xFF5FA9A9),
                          elevation: hasActiveAlerts ? 2 : 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
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
    final session = UserSession.current;
    final userName = session?.name ?? 'User';
    final facility = session?.facilityDisplay ?? 'Independent Care';
    final hasFacility = session?.hasFacility == true;

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
                style:
                    GoogleFonts.albertSans(fontSize: 11, color: Colors.black54)),
            const SizedBox(height: 3),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
              decoration: BoxDecoration(
                color: hasFacility
                    ? const Color(0xFFE8F5E9)
                    : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: hasFacility
                      ? const Color(0xFF81C784)
                      : const Color(0xFFCBD5E1),
                  width: 0.8,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    hasFacility ? Icons.business : Icons.home_outlined,
                    size: 11,
                    color: hasFacility ? const Color(0xFF2E7D32) : Colors.black54,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    facility,
                    style: GoogleFonts.albertSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: hasFacility ? const Color(0xFF2E7D32) : Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(width: 10),
        Builder(builder: (_) {
          final session = UserSession.current;
          final picUrl = session?.profilePictureUrl;
          final initial = (session?.name.isNotEmpty == true)
              ? session!.name[0].toUpperCase()
              : 'U';
          return Tooltip(
            message: 'Open profile',
            child: Semantics(
              button: true,
              label: 'Open profile',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ProfileScreen(),
                    ),
                  );
                  // Refresh the greeting avatar after profile edits.
                  if (mounted) setState(() {});
                },
                child: CircleAvatar(
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
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildDrawerHeader() {
    final session = UserSession.current;
    final facility = session?.facilityDisplay ?? 'Independent Care';
    final hasFacility = session?.hasFacility == true;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      child: Row(
        children: [
          Image.asset('assets/images/alagahead.png', width: 45),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
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
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        hasFacility ? Icons.business : Icons.home_outlined,
                        size: 11,
                        color: hasFacility ? Colors.tealAccent : Colors.white70,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          facility,
                          style: GoogleFonts.albertSans(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
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
