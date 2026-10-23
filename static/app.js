/**
 * EchoBuddy Pro — Real-Time Client AI Vision, Web Audio Sonar & Voice Perception Engine
 */

class WebAudioSpatialSynthesizer {
    constructor() {
        this.ctx = null;
        this.osc = null;
        this.panner = null;
        this.gain = null;
        this.isEnabled = true;
        
        this.currentPan = 0.0;
        this.currentFreq = 550.0;
        this.currentPulseInterval = 300;
        this.isLocked = false;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.osc = this.ctx.createOscillator();
        this.osc.type = 'sine';
        this.osc.frequency.value = 550;

        if (this.ctx.createStereoPanner) {
            this.panner = this.ctx.createStereoPanner();
            this.panner.pan.value = 0.0;
        } else {
            this.panner = this.ctx.createGain();
        }

        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.0;

        this.osc.connect(this.panner);
        this.panner.connect(this.gain);
        this.gain.connect(this.ctx.destination);

        this.osc.start();
        this.isEnabled = true;
        this.startPulseLoop();
    }

    updateParameters(pan, freqHz, pulseMs, isLocked) {
        if (!this.ctx || !this.isEnabled) return;
        this.currentPan = pan;
        this.currentFreq = freqHz;
        this.currentPulseInterval = pulseMs;
        this.isLocked = isLocked;

        const now = this.ctx.currentTime;
        if (this.panner.pan) {
            this.panner.pan.setTargetAtTime(pan, now, 0.03);
        }
        this.osc.frequency.setTargetAtTime(freqHz, now, 0.03);
    }

    startPulseLoop() {
        const triggerBeep = () => {
            if (!this.isEnabled || !this.ctx) return;
            const now = this.ctx.currentTime;
            
            if (this.isLocked) {
                this.gain.gain.setTargetAtTime(0.35, now, 0.01);
            } else {
                this.gain.gain.setValueAtTime(0.3, now);
                this.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            }

            setTimeout(triggerBeep, this.isLocked ? 100 : this.currentPulseInterval);
        };
        triggerBeep();
    }
}

// Global App State
const synth = new WebAudioSpatialSynthesizer();
let speechEnabled = true;
let hapticsEnabled = true;
let handsFreeActive = true;
let cocoModel = null;
let currentTargetName = "bottle";
let currentMode = 'cam'; // 'cam' | 'sim' | 'api'
let lastSpokenTime = 0;
let lastSpokenText = "";
let lastDetectedObjects = [];
let targetObjSim = { x: 320, y: 240, z: 1.25 };

// Real-world physical object height lookup (in meters)
const PHYSICAL_OBJECT_HEIGHTS = {
    "bottle": 0.24,
    "water bottle": 0.25,
    "cup": 0.12,
    "cell phone": 0.15,
    "mobile": 0.15,
    "laptop": 0.25,
    "mouse": 0.04,
    "keyboard": 0.15,
    "book": 0.22,
    "chair": 0.90,
    "person": 1.70,
    "backpack": 0.45,
    "scissors": 0.18,
    "remote": 0.18,
    "clock": 0.25,
    "keys": 0.08,
    "wallet": 0.10,
    "glasses": 0.05
};

// DOM Elements
const video = document.getElementById('webcam-video');
const detectCanvas = document.getElementById('detection-canvas');
const detectCtx = detectCanvas.getContext('2d');
const sonarCanvas = document.getElementById('sonar-canvas');
const sonarCtx = sonarCanvas.getContext('2d');

const customTargetInput = document.getElementById('custom-target-input');
const btnSetTarget = document.getElementById('btn-set-target');
const btnVoiceCmd = document.getElementById('btn-voice-command');
const btnVoiceAgent = document.getElementById('btn-toggle-voice-agent');
const btnAudio = document.getElementById('btn-toggle-audio');
const btnSpeech = document.getElementById('btn-toggle-speech');
const btnHaptics = document.getElementById('btn-toggle-haptics');
const aiStatus = document.getElementById('ai-vision-status');

const lockOverlay = document.getElementById('lock-overlay');
const guidanceBanner = document.getElementById('guidance-banner');
const speechLog = document.getElementById('speech-log');
const detectedObjectsList = document.getElementById('detected-objects-list');

