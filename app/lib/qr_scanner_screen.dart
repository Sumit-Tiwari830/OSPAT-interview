import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'proctoring_room_screen.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  // We use this boolean to stop the camera from scanning the same 
  // QR code 100 times a second once it finds it.
  bool _hasScanned = false; 

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan Interview Room QR'),
        backgroundColor: Colors.blueGrey[900],
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          MobileScanner(
            // The camera handles the heavy lifting automatically
           onDetect: (capture) {
  if (_hasScanned) return; 

  final List<Barcode> barcodes = capture.barcodes;
  for (final barcode in barcodes) {
    if (barcode.rawValue != null) {
      setState(() => _hasScanned = true);
      
      final String scannedData = barcode.rawValue!;
      
      // Stop the scanner and push the new Proctoring Room screen onto the app!
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => ProctoringRoomScreen(callId: scannedData),
        ),
      );
    }
  }
},
          ),
          
          // A simple UI overlay to tell the user what to do
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.greenAccent, width: 4),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const Positioned(
            bottom: 50,
            left: 0,
            right: 0,
            child: Text(
              'Point camera at the web dashboard',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }
}