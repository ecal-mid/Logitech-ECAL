document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const serverUrlInput = document.getElementById('server-url');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const totalDistanceDisplay = document.getElementById('total-distance');
  const totalPhysicalDisplay = document.getElementById('total-physical');
  const resetButton = document.getElementById('reset-button');

  // Scroll visualization elements removed for simplicity

  // WebSocket connection
  let ws = null;

  // Tracking variables
  let isScrolling = false;
  let scrollTimeout = null;
  let lastScrollTime = 0;
  let totalScrollDistance = 0;

  // Conversion factor for millimeters (calibrated for scroll events)
  // Calibration: 190,000 units = 0.42 meters = 420 mm
  // Therefore: 1 unit = 420/190000 mm
  const SCROLL_TO_MM = 420 / 122000;

  // Connect to WebSocket server
  function connectToServer() {
    const url = serverUrlInput.value.trim();
    if (!url) {
      alert('Please enter a valid WebSocket URL');
      return;
    }

    try {
      ws = new WebSocket(url);

      ws.addEventListener('open', () => {
        updateConnectionStatus(true);
      });

      ws.addEventListener('close', () => {
        updateConnectionStatus(false);
      });

      ws.addEventListener('error', (error) => {
        updateConnectionStatus(false);
        alert(`Connection error: ${error.message}`);
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);

          // Process OSC message
          if (message.address && message.args) {
            processOSCMessage(message.address, message.args);
          }
        } catch (error) {
          console.error(`Error processing message: ${error.message}`);
        }
      });
    } catch (error) {
      alert(`Connection error: ${error.message}`);
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

    // Scroll visualization removed for simplicity

    // Calculate absolute delta for distance measurement
    const absDelta = Math.abs(scrollDelta);

    // Accumulate scroll distance (raw units)
    totalScrollDistance += absDelta;

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
      }
    }, 500);
  }

  // Scroll visualization function removed for simplicity

  // Update distance displays
  function updateDistanceDisplays() {
    // Always display raw units consistently
    totalDistanceDisplay.textContent = `${Math.round(
      totalScrollDistance
    )} units`;

    // Convert to physical measurements
    const mm = totalScrollDistance * SCROLL_TO_MM;
    const meters = (mm / 1000).toFixed(3);

    // Display in meters with mm in parentheses
    totalPhysicalDisplay.textContent = `${meters} m`;
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

  // Reset distance counters
  function resetDistance() {
    totalScrollDistance = 0;
    updateDistanceDisplays();
  }

  // Event listeners
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  resetButton.addEventListener('click', resetDistance);

  // Allow pressing Enter in the server URL input to connect
  serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectButton.click();
    }
  });

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }
});