// Telemetry DOM
const valPan = document.getElementById('val-pan');
const valDist = document.getElementById('val-dist');
const valProx = document.getElementById('val-prox');
const valDx = document.getElementById('val-dx');
const valDy = document.getElementById('val-dy');
const valDz = document.getElementById('val-dz');
const meterPan = document.getElementById('meter-pan');
const meterDist = document.getElementById('meter-dist');
const meterProx = document.getElementById('meter-prox');

// -------------------------------------------------------------
// Voice Narrator & Speech Synthesis
// -------------------------------------------------------------
function announceVoice(text, force = false) {
    speechLog.textContent = `"${text}"`;
    if (!speechEnabled || !('speechSynthesis' in window)) return;

    const now = Date.now();
    if (!force && (now - lastSpokenTime < 3500 || text === lastSpokenText)) {
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);

    lastSpokenTime = now;
    lastSpokenText = text;
}

function triggerHapticPulse(pattern = [100, 50, 100]) {
    if (hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// -------------------------------------------------------------
// Hands-Free Continuous Voice Control Agent
// -------------------------------------------------------------
let recognitionAgent = null;

function initHandsFreeVoiceAgent() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionAgent = new SpeechRecognition();
    recognitionAgent.continuous = true;
    recognitionAgent.interimResults = false;
    recognitionAgent.lang = 'en-US';

    recognitionAgent.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log("Voice Agent Heard:", transcript);

        if (transcript.includes("what do you see") || transcript.includes("scan room")) {
            triggerSceneReader();
        } else if (transcript.includes("find") || transcript.includes("search") || transcript.includes("where is")) {
            let clean = transcript
                .replace("find my", "")
                .replace("find a", "")
                .replace("find the", "")
                .replace("find", "")
                .replace("search for", "")
                .replace("where is my", "")
                .replace("where is a", "")
                .trim();
            if (clean) {
                setTarget(clean);
            }
        }
    };

    recognitionAgent.onend = () => {
        if (handsFreeActive) {
            try { recognitionAgent.start(); } catch (e) {}
        }
    };

    try { recognitionAgent.start(); } catch (e) {}
}

btnVoiceAgent.addEventListener('click', () => {
    handsFreeActive = !handsFreeActive;
    btnVoiceAgent.textContent = handsFreeActive ? '🎙️ Hands-Free Voice Agent: ACTIVE' : '🎙️ Hands-Free Voice Agent: OFF';
    btnVoiceAgent.style.backgroundColor = handsFreeActive ? '#c084fc' : 'rgba(255,255,255,0.1)';
    if (handsFreeActive && recognitionAgent) {
        try { recognitionAgent.start(); } catch (e) {}
    } else if (recognitionAgent) {
        recognitionAgent.stop();
    }
});

// -------------------------------------------------------------
// Target & Buttons Controls
// -------------------------------------------------------------
function setTarget(name) {
    currentTargetName = name.toLowerCase().strip ? name.toLowerCase().strip() : name.toLowerCase();
    customTargetInput.value = name;
    announceVoice(`Target set to ${name}. Point camera to search.`, true);
    triggerHapticPulse([80]);
}

btnSetTarget.addEventListener('click', () => {
    const val = customTargetInput.value.trim();
    if (val) setTarget(val);
});

btnVoiceCmd.addEventListener('click', () => {
    announceVoice("Please speak the name of the object you want to find.", true);
});

btnAudio.addEventListener('click', () => {
    synth.init();
    btnAudio.textContent = '🔊 Spatial Sonar Audio: ACTIVE';
    btnAudio.style.backgroundColor = '#10b981';
});

btnSpeech.addEventListener('click', () => {
    speechEnabled = !speechEnabled;
    btnSpeech.textContent = speechEnabled ? '🗣️ Voice Speech Guidance: ON' : '🔇 Voice Speech: OFF';
});

btnHaptics.addEventListener('click', () => {
    hapticsEnabled = !hapticsEnabled;
    btnHaptics.textContent = hapticsEnabled ? '📳 Haptic Pulses: ON' : '📳 Haptics: OFF';
});

// Mode Selector
document.getElementById('btn-mode-cam').addEventListener('click', (e) => switchMode('cam', e.target));
document.getElementById('btn-mode-sim').addEventListener('click', (e) => switchMode('sim', e.target));
document.getElementById('btn-mode-api').addEventListener('click', (e) => switchMode('api', e.target));

