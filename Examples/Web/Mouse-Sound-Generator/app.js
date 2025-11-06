document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const serverUrlInput = document.getElementById('server-url');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const messageLog = document.getElementById('message-log');
  const clearLogButton = document.getElementById('clear-log');
  const toggleSoundButton = document.getElementById('toggle-sound');
  const soundStatusText = document.getElementById('sound-status');
  
  // Control elements
  const baseFrequencySlider = document.getElementById('base-frequency');
  const baseFrequencyValue = document.getElementById('base-frequency-value');
  const speedSensitivitySlider = document.getElementById('speed-sensitivity');
  const speedSensitivityValue = document.getElementById('speed-sensitivity-value');
  const clickVolumeSlider = document.getElementById('click-volume');
  const clickVolumeValue = document.getElementById('click-volume-value');
  const clickPitchSlider = document.getElementById('click-pitch');
  const clickPitchValue = document.getElementById('click-pitch-value');
  const musicalScaleSelect = document.getElementById('musical-scale');
  const noteLengthSlider = document.getElementById('note-length');
  const noteLengthValue = document.getElementById('note-length-value');
  
  // Canvas for visualization
  const waveformCanvas = document.getElementById('waveform');
  const waveformCtx = waveformCanvas.getContext('2d');

  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

  // Sound state
  let isSoundEnabled = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastMoveTime = 0;
  let mouseSpeed = 0;
  
  // Audio context and synths
  let audioContext;
  let movementSynth;
  let clickSynth;
  let wheelSynth;
  let reverb; // Reverb effect for ambient sound
  let analyser;
  let dataArray;
  let bufferLength;
  let isAudioInitialized = false;
  
  // Musical scales for wheel scrolling
  const musicalScales = {
    majorScale: [0, 2, 4, 5, 7, 9, 11, 12], // C major: C, D, E, F, G, A, B, C
    minorScale: [0, 2, 3, 5, 7, 8, 10, 12], // C minor: C, D, Eb, F, G, Ab, Bb, C
    pentatonicScale: [0, 2, 4, 7, 9, 12, 14, 16] // C pentatonic: C, D, E, G, A, C, D, E
  };
  
  // Current scale to use
  let currentScale = musicalScales.pentatonicScale;
  
  // Track wheel scroll position in the scale
  let scalePosition = 0;
  let lastWheelEventTime = 0;
  let wheelNoteActive = false;
  
  // Initialize audio (must be triggered by user interaction)
  async function initAudio() {
    if (isAudioInitialized) return;
    
    try {
      // Start audio context - this is critical for audio to work
      await Tone.start();
      console.log('Audio context started successfully');
      
      // Create synths
      movementSynth = new Tone.FMSynth({
        harmonicity: 1.5,
        modulationIndex: 1.2,
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.5,  // Slower attack for smoother onset
          decay: 0.5,
          sustain: 0.8, // Higher sustain for more continuous sound
          release: 1.5   // Longer release for smoother transitions
        },
        modulation: {
          type: 'triangle' // Softer modulation waveform
        },
        modulationEnvelope: {
          attack: 0.8,
          decay: 1.2,
          sustain: 0.6,
          release: 1.5
        },
        volume: -15 // Lower volume for calmer presence
      }).toDestination();
      
      clickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0.01,
          release: 0.2,
          attackCurve: 'exponential'
        },
        volume: -5 // Start at a reasonable volume
      }).toDestination();
      
      // Create wheel synth with a more pleasant sound for musical notes
      wheelSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'triangle'
        },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.8
        },
        volume: -8
      }).toDestination();
      
      // Create reverb effect for ambient sound
      reverb = new Tone.Reverb({
        decay: 5.0,     // Long decay for ambient wash
        preDelay: 0.1, // Slight pre-delay
        wet: 0.4       // 40% wet signal (blend with dry)
      }).toDestination();
      
      // Wait for reverb to initialize
      await reverb.generate();
      
      // Connect synths to reverb
      movementSynth.connect(reverb);
      wheelSynth.connect(reverb);
      // Don't add reverb to click synth to keep it percussive
      
      // Set up analyser for visualization
      analyser = new Tone.Analyser('waveform', 1024);
      movementSynth.connect(analyser);
      clickSynth.connect(analyser);
      wheelSynth.connect(analyser);
      reverb.connect(analyser);
      bufferLength = analyser.size;
      dataArray = new Uint8Array(bufferLength);
      
      // Play a test sound to verify audio is working
      clickSynth.triggerAttackRelease(440, '0.1s');
      
      isAudioInitialized = true;
      addSystemMessage('Audio system initialized - you should hear a test sound');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      addSystemMessage(`Audio initialization failed: ${error.message}. Try clicking the sound button again.`);
    }
  }
  
  // Toggle sound on/off
  async function toggleSound() {
    try {
      // If audio is not initialized, initialize it first
      if (!isAudioInitialized) {
        await initAudio();
        // If initialization failed, don't proceed
        if (!isAudioInitialized) {
          return;
        }
      }
      
      // Toggle sound state
      isSoundEnabled = !isSoundEnabled;
      soundStatusText.textContent = isSoundEnabled ? 'Sound On' : 'Sound Off';
      
      if (isSoundEnabled) {
        // Make sure audio context is running
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }
        
        // Play a test tone to confirm audio is working
        clickSynth.triggerAttackRelease(660, '0.1s');
        
        addSystemMessage('Sound enabled - you should hear a test sound');
        console.log('Sound enabled, audio context state:', Tone.context.state);
        
        // Start visualization loop
        requestAnimationFrame(drawWaveform);
      } else {
        // Stop any ongoing sounds
        if (movementSynth) {
          movementSynth.triggerRelease();
        }
        addSystemMessage('Sound disabled');
      }
    } catch (error) {
      console.error('Error toggling sound:', error);
      addSystemMessage(`Sound toggle error: ${error.message}. Try again or reload the page.`);
    }
  }
  
  // Draw waveform visualization
  function drawWaveform() {
    if (!isAudioInitialized || !isSoundEnabled) return;
    
    // Get canvas dimensions
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    // Clear canvas
    waveformCtx.fillStyle = '#0f172a';
    waveformCtx.fillRect(0, 0, width, height);
    
    // Get waveform data
    analyser.getValue();
    const data = analyser.getValue();
    
    // Draw waveform
    waveformCtx.lineWidth = 2;
    waveformCtx.strokeStyle = '#3b82f6'; // Movement color
    waveformCtx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = v * height / 2;
      
      if (i === 0) {
        waveformCtx.moveTo(x, y);
      } else {
        waveformCtx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    waveformCtx.lineTo(width, height / 2);
    waveformCtx.stroke();
    
    // Continue animation loop
    requestAnimationFrame(drawWaveform);
  }
  
  // Update slider value displays
  function updateSliderValues() {
    baseFrequencyValue.textContent = `${baseFrequencySlider.value} Hz`;
    speedSensitivityValue.textContent = `${speedSensitivitySlider.value}%`;
    clickVolumeValue.textContent = `${clickVolumeSlider.value}%`;
    clickPitchValue.textContent = `${clickPitchSlider.value} Hz`;
    noteLengthValue.textContent = `${noteLengthSlider.value}%`;
  }
  
  // Update the current musical scale
  function updateMusicalScale() {
    const selectedScale = musicalScaleSelect.value;
    currentScale = musicalScales[selectedScale];
    scalePosition = 0; // Reset scale position
    
    addSystemMessage(`Musical scale changed to ${selectedScale}`);
    console.log('Musical scale changed to:', selectedScale, currentScale);
  }
  
  // Connect to WebSocket server
  function connectToServer() {
    const url = serverUrlInput.value.trim();

    if (!url) {
      alert('Please enter a valid WebSocket server URL');
      return;
    }

    // Close existing connection if any
    if (ws) {
      ws.close();
    }

    try {
      // Create new WebSocket connection
      ws = new WebSocket(url);

      // Connection opened
      ws.addEventListener('open', (event) => {
        updateConnectionStatus(true);
        addSystemMessage('Connected to server');
      });

      // Connection closed
      ws.addEventListener('close', (event) => {
        updateConnectionStatus(false);
        addSystemMessage(
          `Disconnected from server: ${event.reason || 'Connection closed'}`
        );
      });

      // Connection error
      ws.addEventListener('error', (event) => {
        updateConnectionStatus(false);
        addSystemMessage('Connection error');
        console.error('WebSocket error:', event);
      });

      // Listen for messages
      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          processMessage(message);
        } catch (err) {
          console.error('Error processing message:', err);
          addSystemMessage(`Error processing message: ${err.message}`);
        }
      });
    } catch (err) {
      console.error('Error connecting to server:', err);
      addSystemMessage(`Error connecting to server: ${err.message}`);
    }
  }

  // Disconnect from WebSocket server
  function disconnectFromServer() {
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  // Update connection status UI
  function updateConnectionStatus(connected) {
    if (connected) {
      statusText.textContent = 'Connected';
      statusDot.classList.add('connected');
      connectButton.disabled = true;
      disconnectButton.disabled = false;
      serverUrlInput.disabled = true;
    } else {
      statusText.textContent = 'Disconnected';
      statusDot.classList.remove('connected');
      connectButton.disabled = false;
      disconnectButton.disabled = true;
      serverUrlInput.disabled = false;
    }
  }

  // Process incoming message
  function processMessage(message) {
    const address = message.address || '';
    const args = message.args || [];

    // Add message to log
    addMessageToLog(message);
    
    // Only log occasionally to avoid console spam
    if (Math.random() < 0.05) {
      console.log(`Received OSC message: ${address}`, args);
    }

    // Handle mouse events for sound generation
    if (isSoundEnabled) {
      if (address === '/hid/move') {
        handleMouseMove(args);
      } else if (address === '/hid/left_down' || address === '/hid/right_down' || address === '/hid/middle_down') {
        handleMouseClick(args, address);
      } else if (address === '/hid/scroll') {
        handleMouseWheel(args);
      }
    }
  }

  // Handle mouse movement for sound
  function handleMouseMove(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;
    
    // Extract coordinates and delta values
    const x = args[1] || 0;
    const y = args[2] || 0;
    const dx = args[3] || 0;
    const dy = args[4] || 0;
    
    // Calculate speed
    const now = Date.now();
    const timeDelta = now - lastMoveTime;
    if (timeDelta > 0) {
      // Calculate Euclidean distance
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Speed in pixels per millisecond with smoothing
      // Apply smoothing to make speed changes more gradual
      const newSpeed = distance / timeDelta;
      mouseSpeed = mouseSpeed * 0.85 + newSpeed * 0.15; // Smooth transition
    }
    
    // Update last values
    lastMouseX = x;
    lastMouseY = y;
    lastMoveTime = now;
    
    // Generate sound based on movement
    const baseFreq = parseInt(baseFrequencySlider.value);
    const sensitivity = parseInt(speedSensitivitySlider.value) / 50; // Convert to 0-2 range
    
    // Map speed to frequency - use a gentler curve for calmer sound
    // Use logarithmic mapping for more natural frequency changes
    const speedFactor = Math.min(Math.log(1 + mouseSpeed * 500 * sensitivity) / Math.log(10), 1.5); // Cap at 1.5x
    const frequency = baseFreq * (1 + speedFactor * 0.5); // Reduce the range of frequency change
    
    // Map speed to volume with a gentler curve (0.05 to 0.4)
    const volume = Math.min(0.05 + mouseSpeed * 10, 0.4); // Lower max volume for calmer sound
    
    // Update synth
    movementSynth.volume.value = Tone.gainToDb(volume);
    
    // Debug log occasionally
    if (Math.random() < 0.01) {
      console.log(`Mouse speed: ${mouseSpeed.toFixed(4)}, Frequency: ${frequency.toFixed(1)} Hz, Volume: ${volume.toFixed(2)}`);
    }
    
    // Trigger note if not already playing or update frequency
    if (mouseSpeed > 0.005) { // Lower threshold to keep sound more continuous
      if (movementSynth.state !== 'started') {
        console.log('Starting synth with frequency:', frequency);
        // Use triggerAttack with a gentler onset
        movementSynth.triggerAttack(frequency);
      } else {
        // Use rampTo for smoother frequency transitions
        movementSynth.frequency.rampTo(frequency, 0.2); // 200ms ramp time for smooth transitions
      }
    } else if (mouseSpeed <= 0.005 && movementSynth.state === 'started') {
      // Use a longer release time for gentle fade out
      movementSynth.triggerRelease();
    }
  }
  
  // Handle mouse clicks for sound
  function handleMouseClick(args, address) {
    if (!isSoundEnabled || !isAudioInitialized) return;
    
    // Extract button type from address
    const buttonType = address.split('/').pop().replace('_down', '');
    
    // Get click settings
    const clickPitch = parseInt(clickPitchSlider.value);
    const clickVolume = parseInt(clickVolumeSlider.value) / 100;
    
    // Adjust pitch based on button type
    let pitchMultiplier = 1;
    if (buttonType === 'right') {
      pitchMultiplier = 0.8;
    } else if (buttonType === 'middle') {
      pitchMultiplier = 1.2;
    }
    
    // Play click sound
    clickSynth.volume.value = Tone.gainToDb(clickVolume);
    clickSynth.triggerAttackRelease(clickPitch * pitchMultiplier, '0.1s');
    
    addSystemMessage(`${buttonType} click sound played at ${Math.round(clickPitch * pitchMultiplier)} Hz`);
  }
  
  // Handle mouse wheel events and play note series
  function handleMouseWheel(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;
    
    // Extract scroll delta values
    // In OSC format from HIDEventDispatcherApp, args[3] is deltaX, args[4] is deltaY, args[5] is deltaZ
    const deltaX = args[3] || 0;
    const deltaY = args[4] || 0;
    const deltaZ = args[5] || 0;
    
    // We'll primarily use deltaY for vertical scrolling
    const scrollAmount = deltaY;
    
    // Ignore very small scroll amounts
    if (Math.abs(scrollAmount) < 0.1) return;
    
    // Calculate time since last wheel event
    const now = Date.now();
    const timeDelta = now - lastWheelEventTime;
    lastWheelEventTime = now;
    
    // Determine direction (positive = scroll down, negative = scroll up)
    const direction = scrollAmount > 0 ? 1 : -1;
    
    // Update scale position based on scroll direction
    scalePosition = (scalePosition + direction) % currentScale.length;
    if (scalePosition < 0) scalePosition = currentScale.length - 1;
    
    // Get base frequency from slider
    const baseFrequency = parseInt(baseFrequencySlider.value);
    
    // Calculate note frequency based on scale position
    // Using equal temperament: f = baseFreq * 2^(n/12) where n is semitones from base
    const semitones = currentScale[scalePosition];
    const noteFrequency = baseFrequency * Math.pow(2, semitones / 12);
    
    // Calculate note duration based on scroll speed and note length setting
    // Faster scrolls = shorter notes
    const scrollSpeed = Math.abs(scrollAmount / Math.max(1, timeDelta));
    const noteLengthFactor = parseInt(noteLengthSlider.value) / 50; // Convert to 0.02-2 range
    const noteDuration = Math.max(0.05, Math.min(1.0, noteLengthFactor * 0.3 / (scrollSpeed + 0.1)));
    
    // Play the note
    wheelSynth.triggerAttackRelease(noteFrequency, noteDuration);
    
    // Debug log
    if (Math.random() < 0.2) {
      console.log(`Wheel scroll: ${scrollAmount.toFixed(2)}, Note: ${semitones} semitones, Frequency: ${noteFrequency.toFixed(1)} Hz, Duration: ${noteDuration.toFixed(2)}s`);
      addSystemMessage(`Played note at position ${scalePosition} of scale (${noteFrequency.toFixed(1)} Hz)`);
    }
  }

  // Add message to log
  function addMessageToLog(message) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const address = message.address || '';
    const args = JSON.stringify(message.args || []);
    const source = message.source || 'unknown';

    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';

    messageItem.innerHTML = `
      <span class="message-timestamp">[${timestamp}]</span>
      <span class="message-address">${address}</span>
      <span class="message-args">${args}</span>
      <span class="message-source">from ${source}</span>
    `;

    messageLog.appendChild(messageItem);

    // Limit the number of messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }

    // Auto-scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // Add system message to log
  function addSystemMessage(text) {
    const timestamp = new Date().toLocaleTimeString();

    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';

    messageItem.innerHTML = `
      <span class="message-timestamp">[${timestamp}]</span>
      <span class="message-address">SYSTEM:</span>
      <span class="message-args">${text}</span>
    `;

    messageLog.appendChild(messageItem);

    // Limit the number of messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }

    // Auto-scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // Event listeners
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
    addSystemMessage('System log cleared');
  });
  toggleSoundButton.addEventListener('click', toggleSound);
  
  // Slider event listeners
  baseFrequencySlider.addEventListener('input', updateSliderValues);
  speedSensitivitySlider.addEventListener('input', updateSliderValues);
  clickVolumeSlider.addEventListener('input', updateSliderValues);
  clickPitchSlider.addEventListener('input', updateSliderValues);
  noteLengthSlider.addEventListener('input', updateSliderValues);
  
  // Musical scale selection
  musicalScaleSelect.addEventListener('change', updateMusicalScale);

  // Allow pressing Enter in the server URL input to connect
  serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectButton.click();
    }
  });

  // Initialize
  updateConnectionStatus(false);
  updateSliderValues();
  updateMusicalScale();
  
  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }
  
  // Add welcome message
  addSystemMessage('Mouse Sound Generator initialized');
  addSystemMessage('Connect to the WebSocket server and enable sound to start');
  addSystemMessage('Use mouse wheel to play musical notes in the selected scale');
});
