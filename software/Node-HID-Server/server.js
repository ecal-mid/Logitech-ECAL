const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Server: WebSocketServer } = require('ws');
const { Server: OSCServer } = require('node-osc');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const { format } = require('util');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Config file path
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Default configuration
let config = {
  oscPort: 8000,
  webSocketPort: 8080,
  webServerPort: 3000,
  enabled: false,
  filters: {
    enabled: false,
    patterns: ['/hid/*'], // Default filter pattern
  },
  logging: {
    enabled: false,
    consoleOutput: false,
  },
};

// Load configuration if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const data = fs.readFileSync(CONFIG_FILE);
    config = JSON.parse(data);
  }
} catch (err) {
  console.error('Error loading config:', err);
}

// Save configuration
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Initialize WebSocket server
let wss = new WebSocketServer({ noServer: true });

// OSC server instance
let oscServer = null;

// Initialize logger
function initLogger() {
  console.log('OSC message logging enabled');
}

// Log OSC message
function logOSCMessage(message) {
  // Only log to console if console logging is enabled
  if (config.logging && config.logging.consoleOutput) {
    const timestamp = new Date(message.timestamp).toISOString();
    console.log(
      `OSC: [${timestamp}] ${message.address} ${JSON.stringify(
        message.args
      )} from ${message.source}`
    );
  }
}

// Check if a message should be forwarded based on filter patterns
function shouldForwardMessage(address) {
  // If filtering is disabled, forward all messages
  if (!config.filters || !config.filters.enabled) {
    return true;
  }

  // If no patterns are defined, don't forward any messages
  if (!config.filters.patterns || config.filters.patterns.length === 0) {
    return false;
  }

  // Check if the address matches any of the patterns
  return config.filters.patterns.some((pattern) => {
    // Convert OSC-style pattern to regex
    let regexPattern = pattern;

    // Handle special case for /** (matches anything including /)
    if (pattern.endsWith('/**')) {
      regexPattern = pattern.replace(/\/\*\*$/, '(/.*)?');
    }

    // Replace * with wildcard for any characters except /
    regexPattern = regexPattern.replace(/\*/g, '[^/]*');

    // Escape special regex characters except those we've already handled
    regexPattern = regexPattern.replace(/([.+?^${}()|\/])/g, '\\$1');

    // Convert OSC-style wildcards to regex
    regexPattern = regexPattern
      .replace(/\\\*/g, '[^/]*') // Restore * as wildcard
      .replace(/\\\//g, '/'); // Restore / as literal

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(address);
  });
}

// Function to start OSC server
function startOSCServer() {
  if (oscServer) {
    oscServer.close();
  }

  // Initialize logger
  initLogger();

  oscServer = new OSCServer(config.oscPort, '0.0.0.0');

  oscServer.on('message', (msg, rinfo) => {
    if (!msg || !Array.isArray(msg) || msg.length === 0) return;

    const address = msg[0];
    const args = msg.slice(1);

    // Create message object
    const message = {
      timestamp: Date.now(),
      address,
      args,
      source: `${rinfo.address}:${rinfo.port}`,
    };

    // Log message
    logOSCMessage(message);

    // Check if message should be forwarded based on filters
    if (shouldForwardMessage(address)) {
      // Broadcast to all WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  });

  console.log(`OSC server listening on port ${config.oscPort}`);
}

// Function to stop OSC server
function stopOSCServer() {
  if (oscServer) {
    oscServer.close();
    oscServer = null;
    console.log('OSC server stopped');
    console.log('OSC logging stopped');
  }
}

// Setup WebSocket server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send current configuration to the client
  ws.send(JSON.stringify({ type: 'config', data: config }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// API endpoints
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const newConfig = req.body;

  // Update config
  if (newConfig.oscPort !== undefined)
    config.oscPort = parseInt(newConfig.oscPort);
  if (newConfig.webSocketPort !== undefined)
    config.webSocketPort = parseInt(newConfig.webSocketPort);
  if (newConfig.webServerPort !== undefined)
    config.webServerPort = parseInt(newConfig.webServerPort);
  if (newConfig.enabled !== undefined) config.enabled = newConfig.enabled;

  // Update filters
  if (newConfig.filters !== undefined) {
    if (newConfig.filters.enabled !== undefined)
      config.filters.enabled = newConfig.filters.enabled;
    if (newConfig.filters.patterns !== undefined)
      config.filters.patterns = newConfig.filters.patterns;
  }

  // Update logging settings
  if (newConfig.logging !== undefined) {
    if (newConfig.logging.enabled !== undefined)
      config.logging.enabled = newConfig.logging.enabled;
    if (newConfig.logging.consoleOutput !== undefined)
      config.logging.consoleOutput = newConfig.logging.consoleOutput;
  }

  // Save updated config
  saveConfig();

  // Restart services if needed
  if (config.enabled) {
    stopOSCServer();
    startOSCServer();
  } else {
    stopOSCServer();
  }

  // Notify all clients about config change
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send(JSON.stringify({ type: 'config', data: config }));
    }
  });

  res.json({ success: true, config });
});

app.post('/api/toggle', (req, res) => {
  config.enabled = !config.enabled;

  if (config.enabled) {
    startOSCServer();
  } else {
    stopOSCServer();
  }

  saveConfig();

  // Notify all clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send(JSON.stringify({ type: 'config', data: config }));
    }
  });

  res.json({ success: true, enabled: config.enabled });
});

// Start the server
server.listen(config.webServerPort, () => {
  console.log(`Web server listening on port ${config.webServerPort}`);
  console.log(
    `WebSocket server available at ws://localhost:${config.webServerPort}`
  );

  // Start OSC server if enabled
  if (config.enabled) {
    startOSCServer();
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  stopOSCServer();
  wss.close();

  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});
