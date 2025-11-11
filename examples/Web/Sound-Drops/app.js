// Sound Drops - A delta-based musical sequence creator
// This application creates musical sequences based on physical mouse movement (deltas)
// rather than screen coordinates. This allows users to create and replay notes
// based purely on their mouse movement patterns without needing to look at the screen.
// Notes are placed and triggered based on accumulated mouse movement deltas,
// making this a physical-space musical instrument rather than a screen-space one.

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
  const triggerDistanceSlider = document.getElementById('trigger-distance');
  const triggerDistanceValue = document.getElementById('trigger-distance-value');
  const replayToleranceSlider = document.getElementById('replay-tolerance');
  const replayToleranceValue = document.getElementById('replay-tolerance-value');
  const musicalScaleSelect = document.getElementById('musical-scale');
  const baseFrequencySlider = document.getElementById('base-frequency');
  const baseFrequencyValue = document.getElementById('base-frequency-value');
  
  // UI elements
  const notesList = document.getElementById('notes-list');
  const currentPositionDisplay = document.getElementById('current-position');
  
  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

  // Sound state
  let isSoundEnabled = false;
  let isAudioInitialized = false;
  
  // Sequence state
  let isSequenceStarted = false;
  let notes = []; // Array to store dropped notes
  let totalDeltaX = 0;
  let totalDeltaY = 0;
  
  // Update the notes list display
  function updateNotesList() {
    // Clear the list
    notesList.innerHTML = '';
    
    // If no notes, show empty state
    if (notes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No notes yet. Right-click to start a sequence and drop notes.';
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
      
      // Note position (relative to start)
      const notePosition = document.createElement('div');
      notePosition.className = 'note-position';
      
      // Get current replay tolerance
      const replayTolerance = parseInt(replayToleranceSlider.value);
      
      // Add position with tolerance indicator
      notePosition.innerHTML = `
        <span>(${Math.round(note.deltaX)}, ${Math.round(note.deltaY)})</span>
        <span class="tolerance-indicator" title="Replay tolerance: ±${replayTolerance} units">±${replayTolerance}</span>
      `;
      
      // Note frequency
      const noteFrequency = document.createElement('div');
      noteFrequency.className = 'note-frequency';
      noteFrequency.textContent = `${Math.round(note.frequency)} Hz`;
      
      // Note status
      const noteStatus = document.createElement('div');
      noteStatus.className = 'note-status';
      
      const statusIndicator = document.createElement('span');
      statusIndicator.className = note.isPlaying ? 
        'note-status-indicator playing' : 'note-status-indicator';
      
      const statusText = document.createTextNode(
        note.isPlaying ? ' Playing' : ' Idle'
      );
      
      noteStatus.appendChild(statusIndicator);
      noteStatus.appendChild(statusText);
      
      // Add all elements to the note item
      noteItem.appendChild(noteId);
      noteItem.appendChild(notePosition);
      noteItem.appendChild(noteFrequency);
      noteItem.appendChild(noteStatus);
      
      // Add the note item to the list
      notesList.appendChild(noteItem);
    });
  }

  // Audio context and synths
  let noteSynth;
  let replaySynth;
  
  // Musical scales
  const musicalScales = {
    majorScale: [0, 2, 4, 5, 7, 9, 11, 12], // C major: C, D, E, F, G, A, B, C
    minorScale: [0, 2, 3, 5, 7, 8, 10, 12], // C minor: C, D, Eb, F, G, Ab, Bb, C
    pentatonicScale: [0, 2, 4, 7, 9, 12, 14, 16] // C pentatonic: C, D, E, G, A, C, D, E
  };
  
  // Current scale to use
  let currentScale = musicalScales.pentatonicScale;
  
  // Initialize audio (must be triggered by user interaction)
  async function initAudio() {
    if (isAudioInitialized) return;
    
    try {
      // Start audio context
      await Tone.start();
      console.log('Audio context started successfully');
      
      // Create synth for dropped notes
      noteSynth = new Tone.Synth({
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
      
      // Create synth for replaying notes
      replaySynth = new Tone.Synth({
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.4,
          release: 0.5
        },
        volume: -10
      }).toDestination();
      
      // Create reverb effect
      const reverb = new Tone.Reverb({
        decay: 2.0,
        preDelay: 0.01,
        wet: 0.3
      }).toDestination();
      
      // Wait for reverb to initialize
      await reverb.generate();
      
      // Connect synths to reverb
      noteSynth.connect(reverb);
      replaySynth.connect(reverb);
      
      // Play a test sound
      noteSynth.triggerAttackRelease(440, '0.1s');
      
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
        noteSynth.triggerAttackRelease(660, '0.1s');
        
        addSystemMessage('Sound enabled - you should hear a test sound');
        console.log('Sound enabled, audio context state:', Tone.context.state);
      } else {
        addSystemMessage('Sound disabled');
      }
    } catch (error) {
      console.error('Error toggling sound:', error);
      addSystemMessage(`Sound toggle error: ${error.message}. Try again or reload the page.`);
    }
  }
  
  // Clear the current sequence
  function clearSequence() {
    notes = [];
    isSequenceStarted = false;
    totalDeltaX = 0;
    totalDeltaY = 0;
    sequenceStatusText.textContent = 'No sequence started';
    notesCountText.textContent = '0 notes';
    updateNotesList();
    updateCurrentPosition();
    addSystemMessage('Sequence cleared - movement tracking reset');
  }
  
  // Update slider value displays
  function updateSliderValues() {
    noteVolumeValue.textContent = `${noteVolumeSlider.value}%`;
    triggerDistanceValue.textContent = `${triggerDistanceSlider.value}x`;
    replayToleranceValue.textContent = `${replayToleranceSlider.value}`;
    baseFrequencyValue.textContent = `${baseFrequencySlider.value} Hz`;
  }
  
  // Update the current musical scale
  function updateMusicalScale() {
    const selectedScale = musicalScaleSelect.value;
    currentScale = musicalScales[selectedScale];
    
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
      } else if (address === '/hid/right_down') {
        handleRightClick(args);
      }
    }
  }

  // Update the current position display
  function updateCurrentPosition() {
    if (isSequenceStarted) {
      currentPositionDisplay.textContent = `(${Math.round(totalDeltaX)}, ${Math.round(totalDeltaY)})`;
      currentPositionDisplay.style.color = 'var(--note-color)';
    } else {
      currentPositionDisplay.textContent = '(0, 0)';
      currentPositionDisplay.style.color = 'var(--secondary-color)';
    }
  }

  // Handle mouse movement
  function handleMouseMove(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;
    
    // Extract delta values (ignore screen coordinates)
    const dx = args[3] || 0;
    const dy = args[4] || 0;
    
    // If sequence started, accumulate deltas with scaling factor
    if (isSequenceStarted) {
      // Apply movement scaling factor
      const scalingFactor = parseInt(triggerDistanceSlider.value);
      totalDeltaX += dx * scalingFactor;
      totalDeltaY += dy * scalingFactor;
      
      // Update the current position display
      updateCurrentPosition();
    }
    
    // Check if mouse movement is near any note's delta position to trigger replay
    if (notes.length > 0) {
      // Reset all notes playing state
      notes.forEach(note => note.isPlaying = false);
      
      // Check each note based on accumulated deltas
      for (const note of notes) {
        // Calculate distance in delta space (physical movement space)
        const deltaDistance = Math.sqrt(
          Math.pow(totalDeltaX - note.deltaX, 2) + 
          Math.pow(totalDeltaY - note.deltaY, 2)
        );
        
        // Get the replay tolerance value
        const replayTolerance = parseInt(replayToleranceSlider.value);
        
        if (deltaDistance <= replayTolerance) { // Use the replay tolerance value
          // Play note if not already playing
          if (!note.isPlaying) {
            playNote(note.frequency, 0.2, replaySynth);
            note.isPlaying = true;
            
            // Log occasionally
            if (Math.random() < 0.2) {
              addSystemMessage(`Replaying note at delta position (${Math.round(note.deltaX)}, ${Math.round(note.deltaY)})`);
            }
          }
        }
      }
      
      // Update the notes list to show playing status
      updateNotesList();
    }
  }

  // Handle right click to start sequence or drop note
  function handleRightClick(args) {
    if (!isSoundEnabled || !isAudioInitialized) return;
    
    // If sequence not started, start it
    if (!isSequenceStarted) {
      isSequenceStarted = true;
      totalDeltaX = 0;
      totalDeltaY = 0;
      sequenceStatusText.textContent = 'Sequence active';
      addSystemMessage('Sequence started - right-click to drop notes');
      updateNotesList();
      updateCurrentPosition();
    } else {
      // Drop a note at current delta position
      dropNote();
    }
  }
  
  // Drop a note at the current delta position
  function dropNote() {
    // Calculate note frequency based on position in sequence
    const baseFrequency = parseInt(baseFrequencySlider.value);
    const noteIndex = notes.length % currentScale.length;
    const semitones = currentScale[noteIndex];
    const frequency = baseFrequency * Math.pow(2, semitones / 12);
    
    // Create note object
    const note = {
      // Store actual delta values for replay logic
      deltaX: totalDeltaX,
      deltaY: totalDeltaY,
      frequency: frequency,
      isPlaying: false
    };
    
    // Add to notes array
    notes.push(note);
    
    // Update UI
    notesCountText.textContent = `${notes.length} notes`;
    
    // Play sound
    playNote(frequency, 0.3, noteSynth);
    
    // Log
    addSystemMessage(`Note dropped at delta position (${Math.round(totalDeltaX)}, ${Math.round(totalDeltaY)}) with frequency ${Math.round(frequency)} Hz`);
    
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
  clearSequenceButton.addEventListener('click', clearSequence);
  
  // Slider event listeners
  noteVolumeSlider.addEventListener('input', updateSliderValues);
  triggerDistanceSlider.addEventListener('input', () => {
    updateSliderValues();
    addSystemMessage(`Movement scaling set to ${triggerDistanceSlider.value}x`);
  });
  replayToleranceSlider.addEventListener('input', () => {
    updateSliderValues();
    // Update the notes list to show new tolerance values
    if (notes.length > 0) {
      updateNotesList();
    }
  });
  baseFrequencySlider.addEventListener('input', updateSliderValues);
  
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
  updateCurrentPosition();
  
  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }
  
  // Add welcome message
  addSystemMessage('Sound Drops initialized');
  addSystemMessage('Connect to the WebSocket server and enable sound to start');
  addSystemMessage('Right-click to start a sequence and drop notes');
});
