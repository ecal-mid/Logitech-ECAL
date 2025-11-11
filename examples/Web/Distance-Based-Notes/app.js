// Distance-Based Notes - A musical sequence creator based on movement distances
// This application creates musical sequences based on the distance traveled by the mouse
// rather than screen coordinates. Notes are manually dropped with left-click and saved
// with their corresponding distance from the start. The sequence can be played back by
// moving the mouse through similar distances.

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
  const clearSequenceButton = document.getElementById('clear-sequence');
  const sequenceStatusText = document.getElementById('sequence-status');
  const notesCountText = document.getElementById('notes-count');

  // Control elements
  const noteVolumeSlider = document.getElementById('note-volume');
  const noteVolumeValue = document.getElementById('note-volume-value');
  const distanceThresholdSlider = document.getElementById('distance-threshold');
  const distanceThresholdValue = document.getElementById(
    'distance-threshold-value'
  );
  const replayToleranceSlider = document.getElementById('replay-tolerance');
  const replayToleranceValue = document.getElementById(
    'replay-tolerance-value'
  );
  const musicalScaleSelect = document.getElementById('musical-scale');
  const baseFrequencySlider = document.getElementById('base-frequency');
  const baseFrequencyValue = document.getElementById('base-frequency-value');
  const frequencyFactorSlider = document.getElementById('frequency-factor');
  const frequencyFactorValue = document.getElementById(
    'frequency-factor-value'
  );

  // UI elements
  const notesList = document.getElementById('notes-list');
  const currentDistanceDisplay = document.getElementById('current-distance');
  const totalDistanceDisplay = document.getElementById('total-distance');

  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

  // Sound state
  let isSoundEnabled = false;
  let isAudioInitialized = false;

  // Sequence state
  let isSequenceStarted = false;
  let isPlaybackMode = false;
  let notes = []; // Array to store dropped notes
  let lastX = 0;
  let lastY = 0;
  let currentDistance = 0;
  let totalDistance = 0;

  // Right drag detection
  let isRightDragging = false;
  let rightDragStartX = 0;
  let rightDragStartY = 0;
  let rightDragDistance = 0;
  const RIGHT_DRAG_THRESHOLD = 50; // Distance needed to trigger restart

  // Long press detection
  let isLeftPressed = false;
  let leftPressStartTime = 0;
  const LONG_PRESS_THRESHOLD = 800; // milliseconds for long press

  // Conversion factor for millimeters (same as Mouse-Distance-Tracker)
  const PIXELS_TO_MM = 297 / 7751;

  // Update the notes list display
  function updateNotesList() {
    // Clear the list
    notesList.innerHTML = '';

    // If no notes, show empty state
    if (notes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent =
        'No notes yet. Right-click to start a sequence and move to drop notes.';
      notesList.appendChild(emptyState);
      return;
    }

    // Add each note to the list
    notes.forEach((note, index) => {
      const noteItem = document.createElement('div');
      noteItem.className = note.isPlaying ? 'note-item playing' : 'note-item';

      // Note ID
      const noteId = document.createElement('div');
      noteId.className = 'note-id';
      noteId.textContent = `#${index + 1}`;

      // Note distance
      const noteDistance = document.createElement('div');
      noteDistance.className = 'note-distance';

      // Get current replay tolerance
      const replayTolerance = parseInt(replayToleranceSlider.value);

      // Convert to millimeters
      const distanceInMm = convertToMillimeters(note.distance);
      const toleranceInMm = convertToMillimeters(replayTolerance);

      // Add distance with tolerance indicator
      noteDistance.innerHTML = `
        <span>${note.distance.toFixed(2)} units (${distanceInMm} mm)</span>
        <span class="tolerance-indicator" title="Replay tolerance: ±${replayTolerance} units (±${toleranceInMm} mm)">±${replayTolerance}</span>
      `;

      // Note frequency
      const noteFrequency = document.createElement('div');
      noteFrequency.className = 'note-frequency';
      noteFrequency.textContent = `${Math.round(note.frequency)} Hz`;

      // Add base frequency as a tooltip
      if (note.baseFrequency) {
        noteFrequency.title = `Base: ${Math.round(note.baseFrequency)} Hz`;
      }

      // Note status
      const noteStatus = document.createElement('div');
      noteStatus.className = 'note-status';

      const statusIndicator = document.createElement('span');
      statusIndicator.className = note.isPlaying
        ? 'note-status-indicator playing'
        : 'note-status-indicator';

      const statusText = document.createTextNode(
        note.isPlaying ? ' Playing' : ' Idle'
      );

      noteStatus.appendChild(statusIndicator);
      noteStatus.appendChild(statusText);

      // Add all elements to the note item
      noteItem.appendChild(noteId);
      noteItem.appendChild(noteDistance);
      noteItem.appendChild(noteFrequency);
      noteItem.appendChild(noteStatus);

      // Add the note item to the list
      notesList.appendChild(noteItem);
    });
  }

  // Convert distance units to millimeters
  function convertToMillimeters(distance) {
    return (distance * PIXELS_TO_MM).toFixed(2);
  }

  // Update the distance displays
  function updateDistanceDisplays() {
    const currentMm = convertToMillimeters(currentDistance);
    const totalMm = convertToMillimeters(totalDistance);

    currentDistanceDisplay.textContent = `${currentDistance.toFixed(
      2
    )} units (${currentMm} mm)`;
    totalDistanceDisplay.textContent = `${totalDistance.toFixed(
      2
    )} units (${totalMm} mm)`;

    if (isSequenceStarted) {
      currentDistanceDisplay.style.color = 'var(--note-color)';
      totalDistanceDisplay.style.color = 'var(--note-color)';
    } else {
      currentDistanceDisplay.style.color = 'var(--secondary-color)';
      totalDistanceDisplay.style.color = 'var(--secondary-color)';
    }
  }

  // Audio context and synths
  let noteSynth;
  let replaySynth;

  // Note settings
  const NOTE_DURATION = 0.3; // Duration for original notes
  const REPLAY_DURATION = 0.3; // Duration for replayed notes (now same as original)

  // Frequency settings - now controlled by slider
  let frequencyDistanceFactor = 0.002; // Default value, will be updated by slider
  // Musical scales
  const musicalScales = {
    majorScale: [0, 2, 4, 5, 7, 9, 11, 12], // C major: C, D, E, F, G, A, B, C
    minorScale: [0, 2, 3, 5, 7, 8, 10, 12], // C minor: C, D, Eb, F, G, Ab, Bb, C
    pentatonicScale: [0, 2, 4, 7, 9, 12, 14, 16], // C pentatonic: C, D, E, G, A, C, D, E
  };

  // Current musical scale
  let currentScale = musicalScales.pentatonicScale;

  // Initialize audio
  function initializeAudio() {
    return new Promise(async (resolve, reject) => {
      try {
        // Start audio context
        await Tone.start();

        // Create synths
        noteSynth = new Tone.PolySynth(Tone.Synth).toDestination();
        noteSynth.set({
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1,
          },
        });

        // Use the same synth settings for replay to ensure consistent sound
        replaySynth = new Tone.PolySynth(Tone.Synth).toDestination();
        replaySynth.set({
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1,
          },
        });

        // Add reverb
        const reverb = new Tone.Reverb({
          decay: 2,
          wet: 0.3,
        }).toDestination();

        noteSynth.connect(reverb);
        replaySynth.connect(reverb);

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Update connection status
  function updateConnectionStatus(connected) {
    if (connected) {
      statusText.textContent = 'Connected';
      statusDot.classList.add('connected');
      connectButton.disabled = true;
      disconnectButton.disabled = false;
    } else {
      statusText.textContent = 'Disconnected';
      statusDot.classList.remove('connected');
      connectButton.disabled = false;
      disconnectButton.disabled = true;

      // Also disable sound if disconnected
      if (isSoundEnabled) {
        toggleSound();
      }
    }
  }

  // Add message to log
  function addMessage(message, type = 'system') {
    const messageElement = document.createElement('p');
    messageElement.className = type;
    messageElement.textContent = message;

    messageLog.appendChild(messageElement);

    // Limit number of messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }

    // Scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // Add system message
  function addSystemMessage(message) {
    addMessage(message, 'system');
  }

  // Add error message
  function addErrorMessage(message) {
    addMessage(message, 'error');
  }

  // Add OSC message
  function addOSCMessage(message) {
    addMessage(message, 'osc');
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
        addSystemMessage(`Connected to ${url}`);
      });

      // Connection closed
      ws.addEventListener('close', (event) => {
        updateConnectionStatus(false);
        addSystemMessage('Disconnected from server');
      });

      // Connection error
      ws.addEventListener('error', (event) => {
        updateConnectionStatus(false);
        addErrorMessage('WebSocket connection error');
      });

      // Listen for messages
      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);

          // Process OSC message
          if (message.address && message.args) {
            processOSCMessage(message.address, message.args);
          }
        } catch (error) {
          addErrorMessage(`Failed to parse message: ${error.message}`);
        }
      });
    } catch (error) {
      addErrorMessage(`Connection error: ${error.message}`);
    }
  }

  // Disconnect from server
  function disconnectFromServer() {
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  // Process OSC message
  function processOSCMessage(address, args) {
    // Log OSC message occasionally to avoid flooding
    if (Math.random() < 0.05) {
      addOSCMessage(`${address} ${JSON.stringify(args)}`);
    }

    // Handle mouse events for sound generation
    if (isSoundEnabled) {
      if (address === '/hid/move') {
        handleMouseMove(args);
      } else if (address === '/hid/right_down') {
        handleRightDown(args);
      } else if (address === '/hid/right_up') {
        handleRightUp(args);
      } else if (address === '/hid/right_drag') {
        handleRightDrag(args);
      } else if (address === '/hid/left_down') {
        handleLeftDown(args);
      } else if (address === '/hid/left_up') {
        handleLeftUp(args);
      }
    }
  }

  // Calculate distance between two points
  function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  // Handle mouse movement
  function handleMouseMove(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;

    // Extract coordinates and delta values
    const x = args[1] || 0;
    const y = args[2] || 0;
    const dx = args[3] || 0;
    const dy = args[4] || 0;

    // If sequence started, calculate distance using delta values
    if (isSequenceStarted) {
      // Calculate distance moved using delta values directly
      const movementDistance = Math.sqrt(dx * dx + dy * dy);

      // Update current distance and total distance
      currentDistance = movementDistance;
      totalDistance += movementDistance;

      // Log occasionally for debugging
      if (Math.random() < 0.05) {
        console.log(
          `Delta values: dx=${dx}, dy=${dy}, distance=${movementDistance.toFixed(
            2
          )}`
        );
      }

      // Update the distance displays
      updateDistanceDisplays();

      // Check if mouse movement is near any note's distance to trigger replay (only in playback mode)
      if (isPlaybackMode && notes.length > 0) {
        // Reset all notes playing state
        notes.forEach((note) => (note.isPlaying = false));

        // Check each note based on distance
        for (const note of notes) {
          // Get the replay tolerance value
          const replayTolerance = parseInt(replayToleranceSlider.value);

          // Calculate how close the current total distance is to this note's distance
          const distanceDifference = Math.abs(totalDistance - note.distance);

          if (distanceDifference <= replayTolerance) {
            // Play note if not already playing
            if (!note.isPlaying) {
              playNote(note.frequency, REPLAY_DURATION, replaySynth);
              note.isPlaying = true;

              // Log occasionally
              if (Math.random() < 0.2) {
                const distanceInMm = convertToMillimeters(note.distance);
                addSystemMessage(
                  `Replaying note at distance ${note.distance.toFixed(
                    2
                  )} units (${distanceInMm} mm)`
                );
              }
            }
          }
        }

        // Update the notes list to show playing status
        updateNotesList();
      }
    }

    // Update last position
    lastX = x;
    lastY = y;
  }

  // Handle right mouse button down
  function handleRightDown(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;

    // Extract coordinates
    const x = args[1] || 0;
    const y = args[2] || 0;

    // Start tracking right drag
    isRightDragging = true;
    rightDragStartX = x;
    rightDragStartY = y;
    rightDragDistance = 0;

    // If sequence not started, start recording mode
    if (!isSequenceStarted) {
      isSequenceStarted = true;
      isPlaybackMode = false;
      lastX = x;
      lastY = y;
      currentDistance = 0;
      totalDistance = 0;
      sequenceStatusText.textContent = 'Recording Mode';
      addSystemMessage('Recording started - left-click to drop notes');
      updateNotesList();
      updateDistanceDisplays();
    }
    // If already in recording or playback mode, reset distance and go to playback mode
    else {
      isPlaybackMode = true;
      sequenceStatusText.textContent = 'Playback Mode';
      addSystemMessage('Distance reset - now in playback mode');
      // Reset total distance for playback
      totalDistance = 0;
      updateDistanceDisplays();
    }
  }

  // Handle right drag to restart sequence
  function handleRightDrag(args) {
    if (!isSoundEnabled || !isAudioInitialized || !isRightDragging) return;

    // Extract coordinates
    const x = args[1] || 0;
    const y = args[2] || 0;

    // Calculate drag distance
    const dragDeltaX = x - rightDragStartX;
    const dragDeltaY = y - rightDragStartY;
    rightDragDistance = Math.sqrt(
      dragDeltaX * dragDeltaX + dragDeltaY * dragDeltaY
    );

    // If drag distance exceeds threshold, restart sequence
    if (rightDragDistance >= RIGHT_DRAG_THRESHOLD) {
      // Reset sequence but keep notes
      if (isSequenceStarted) {
        totalDistance = 0;
        currentDistance = 0;

        // Reset all notes playing state
        notes.forEach((note) => (note.isPlaying = false));

        // Update UI
        updateNotesList();
        updateDistanceDisplays();

        // Show message
        addSystemMessage('Sequence restarted - total distance reset to 0');

        // Prevent multiple restarts from the same drag
        isRightDragging = false;
      }
    }
  }

  // Handle right mouse button up
  function handleRightUp(args) {
    isRightDragging = false;
  }

  // Handle left mouse button down
  function handleLeftDown(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;

    // Start tracking for long press
    isLeftPressed = true;
    leftPressStartTime = Date.now();

    // Only drop notes in recording mode for regular clicks
    if (isSequenceStarted && !isPlaybackMode) {
      dropNote();
    }
  }

  // Handle left mouse button up
  function handleLeftUp(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;

    // Check if this was a long press
    if (
      isLeftPressed &&
      Date.now() - leftPressStartTime >= LONG_PRESS_THRESHOLD
    ) {
      // Reset sequence and restart recording
      notes = [];
      isSequenceStarted = true;
      isPlaybackMode = false;
      currentDistance = 0;
      totalDistance = 0;

      // Update UI
      sequenceStatusText.textContent = 'Recording Mode';
      notesCountText.textContent = '0 notes';
      addSystemMessage('Sequence reset - starting new recording');
      updateNotesList();
      updateDistanceDisplays();
    }

    // Reset left press tracking
    isLeftPressed = false;
  }

  // Drop a note at the current distance
  function dropNote() {
    // Get base frequency from slider
    const initialBaseFrequency = parseInt(baseFrequencySlider.value);

    // Calculate distance-adjusted base frequency
    // As distance increases, the base frequency increases
    const distanceAdjustment = totalDistance * frequencyDistanceFactor;
    const adjustedBaseFrequency =
      initialBaseFrequency * (1 + distanceAdjustment);

    // Calculate note frequency based on position in scale
    const noteIndex = notes.length % currentScale.length;
    const semitones = currentScale[noteIndex];
    const frequency = adjustedBaseFrequency * Math.pow(2, semitones / 12);

    // Create note object
    const note = {
      distance: totalDistance,
      frequency: frequency,
      baseFrequency: adjustedBaseFrequency, // Store the base frequency used for this note
      isPlaying: false,
    };

    // Add to notes array
    notes.push(note);

    // Update UI
    notesCountText.textContent = `${notes.length} notes`;

    // Play sound
    playNote(frequency, NOTE_DURATION, noteSynth);

    // Convert to millimeters
    const distanceInMm = convertToMillimeters(totalDistance);

    // Log
    addSystemMessage(
      `Note dropped at distance ${totalDistance.toFixed(
        2
      )} units (${distanceInMm} mm) with frequency ${Math.round(
        frequency
      )} Hz (base: ${Math.round(adjustedBaseFrequency)} Hz)`
    );

    // Update notes list
    updateNotesList();
  }

  // Play a note with the specified frequency and duration
  function playNote(frequency, duration, synth) {
    if (!isSoundEnabled || !isAudioInitialized) return;

    const volume = parseInt(noteVolumeSlider.value) / 100;
    synth.volume.value = Tone.gainToDb(volume);
    synth.triggerAttackRelease(frequency, duration);
  }

  // Toggle sound on/off
  async function toggleSound() {
    try {
      if (isSoundEnabled) {
        // Turn off sound
        isSoundEnabled = false;
        soundStatusText.textContent = 'Sound Off';
        toggleSoundButton.classList.remove('danger');
        toggleSoundButton.classList.add('primary');
        addSystemMessage('Sound disabled');
      } else {
        // Turn on sound
        if (!isAudioInitialized) {
          addSystemMessage('Initializing audio...');
          await initializeAudio();
          isAudioInitialized = true;
          addSystemMessage('Audio initialized');
        }

        isSoundEnabled = true;
        soundStatusText.textContent = 'Sound On';
        toggleSoundButton.classList.remove('primary');
        toggleSoundButton.classList.add('danger');
        addSystemMessage('Sound enabled');
      }
    } catch (error) {
      addSystemMessage(
        `Sound toggle error: ${error.message}. Try again or reload the page.`
      );
    }
  }

  // Clear the current sequence
  function clearSequence() {
    notes = [];
    isSequenceStarted = false;
    currentDistance = 0;
    totalDistance = 0;
    distanceSinceLastNote = 0;
    sequenceStatusText.textContent = 'No sequence started';
    notesCountText.textContent = '0 notes';
    updateNotesList();
    updateDistanceDisplays();
    addSystemMessage('Sequence cleared - movement tracking reset');
  }

  // Update slider value displays
  function updateSliderValues() {
    noteVolumeValue.textContent = `${noteVolumeSlider.value}%`;
    distanceThresholdValue.textContent = `${distanceThresholdSlider.value} units`;
    replayToleranceValue.textContent = `${replayToleranceSlider.value}`;
    baseFrequencyValue.textContent = `${baseFrequencySlider.value} Hz`;

    // Convert slider value (0-10) to a small factor (0-0.01)
    frequencyDistanceFactor = parseFloat(frequencyFactorSlider.value) * 0.001;
    frequencyFactorValue.textContent = frequencyDistanceFactor.toFixed(4);
  }

  // Update the current musical scale
  function updateMusicalScale() {
    const selectedScale = musicalScaleSelect.value;
    currentScale = musicalScales[selectedScale];

    addSystemMessage(`Musical scale changed to ${selectedScale}`);
    console.log('Musical scale changed to:', selectedScale, currentScale);
  }

  // Event listeners
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
    addSystemMessage('System log cleared');
  });
  toggleSoundButton.addEventListener('click', toggleSound);
  clearSequenceButton.addEventListener('click', clearSequence);

  // Slider event listeners
  noteVolumeSlider.addEventListener('input', updateSliderValues);
  distanceThresholdSlider.addEventListener('input', () => {
    updateSliderValues();
    addSystemMessage(
      `Distance threshold set to ${distanceThresholdSlider.value} units`
    );
  });
  replayToleranceSlider.addEventListener('input', () => {
    updateSliderValues();
    // Update the notes list to show new tolerance values
    if (notes.length > 0) {
      updateNotesList();
    }
  });
  baseFrequencySlider.addEventListener('input', updateSliderValues);
  frequencyFactorSlider.addEventListener('input', () => {
    updateSliderValues();
    addSystemMessage(
      `Pitch increment factor set to ${frequencyDistanceFactor.toFixed(4)}`
    );
  });

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
  updateDistanceDisplays();

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }

  // Add welcome message
  addSystemMessage('Distance-Based Notes initialized');
  addSystemMessage('Connect to the WebSocket server and enable sound to start');
  addSystemMessage('Right-click to start a sequence and move to drop notes');
});
