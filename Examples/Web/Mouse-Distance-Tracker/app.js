document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const serverUrlInput = document.getElementById('server-url');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const messageLog = document.getElementById('message-log');
  const clearLogButton = document.getElementById('clear-log');
  const measurementsContainer = document.getElementById(
    'measurements-container'
  );
  const emptyState = document.getElementById('empty-state');
  const clearMeasurementsButton = document.getElementById('clear-measurements');
  const exportMeasurementsButton = document.getElementById(
    'export-measurements'
  );

  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

  // Tracking variables
  let isLeftDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastX = 0;
  let lastY = 0;
  let currentDragDistance = 0;

  // Store measurements for export
  let measurements = [];

  // Save measurements to localStorage
  function saveMeasurements() {
    localStorage.setItem('mouseMeasurements', JSON.stringify(measurements));
  }

  // Load measurements from localStorage
  function loadMeasurements() {
    const savedMeasurements = localStorage.getItem('mouseMeasurements');
    if (savedMeasurements) {
      measurements = JSON.parse(savedMeasurements);
    }
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
      console.log('Message structure:', {
        'args[0]':
          args[0] !== undefined ? `${args[0]} (deviceID)` : 'undefined',
        'args[1]':
          args[1] !== undefined ? `${args[1]} (x position)` : 'undefined',
        'args[2]':
          args[2] !== undefined ? `${args[2]} (y position)` : 'undefined',
        'args[3]':
          args[3] !== undefined ? `${args[3]} (deltaX for move)` : 'undefined',
        'args[4]':
          args[4] !== undefined ? `${args[4]} (deltaY for move)` : 'undefined',
      });
    }

    // Handle left mouse button events
    if (address === '/hid/left_down') {
      console.log('Processing left mouse down event');
      handleMouseDown(args);
    } else if (address === '/hid/left_up') {
      console.log('Processing left mouse up event');
      handleMouseUp(args);
    } else if (address === '/hid/left_drag') {
      // Also check for left_drag events
      console.log('Processing left drag event');
      handleMouseMove(args);
    } else if (address === '/hid/move' && isLeftDragging) {
      // Process move events during left drag
      handleMouseMove(args);
    }
  }

  // Handle left mouse button down
  function handleMouseDown(args) {
    isLeftDragging = true;

    // Extract coordinates - deviceID is args[0], x is args[1], y is args[2]
    // Based on HIDEventDispatcherApp.swift, coordinates are at index 1 and 2
    dragStartX = args[1] || 0;
    dragStartY = args[2] || 0;
    lastX = dragStartX;
    lastY = dragStartY;
    currentDragDistance = 0;

    console.log('Left mouse down with args:', args);

    addSystemMessage(`Left drag started at (${dragStartX}, ${dragStartY})`);
  }

  // Handle left mouse button up
  function handleMouseUp(args) {
    if (!isLeftDragging) return;

    isLeftDragging = false;

    // Extract coordinates - deviceID is args[0], x is args[1], y is args[2]
    const endX = args[1] || 0;
    const endY = args[2] || 0;

    console.log('Left mouse up with args:', args);

    // Add measurement to log with timestamp
    const timestamp = new Date().toLocaleTimeString();
    addMeasurementToLog(timestamp, Math.round(currentDragDistance));

    // Save measurements to localStorage
    saveMeasurements();

    addSystemMessage(
      `Left drag ended. Distance: ${Math.round(currentDragDistance)} pixels`
    );
  }

  // Handle mouse movement during left drag
  function handleMouseMove(args) {
    if (!isLeftDragging) return;

    // Extract coordinates - deviceID is args[0], x is args[1], y is args[2]
    const x = args[1] || 0;
    const y = args[2] || 0;

    // Extract delta values - based on HIDEventDispatcherApp.swift, delta values are at index 3 and 4
    // For mouse move events, args structure is: [deviceID, x, y, deltaX, deltaY]
    const dx = args[3] || 0;
    const dy = args[4] || 0;

    // Debug log
    if (Math.random() < 0.1) {
      console.log('Mouse move during left drag with args:', args);
      console.log(`Using delta values: dx=${dx}, dy=${dy}`);
    }

    // Calculate distance moved using delta values directly
    const segmentDistance = Math.sqrt(dx * dx + dy * dy);
    currentDragDistance += segmentDistance;

    // Update last position
    lastX = x;
    lastY = y;
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

  // Conversion factor: 6660 pixels = 300mm
  const PIXELS_TO_MM = 300 / 6660;

  // Add measurement as a card
  function addMeasurementToLog(timestamp, distance) {
    // Hide empty state if visible
    if (emptyState.style.display !== 'none') {
      emptyState.style.display = 'none';
    }

    // Calculate millimeters
    const distanceInMm = (distance * PIXELS_TO_MM).toFixed(2);

    // Create measurement card
    const card = document.createElement('div');
    card.className = 'measurement-card';

    // Add card content
    card.innerHTML = `
      <div class="measurement-distance">${distance} pixels</div>
      <div class="measurement-mm">${distanceInMm} mm</div>
      <div class="measurement-timestamp">${timestamp}</div>
    `;

    // Add to container at the beginning (newest first)
    measurementsContainer.insertBefore(card, measurementsContainer.firstChild);

    // Store measurement for export
    measurements.push({
      timestamp: timestamp,
      distance: distance,
      distanceInMm: distanceInMm,
    });

    // Also add to system log
    addSystemMessage(
      `Measured distance: ${distance} pixels (${distanceInMm} mm)`
    );
  }

  // Export measurements as CSV
  function exportMeasurements() {
    if (measurements.length === 0) {
      alert('No measurements to export');
      return;
    }

    // Create CSV content
    let csvContent =
      'data:text/csv;charset=utf-8,Timestamp,Distance (pixels),Distance (mm)\n';

    measurements.forEach((measurement) => {
      csvContent += `${measurement.timestamp},${measurement.distance},${measurement.distanceInMm}\n`;
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `mouse-drag-measurements-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Clean up
    document.body.removeChild(link);

    addSystemMessage(`Exported ${measurements.length} measurements to CSV`);
  }

  // Event listeners
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
    addSystemMessage('System log cleared');
  });
  clearMeasurementsButton.addEventListener('click', () => {
    // Clear measurement cards
    measurementsContainer.innerHTML = '';

    // Reset measurements array
    measurements = [];

    // Save to localStorage
    saveMeasurements();

    // Show empty state
    measurementsContainer.appendChild(emptyState);
    emptyState.style.display = 'block';

    addSystemMessage('All measurements cleared');
  });
  exportMeasurementsButton.addEventListener('click', exportMeasurements);

  // Allow pressing Enter in the server URL input to connect
  serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectButton.click();
    }
  });

  // Initialize
  updateConnectionStatus(false);
  loadMeasurements();

  // Initialize measurements container
  if (measurements.length === 0) {
    // Show empty state
    emptyState.style.display = 'block';
  } else {
    // Hide empty state
    emptyState.style.display = 'none';

    // Populate with existing measurements
    measurements.forEach((measurement) => {
      // Calculate mm if not already present
      if (!measurement.distanceInMm) {
        measurement.distanceInMm = (
          measurement.distance * PIXELS_TO_MM
        ).toFixed(2);
      }

      const card = document.createElement('div');
      card.className = 'measurement-card';
      card.innerHTML = `
        <div class="measurement-distance">${measurement.distance} pixels</div>
        <div class="measurement-mm">${measurement.distanceInMm} mm</div>
        <div class="measurement-timestamp">${measurement.timestamp}</div>
      `;
      measurementsContainer.appendChild(card);
    });
  }

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }

  // Add welcome message
  addSystemMessage('Mouse Distance Tracker initialized');
  addSystemMessage(
    'Connect to the WebSocket server to start tracking left-drag distances'
  );
});
