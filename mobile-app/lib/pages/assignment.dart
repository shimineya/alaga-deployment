import 'package:flutter/material.dart';

class AssignmentScreen extends StatelessWidget {
  const AssignmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Assignment Tracker")),
      body: const Center(child: Icon(Icons.assignment_turned_in, size: 100, color: Color(0xFF5FA9A9))),
    );
  }
}