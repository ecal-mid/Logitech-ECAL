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

  // Scroll visualization elements
  const scrollUp = document.getElementById('scroll-up');
  const scrollDown = document.getElementById('scroll-down');
  const scrollBar = document.getElementById('scroll-bar');
  const currentDeltaDisplay = document.getElementById('current-delta');
  const totalDistanceDisplay = document.getElementById('total-distance');
  const totalMmDisplay = document.getElementById('total-mm');

  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

  // Tracking variables
  let isScrolling = false;
  let scrollTimeout = null;
  let lastScrollTime = 0;
  let currentScrollDelta = 0;
  let totalScrollDistance = 0;
  let accumulatedScrollDistance = 0;

  // Store measurements for export
  let measurements = [];

  // Save measurements to localStorage
  function saveMeasurements() {
    localStorage.setItem('scrollMeasurements', JSON.stringify(measurements));
  }

  // Load measurements from localStorage
  function loadMeasurements() {
    const savedMeasurements = localStorage.getItem('scrollMeasurements');
    if (savedMeasurements) {
      measurements = JSON.parse(savedMeasurements);

      // Display saved measurements
      if (measurements.length > 0) {
        emptyState.style.display = 'none';
        measurements.forEach((measurement) => {
          addMeasurementCard(
            measurement.timestamp,
            measurement.distance,
            measurement.distanceInMm
          );
        });
      }
    }
  }

  // Connect to WebSocket server
  function connectToServer() {
    const url = serverUrlInput.value.trim();
    if (!url) {
      addErrorMessage('Please enter a valid WebSocket URL');
      return;
    }

    try {
      ws = new WebSocket(url);

      ws.addEventListener('open', () => {
        updateConnectionStatus(true);
        addSystemMessage(`Connected to ${url}`);
      });

      ws.addEventListener('close', () => {
        updateConnectionStatus(false);
        addSystemMessage('Disconnected from server');
      });

      ws.addEventListener('error', (error) => {
        updateConnectionStatus(false);
        addErrorMessage(`Connection error: ${error.message}`);
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);

          // Process OSC message
          if (message.address && message.args) {
            processOSCMessage(message.address, message.args);
          }
        } catch (error) {
          addErrorMessage(`Error processing message: ${error.message}`);
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

    // Handle scroll wheel events
    if (address === '/hid/scroll') {
      handleScrollEvent(args);
    }
  }

  // Handle scroll wheel event
  function handleScrollEvent(args) {
    // Extract scroll delta - based on HID event structure
    // For scroll events, args structure is: [deviceID, deltaY]
    const scrollDelta = args[1] || 0;

    // Skip if delta is 0
    if (scrollDelta === 0) return;

    // Update current delta display
    currentScrollDelta = scrollDelta;
    currentDeltaDisplay.textContent = scrollDelta;

    // Update visualization
    updateScrollVisualization(scrollDelta);

    // Calculate absolute delta for distance measurement
    const absDelta = Math.abs(scrollDelta);

    // Accumulate scroll distance (raw units)
    totalScrollDistance += absDelta;
    accumulatedScrollDistance += absDelta;

    // Update distance displays
    updateDistanceDisplays();

    // Mark as scrolling
    isScrolling = true;
    lastScrollTime = Date.now();

    // Clear previous timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Set timeout to detect end of scrolling
    scrollTimeout = setTimeout(() => {
      if (Date.now() - lastScrollTime >= 500) {
        // Scrolling has stopped
        isScrolling = false;

        // Record the measurement if significant
        if (accumulatedScrollDistance > 0) {
          const timestamp = new Date().toLocaleTimeString();
          // Store the raw unit value - don't round it here as it affects the stored data
          addMeasurementToLog(timestamp, accumulatedScrollDistance);
          
          // Reset accumulated distance
          accumulatedScrollDistance = 0;

          // Save measurements
          saveMeasurements();
        }
      }
    }, 500);
  }

  // Update scroll visualization
  function updateScrollVisualization(delta) {
    // Update direction indicators
    if (delta > 0) {
      scrollDown.classList.add('active');
      scrollUp.classList.remove('active');
    } else if (delta < 0) {
      scrollUp.classList.add('active');
      scrollDown.classList.remove('active');
    }

    // Reset indicators after a short delay
    setTimeout(() => {
      scrollUp.classList.remove('active');
      scrollDown.classList.remove('active');
    }, 200);

    // Update scroll bar visualization
    const barHeight = Math.min(100, 50 + Math.abs(delta) / 2);
    scrollBar.style.height = `${barHeight}%`;

    // Reset bar height after animation
    setTimeout(() => {
      scrollBar.style.height = '50%';
    }, 300);
  }

  // Conversion factor for millimeters (calibrated for scroll events)
  // Calibration: 190,000 units = 0.42 meters = 420 mm
  // Therefore: 1 unit = 420/190000 = 0.00221 mm
  const SCROLL_TO_MM = 420 / 190000;

  // Update distance displays
  function updateDistanceDisplays() {
    // Always display raw units consistently
    totalDistanceDisplay.textContent = `${Math.round(totalScrollDistance)} units`;

    // Convert to physical measurements
    const mm = totalScrollDistance * SCROLL_TO_MM;
    const meters = (mm / 1000).toFixed(3);

    // Display in meters with mm in parentheses
    totalMmDisplay.textContent = `${meters} m (${mm.toFixed(2)} mm)`;
  }

  // Add measurement to log
  function addMeasurementToLog(timestamp, distance) {
    // Hide empty state if visible
    if (emptyState.style.display !== 'none') {
      emptyState.style.display = 'none';
    }

    // Store the raw distance value (unrounded)
    const rawDistance = distance;
    // Format the display distance value (rounded)
    const displayDistance = Math.round(distance);
    
    // Calculate millimeters
    const distanceInMm = (rawDistance * SCROLL_TO_MM).toFixed(2);
    const meters = (parseFloat(distanceInMm) / 1000).toFixed(3);

    // Add measurement card
    addMeasurementCard(timestamp, displayDistance, distanceInMm, meters);

    // Store measurement for export
    measurements.push({
      timestamp: timestamp,
      distance: rawDistance,  // Store raw value
      displayDistance: displayDistance, // Store rounded value for display
      distanceInMm: distanceInMm,
      distanceInM: meters
    });

    // Add to system log
    addSystemMessage(
      `Measured scroll distance: ${displayDistance} units (${meters} m / ${distanceInMm} mm)`
    );
  }

  // Add measurement card to UI
  function addMeasurementCard(timestamp, distance, distanceInMm, meters) {
    // Create measurement card
    const card = document.createElement('div');
    card.className = 'measurement-card';

    // Format distance display in meters
    const distanceDisplay = `${meters} m (${distanceInMm} mm)`;

    // Add card content
    card.innerHTML = `
      <div class="measurement-distance">${distance} units</div>
      <div class="measurement-mm">${distanceDisplay}</div>
      <div class="measurement-timestamp">${timestamp}</div>
    `;

    // Add to container at the beginning (newest first)
    measurementsContainer.insertBefore(card, measurementsContainer.firstChild);
  }

  // Export measurements as CSV
  function exportMeasurements() {
    if (measurements.length === 0) {
      alert('No measurements to export');
      return;
    }

    // Create CSV content
    let csvContent =
      'data:text/csv;charset=utf-8,Timestamp,Distance (raw units),Distance (rounded units),Distance (mm),Distance (m)\n';

    measurements.forEach((measurement) => {
      // Use the stored values to ensure consistency
      const rawUnits = measurement.distance.toFixed(2);
      const displayUnits = measurement.displayDistance || Math.round(measurement.distance);
      const mm = measurement.distanceInMm;
      const meters = measurement.distanceInM || (parseFloat(mm) / 1000).toFixed(3);
      
      csvContent += `${measurement.timestamp},${rawUnits},${displayUnits},${mm},${meters}\n`;
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `scroll-measurements-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Clean up
    document.body.removeChild(link);

    addSystemMessage(`Exported ${measurements.length} measurements to CSV`);
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

    // Add empty state back
    emptyState.style.display = 'block';
    measurementsContainer.appendChild(emptyState);

    // Reset measurements array
    measurements = [];

    // Reset total distance
    totalScrollDistance = 0;
    accumulatedScrollDistance = 0;
    updateDistanceDisplays();

    // Save empty measurements
    saveMeasurements();

    addSystemMessage('Measurements cleared');
  });

  exportMeasurementsButton.addEventListener('click', exportMeasurements);

  // Allow pressing Enter in the server URL input to connect
  serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectButton.click();
    }
  });

  // Load saved measurements on startup
  loadMeasurements();

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }

  // Add welcome message
  addSystemMessage('Scroll Distance Tracker initialized');
  addSystemMessage(
    'Connect to the WebSocket server to start tracking scroll events'
  );
});
