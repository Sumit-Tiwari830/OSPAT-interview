import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart'; 
import 'qr_scanner_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  runApp(const OSPATProctorApp());
}

class OSPATProctorApp extends StatelessWidget {
  const OSPATProctorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'OSPAT Mobile Proctor',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7480FF), 
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const QrScannerScreen(),
    );
  }
}