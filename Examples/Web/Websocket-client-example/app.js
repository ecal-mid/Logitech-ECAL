document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const serverUrlInput = document.getElementById('server-url');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const messageLog = document.getElementById('message-log');
  const clearLogButton = document.getElementById('clear-log');
  const messageCountElement = document.getElementById('message-count');
  const visualizationArea = document.getElementById('visualization-area');
  const pointer = document.getElementById('pointer');
  const xCoord = document.getElementById('x-coord');
  const yCoord = document.getElementById('y-coord');

  // Filter checkboxes
  const filterMove = document.getElementById('filter-move');
  const filterClick = document.getElementById('filter-click');
  const filterScroll = document.getElementById('filter-scroll');
  const filterKeyboard = document.getElementById('filter-keyboard');
  const filterOther = document.getElementById('filter-other');

  // WebSocket connection
  let ws = null;

  // Maximum number of messages to display
  const MAX_MESSAGES = 50;

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
    // Check if message should be displayed based on filters
    if (!shouldDisplayMessage(message)) {
      return;
    }

    // Add message to log
    addMessageToLog(message);

    // Update visualization for specific message types
    updateVisualization(message);
  }

  // Check if message should be displayed based on filters
  function shouldDisplayMessage(message) {
    const address = message.address || '';

    if (address.includes('/move') && !filterMove.checked) {
      return false;
    }

    if (
      address.includes('/left_down') ||
      address.includes('/right_down') ||
      (address.includes('/middle_down') && !filterClick.checked)
    ) {
      return false;
    }

    if (address.includes('/scroll') && !filterScroll.checked) {
      return false;
    }

    if (address.includes('/key') && !filterKeyboard.checked) {
      return false;
    }

    // If it's not one of the above types, check "Other" filter
    if (
      !address.includes('/left_down') &&
      !address.includes('/left_up') &&
      !address.includes('/right_down') &&
      !address.includes('/right_up') &&
      !address.includes('/middle_down') &&
      !address.includes('/middle_up') &&
      !address.includes('/scroll') &&
      !address.includes('/move') &&
      !filterOther.checked
    ) {
      return false;
    }

    return true;
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

  // Update visualization based on message
  function updateVisualization(message) {
    const address = message.address || '';
    const args = message.args || [];

    // Handle mouse move events
    if (address.includes('/move') && args.length >= 5) {
      // Extract coordinates (assuming args[3] is x and args[4] is y)
      const x = args[3];
      const y = args[4];

      // Calculate position in visualization area
      const areaWidth = visualizationArea.clientWidth;
      const areaHeight = visualizationArea.clientHeight;

      // Scale the movement (adjust these values as needed)
      const scaleFactor = 2;
      const pointerX = areaWidth / 2 + x * scaleFactor;
      const pointerY = areaHeight / 2 + y * scaleFactor;

      // Update pointer position
      pointer.style.left = `${Math.max(0, Math.min(areaWidth, pointerX))}px`;
      pointer.style.top = `${Math.max(0, Math.min(areaHeight, pointerY))}px`;

      // Update coordinates display
      xCoord.textContent = x;
      yCoord.textContent = y;
    }

    // Handle click events
    if (
      address.includes('/left_down') ||
      address.includes('/right_down') ||
      address.includes('/middle_down')
    ) {
      // Add click animation
      pointer.classList.add('click-animation');

      // Remove animation class after animation completes
      setTimeout(() => {
        pointer.classList.remove('click-animation');
      }, 500);
    }
  }

  // Event listeners
  connectButton.addEventListener('click', connectToServer);
  disconnectButton.addEventListener('click', disconnectFromServer);
  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
  });

  // Allow pressing Enter in the server URL input to connect
  serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectButton.click();
    }
  });

  // Initialize
  updateConnectionStatus(false);
  messageCountElement.textContent = MAX_MESSAGES;

  // Center the pointer initially
  const areaWidth = visualizationArea.clientWidth;
  const areaHeight = visualizationArea.clientHeight;
  pointer.style.left = `${areaWidth / 2}px`;
  pointer.style.top = `${areaHeight / 2}px`;

  // Try to connect automatically if URL is provided
  if (serverUrlInput.value.trim()) {
    connectToServer();
  }
});
