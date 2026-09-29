# SoundGuard – AI-Powered Environmental Sound Assistant

> **A real-time, privacy-preserving Edge AI environmental sound detection assistant designed especially for people with hearing impairment and heightened situational awareness.**

SoundGuard operates on the foundational principle:
$$\text{Hear} \longrightarrow \text{Understand} \longrightarrow \text{Alert} \longrightarrow \text{Show + Speak}$$

---

## 🌟 Key Highlights & Innovations

1. **Dual Alert System (Core Innovation)**:
   - 🔊 **Voice Notification**: Speaks the detected sound immediately via on-device Text-to-Speech (e.g., *"Fire alarm detected"*, *"Car horn detected nearby"*).
   - 📱 **Large Visual Pop-up Alert**: High-contrast, accessibility-first visual modal with prominent iconography, exact timestamp, category, confidence score, screen flash, and haptic vibration.
2. **13 Predefined Environmental Sound Classes**:
   - 🚨 **Emergency Sounds (High Priority)**: Fire Alarm, Emergency Siren, Security Alarm, Distress Shouting / Screaming.
   - 🌍 **Environmental Sounds (Medium / Low Priority)**: Car Horn, Train, Motorcycle, Dog Barking, Construction Noise.
   - 🏠 **Household Sounds (High / Medium / Low Priority)**: Glass Breaking (High Priority), Doorbell, Baby Crying, Door Knocking.
3. **Snapdragon NPU / Edge AI Architecture**:
   - Designed for local execution on Qualcomm Snapdragon compute platforms (Snapdragon 8 Gen, Snapdragon X Elite, Snapdragon Cockpit) using Qualcomm Neural Processing SDK (SNPE) and QNN execution providers.
   - Sub-5ms inference latency ($~3.8\text{ ms}$).
   - Ultra-low power consumption ($<1\text{W}$).
4. **Privacy-First Design (Zero Cloud Audio Upload)**:
   - Audio is captured and processed **100% locally on-device**.
   - Raw microphone buffers are discarded immediately after acoustic feature extraction.
   - Persistent SQLite history logs only detection timestamps, categories, and confidence percentages—**never raw audio recordings**.
5. **Smart Debounce Cooldown**:
   - Eliminates alert fatigue from continuous repeating sounds (e.g., a 20-second siren or continuous alarm). Configurable cooldown (5–10s) suppresses duplicate bursts while maintaining live monitoring.
6. **Built-in Demo Sound Simulator (Section 19 Presentation Scenarios)**:
   - Built-in acoustic synthesizers for immediate demonstration of:
     - **Demo 1 — Fire Alarm**: T-3 pulsed emergency alarm pattern.
     - **Demo 2 — Car Horn**: Dual-tone automotive blast ($415\text{ Hz} + 495\text{ Hz}$).
     - **Demo 3 — Glass Breaking**: High-frequency shatter impact with resonant decay.
     - **Demo 4 — Doorbell**: Traditional Westminster chime ($660\text{ Hz} \to 520\text{ Hz}$).
     - Siren, Baby Crying, Dog Barking, and Knocking.
7. **Accessibility Suite**:
   - High Contrast Mode (high visibility black/yellow/red styling).
   - Large Text Mode (scaled typography for readability).
   - Screen Strobe Flash for emergency events.
   - Emergency Escalation Countdown (30s safety check with user-confirmed contact alert).

---

## 🏗️ Project Architecture