function switchMode(mode, btn) {
    currentMode = mode;
    document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const apiSection = document.getElementById('api-playground-section');
    if (mode === 'api') {
        apiSection.classList.remove('hidden');
    } else {
        apiSection.classList.add('hidden');
    }

    if (mode === 'cam') {
        detectCanvas.classList.remove('hidden');
        sonarCanvas.classList.add('hidden');
        video.classList.remove('hidden');
        startCameraVision();
    } else {
        detectCanvas.classList.add('hidden');
        sonarCanvas.classList.remove('hidden');
        video.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// "What Do You See?" Scene Reader Engine
// -------------------------------------------------------------
function triggerSceneReader() {
    if (!lastDetectedObjects || lastDetectedObjects.length === 0) {
        announceVoice("I am scanning the room. No objects detected in frame yet.", true);
        return;
    }

    const summaries = lastDetectedObjects.slice(0, 4).map(obj => {
        const distStr = obj.distance_m >= 1.0 ? `${obj.distance_m.toFixed(1)} meters` : `${Math.round(obj.distance_m * 100)} centimeters`;
        return `${obj.class} ${distStr} away on your ${obj.position}`;
    });

    const fullNarration = `In your surroundings, I detect: ${summaries.join(', ')}.`;
    announceVoice(fullNarration, true);
    triggerHapticPulse([150, 100, 150]);
}

// -------------------------------------------------------------
// TensorFlow.js COCO-SSD Real-Time Camera Object Detection Loop
// -------------------------------------------------------------
let isCameraActive = false;

async function loadTensorFlowVisionModel() {
    try {
        aiStatus.innerHTML = '<span class="status-dot pulsing"></span> AI Vision: Loading Neural Network...';
        cocoModel = await cocoSsd.load();
        aiStatus.innerHTML = '<span class="status-dot"></span> AI Vision: Active (WebGL Accelerated)';
        aiStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        announceVoice("EchoBuddy AI Vision model loaded successfully. Say 'Find' followed by any object name to begin.", true);
        initHandsFreeVoiceAgent();
        startCameraVision();
    } catch (err) {
        console.error("TF.js COCO-SSD Load Error:", err);
        aiStatus.innerHTML = '<span class="status-dot"></span> AI Vision: Fallback Mode Active';
    }
}

function startCameraVision() {
    if (isCameraActive) return;

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            isCameraActive = true;
            synth.init();
            requestAnimationFrame(detectFrameLoop);
        })
        .catch(err => {
            alert("Camera access denied or unavailable. Switching to 3D Interactive Simulator.");
            document.getElementById('btn-mode-sim').click();
        });
}

