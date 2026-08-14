// Global Emergency App Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- Audio Utility using Web Audio API ---
  let audioCtx = null;
  
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playSound(type) {
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'tick') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'critical-tick') {
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      } else if (type === 'siren') {
        // Medical two-tone siren
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        // Modulate siren pitch
        let interval = setInterval(() => {
          if (osc && audioCtx) {
            const time = audioCtx.currentTime;
            osc.frequency.setValueAtTime(osc.frequency.value === 600 ? 800 : 600, time);
          }
        }, 400);

        osc.start();
        
        // Stop siren after 4 seconds
        setTimeout(() => {
          clearInterval(interval);
          try {
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.stop(audioCtx.currentTime + 0.2);
          } catch(e) {}
        }, 4000);
      }
    } catch (e) {
      console.warn("Audio Context blocked or unsupported:", e);
    }
  }

  // --- Clock / Status Bar ---
  function updateClock() {
    const timeEl = document.getElementById('statusTime');
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    minutes = minutes < 10 ? '0' + minutes : minutes;
    timeEl.textContent = `${hours}:${minutes}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- SOS Hold Mechanism ---
  const sosBtn = document.getElementById('sosBtn');
  const progressCircle = document.getElementById('sosProgressCircle');
  const sosCountdown = document.getElementById('sosCountdown');
  const phoneFrame = document.querySelector('.phone-frame');
  
  let isHolding = false;
  let holdStartTime = 0;
  let holdAnimationFrame = null;
  const holdDuration = 5000; // 5 seconds
  const circumference = 2 * Math.PI * 88; // Radius is 88, Circumference = 552.92

  function updateSOSProgress() {
    if (!isHolding) return;

    const elapsed = Date.now() - holdStartTime;
    const progress = Math.min(elapsed / holdDuration, 1);
    
    // Update SVG stroke-dashoffset
    const offset = circumference - (progress * circumference);
    progressCircle.style.strokeDashoffset = offset;

    // Update Countdown numbers
    const secondsRemaining = Math.ceil((holdDuration - elapsed) / 1000);
    if (secondsRemaining > 0) {
      sosCountdown.textContent = secondsRemaining;
      sosCountdown.classList.add('active');
    }

    // Audible tick feedback matching the speed of progress
    if (Math.floor(elapsed / 250) % 2 === 0) {
      playSound(elapsed > 3000 ? 'critical-tick' : 'tick');
    }

    // Shaking device warning on critical stage
    if (elapsed > 3000) {
      phoneFrame.classList.add('screen-shake');
    } else {
      phoneFrame.classList.remove('screen-shake');
    }

    if (progress < 1) {
      holdAnimationFrame = requestAnimationFrame(updateSOSProgress);
    } else {
      triggerSOS();
    }
  }

  function startHolding(e) {
    e.preventDefault();
    initAudio();
    isHolding = true;
    holdStartTime = Date.now();
    holdAnimationFrame = requestAnimationFrame(updateSOSProgress);
    sosBtn.style.transform = 'scale(0.92)';
  }

  function cancelHolding() {
    if (!isHolding) return;
    isHolding = false;
    cancelAnimationFrame(holdAnimationFrame);
    
    // Reset visual indicators smoothly
    progressCircle.style.strokeDashoffset = circumference;
    sosCountdown.classList.remove('active');
    phoneFrame.classList.remove('screen-shake');
    sosBtn.style.transform = '';
  }

  sosBtn.addEventListener('mousedown', startHolding);
  sosBtn.addEventListener('touchstart', startHolding);

  window.addEventListener('mouseup', cancelHolding);
  window.addEventListener('touchend', cancelHolding);
  sosBtn.addEventListener('mouseleave', cancelHolding);

  // --- SOS Activation Event ---
  function triggerSOS() {
    cancelHolding();
    playSound('success');
    playSound('siren');
    
    // Open full screen prioritized video call
    startVideoCall(true);
  }

  // --- Video Call Overlay System ---
  const videoCallModal = document.getElementById('videoCallModal');
  const vcConnectingScreen = document.getElementById('vcConnectingScreen');
  const doctorStreamWrapper = document.getElementById('doctorStreamWrapper');
  const userPipVideo = document.getElementById('userPipVideo');
  const userPipCanvas = document.getElementById('userPipCanvas');
  const pipFallback = document.getElementById('pipFallback');
  const dispatchMapCard = document.getElementById('dispatchMapCard');
  const mapAmbulance = document.getElementById('mapAmbulance');
  const vcStatusLabel = document.getElementById('vcStatusLabel');
  const vcQueueText = document.getElementById('vcQueueText');
  const doctorNameLabel = document.getElementById('doctorNameLabel');
  const doctorAvatar = document.getElementById('doctorAvatar');
  
  let vcTimer = null;
  let mapTimer = null;
  let localStream = null;
  let canvasAnimationId = null;

  function startVideoCall(isEmergency = false) {
    videoCallModal.classList.add('active');
    vcConnectingScreen.classList.remove('hidden');
    doctorStreamWrapper.classList.add('hidden');
    dispatchMapCard.classList.add('hidden');

    if (isEmergency) {
      vcStatusLabel.textContent = "Connecting with Doctor (Priority)...";
      vcQueueText.textContent = "Priority Queue (SOS Active)";
      doctorAvatar.textContent = "🚨";
      dispatchMapCard.classList.remove('hidden');
      simulateAmbulanceDispatch();
    } else {
      vcStatusLabel.textContent = "Connecting with Doctor...";
      vcQueueText.textContent = "Queue Position: 3 (Est. 2 mins)";
      doctorAvatar.textContent = "🧑‍⚕️";
    }

    // Try user camera stream for PiP
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStream = stream;
        userPipVideo.srcObject = stream;
        userPipVideo.classList.remove('hidden');
        pipFallback.classList.add('hidden');
      })
      .catch(err => {
        console.warn("Camera access denied or unavailable: ", err);
        // Fallback user visualization
        userPipVideo.classList.add('hidden');
        pipFallback.classList.remove('hidden');
        pipFallback.textContent = "You";
      });

    // Simulate doctor connection delay
    const connectionDelay = isEmergency ? 3000 : 5000;
    vcTimer = setTimeout(() => {
      vcConnectingScreen.classList.add('hidden');
      doctorStreamWrapper.classList.remove('hidden');
      doctorNameLabel.textContent = isEmergency 
        ? "Dr. Sarah Jenkins (ER Cardiologist)"
        : "Dr. Alex Rivera (General Practitioner)";
      
      startDoctorCanvasStream();
    }, connectionDelay);
  }

  function simulateAmbulanceDispatch() {
    let position = 12; // Start left position in px
    mapAmbulance.style.left = `${position}px`;
    mapAmbulance.style.top = '12px';
    
    // Ambulance moves along the grid to meet the user
    let etaMinutes = 7;
    const etaText = document.getElementById('etaText');
    
    mapTimer = setInterval(() => {
      position += 8;
      if (position <= 140) {
        mapAmbulance.style.left = `${position}px`;
        mapAmbulance.style.top = `${12 + (position/4)}px`;
      }
      
      // Countdown arrival time
      if (position % 24 === 0 && etaMinutes > 1) {
        etaMinutes--;
        etaText.textContent = `Estimated Arrival: ${etaMinutes} mins`;
      }
    }, 1000);
  }

  // Draw an interactive animated canvas for Doctor feed
  const doctorStreamCanvas = document.getElementById('doctorStreamCanvas');
  const docCtx = doctorStreamCanvas.getContext('2d');

  function startDoctorCanvasStream() {
    let frame = 0;
    
    function draw() {
      if (!doctorStreamModalActive()) return;

      const w = doctorStreamCanvas.width;
      const h = doctorStreamCanvas.height;
      
      // Background gradient
      const grad = docCtx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w);
      grad.addColorStop(0, '#1c2336');
      grad.addColorStop(1, '#0b0e14');
      docCtx.fillStyle = grad;
      docCtx.fillRect(0, 0, w, h);

      // Draw Doctor Silhouette or Medical Hologram Symbol
      docCtx.save();
      docCtx.strokeStyle = 'rgba(20, 184, 166, 0.4)';
      docCtx.lineWidth = 2;
      
      // Draw grid lines
      docCtx.beginPath();
      for (let i = 0; i < w; i += 40) {
        docCtx.moveTo(i, 0);
        docCtx.lineTo(i, h);
      }
      for (let j = 0; j < h; j += 40) {
        docCtx.moveTo(0, j);
        docCtx.lineTo(w, j);
      }
      docCtx.stroke();
      docCtx.restore();

      // Pulsing heartbeat line
      docCtx.save();
      docCtx.strokeStyle = '#ef4444';
      docCtx.lineWidth = 4;
      docCtx.shadowColor = 'rgba(239, 68, 68, 0.5)';
      docCtx.shadowBlur = 10;
      docCtx.beginPath();
      
      for (let x = 0; x < w; x++) {
        let y = h / 2;
        // Simulating ECG heartbeat spikes at intervals
        let phase = (x + frame * 4) % 300;
        if (phase > 120 && phase < 130) {
          y -= 40;
        } else if (phase >= 130 && phase < 140) {
          y += 60;
        } else if (phase >= 140 && phase < 155) {
          y -= 10;
        }
        
        if (x === 0) docCtx.moveTo(x, y);
        else docCtx.lineTo(x, y);
      }
      docCtx.stroke();
      docCtx.restore();

      // Doctor avatar graphic
      docCtx.save();
      docCtx.fillStyle = '#14b8a6';
      docCtx.beginPath();
      // Head
      docCtx.arc(w/2, h/2 - 40, 35, 0, Math.PI * 2);
      // Body shape
      docCtx.moveTo(w/2 - 70, h/2 + 90);
      docCtx.quadraticCurveTo(w/2 - 60, h/2 + 20, w/2 - 40, h/2 + 15);
      docCtx.lineTo(w/2 + 40, h/2 + 15);
      docCtx.quadraticCurveTo(w/2 + 60, h/2 + 20, w/2 + 70, h/2 + 90);
      docCtx.closePath();
      docCtx.fill();
      
      // Draw doctor details (Stethoscope shape)
      docCtx.strokeStyle = '#ffffff';
      docCtx.lineWidth = 3;
      docCtx.beginPath();
      docCtx.arc(w/2, h/2 - 40, 42, 0.2 * Math.PI, 0.8 * Math.PI);
      docCtx.stroke();
      docCtx.restore();

      // Text status overlay
      docCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      docCtx.font = '14px sans-serif';
      docCtx.textAlign = 'center';
      docCtx.fillText("STREAMING HD • LIVE FEED ACTIVE", w/2, h - 30);

      frame++;
      canvasAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
  }

  function doctorStreamModalActive() {
    return videoCallModal.classList.contains('active') && vcConnectingScreen.classList.contains('hidden');
  }

  function endVideoCall() {
    clearTimeout(vcTimer);
    clearInterval(mapTimer);
    if (canvasAnimationId) cancelAnimationFrame(canvasAnimationId);
    
    // Stop local video track
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    userPipVideo.srcObject = null;
    videoCallModal.classList.remove('active');
  }

  document.getElementById('vcEndCallBtn').addEventListener('click', endVideoCall);
  document.getElementById('vcDoctorBtn').addEventListener('click', () => startVideoCall(false));
  document.getElementById('scannerCallDocBtn').addEventListener('click', () => {
    closeScanner();
    startVideoCall(false);
  });

  // Call Mute and Video Controls Toggle
  const vcMuteBtn = document.getElementById('vcMuteBtn');
  const vcVideoToggleBtn = document.getElementById('vcVideoToggleBtn');
  
  vcMuteBtn.addEventListener('click', () => {
    const unmuted = vcMuteBtn.querySelector('.icon-unmuted');
    const muted = vcMuteBtn.querySelector('.icon-muted');
    unmuted.classList.toggle('hidden');
    muted.classList.toggle('hidden');
    
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    }
  });

  vcVideoToggleBtn.addEventListener('click', () => {
    const videoOn = vcVideoToggleBtn.querySelector('.icon-video-on');
    const videoOff = vcVideoToggleBtn.querySelector('.icon-video-off');
    videoOn.classList.toggle('hidden');
    videoOff.classList.toggle('hidden');
    
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        if (videoTrack.enabled) {
          userPipVideo.classList.remove('hidden');
          pipFallback.classList.add('hidden');
        } else {
          userPipVideo.classList.add('hidden');
          pipFallback.classList.remove('hidden');
          pipFallback.textContent = "Camera Off";
        }
      }
    }
  });


  // --- Common Emergencies Detail Drawers ---
  const firstAidData = {
    'heart-attack': {
      title: 'Heart Attack Protocol',
      icon: '🫀',
      steps: [
        'Call Emergency Services (SOS) immediately.',
        'Have the patient sit down, remain quiet, and stay calm.',
        'Loosen any tight clothing around the neck and chest.',
        'Ask if they take prescription chest pain medicine (like nitroglycerin) and assist them in taking it.',
        'Chew a full adult aspirin (325mg) or four baby aspirins slowly if they are conscious and not allergic.',
        'If they lose consciousness or stop breathing, start chest compressions (CPR) immediately at 100-120 beats per minute.'
      ]
    },
    'allergy': {
      title: 'Anaphylaxis & Allergy Protocol',
      icon: '⚠️',
      steps: [
        'Check for swelling of lips/throat, severe hives, or extreme difficulty breathing.',
        'Locate and prepare an Epinephrine Auto-Injector (EpiPen) if available.',
        'Press the EpiPen firmly against the outer thigh at a 90-degree angle. Hold for 3 seconds.',
        'Call Emergency Services immediately, even if symptoms improve after the injection.',
        'Lay the person flat on their back. Elevate feet 12 inches to prevent shock unless they are vomiting.',
        'Keep them warm and calm. Prepare to administer a second EpiPen if help does not arrive within 5-10 minutes.'
      ]
    },
    'choking': {
      title: 'Severe Choking Relief',
      icon: '🗣️',
      steps: [
        'Ask clearly: "Are you choking?" If they can speak or cough forcefully, encourage them to continue coughing.',
        'If they cannot speak, stand slightly behind the person. Perform 5 sharp blows to the back between the shoulder blades using the heel of your hand.',
        'If the blockage persists, position yourself fully behind the person. Wrap your arms around their waist.',
        'Make a fist with one hand, place it just above the navel, and grasp it with your other hand.',
        'Perform 5 rapid, upward abdominal thrusts (Heimlich Maneuver).',
        'Repeat alternating 5 back blows and 5 abdominal thrusts until the object is cleared or they become unconscious.'
      ]
    },
    'burns': {
      title: 'Thermal Burn Care',
      icon: '🔥',
      steps: [
        'Move the victim away from the heat source. Extinguish any flames on clothing.',
        'Cool the burn immediately using cool running water for 10-20 minutes. Never use ice, ice water, butter, or oil.',
        'Gently slide off tight clothing or jewelry from the burned area before swelling starts, but do not pull away fabric stuck to the wound.',
        'Cover the burn loosely with clean plastic wrap or a sterile non-stick dressing to protect from infection.',
        'Avoid popping blisters as they protect the underlying skin from pathogens.'
      ]
    },
    'stings': {
      title: 'Insect Sting Relief',
      icon: '🐝',
      steps: [
        'Scrape the sting area immediately with the edge of a credit card or flat card to remove the stinger. Do not squeeze with tweezers.',
        'Wash the area thoroughly with soap and clean water.',
        'Apply an ice pack wrapped in a cloth to the sting site for 10 minutes to reduce pain and localized swelling.',
        'Elevate the stung arm or leg if possible.',
        'Monitor the person closely for 30 minutes for symptoms of severe systemic reaction (hives, wheezing, swelling).'
      ]
    }
  };

  const firstAidDrawer = document.getElementById('firstAidDrawer');
  const firstAidBackdrop = document.getElementById('firstAidBackdrop');
  const firstAidTitle = document.getElementById('firstAidTitle');
  const firstAidIcon = document.getElementById('firstAidIcon');
  const firstAidSteps = document.getElementById('firstAidSteps');
  const playAudioGuideBtn = document.getElementById('playAudioGuideBtn');
  const audioVisualizer = document.getElementById('audioVisualizer');

  let currentUtterance = null;
  let isNarrating = false;

  // Open first-aid drawer
  document.querySelectorAll('.emergency-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-emergency');
      const data = firstAidData[type];
      if (!data) return;

      firstAidIcon.textContent = data.icon;
      firstAidTitle.textContent = data.title;
      
      // Populate step list
      firstAidSteps.innerHTML = '';
      data.steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        firstAidSteps.appendChild(li);
      });

      firstAidDrawer.classList.add('active');
    });
  });

  function closeFirstAidDrawer() {
    stopNarration();
    firstAidDrawer.classList.remove('active');
  }

  document.getElementById('closeFirstAidBtn').addEventListener('click', closeFirstAidDrawer);
  firstAidBackdrop.addEventListener('click', closeFirstAidDrawer);

  // Audio Narration Step-by-Step Speech Synthesis
  playAudioGuideBtn.addEventListener('click', () => {
    if (isNarrating) {
      stopNarration();
    } else {
      startNarration();
    }
  });

  function startNarration() {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }
    
    stopNarration(); // Reset any existing speech
    isNarrating = true;
    playAudioGuideBtn.querySelector('.audio-text').textContent = "Pause Audio Guide";
    audioVisualizer.classList.add('playing');

    // Aggregate text to read
    const stepsText = Array.from(firstAidSteps.querySelectorAll('li'))
      .map((li, idx) => `Step ${idx + 1}. ${li.textContent}`)
      .join('. ');
    
    const textToRead = `${firstAidTitle.textContent}. ${stepsText}`;

    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    currentUtterance.rate = 0.95; // Slightly slower for emergency comprehension
    
    currentUtterance.onend = () => {
      stopNarration();
    };
    
    currentUtterance.onerror = () => {
      stopNarration();
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  function stopNarration() {
    isNarrating = false;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    playAudioGuideBtn.querySelector('.audio-text').textContent = "Listen to Step-by-Step Audio";
    audioVisualizer.classList.remove('playing');
  }


  // --- AI Injury Scanner System ---
  const injuryScannerModal = document.getElementById('injuryScannerModal');
  const scannerVideo = document.getElementById('scannerVideo');
  const scannerCanvas = document.getElementById('scannerCanvas');
  const scannerFallback = document.getElementById('scannerFallback');
  const laserSweep = document.getElementById('laserSweep');
  const scannerAlertOverlay = document.getElementById('scannerAlertOverlay');
  const startCamBtn = document.getElementById('startCamBtn');
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const analyzeSampleBtn = document.getElementById('analyzeSampleBtn');
  const scannerResults = document.getElementById('scannerResults');

  let scannerStream = null;

  document.getElementById('scanInjuryBtn').addEventListener('click', () => {
    injuryScannerModal.classList.add('active');
    resetScanner();
  });

  function closeScanner() {
    stopScannerCamera();
    injuryScannerModal.classList.remove('active');
  }

  document.getElementById('closeScannerBtn').addEventListener('click', closeScanner);

  function resetScanner() {
    stopScannerCamera();
    scannerVideo.classList.add('hidden');
    scannerCanvas.classList.add('hidden');
    scannerFallback.classList.remove('hidden');
    laserSweep.classList.add('hidden');
    scannerAlertOverlay.classList.add('hidden');
    scannerResults.classList.add('hidden');
    analyzeSampleBtn.classList.add('hidden');
    startCamBtn.textContent = "📷 Start Camera";
  }

  function startScannerCamera() {
    resetScanner();
    startCamBtn.textContent = "⏳ Accessing...";
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        scannerStream = stream;
        scannerVideo.srcObject = stream;
        scannerVideo.classList.remove('hidden');
        scannerFallback.classList.add('hidden');
        analyzeSampleBtn.classList.remove('hidden');
        startCamBtn.textContent = "🛑 Stop Camera";
      })
      .catch(err => {
        console.warn("Unable to capture video: ", err);
        alert("Camera permissions denied or unavailable. You can still upload a photo to analyze.");
        resetScanner();
      });
  }

  function stopScannerCamera() {
    if (scannerStream) {
      scannerStream.getTracks().forEach(track => track.stop());
      scannerStream = null;
    }
    scannerVideo.srcObject = null;
  }

  startCamBtn.addEventListener('click', () => {
    if (scannerStream) {
      resetScanner();
    } else {
      startScannerCamera();
    }
  });

  // Handle Photo Upload
  uploadImageBtn.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    stopScannerCamera();
    startCamBtn.textContent = "📷 Start Camera";

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        scannerCanvas.width = scannerCanvas.clientWidth || 320;
        scannerCanvas.height = scannerCanvas.clientHeight || 240;
        const ctx = scannerCanvas.getContext('2d');
        
        // Draw image keeping ratio
        const scale = Math.min(scannerCanvas.width / img.width, scannerCanvas.height / img.height);
        const x = (scannerCanvas.width / 2) - (img.width / 2) * scale;
        const y = (scannerCanvas.height / 2) - (img.height / 2) * scale;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, scannerCanvas.width, scannerCanvas.height);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        scannerCanvas.classList.remove('hidden');
        scannerVideo.classList.add('hidden');
        scannerFallback.classList.add('hidden');
        
        // Trigger scanning effect directly after upload
        triggerScanAnalysis("wound");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  analyzeSampleBtn.addEventListener('click', () => {
    if (!scannerStream) return;
    
    // Draw current frame of camera feed onto canvas to lock it
    scannerCanvas.width = scannerVideo.videoWidth;
    scannerCanvas.height = scannerVideo.videoHeight;
    const ctx = scannerCanvas.getContext('2d');
    ctx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
    
    scannerCanvas.classList.remove('hidden');
    scannerVideo.classList.add('hidden');
    stopScannerCamera();
    startCamBtn.textContent = "📷 Start Camera";
    analyzeSampleBtn.classList.add('hidden');
    
    triggerScanAnalysis("camera");
  });

  function triggerScanAnalysis(source) {
    laserSweep.classList.remove('hidden');
    scannerAlertOverlay.classList.remove('hidden');
    scannerResults.classList.add('hidden');

    // Simple beep sound for scan start
    playSound('tick');
    setTimeout(() => playSound('tick'), 300);
    setTimeout(() => playSound('tick'), 600);

    // Mock Diagnosis processing wait time
    setTimeout(() => {
      laserSweep.classList.add('hidden');
      scannerAlertOverlay.classList.add('hidden');
      playSound('success');

      // Populate results
      const severityEl = document.getElementById('resultSeverity');
      const titleEl = document.getElementById('resultTitle');
      const summaryEl = document.getElementById('resultSummary');
      const stepsEl = document.getElementById('resultSteps');

      if (source === "wound") {
        severityEl.className = "severity-badge medium";
        severityEl.textContent = "MEDIUM";
        titleEl.textContent = "Contact Dermatitis / Bite";
        summaryEl.textContent = "AI Vision indicates localized redness with standard insect sting patterns. Non-life threatening, but requires minor antihistamine protocol.";
        stepsEl.innerHTML = `
          <li>Wash sting area with water.</li>
          <li>Apply hydrocortisone cream or cold pack.</li>
          <li>Do not scratch area. Monitor for breathing difficulty.</li>
        `;
      } else {
        severityEl.className = "severity-badge low";
        severityEl.textContent = "LOW";
        titleEl.textContent = "Minor Scrape (Abrasion)";
        summaryEl.textContent = "Superficial skin loss without deep tissue laceration. Negligible blood flow detected. Low risk index.";
        stepsEl.innerHTML = `
          <li>Rinse wound with clean running water to wash away dirt.</li>
          <li>Apply a thin layer of petroleum jelly or antibiotic ointment.</li>
          <li>Cover loosely with a clean adhesive bandage.</li>
        `;
      }

      scannerResults.classList.remove('hidden');
    }, 2500);
  }


  // --- AI Chatbot Assistant ---
  const aiInputBar = document.getElementById('aiInputBar');
  const aiChatDrawer = document.getElementById('aiChatDrawer');
  const aiChatBackdrop = document.getElementById('aiChatBackdrop');
  const chatMessages = document.getElementById('chatMessages');
  const chatInputForm = document.getElementById('chatInputForm');
  const chatInputField = document.getElementById('chatInputField');
  const aiMicBtn = document.getElementById('aiMicBtn');

  aiInputBar.addEventListener('click', (e) => {
    // Avoid triggering if mic button clicked specifically
    if (e.target.closest('#aiMicBtn')) return;
    
    aiChatDrawer.classList.add('active');
    setTimeout(() => chatInputField.focus(), 150);
  });

  function closeChatDrawer() {
    aiChatDrawer.classList.remove('active');
  }

  document.getElementById('closeChatBtn').addEventListener('click', closeChatDrawer);
  aiChatBackdrop.addEventListener('click', closeChatDrawer);

  // Send Message
  chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = chatInputField.value.trim();
    if (!query) return;

    // Append User message
    appendChatMessage(query, 'user');
    chatInputField.value = '';

    // Simulate AI response
    showTypingIndicator();
    
    setTimeout(() => {
      removeTypingIndicator();
      const responseText = getAIResponse(query);
      appendChatMessage(responseText, 'ai');
    }, 1200);
  });

  function appendChatMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = text; // allow HTML tags for shortcut buttons

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = 'Just now';

    msg.appendChild(bubble);
    msg.appendChild(time);
    chatMessages.appendChild(msg);
    
    // Auto scroll bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message ai-message typing-indicator-msg';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
      <div class="message-bubble" style="padding: 10px 16px;">
        <span class="connecting-dots" style="display:inline-flex; gap:3px;">
          <span style="width:6px; height:6px; background-color:#aaa;"></span>
          <span style="width:6px; height:6px; background-color:#aaa; animation-delay: 0.2s;"></span>
          <span style="width:6px; height:6px; background-color:#aaa; animation-delay: 0.4s;"></span>
        </span>
      </div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
  }

  // Basic Triage Keyword Matcher
  function getAIResponse(query) {
    const q = query.toLowerCase();
    
    if (q.includes('heart') || q.includes('chest') || q.includes('cardiac') || q.includes('heart attack')) {
      return `⚠️ <strong>CRITICAL ALERT: Chest pain detected!</strong> This can be a sign of a heart attack.<br><br>
              1. <strong>Hold the red SOS button</strong> for 5 seconds immediately to dispatch an ambulance.<br>
              2. Chew 1 adult aspirin if conscious.<br>
              3. Sit upright and avoid physical exertion.`;
    }
    
    if (q.includes('chok') || q.includes('throat') || q.includes('suffocat')) {
      return `🗣️ <strong>Severe Choking Triage:</strong> If the patient is conscious but unable to breathe or speak:<br><br>
              - Give 5 sharp blows to the back between shoulder blades.<br>
              - Perform 5 abdominal thrusts (Heimlich Maneuver).<br>
              - Click below to open step-by-step illustrations:<br>
              <button class="btn-primary" onclick="triggerFirstAid('choking')" style="margin-top: 10px; font-size:12px; padding: 8px;">Show Choking Guide</button>`;
    }

    if (q.includes('burn') || q.includes('scal')) {
      return `🔥 <strong>Burn Protocol:</strong> Cooling takes absolute priority.<br><br>
              - Run cool tap water over the injury for 10-20 minutes. Do not use ice.<br>
              - Cover loosely with wrap or sterile dressing.<br>
              <button class="btn-primary" onclick="triggerFirstAid('burns')" style="margin-top: 10px; font-size:12px; padding: 8px;">Open Burn Guide</button>`;
    }

    if (q.includes('sting') || q.includes('bee') || q.includes('bite') || q.includes('bug')) {
      return `🐝 <strong>Stings & Bites Protocol:</strong><br><br>
              - Remove stinger by scraping with a card. Do not squeeze.<br>
              - Wash area with soap & water, apply cold pack.<br>
              <button class="btn-primary" onclick="triggerFirstAid('stings')" style="margin-top: 10px; font-size:12px; padding: 8px;">Open Sting Guide</button>`;
    }

    if (q.includes('breath') || q.includes('asthma') || q.includes('allergy') || q.includes('allergic')) {
      return `⚠️ <strong>Severe Allergy / Breathing Difficulty:</strong><br><br>
              - Administer EpiPen if anaphylaxis symptoms occur.<br>
              - Elevate legs, keep patient warm.<br>
              <button class="btn-primary" onclick="triggerFirstAid('allergy')" style="margin-top: 10px; font-size:12px; padding: 8px;">Open Allergy Guide</button>`;
    }

    return `🩹 I've recorded your question: <em>"${query}"</em>. For minor concerns:<br><br>
            - Clean and dry the wound area.<br>
            - Apply compression to minor bleeding.<br>
            - If pain or swelling persists, use the <strong>Scan an Injury</strong> tool or consult a <strong>V.C Doctor</strong>.`;
  }

  // Voice Speech Recognition mock/real helper
  aiMicBtn.addEventListener('click', () => {
    initAudio();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      aiMicBtn.style.backgroundColor = 'var(--color-sos)';
      aiMicBtn.style.color = '#fff';
      
      recognition.start();

      recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        aiChatDrawer.classList.add('active');
        chatInputField.value = speechResult;
        // submit form trigger
        chatInputForm.dispatchEvent(new Event('submit'));
      };

      recognition.onspeechend = () => {
        recognition.stop();
        aiMicBtn.style.backgroundColor = '';
        aiMicBtn.style.color = '';
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error: ", event.error);
        aiMicBtn.style.backgroundColor = '';
        aiMicBtn.style.color = '';
      };

    } else {
      // Fallback Demo: Automatically types query to demonstrate voice input style
      aiChatDrawer.classList.add('active');
      chatInputField.value = '';
      
      const demoText = "Heart attack symptoms";
      let charIdx = 0;
      
      const typeInterval = setInterval(() => {
        chatInputField.value += demoText[charIdx];
        charIdx++;
        if (charIdx >= demoText.length) {
          clearInterval(typeInterval);
          setTimeout(() => {
            chatInputForm.dispatchEvent(new Event('submit'));
          }, 400);
        }
      }, 80);
    }
  });

});

// Global accessibility helper to trigger drawers from chat buttons
function triggerFirstAid(type) {
  document.getElementById('closeChatBtn').click();
  const card = document.querySelector(`.emergency-card[data-emergency="${type}"]`);
  if (card) card.click();
}