```text
soundguard/
├── frontend/                  # React 19 + Vite accessible interface
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx             # Top bar, Snapdragon status, accessibility switches
│   │   │   ├── LiveVisualizer.jsx     # HTML5 Canvas Waveform, Decibel meter, Last detection
│   │   │   ├── AlertModal.jsx         # Dual Alert visual pop-up, screen flash, vibration
│   │   │   ├── DemoSimulator.jsx      # Section 19 Demo test triggers with speaker playback
│   │   │   ├── HistoryList.jsx        # Searchable, filterable detection timeline & CSV export
│   │   │   └── SettingsPanel.jsx      # Sensitivity, cooldown, sound toggles, emergency contact
│   │   ├── services/
│   │   │   ├── audioService.js        # Web Audio API mic capture, FFT analyser, audio synthesis
│   │   │   ├── ttsService.js          # On-device SpeechSynthesis engine
│   │   │   ├── vibrationService.js    # Navigator vibration haptic patterns
│   │   │   └── apiService.js          # REST client to local backend
│   │   └── styles/
│   │       ├── index.css              # Glassmorphism, base styles, high-contrast theme
│   │       └── animations.css         # Emergency screen flash, radar pulse, modal animations
│   └── dist/                          # Production build served directly by Flask
│
├── ai/                        # Modular AI Sound Classification
│   ├── labels/categories.py           # 13 sound classes, categories, priorities, voice phrases
│   ├── preprocessing/audio_features.py# 40-band log-mel filterbanks, centroid, ZCR, RMS
│   ├── model/classifier.py            # Acoustic neural classifier & calibrated confidence
│   └── inference/engine.py            # Snapdragon NPU / Qualcomm QNN / ONNX Edge inference
│
├── audio/                     # Real-Time Audio Processing Pipeline
│   ├── capture/microphone.py          # PCM audio chunk ingestion & sliding buffer
│   ├── preprocessing/noise_filter.py  # Pre-emphasis, noise gate, DC-offset suppression
│   ├── detection/detector.py          # Detection loop, debounce cooldown & threshold gating
│   └── simulation/synthetic_sounds.py # Authentic acoustic synthesis for demo testing
│
├── notifications/             # Dual Alert Dispatchers
│   ├── voice/tts_engine.py            # Voice alert phrasing & speech synthesis
│   ├── visual/alert_formatter.py      # High/medium/low priority color schemes & metadata
│   └── vibration/haptic_patterns.py   # Tactile pulse sequences for mobile/wearable devices
│
├── database/
│   └── detection_history.py           # SQLite database with query, statistics, and CSV export
│
├── tests/                             # Automated Test Suite
│   ├── test_soundguard.py             # Unit tests for classification, debouncing, & database
│   └── test_api.py                    # REST API integration tests
│
└── server.py                          # Flask application serving APIs and the React frontend
```

---

## 🚀 Quick Start Guide

### 1. Launch the Application
Run the single unified server:
```bash
python server.py
```
Open your browser to:
👉 **[http://localhost:5000](http://localhost:5000)**

### 2. Run in Development Mode (Optional)
If you wish to edit frontend components with instant Hot-Module-Replacement:
```bash
# Terminal 1: Backend
python server.py

# Terminal 2: Frontend
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)**.

---

## 🧪 Testing the Section 19 Demo Scenarios

1. Navigate to **"Demo Sound Simulator"** (or use the Demo cards directly on the Dashboard).
2. Click **"🔊 Play Sound & Run AI"** on any scenario:
   - **Demo 1 — Fire Alarm**: Synthesizes a loud 3.2 kHz T-3 alarm -> Triggers 🔴 **RED ALERT MODAL**, screen flash, vibration, and speaks: *"Fire alarm detected."*
   - **Demo 2 — Car Horn**: Synthesizes dual automotive horn -> Triggers 🟠 **AMBER ALERT MODAL** and speaks: *"Car horn detected nearby."*
   - **Demo 3 — Glass Breaking**: Synthesizes glass shatter -> Triggers 🔴 **HIGH PRIORITY ALERT** and speaks: *"Glass breaking detected."*
   - **Demo 4 — Doorbell**: Synthesizes Westminster Ding-Dong -> Triggers 🟠 **DOORBELL MODAL** and speaks: *"Doorbell ringing."*
3. Dismiss alerts by clicking **[ ACKNOWLEDGE & DISMISS ]**, pressing **ENTER**, or pressing **SPACEBAR**.

---

## 🔒 Privacy & Edge AI Verification

- **Microphone Stream**: Processed strictly in-memory; raw audio is wiped after feature extraction.
- **Zero Cloud Network Calls**: AI inference runs entirely on the host CPU / Snapdragon NPU.
- **History Storage**: Only stores `[sound_name, category, confidence_percent, timestamp]`.
