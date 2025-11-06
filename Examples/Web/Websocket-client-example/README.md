# WebSocket Client Example

This is a simple example of a WebSocket client that connects to the Node-HID-Server and displays received OSC messages/events.

## Features

- Connect to any WebSocket server (default: `ws://localhost:3000`)
- Real-time visualization of mouse movements and clicks
- Message log with filtering options
- Clean, responsive UI

## How to Use

1. Start the Node-HID-Server (from the `/software/Node-HID-Server` directory):

   ```bash
   npm start
   ```

2. Open the WebSocket client example:

   Simply open the `index.html` file in a web browser directly or serve it using the Node-HID-Server's built-in web server.

3. Connect to the WebSocket server:
   - The default URL is `ws://localhost:3000`
   - Click the "Connect" button to establish a connection

4. Interact with your system:
   - Move your mouse, click, scroll, or use your keyboard
   - Watch as events are visualized and logged in real-time

5. Filter messages:
   - Use the checkboxes to show/hide specific types of events
   - Clear the log as needed

## Message Types

The client recognizes and visualizes these OSC message types:

- `/hid/move`: Mouse movement events
- `/hid/left_down`, `/hid/right_down`: Mouse click events
- `/hid/scroll`: Scroll wheel events
- `/hid/key`: Keyboard events

## Customization

You can modify this example to:

- Change the visualization behavior
- Add support for additional message types
- Implement more advanced filtering
- Add data analysis or recording features

## Requirements

- Modern web browser with WebSocket support
- Running Node-HID-Server instance (this handles both OSC message reception and WebSocket communication)
