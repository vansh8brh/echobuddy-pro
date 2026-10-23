# 🎙️ EchoBuddy Pro — AI Spatial Perception & Hands-Free Voice Companion

> **Production-Grade Accessibility & Spatial Perception Platform for Visually Impaired Users**

**EchoBuddy Pro** is an autonomous AI-powered spatial perception platform designed for blind and visually impaired (BVI) individuals.

Built with **TensorFlow.js Real-Time Neural Vision**, **Pinhole Camera Optical Depth Measurement**, **Web Audio 3D Sonification**, **Web Speech API Voice Navigation**, and **Haptic Pulses**, EchoBuddy Pro provides complete digital independence without requiring expensive hardware.

---

## 🌟 Key Features Built for Blind Users

1. **🎙️ Hands-Free Voice Control Agent:**
   - Blind users do not need to touch screen buttons or type.
   - Simply speak: *"Find my phone"*, *"Where is my bottle"*, or *"What do you see?"*.

2. **👁️ Real-Time Optical AI Object Detection & Distance Measurement:**
   - Powered by TensorFlow.js (COCO-SSD) running directly inside the browser WebGL GPU at 30–60 FPS.
   - Detects 80+ real-world objects (*cell phone, bottle, cup, laptop, mouse, keyboard, chair, book, scissors, backpack, remote, clock, toothbrush, person, keys, etc.*).
   - Calculates **exact physical distance in meters and feet** using Pinhole Camera Geometry.

3. **🗣️ Natural Conversational Voice Guidance:**
   - Announces real-time object locations out loud (*"Bottle detected 1.2 meters away, 30 degrees to your left"*).
   - Spoken Lock Announcement (*"Target locked! Reach straight ahead"*).

4. **👁️ "What Do You See?" Ambient Scene Reader:**
   - Speak *"What do you see?"* or click the button to get an ambient verbal narration of all items visible in the room.

5. **📳 Tactile Haptic Pulses:**
   - Triggers physical vibration patterns on smartphones when an object is aligned or target-locked.

6. **🎯 WCAG 2.1 AAA High-Contrast Professional UI/UX:**
   - Sleek glassmorphic dark interface, glowing bounding box overlays, voice wave visualizer, and real-time spatial telemetry.

---

## 💻 Quick Start & Launching

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the EchoBuddy Platform Server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open `http://localhost:8000` in your web browser. Allow camera and microphone permissions for hands-free voice navigation.

---

## 📡 API Reference

### 1. Platform Health Check
`GET /api/v1/health`

```json
{
  "status": "healthy",
  "platform": "EchoBuddy Accessibility Platform",
  "version": "2.0.0",
  "vision_engine": "TensorFlow.js & OpenCV active",
  "voice_navigation": "operational"
}
```

### 2. Ambient Scene Reader API
`POST /api/v1/scene-describe`

```json
{
  "objects": [
    {"label": "bottle", "distance_m": 0.8, "position": "left"},
    {"label": "cell phone", "distance_m": 0.4, "position": "center"}
  ]
}
```

**Response:**
```json
{
  "speech_narration": "In your surroundings, I detect a bottle 0.8 meters away on your left, and a cell phone 0.4 meters away on your center.",
  "object_count": 2
}
```

### 3. Spatial Sonification API
`POST /api/v1/sonify`

```json
{
  "dx": -0.35,
  "dy": 0.50,
  "dz": 0.85,
  "target_name": "bottle"
}
```

---

## 📁 File Structure

```
echopoint-ai/
├── app/
│   ├── main.py             # EchoBuddy FastAPI Server & Routes
│   ├── spatial_engine.py   # Pinhole Depth & Spatial Audio Engine
│   └── vision_engine.py    # Vision Perception & Scene Narration
├── static/
│   ├── index.html          # EchoBuddy Pro Platform Interface
│   ├── style.css           # Glassmorphic WCAG AAA Dark Styling
│   └── app.js              # TensorFlow.js COCO-SSD, Speech & Haptics Engine
├── test_api.py             # API Verification Suite
├── requirements.txt        # Python Dependencies
└── README.md               # Production Documentation
```
