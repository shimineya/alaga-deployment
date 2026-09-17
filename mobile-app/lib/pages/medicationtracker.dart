import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class MedicationEntry {
  final String medicineName;
  int initialCount;
  int timesPerDay;

  MedicationEntry({
    required this.medicineName,
    required this.initialCount,
    required this.timesPerDay,
  });

  /// Stock required is strictly Duration (in days) * Frequency (per day)
  static int calculateStock(int durationDays, int timesPerDay) {
    return durationDays * timesPerDay;
  }
}

class PatientMedicationRecord {
  final String patientName;
  final List<MedicationEntry> medications;
  final DateTime startDate;
  final DateTime endDate;
  final DateTime createdAt;
  bool isExpanded;

  PatientMedicationRecord({
    required this.patientName,
    required this.medications,
    required this.startDate,
    required this.endDate,
    DateTime? createdAt,
    this.isExpanded = true,
  }) : createdAt = createdAt ?? DateTime.now();

  int get totalDays {
    final start = DateTime(startDate.year, startDate.month, startDate.day);
    final end = DateTime(endDate.year, endDate.month, endDate.day);
    final diff = end.difference(start).inDays + 1;
    return diff > 0 ? diff : 1;
  }

  int get remainingDays {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final end = DateTime(endDate.year, endDate.month, endDate.day);
    final diff = end.difference(today).inDays + 1;
    return diff.clamp(0, totalDays);
  }

  int get daysElapsed {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final start = DateTime(startDate.year, startDate.month, startDate.day);
    if (today.isBefore(start)) return 0;
    final diff = today.difference(start).inDays;
    return diff.clamp(0, totalDays);
  }
}

class MedicationTrackerScreen extends StatefulWidget {
  const MedicationTrackerScreen({super.key});

  @override
  State<MedicationTrackerScreen> createState() =>
      _MedicationTrackerScreenState();
}

class _MedicationTrackerScreenState extends State<MedicationTrackerScreen> {
  // Alphabetically ordered list relevant to infants, bedridden patients, and elderly
  final List<String> _alphabeticalMedicines = [
    'Acetaminophen (Infant Drops)',
    'Amoxicillin Suspension',
    'Amlodipine (Blood Pressure)',
    'Bisacodyl (Laxative)',
    'Donepezil (Cognitive Health)',
    'Enoxaparin (Blood Thinning)',
    'Gabapentin (Nerve Pain)',
    'Lactulose Syrup',
    'Levothyroxine',
    'Memantine (Dementia Care)',
    'Metoprolol',
    'Multivitamin Drops (Infant)',
    'Omeprazole',
    'Paracetamol Liquid',
    'Simethicone (Gas Relief)',
    'Zinc Sulfate Drops',
  ];

  // Dynamic records list (Hardcoded Patient 1 removed)
  final List<PatientMedicationRecord> _records = [];
  List<String> _suggestedPatients = [];

  @override
  void initState() {
    super.initState();
    _loadPatientSuggestions();
  }

