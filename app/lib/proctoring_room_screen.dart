import 'dart:async'; // <-- ADDED: Needed for the event listener
import 'package:flutter/material.dart';
import 'package:stream_video_flutter/stream_video_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ProctoringRoomScreen extends StatefulWidget {
  final String callId;
  final String token; 

  const ProctoringRoomScreen({super.key, required this.callId, required this.token});

  @override
  State<ProctoringRoomScreen> createState() => _ProctoringRoomScreenState();
}

class _ProctoringRoomScreenState extends State<ProctoringRoomScreen> {
  Call? _call;
  bool _isMicrophoneOn = true;
  bool _isCameraOn = true;
  
  StreamSubscription? _eventSubscription; // <-- ADDED: To listen for call ending

  // --- DaisyUI / Tailwind Color Palette ---
  final Color bgBase100 = const Color(0xFF1D232A);
  final Color bgBase200 = const Color(0xFF191E24);
  final Color bgBase300 = const Color(0xFF15191E);
  final Color textBaseContent = const Color(0xFFA6ADBB);
  final Color primaryColor = const Color(0xFF7480FF);
  final Color errorColor = const Color(0xFFF87272);

  @override
  void initState() {
    super.initState();
    _initializeProctoringCall();
  }

  Future<void> _initializeProctoringCall() async {
    final streamApiKey = dotenv.env['STREAM_API_KEY'] ?? '';

    // RESTORED: Your original working User code
    final proctorUser = User(
      info: UserInfo(id: 'proctor_camera_01', name: 'Mobile Proctor', role: 'admin'),
    );

    final videoClient = StreamVideo(
      streamApiKey,
      user: proctorUser,
      userToken: widget.token,
    );
    
    // RESTORED: Your original working StreamCallType
    final call = videoClient.makeCall(
      callType: StreamCallType.defaultType(), 
      id: widget.callId,
    );
    
    await call.join();

    // --- THE ONLY FIX WE ADDED: Safely listening for the call to end ---
    _eventSubscription = videoClient.events.listen((event) {
      final eventName = event.runtimeType.toString();
      // By checking the string name, we avoid any import/type errors!
      if (eventName.contains('CallEnded') || eventName.contains('CallDeleted')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('The interviewer has ended the session.'),
              backgroundColor: Colors.redAccent,
            ),
          );
          Navigator.of(context).pop(); // Go back to QR scanner automatically
        }
      }
    });
    // -------------------------------------------------------------------
    
    if (mounted) {
      setState(() => _call = call);
    }
  }

  @override
  void dispose() {
    _eventSubscription?.cancel(); // Always clean up listeners!
    _call?.leave(); // Safely disconnects if they use the Android Back button
    super.dispose();
  }

  // RESTORED: Your exact original build method and PartialCallStateBuilder
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgBase100, 
      body: SafeArea(
        child: Column(
          children: [
            // --- HEADER ---
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: bgBase100,
                border: Border(bottom: BorderSide(color: bgBase300, width: 2)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Proctor Camera',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Session ID: ${widget.callId}',
                          style: TextStyle(
                            color: textBaseContent.withOpacity(0.7),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: bgBase200,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: bgBase300),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: errorColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'LIVE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // --- VIDEO FEED AREA ---
            Expanded(
              child: Container(
                color: bgBase200, 
                padding: const EdgeInsets.all(16),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: bgBase100,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: bgBase300, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      )
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: _call != null 
                        ? PartialCallStateBuilder(
                            call: _call!,
                            selector: (state) => state.localParticipant,
                            builder: (context, localParticipant) {
                              if (localParticipant == null) {
                                return Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      CircularProgressIndicator(color: primaryColor),
                                      const SizedBox(height: 16),
                                      Text(
                                        'Starting camera...',
                                        style: TextStyle(color: textBaseContent),
                                      )
                                    ],
                                  ),
                                );
                              }
                              
                              return StreamCallParticipant(
                                call: _call!,
                                participant: localParticipant,
                              );
                            },
                          )
                        : Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                CircularProgressIndicator(color: primaryColor),
                                const SizedBox(height: 16),
                                Text(
                                  'Connecting to Stream...',
                                  style: TextStyle(color: textBaseContent),
                                )
                              ],
                            ),
                          ),
                  ),
                ),
              ),
            ),

            // --- BOTTOM CONTROLS ---
            Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
              decoration: BoxDecoration(
                color: bgBase100,
                border: Border(top: BorderSide(color: bgBase300, width: 2)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildControlBtn(
                    icon: _isMicrophoneOn ? Icons.mic : Icons.mic_off,
                    isActive: _isMicrophoneOn,
                    onTap: () {
                      _call?.setMicrophoneEnabled(enabled: !_isMicrophoneOn);
                      setState(() => _isMicrophoneOn = !_isMicrophoneOn);
                    },
                  ),
                  _buildControlBtn(
                    icon: _isCameraOn ? Icons.videocam : Icons.videocam_off,
                    isActive: _isCameraOn,
                    onTap: () {
                      _call?.setCameraEnabled(enabled: !_isCameraOn);
                      setState(() => _isCameraOn = !_isCameraOn);
                    },
                  ),
                  GestureDetector(
                    onTap: () async {
                      await _call?.leave();
                      if (mounted) Navigator.of(context).pop();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                      decoration: BoxDecoration(
                        color: errorColor,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: errorColor.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.call_end, color: Colors.white, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Disconnect',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlBtn({
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActive ? bgBase200 : errorColor.withOpacity(0.15),
          shape: BoxShape.circle,
          border: Border.all(
            color: isActive ? bgBase300 : errorColor.withOpacity(0.3),
            width: 2,
          ),
        ),
        child: Icon(
          icon,
          color: isActive ? textBaseContent : errorColor,
          size: 26,
        ),
      ),
    );
  }
}