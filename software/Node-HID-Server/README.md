# Node HID Server

A Node.js server that listens for OSC messages and forwards them via WebSockets. This server provides a simple web interface for configuration and monitoring.

## Features

- Listens for OSC messages on a configurable port
- Forwards received OSC messages to connected WebSocket clients
- Web UI for configuration and monitoring
- Persists configuration between server restarts
- Real-time message monitoring

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

This will start the server with the default configuration or the last saved configuration.

For development with auto-restart on file changes:

```bash
npm run dev
```

### Accessing the Web UI

Once the server is running, open your browser and navigate to:

```plaintext
http://localhost:3000
```

(Or the port you've configured for the web server)

### Configuration

Through the web UI, you can configure:

- OSC Port: The port to listen for incoming OSC messages
- WebSocket Port: The port for WebSocket connections
- Web Server Port: The port for the HTTP server

After changing any configuration, click "Save Configuration" to apply the changes.

### Logging

The server includes comprehensive logging functionality:

- Enable/Disable Logging: Toggle logging on or off
- Log to Console: Output OSC messages to the server console
- Log to File: Save OSC messages to log files
- Log File Path: Specify where log files should be stored

Log files are named with timestamps (e.g., `osc-log-2023-11-04-12-30-00.log`) and can be viewed directly through the web UI. Each log entry includes:

- Timestamp
- OSC address
- Message arguments
- Source information

### Starting/Stopping the OSC Server

Use the "Start Server" / "Stop Server" button to enable or disable the OSC listener.

### Monitoring Messages

The "Message Monitor" section displays incoming OSC messages in real-time. Each message shows:

- Timestamp
- OSC address
- Arguments
- Source (IP address and port)

## WebSocket Client API

To connect to the WebSocket server from your own application:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received OSC message:', message);
};
```

The message format is:

```javascript
{
  address: '/osc/address',
  args: [arg1, arg2, ...],
  timestamp: 1634567890123,
  source: '192.168.1.100:57110'
}
```

## License

MIT

## Acknowledgements

This project is part of the Logitech-ECAL collaboration.