async function detectFrameLoop() {
    if (currentMode === 'cam' && video.readyState === 4) {
        detectCtx.clearRect(0, 0, detectCanvas.width, detectCanvas.height);

        let predictions = [];
        if (cocoModel) {
            predictions = await cocoModel.detect(video);
        }

        lastDetectedObjects = [];
        let targetFound = false;

        const detectedListHTML = [];

        predictions.forEach(pred => {
            const [x, y, w, h] = pred.bbox;
            const objClass = pred.class.toLowerCase();

            // Pinhole camera depth calculation
            const realH = PHYSICAL_OBJECT_HEIGHTS[objClass] || 0.25;
            const distMeters = Math.max(0.15, Math.min(5.0, (realH * 600.0) / h));

            const centerX = x + (w / 2.0);
            const dx = (centerX - (detectCanvas.width / 2.0)) / (detectCanvas.width / 2.0);
            const position = dx < -0.2 ? "left" : dx > 0.2 ? "right" : "center";

            lastDetectedObjects.push({
                class: pred.class,
                distance_m: roundNum(distMeters, 2),
                position: position,
                bbox: pred.bbox
            });

            detectedListHTML.push(`<li><span>${pred.class}</span> <span>${distMeters.toFixed(1)}m (${position})</span></li>`);

            // Check if object matches requested target
            const isTargetMatch = objClass.includes(currentTargetName) || currentTargetName.includes(objClass);

            // Draw Real-Time Bounding Box Overlay
            detectCtx.strokeStyle = isTargetMatch ? '#10b981' : 'rgba(56, 189, 248, 0.7)';
            detectCtx.lineWidth = isTargetMatch ? 4 : 2;
            detectCtx.strokeRect(x, y, w, h);

            // Bounding Box Label
            detectCtx.fillStyle = isTargetMatch ? '#10b981' : 'rgba(16, 23, 38, 0.85)';
            detectCtx.fillRect(x, y - 24, Math.max(120, pred.class.length * 10 + 60), 24);
            detectCtx.fillStyle = '#ffffff';
            detectCtx.font = '700 13px "Plus Jakarta Sans"';
            detectCtx.fillText(`${pred.class.toUpperCase()} (${distMeters.toFixed(1)}m)`, x + 6, y - 7);

            if (isTargetMatch && !targetFound) {
                targetFound = true;

                const centerY = y + (h / 2.0);
                const dy = ((detectCanvas.height / 2.0) - centerY) / (detectCanvas.height / 2.0);

                const normDy = (dy + 1.0) / 2.0;
                const freqHz = Math.round(261.63 + (normDy * (880.0 - 261.63)));
                const normDz = (distMeters - 0.15) / (3.5 - 0.15);
                const pulseMs = Math.round(50 + (normDz * (600 - 50)));

                const isCentered = Math.abs(dx) <= 0.18 && Math.abs(dy) <= 0.18;
                const isClose = distMeters <= 0.35;
                const isLocked = isCentered && isClose;

                synth.updateParameters(dx, freqHz, pulseMs, isLocked);
                updateTelemetryUI(dx, dy, distMeters, dx, freqHz, pulseMs, isLocked, pred.class);

                if (isLocked) {
                    triggerHapticPulse([150, 50, 150]);
                }
            }
        });

        if (detectedObjectsList) {
            detectedObjectsList.innerHTML = detectedListHTML.length ? detectedListHTML.join('') : '<li class="empty-item">Scanning camera feed...</li>';
        }

        if (!targetFound && predictions.length > 0) {
            guidanceBanner.textContent = `👁️ ${predictions.length} objects visible. Target "${currentTargetName}" not locked yet.`;
            guidanceBanner.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
            guidanceBanner.style.color = '#38bdf8';
        }
    }

    requestAnimationFrame(detectFrameLoop);
}

function updateTelemetryUI(dx, dy, dz, pan, freqHz, pulseMs, isLocked, labelName) {
    valPan.textContent = pan.toFixed(2);
    valDist.textContent = `${dz.toFixed(2)}m (${(dz * 3.28).toFixed(1)} ft)`;
    valDx.textContent = dx.toFixed(2);
    valDy.textContent = dy.toFixed(2);
    valDz.textContent = `${dz.toFixed(2)}m`;

    meterPan.style.width = `${((pan + 1.0) / 2.0) * 100}%`;
    meterDist.style.width = `${(1.0 - (dz / 3.0)) * 100}%`;

    const proxPct = Math.round((1.0 - (dz / 3.0)) * 50 + (1.0 - Math.min(1.0, Math.sqrt(dx*dx + dy*dy))) * 50);
    valProx.textContent = `${proxPct}%`;
    meterProx.style.width = `${proxPct}%`;

    let guidanceText = "";
    if (isLocked) {
        lockOverlay.classList.remove('hidden');
        guidanceText = `${labelName} locked! Touch distance ahead.`;
        guidanceBanner.textContent = `🔒 ${guidanceText}`;
        guidanceBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        guidanceBanner.style.color = '#10b981';
        announceVoice(`${labelName} locked! Reach straight ahead.`, true);
    } else {
        lockOverlay.classList.add('hidden');
        let cue = [];
        if (dx < -0.2) cue.push("to your right");
        if (dx > 0.2) cue.push("to your left");
        if (dy < -0.2) cue.push("higher up");
        if (dy > 0.2) cue.push("lower down");

        const distStr = dz >= 1.0 ? `${dz.toFixed(1)} meters` : `${Math.round(dz * 100)} centimeters`;
        const dirStr = cue.length ? cue.join(' and ') : 'straight ahead';

        guidanceText = `${labelName} is ${distStr} away, ${dirStr}.`;
        guidanceBanner.textContent = `🔊 ${guidanceText}`;
        guidanceBanner.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
        guidanceBanner.style.color = '#38bdf8';
        announceVoice(guidanceText);
    }
}

function roundNum(num, dec) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

// Load AI models on start
loadTensorFlowVisionModel();
