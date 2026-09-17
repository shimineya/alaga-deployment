import 'package:flutter/material.dart';

Future<String?> chooseAccountRole(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (context) => SimpleDialog(
      title: const Text('Choose your account'),
      children: [
        for (final role in ['parent', 'caregiver'])
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, role),
            child: Text(role == 'parent' ? 'Parent' : 'Caregiver'),
          ),
      ],
    ),
  );
}