  Future<void> _loadPatientSuggestions() async {
    try {
      final result = await ApiService.get('/api/caregiver/patients');
      if (result['success'] == true && result['data'] != null) {
        final List<dynamic> list = result['data'];
        if (mounted) {
          setState(() {
            _suggestedPatients = list
                .map((p) => p['name']?.toString() ?? '')
                .where((name) => name.isNotEmpty)
                .toSet()
                .toList();
          });
        }
      }
    } catch (_) {
      // Best-effort suggestion fetch
    }
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.poppins(fontSize: 13, color: Colors.black38),
      filled: true,
      fillColor: const Color(0xFFE8F4F4),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(25),
        borderSide: const BorderSide(color: Color(0x665FA9A9)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(25),
        borderSide: const BorderSide(color: Color(0x665FA9A9)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(25),
        borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 1.5),
      ),
    );
  }

  int _calculateDaysBetween(DateTime start, DateTime end) {
    final s = DateTime(start.year, start.month, start.day);
    final e = DateTime(end.year, end.month, end.day);
    final diff = e.difference(s).inDays + 1;
    return diff > 0 ? diff : 1;
  }

  void _showAddMedicationModal() {
    final patientNameController = TextEditingController();
    DateTime startDate = DateTime.now();
    DateTime endDate = DateTime.now().add(const Duration(days: 29)); // Default 30-day course
    int durationDays = _calculateDaysBetween(startDate, endDate);

    // List of pending configured medicines
    List<MedicationEntry> pendingMedications = [];

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            void updateMedicationStock() {
              durationDays = _calculateDaysBetween(startDate, endDate);
              for (var med in pendingMedications) {
                med.initialCount = MedicationEntry.calculateStock(durationDays, med.timesPerDay);
              }
            }

            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.85,
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "Add Medication Schedule",
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF2D3436),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 20, color: Colors.black54),
                            onPressed: () => Navigator.pop(context),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          )
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Patient Name
                      _buildLabel("Patient Name"),
                      const SizedBox(height: 8),
                      TextField(
                        controller: patientNameController,
                        style: GoogleFonts.poppins(fontSize: 14),
                        decoration: _inputDecoration(hint: "Enter patient name"),
                      ),
                      if (_suggestedPatients.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: _suggestedPatients.map((name) {
                            return InkWell(
                              onTap: () {
                                setModalState(() {
                                  patientNameController.text = name;
                                });
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F4F4),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0x4D5FA9A9)),
                                ),
                                child: Text(
                                  "+ $name",
                                  style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF5FA9A9)),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                      const SizedBox(height: 16),

                      // Duration Section
                      _buildLabel("Duration"),
                      const SizedBox(height: 6),
                      Text(
                        "Stock count strictly calculates as: Duration × Frequency/day",
                        style: GoogleFonts.poppins(fontSize: 11, color: Colors.black54),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final initialRange = DateTimeRange(
                            start: startDate,
                            end: endDate,
                          );
                          final pickedRange = await showDateRangePicker(
                            context: context,
                            firstDate: DateTime.now().subtract(const Duration(days: 30)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                            initialDateRange: initialRange,
                            builder: (context, child) {
                              return Theme(
                                data: Theme.of(context).copyWith(
                                  colorScheme: const ColorScheme.light(
                                    primary: Color(0xFF5FA9A9),
                                  ),
                                ),
                                child: child!,
                              );
                            },
                          );
                          if (pickedRange != null) {
                            setModalState(() {
                              startDate = pickedRange.start;
                              endDate = pickedRange.end;
                              updateMedicationStock();
                            });
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F4F4),
                            borderRadius: BorderRadius.circular(25),
                            border: Border.all(color: const Color(0x665FA9A9)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      "${DateFormat('MMM d, y').format(startDate)} - ${DateFormat('MMM d, y').format(endDate)}",
                                      style: GoogleFonts.poppins(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.black87,
                                      ),
                                    ),
                                    Text(
                                      "$durationDays ${durationDays == 1 ? 'day' : 'days'} (${(durationDays / 30).toStringAsFixed(durationDays % 30 == 0 ? 0 : 1)} month)",
                                      style: GoogleFonts.poppins(
                                        fontSize: 11,
                                        color: const Color(0xFF5FA9A9),
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.calendar_month, color: Color(0xFF5FA9A9), size: 20),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Medication/s Multi-Selection Trigger
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildLabel("Medication/s"),
                          Text(
                            "${pendingMedications.length} selected",
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: const Color(0xFF5FA9A9),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Multi-Select Medicine Trigger Button
                      InkWell(
                        onTap: () async {
                          final selectedNames = await _showMultiSelectMedicineDialog(
                            context,
                            alreadySelected: pendingMedications.map((m) => m.medicineName).toSet(),
                          );
                          if (selectedNames != null) {
                            setModalState(() {
                              for (var name in selectedNames) {
                                if (!pendingMedications.any((m) => m.medicineName == name)) {
                                  pendingMedications.add(
                                    MedicationEntry(
                                      medicineName: name,
                                      initialCount: MedicationEntry.calculateStock(durationDays, 1),
                                      timesPerDay: 1,
                                    ),
                                  );
                                }
                              }
                            });
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F4F4),
                            borderRadius: BorderRadius.circular(25),
                            border: Border.all(color: const Color(0x665FA9A9)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                pendingMedications.isEmpty
                                    ? "Tap to select medicine(s)"
                                    : "+ Add more medicines",
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  color: pendingMedications.isEmpty
                                      ? Colors.black45
                                      : const Color(0xFF5FA9A9),
                                  fontWeight: pendingMedications.isEmpty
                                      ? FontWeight.normal
                                      : FontWeight.w600,
                                ),
                              ),
                              const Icon(Icons.playlist_add, color: Color(0xFF5FA9A9), size: 22),
                            ],
                          ),
                        ),
                      ),

                      // Selected Medicines List with Frequency & Auto-calculated Stock
                      if (pendingMedications.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        ...pendingMedications.map((med) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7FBFB),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0x4D5FA9A9)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.medication_outlined, size: 20, color: Color(0xFF5FA9A9)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        med.medicineName,
                                        style: GoogleFonts.poppins(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, size: 20, color: Colors.redAccent),
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                      onPressed: () {
                                        setModalState(() {
                                          pendingMedications.remove(med);
                                        });
                                      },
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Frequency Row
                                Row(
                                  children: [
                                    Text(
                                      "Frequency:",
                                      style: GoogleFonts.poppins(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Row(
                                        children: [1, 2, 3, 4].map((freq) {
                                          final isSelected = med.timesPerDay == freq;
                                          return Expanded(
                                            child: GestureDetector(
                                              onTap: () {
                                                setModalState(() {
                                                  med.timesPerDay = freq;
                                                  med.initialCount = MedicationEntry.calculateStock(
                                                    durationDays,
                                                    freq,
                                                  );
                                                });
                                              },
                                              child: Container(
                                                margin: const EdgeInsets.symmetric(horizontal: 2),
                                                padding: const EdgeInsets.symmetric(vertical: 6),
                                                decoration: BoxDecoration(
                                                  color: isSelected
                                                      ? const Color(0xFF5FA9A9)
                                                      : Colors.grey.shade200,
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Center(
                                                  child: Text(
                                                    "${freq}x",
                                                    style: GoogleFonts.poppins(
                                                      fontSize: 11,
                                                      color: isSelected ? Colors.white : Colors.black87,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          );
                                        }).toList(),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Stock info badge strictly matching duration * frequency
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE8F4F4),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        "Required Stock:",
                                        style: GoogleFonts.poppins(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                          color: Colors.black87,
                                        ),
                                      ),
                                      Text(
                                        "${med.initialCount} medicines ($durationDays d × ${med.timesPerDay}x)",
                                        style: GoogleFonts.poppins(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF5FA9A9),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],

                      const SizedBox(height: 24),

                      // Save Record Button with strict validation
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            final patientName = patientNameController.text.trim();
                            if (patientName.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text("Please enter a patient name.")),
                              );
                              return;
                            }
                            if (pendingMedications.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text("Please select at least 1 medication.")),
                              );
                              return;
                            }

                            // Strict validation: Ensure all stock counts match duration * frequency
                            for (var med in pendingMedications) {
                              final expectedStock = MedicationEntry.calculateStock(durationDays, med.timesPerDay);
                              med.initialCount = expectedStock; // Ensure strict match
                            }

                            setState(() {
                              _records.add(PatientMedicationRecord(
                                patientName: patientName,
                                medications: pendingMedications,
                                startDate: startDate,
                                endDate: endDate,
                                isExpanded: true,
                              ));
                            });
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("Added medication schedule for $patientName"),
                                backgroundColor: const Color(0xFF5FA9A9),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF5FA9A9),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(25),
                            ),
                          ),
                          child: Text(
                            "Save Record",
                            style: GoogleFonts.poppins(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      )
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

  /// Multi-Select Medicine Dialog with search filter
  Future<List<String>?> _showMultiSelectMedicineDialog(
    BuildContext context, {
    required Set<String> alreadySelected,
  }) async {
    final Set<String> selected = Set.from(alreadySelected);
    String filter = "";

    return showDialog<List<String>>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setInnerState) {
            final filteredMedicines = _alphabeticalMedicines
                .where((m) => m.toLowerCase().contains(filter.toLowerCase())).toList();

            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.75,
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Select Medicine(s)",
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: const Color(0xFF2D3436),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 20, color: Colors.black54),
                          onPressed: () => Navigator.pop(context),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Search Box
                    TextField(
                      onChanged: (val) => setInnerState(() => filter = val),
                      style: GoogleFonts.poppins(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: "Search medicine (A-Z)...",
                        hintStyle: GoogleFonts.poppins(fontSize: 12, color: Colors.black38),
                        prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF5FA9A9)),
                        filled: true,
                        fillColor: const Color(0xFFE8F4F4),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0x665FA9A9)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0x665FA9A9)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0xFF5FA9A9), width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Quick Select info
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "${selected.length} medicine(s) chosen",
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF5FA9A9),
                          ),
                        ),
                        if (selected.isNotEmpty)
                          InkWell(
                            onTap: () => setInnerState(() => selected.clear()),
                            child: Text(
                              "Clear all",
                              style: GoogleFonts.poppins(
                                fontSize: 11,
                                color: Colors.redAccent,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Medicines Checklist
                    Expanded(
                      child: filteredMedicines.isEmpty
                          ? Center(
                              child: Text(
                                "No medicines match your search.",
                                style: GoogleFonts.poppins(fontSize: 12, color: Colors.black45),
                              ),
                            )
                          : ListView.builder(
                              itemCount: filteredMedicines.length,
                              itemBuilder: (context, index) {
                                final medName = filteredMedicines[index];
                                final isChecked = selected.contains(medName);

                                return CheckboxListTile(
                                  value: isChecked,
                                  activeColor: const Color(0xFF5FA9A9),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                                  dense: true,
                                  controlAffinity: ListTileControlAffinity.leading,
                                  title: Text(
                                    medName,
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: isChecked ? FontWeight.bold : FontWeight.normal,
                                      color: isChecked ? const Color(0xFF5FA9A9) : Colors.black87,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  onChanged: (bool? val) {
                                    setInnerState(() {
                                      if (val == true) {
                                        selected.add(medName);
                                      } else {
                                        selected.remove(medName);
                                      }
                                    });
                                  },
                                );
                              },
                            ),
                    ),
                    const SizedBox(height: 12),

                    // Confirm Selection Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5FA9A9),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        onPressed: () => Navigator.pop(context, selected.toList()),
                        child: Text(
                          "Done (${selected.length} Selected)",
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLabel(String text) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: text,
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
          TextSpan(
            text: " *",
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.red,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE4F3F2),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(Icons.medication_outlined,
                        color: Color(0xFF5FA9A9), size: 25),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Medication Tracker",
                            style: GoogleFonts.poppins(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF2D3436))),
                        Text("Schedules, dosage, and medicine stock",
                            style: GoogleFonts.albertSans(
                                fontSize: 12, color: Colors.black54)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Add Patient Button
              InkWell(
                onTap: _showAddMedicationModal,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(
                    color: const Color(0xFF5FA9A9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        "Add Medication Schedule",
                        style: GoogleFonts.albertSans(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              Text(
                "Today's Schedule",
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2D3436),
                ),
              ),
              Text(
                "Patient medication plans and remaining stock",
                style: GoogleFonts.albertSans(
                  fontSize: 12,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 16),

              // Patient Cards List or Empty State
              if (_records.isEmpty)
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(22),
                              decoration: const BoxDecoration(
                                color: Color(0xFFE8F4F4),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.medication_liquid_outlined,
                                size: 56,
                                color: Color(0xFF5FA9A9),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Text(
                              "No Medication Records",
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "Keep track of your patient's medication, schedule, and stock count.\nTap 'Add Patient’s Medication Tracking' above to create one.",
                              textAlign: TextAlign.center,
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: Colors.black54,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: _records.length,
                    itemBuilder: (context, index) {
                      return _buildPatientCard(_records[index]);
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPatientCard(PatientMedicationRecord record) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF5FA9A9).withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tab Header with Inverted Triangle Dropdown Icon at Top Right
          InkWell(
            onTap: () {
              setState(() {
                record.isExpanded = !record.isExpanded;
              });
            },
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          record.patientName,
                          style: GoogleFonts.poppins(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF2D3436),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "${record.medications.length} ${record.medications.length == 1 ? 'Medicine' : 'Medicines'} • ${DateFormat('MMM d').format(record.startDate)} - ${DateFormat('MMM d, y').format(record.endDate)} (${record.totalDays}d)",
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            color: Colors.black54,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Inverted triangle expand/collapse icon at top right corner
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F4F4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      record.isExpanded ? Icons.arrow_drop_up : Icons.arrow_drop_down,
                      color: const Color(0xFF5FA9A9),
                      size: 26,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Collapsible Details Section
          if (record.isExpanded) ...[
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: Divider(height: 1, color: Color(0xFFEEEEEE)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: record.medications.map((med) {
                  // Accurate stock calculation based on actual days elapsed
                  final initialStock = med.initialCount;
                  final dosesConsumed = record.daysElapsed * med.timesPerDay;
                  final remainingStock = (initialStock - dosesConsumed).clamp(0, initialStock);
                  final remainingDays = record.remainingDays;

                  Color statusColor;
                  String statusText;

                  if (remainingStock <= 0 || remainingDays == 0) {
                    statusColor = Colors.red;
                    statusText = "Completed / Out of stock (0 left)";
                  } else if (remainingStock <= 2 * med.timesPerDay) {
                    statusColor = Colors.red;
                    statusText = "Nearing end. Restock needed ($remainingStock left • $remainingDays d left)";
                  } else if (remainingStock <= 4 * med.timesPerDay) {
                    statusColor = Colors.orange;
                    statusText = "Low stock ($remainingStock of $initialStock left • $remainingDays d left)";
                  } else {
                    statusColor = const Color(0xFF2E7D32);
                    statusText = "In stock ($remainingStock of $initialStock left • $remainingDays d left)";
                  }

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7FBFB),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0x335FA9A9)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Image.asset(
                          'assets/images/bottle.png',
                          width: 34,
                          height: 34,
                          errorBuilder: (context, error, stackTrace) =>
                              const Icon(Icons.medication, size: 34, color: Color(0xFF5FA9A9)),
                        ),
                        const SizedBox(width: 10),

                        // Medication name and status with overflow prevention
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      med.medicineName,
                                      style: GoogleFonts.poppins(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black87,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF5FA9A9),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      "${med.timesPerDay}x/day",
                                      style: GoogleFonts.poppins(
                                        fontSize: 10,
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                statusText,
                                style: GoogleFonts.poppins(
                                  fontSize: 10.5,
                                  fontStyle: FontStyle.italic,
                                  color: Colors.black54,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Status Color Dot
                        Container(
                          width: 11,
                          height: 11,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
