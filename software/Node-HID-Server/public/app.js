document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const toggleButton = document.getElementById('toggle-server');
  const configForm = document.getElementById('config-form');
  const oscPortInput = document.getElementById('osc-port');
  const websocketPortInput = document.getElementById('websocket-port');
  const webserverPortInput = document.getElementById('webserver-port');
  const messageLog = document.getElementById('message-log');
  const clearLogButton = document.getElementById('clear-log');

  // Filter Elements
  const filterEnabledCheckbox = document.getElementById('filter-enabled');
  const filterPatternsContainer = document.getElementById('filter-patterns');
  const newFilterInput = document.getElementById('new-filter');
  const addFilterButton = document.getElementById('add-filter');

  // Logging Elements
  const loggingEnabledCheckbox = document.getElementById('logging-enabled');
  const consoleOutputCheckbox = document.getElementById('console-output');

  // WebSocket connection
  let ws = null;
  let serverEnabled = false;

  // Initialize WebSocket connection
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      updateStatus(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      updateStatus(false);

      // Try to reconnect after 3 seconds
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'config') {
          // Update UI with config data
          updateConfigUI(data.data);
        } else {
          // Display OSC message
          displayMessage(data);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    };
  }

  // Update server status in UI
  function updateStatus(connected) {
    if (connected) {
      statusText.textContent = 'Connected';
      statusDot.classList.add('connected');
    } else {
      statusText.textContent = 'Disconnected';
      statusDot.classList.remove('connected');
    }

    updateToggleButton();
  }

  // Update config form with received data
  function updateConfigUI(config) {
    oscPortInput.value = config.oscPort;
    websocketPortInput.value = config.webSocketPort;
    webserverPortInput.value = config.webServerPort;
    serverEnabled = config.enabled;

    // Update filter UI if filter config exists
    if (config.filters) {
      filterEnabledCheckbox.checked = config.filters.enabled;

      // Clear existing patterns
      filterPatternsContainer.innerHTML = '';

      // Add each pattern to the UI
      if (config.filters.patterns && Array.isArray(config.filters.patterns)) {
        config.filters.patterns.forEach((pattern) => {
          addFilterPatternToUI(pattern);
        });
      }
    }

    // Update logging UI if logging config exists
    if (config.logging) {
      loggingEnabledCheckbox.checked = config.logging.enabled;
      consoleOutputCheckbox.checked = config.logging.consoleOutput;
    }

    updateToggleButton();
  }

  // Update toggle button text based on server status
  function updateToggleButton() {
    if (serverEnabled) {
      toggleButton.textContent = 'Stop Server';
      toggleButton.classList.add('danger');
      toggleButton.classList.remove('primary');
    } else {
      toggleButton.textContent = 'Start Server';
      toggleButton.classList.add('primary');
      toggleButton.classList.remove('danger');
    }
  }

  // Maximum number of messages to display
  const MAX_MESSAGES = 10;

  // Display OSC message in the log
  function displayMessage(message) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const address = message.address;
    const args = JSON.stringify(message.args);
    const source = message.source;

    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';

    messageItem.innerHTML = `
      <span class="message-timestamp">[${timestamp}]</span>
      <span class="message-address">${address}</span>
      <span class="message-args">${args}</span>
      <span class="message-source">from ${source}</span>
    `;

    messageLog.appendChild(messageItem);

    // Keep only the last MAX_MESSAGES messages
    while (messageLog.children.length > MAX_MESSAGES) {
      messageLog.removeChild(messageLog.firstChild);
    }
  }

  // Toggle server status
  async function toggleServer() {
    try {
      const response = await fetch('/api/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        serverEnabled = data.enabled;
        updateToggleButton();
      }
    } catch (err) {
      console.error('Error toggling server:', err);
    }
  }

  // Save configuration
  async function saveConfig(config) {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        alert('Configuration saved successfully!');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Error saving configuration. Please try again.');
    }
  }

  // Add a filter pattern to the UI
  function addFilterPatternToUI(pattern) {
    const patternElement = document.createElement('div');
    patternElement.className = 'filter-pattern';
    patternElement.dataset.pattern = pattern;

    patternElement.innerHTML = `
      <span class="filter-pattern-text">${pattern}</span>
      <button class="filter-pattern-remove" title="Remove pattern">&times;</button>
    `;

    // Add event listener to remove button
    const removeButton = patternElement.querySelector('.filter-pattern-remove');
    removeButton.addEventListener('click', () => {
      patternElement.remove();
    });

    filterPatternsContainer.appendChild(patternElement);
  }

  // Get all filter patterns from the UI
  function getFilterPatternsFromUI() {
    const patterns = [];
    const patternElements =
      filterPatternsContainer.querySelectorAll('.filter-pattern');

    patternElements.forEach((element) => {
      patterns.push(element.dataset.pattern);
    });

    return patterns;
  }

  // Event listeners
  toggleButton.addEventListener('click', toggleServer);

  configForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const config = {
      oscPort: parseInt(oscPortInput.value),
      webSocketPort: parseInt(websocketPortInput.value),
      webServerPort: parseInt(webserverPortInput.value),
      filters: {
        enabled: filterEnabledCheckbox.checked,
        patterns: getFilterPatternsFromUI(),
      },
      logging: {
        enabled: loggingEnabledCheckbox.checked,
        consoleOutput: consoleOutputCheckbox.checked,
      },
    };

    saveConfig(config);
  });

  clearLogButton.addEventListener('click', () => {
    messageLog.innerHTML = '';
  });

  // Add filter pattern button
  addFilterButton.addEventListener('click', () => {
    const pattern = newFilterInput.value.trim();

    if (pattern) {
      addFilterPatternToUI(pattern);
      newFilterInput.value = '';
      newFilterInput.focus();
    }
  });

  // Allow pressing Enter in the filter input to add a pattern
  newFilterInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFilterButton.click();
    }
  });

  // Initialize WebSocket connection
  initWebSocket();

  // Fetch initial configuration
  fetch('/api/config')
    .then((response) => response.json())
    .then((config) => {
      updateConfigUI(config);
    })
    .catch((err) => {
      console.error('Error fetching config:', err);
    });
});
