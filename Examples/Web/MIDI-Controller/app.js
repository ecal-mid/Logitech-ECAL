document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - WebSocket
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const serverUrlInput = document.getElementById('server-url');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const messageLog = document.getElementById('message-log');
  const clearLogButton = document.getElementById('clear-log');
  const messageCountElement = document.getElementById('message-count');

  // DOM Elements - MIDI
  const midiStatusText = document.getElementById('midi-status-text');
  const midiStatusDot = document.getElementById('midi-status-dot');
  const midiInitButton = document.getElementById('midi-init-button');
  const midiOutputSelect = document.getElementById('midi-output');

  // DOM Elements - MIDI Values
  const moveXValue = document.getElementById('move-x-value');
  const moveYValue = document.getElementById('move-y-value');
  const leftButtonValue = document.getElementById('left-button-value');
  const rightButtonValue = document.getElementById('right-button-value');
  const middleButtonValue = document.getElementById('middle-button-value');
  const scrollYValue = document.getElementById('scroll-y-value');
  const keyboardValue = document.getElementById('keyboard-value');
  const sensitivitySlider = document.getElementById('movement-sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  const scrollSensitivitySlider = document.getElementById('scroll-sensitivity');
  const scrollSensitivityValue = document.getElementById(
    'scroll-sensitivity-value'
  );

  // WebSocket connection
  let ws = null;

  // MIDI variables
  let midiAccess = null;
  let midiOutput = null;
  let midiInitialized = false;

  // Maximum number of messages to display
  const MAX_MESSAGES = 10;

  // MIDI mapping state
  const midiState = {
    'move-x': { value: 0, type: 'cc', number: 1, lastValue: 64 },
    'move-y': { value: 0, type: 'cc', number: 2, lastValue: 64 },
    'left-button': { value: 0, type: 'note', number: 60 },
    'right-button': { value: 0, type: 'note', number: 62 },
    'middle-button': { value: 0, type: 'note', number: 64 },
    'scroll-y': { value: 64, type: 'cc', number: 3, lastValue: 64 },
    keyboard: { value: 0, type: 'note', number: 48, lastKey: null },
  };

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

  // Initialize Web MIDI API
  async function initMIDI() {
    try {
      if (navigator.requestMIDIAccess) {
        midiAccess = await navigator.requestMIDIAccess();
        midiInitialized = true;
        updateMIDIStatus(true);
        populateMIDIOutputs();
        addSystemMessage('MIDI initialized successfully');
      } else {
        updateMIDIStatus(false);
        addSystemMessage('Web MIDI API not supported in this browser');
        alert(
          'Web MIDI API is not supported in this browser. Please use Chrome or Edge.'
        );
      }
    } catch (err) {
      updateMIDIStatus(false);
      addSystemMessage(`MIDI initialization error: ${err.message}`);
      console.error('MIDI initialization error:', err);
    }
  }

  // Update MIDI status UI
  function updateMIDIStatus(initialized) {
    if (initialized) {
      midiStatusText.textContent = 'MIDI Initialized';
      midiStatusDot.classList.add('connected');
      midiInitButton.disabled = true;
      midiOutputSelect.disabled = false;
    } else {
      midiStatusText.textContent = 'MIDI Not Initialized';
      midiStatusDot.classList.remove('connected');
      midiInitButton.disabled = false;
      midiOutputSelect.disabled = true;
    }
  }

  // Populate MIDI output devices dropdown
  function populateMIDIOutputs() {
    midiOutputSelect.innerHTML = '';

    if (midiAccess) {
      if (midiAccess.outputs.size === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No MIDI outputs available';
        midiOutputSelect.appendChild(option);
      } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select MIDI output';
        midiOutputSelect.appendChild(defaultOption);

        midiAccess.outputs.forEach((output) => {
          const option = document.createElement('option');
          option.value = output.id;
          option.textContent = output.name;
          midiOutputSelect.appendChild(option);
        });
      }
    }
  }

  // Process incoming OSC message
  function processMessage(message) {
    // Add message to log
    addMessageToLog(message);

    // Process message for MIDI conversion
    if (midiInitialized && midiOutput) {
      const address = message.address || '';
      const args = message.args || [];

      // Process mouse move events
      if (address === '/hid/move') {
        // args[3] is deltaX, args[4] is deltaY
        if (args.length >= 5) {
          // Update X position based on deltaX
          if (midiState['move-x'].type !== 'none') {
            // Get the delta value
            const deltaX = args[3] || 0;

            // Calculate new value based on delta, centered around 64 (MIDI middle value)
            // Scale the delta to control sensitivity (lower = slower increments)
            const scaleFactor = parseFloat(sensitivitySlider.value);
            let newX = midiState['move-x'].lastValue + deltaX * scaleFactor;

            // Constrain to MIDI range (0-127)
            newX = Math.min(Math.max(Math.round(newX), 0), 127);

            // Gradually return to center when no movement
            if (Math.abs(deltaX) < 0.1) {
              newX = Math.round(newX * 0.98 + 64 * 0.02); // Very slowly drift toward center (64)
            }

            midiState['move-x'].value = newX;
            midiState['move-x'].lastValue = newX;
            moveXValue.textContent = newX;

            if (midiState['move-x'].type === 'cc') {
              sendMIDICC(midiState['move-x'].number, newX);
            } else if (midiState['move-x'].type === 'note') {
              sendMIDINote(midiState['move-x'].number, newX);
            }
          }

          // Update Y position based on deltaY
          if (midiState['move-y'].type !== 'none') {
            // Get the delta value
            const deltaY = args[4] || 0;

            // Calculate new value based on delta, centered around 64 (MIDI middle value)
            // Scale the delta to control sensitivity (lower = slower increments)
            const scaleFactor = parseFloat(sensitivitySlider.value);
            let newY = midiState['move-y'].lastValue + deltaY * scaleFactor;

            // Constrain to MIDI range (0-127)
            newY = Math.min(Math.max(Math.round(newY), 0), 127);

            // Gradually return to center when no movement
            if (Math.abs(deltaY) < 0.1) {
              newY = Math.round(newY * 0.98 + 64 * 0.02); // Very slowly drift toward center (64)
            }

            midiState['move-y'].value = newY;
            midiState['move-y'].lastValue = newY;
            moveYValue.textContent = newY;

            if (midiState['move-y'].type === 'cc') {
              sendMIDICC(midiState['move-y'].number, newY);
            } else if (midiState['move-y'].type === 'note') {
              sendMIDINote(midiState['move-y'].number, newY);
            }
          }
        }
      }

      // Process mouse button events
      else if (address === '/hid/left_down') {
        if (midiState['left-button'].type !== 'none') {
          midiState['left-button'].value = 127;
          leftButtonValue.textContent = 'On';

          if (midiState['left-button'].type === 'cc') {
            sendMIDICC(midiState['left-button'].number, 127);
          } else if (midiState['left-button'].type === 'note') {
            sendMIDINoteOn(midiState['left-button'].number, 127);
          }
        }
      } else if (address === '/hid/left_up') {
        if (midiState['left-button'].type !== 'none') {
          midiState['left-button'].value = 0;
          leftButtonValue.textContent = 'Off';

          if (midiState['left-button'].type === 'cc') {
            sendMIDICC(midiState['left-button'].number, 0);
          } else if (midiState['left-button'].type === 'note') {
            sendMIDINoteOff(midiState['left-button'].number);
          }
        }
      } else if (address === '/hid/right_down') {
        if (midiState['right-button'].type !== 'none') {
          midiState['right-button'].value = 127;
          rightButtonValue.textContent = 'On';

          if (midiState['right-button'].type === 'cc') {
            sendMIDICC(midiState['right-button'].number, 127);
          } else if (midiState['right-button'].type === 'note') {
            sendMIDINoteOn(midiState['right-button'].number, 127);
          }
        }
      } else if (address === '/hid/right_up') {
        if (midiState['right-button'].type !== 'none') {
          midiState['right-button'].value = 0;
          rightButtonValue.textContent = 'Off';

          if (midiState['right-button'].type === 'cc') {
            sendMIDICC(midiState['right-button'].number, 0);
          } else if (midiState['right-button'].type === 'note') {
            sendMIDINoteOff(midiState['right-button'].number);
          }
        }
      } else if (address === '/hid/middle_down') {
        if (midiState['middle-button'].type !== 'none') {
          midiState['middle-button'].value = 127;
          middleButtonValue.textContent = 'On';

          if (midiState['middle-button'].type === 'cc') {
            sendMIDICC(midiState['middle-button'].number, 127);
          } else if (midiState['middle-button'].type === 'note') {
            sendMIDINoteOn(midiState['middle-button'].number, 127);
          }
        }
      } else if (address === '/hid/middle_up') {
        if (midiState['middle-button'].type !== 'none') {
          midiState['middle-button'].value = 0;
          middleButtonValue.textContent = 'Off';

          if (midiState['middle-button'].type === 'cc') {
            sendMIDICC(midiState['middle-button'].number, 0);
          } else if (midiState['middle-button'].type === 'note') {
            sendMIDINoteOff(midiState['middle-button'].number);
          }
        }
      }

      // Process scroll events
      else if (address === '/hid/scroll') {
        // Based on MouseEventDispatcherApp.swift, scroll events have args:
        // [0]: deviceID, [1]: x, [2]: y, [3]: deltaX, [4]: deltaY, [5]: deltaZ
        if (midiState['scroll-y'].type !== 'none' && args.length >= 5) {
          // Get the deltaY value (vertical scroll)
          const deltaY = args[4] || 0;

          // Calculate new value based on delta, centered around 64 (MIDI middle value)
          // Scale the delta using the dedicated scroll sensitivity slider
          const scaleFactor = parseFloat(scrollSensitivitySlider.value);

          // Update value based on last value and delta
          let newValue = midiState['scroll-y'].lastValue;
          newValue = newValue + deltaY * scaleFactor;

          // Constrain to MIDI range (0-127)
          newValue = Math.min(Math.max(Math.round(newValue), 0), 127);

          // Gradually return to center
          if (Math.abs(deltaY) < 0.1) {
            newValue = Math.round(newValue * 0.9 + 64 * 0.1); // Faster return to center for scroll
          }

          midiState['scroll-y'].value = newValue;
          midiState['scroll-y'].lastValue = newValue;
          scrollYValue.textContent = newValue;

          if (midiState['scroll-y'].type === 'cc') {
            sendMIDICC(midiState['scroll-y'].number, newValue);
          } else if (midiState['scroll-y'].type === 'note') {
            sendMIDINote(midiState['scroll-y'].number, newValue);
          }

          // No debug message in production
        }
      }

      // Process keyboard events
      else if (address === '/hid/key_down') {
        if (midiState['keyboard'].type !== 'none' && args.length >= 2) {
          const keyCode = args[2];
          // Map key codes to MIDI notes (simple mapping: keyCode % 24 + base note)
          const noteNumber = (keyCode % 24) + midiState['keyboard'].number;
          midiState['keyboard'].lastKey = keyCode;
          midiState['keyboard'].value = 127;
          keyboardValue.textContent = `Key ${keyCode} (Note ${noteNumber})`;

          if (midiState['keyboard'].type === 'cc') {
            sendMIDICC(noteNumber, 127);
          } else if (midiState['keyboard'].type === 'note') {
            sendMIDINoteOn(noteNumber, 127);
          }
        }
      } else if (address === '/hid/key_up') {
        if (midiState['keyboard'].type !== 'none' && args.length >= 2) {
          const keyCode = args[1];
          // Map key codes to MIDI notes (simple mapping: keyCode % 24 + base note)
          const noteNumber = (keyCode % 24) + midiState['keyboard'].number;

          if (midiState['keyboard'].lastKey === keyCode) {
            midiState['keyboard'].value = 0;
            keyboardValue.textContent = 'None';
          }

          if (midiState['keyboard'].type === 'cc') {
            sendMIDICC(noteNumber, 0);
          } else if (midiState['keyboard'].type === 'note') {
            sendMIDINoteOff(noteNumber);
          }
        }
      }
    }
  }

  // Send MIDI CC message
  function sendMIDICC(ccNumber, value) {
    if (midiOutput) {
      // MIDI CC message: [0xB0, controller number, value]
      midiOutput.send([0xb0, ccNumber, value]);
      addMIDIMessage(`CC #${ccNumber}`, value);
    }
  }

  // Send MIDI Note On message
  function sendMIDINoteOn(noteNumber, velocity) {
    if (midiOutput) {
      // MIDI Note On message: [0x90, note number, velocity]
      midiOutput.send([0x90, noteNumber, velocity]);
      addMIDIMessage(`Note On #${noteNumber}`, velocity);
    }
  }

  // Send MIDI Note Off message
  function sendMIDINoteOff(noteNumber) {
    if (midiOutput) {
      // MIDI Note Off message: [0x80, note number, 0]
      midiOutput.send([0x80, noteNumber, 0]);
      addMIDIMessage(`Note Off #${noteNumber}`, 0);
    }
  }

  // Send MIDI Note with velocity (Note On followed by Note Off)
  function sendMIDINote(noteNumber, velocity) {
    sendMIDINoteOn(noteNumber, velocity);
    // Send Note Off after a short delay
    setTimeout(() => {
      sendMIDINoteOff(noteNumber);
    }, 100);
  }

  // Add message to log
  function addMessageToLog(message) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const address = message.address || '';
    const args = JSON.stringify(message.args || []);
    const source = message.source || 'unknown';

    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';

    messageItem.innerHTML = `<span class="message-timestamp">[${timestamp}]</span> <span class="message-address">${address}</span> <span class="message-args">${args}</span> <span class="message-source">from ${source}</span>`;

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
    messageItem.className = 'message-item system-message';

    messageItem.innerHTML = `<span class="message-timestamp">[${timestamp}]</span> <span class="message-address">SYSTEM:</span> <span class="message-args">${text}</span>`;

    messageLog.appendChild(messageItem);

    // Limit the number of messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }

    // Auto-scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // Add MIDI message to log
  function addMIDIMessage(type, value) {
    const timestamp = new Date().toLocaleTimeString();

    const messageItem = document.createElement('div');
    messageItem.className = 'message-item midi-message';

    messageItem.innerHTML = `<span class="message-timestamp">[${timestamp}]</span> <span class="message-address">MIDI:</span> <span class="message-args">${type} = ${value}</span>`;

    messageLog.appendChild(messageItem);

    // Limit the number of messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }

    // Auto-scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  // Event listeners - WebSocket
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
  });

  // Event listeners - MIDI
  midiInitButton.addEventListener('click', initMIDI);
  midiOutputSelect.addEventListener('change', (e) => {
    const selectedOutputId = e.target.value;

    if (selectedOutputId && midiAccess) {
      midiOutput = midiAccess.outputs.get(selectedOutputId);
      addSystemMessage(`Selected MIDI output: ${midiOutput.name}`);
    } else {
      midiOutput = null;
      addSystemMessage('No MIDI output selected');
    }
  });

  // Event listeners - MIDI Mapping
  document.querySelectorAll('.midi-mapping').forEach((select) => {
    select.addEventListener('change', (e) => {
      const eventType = e.target.dataset.event;
      const mappingType = e.target.value;

      midiState[eventType].type = mappingType;

      // Update UI based on mapping type
      const ccInput = document.querySelector(
        `.midi-cc-number[data-event="${eventType}"]`
      );
      const noteInput = document.querySelector(
        `.midi-note-number[data-event="${eventType}"]`
      );

      if (ccInput)
        ccInput.style.display = mappingType === 'cc' ? 'inline-block' : 'none';
      if (noteInput)
        noteInput.style.display =
          mappingType === 'note' ? 'inline-block' : 'none';
    });
  });

  document
    .querySelectorAll('.midi-cc-number, .midi-note-number')
    .forEach((input) => {
      input.addEventListener('change', (e) => {
        const eventType = e.target.dataset.event;
        const number = parseInt(e.target.value, 10);

        if (number >= 0 && number <= 127) {
          midiState[eventType].number = number;
        } else {
          e.target.value = midiState[eventType].number;
          alert('MIDI values must be between 0 and 127');
        }
      });
    });

  // Initialize
  updateConnectionStatus(false);
  updateMIDIStatus(false);
  messageCountElement.textContent = MAX_MESSAGES;

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }

  // Setup initial visibility of number inputs
  document.querySelectorAll('.midi-mapping').forEach((select) => {
    const eventType = select.dataset.event;
    const mappingType = select.value;

    const ccInput = document.querySelector(
      `.midi-cc-number[data-event="${eventType}"]`
    );
    const noteInput = document.querySelector(
      `.midi-note-number[data-event="${eventType}"]`
    );

    if (ccInput)
      ccInput.style.display = mappingType === 'cc' ? 'inline-block' : 'none';
    if (noteInput)
      noteInput.style.display =
        mappingType === 'note' ? 'inline-block' : 'none';
  });

  // Set up sensitivity sliders
  sensitivitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value).toFixed(1);
    sensitivityValue.textContent = value;
  });

  scrollSensitivitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value).toFixed(1);
    scrollSensitivityValue.textContent = value;
  });
});
