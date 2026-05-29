import 'package:flutter/material.dart';
import 'qr_scanner_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OSPATProctorApp());
}

class OSPATProctorApp extends StatelessWidget {
  const OSPATProctorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OSPAT Mobile Proctor',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey),
        useMaterial3: true,
      ),
      // Skip the default counter app and go straight to our scanner
      home: const QrScannerScreen(), 
    );
  }
}