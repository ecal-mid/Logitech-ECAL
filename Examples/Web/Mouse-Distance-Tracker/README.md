# Mouse Distance Tracker

A specialized WebSocket client that measures and visualizes the distance traveled by the mouse during left-button drag operations.

## Features

- Connects to the Node-HID-Server via WebSocket
- Tracks and measures left-button drag distances
- Displays measurements in both pixels and millimeters (6660px = 300mm)
- Organizes measurements in an easy-to-read card layout
- Persists measurements between sessions using localStorage
- Exports data to CSV for further analysis
- Clean, responsive UI

## How to Use

1. Start the Node-HID-Server (from the `/software/Node-HID-Server` directory):

   ```bash
   npm start
   ```

2. Open the Mouse Distance Tracker:

   Simply open the `index.html` file in a web browser directly or serve it using the Node-HID-Server's built-in web server.

3. Connect to the WebSocket server:
   - The default URL is `ws://localhost:3000`
   - Click the "Connect" button to establish a connection

4. Start tracking left-button drags:
   - Hold down the left mouse button and move the mouse
   - Release to complete a drag operation
   - Watch as distances are calculated and displayed on cards

5. View and manage measurements:
   - Each measurement is displayed as a card
   - Export measurements to CSV for analysis
   - Clear all measurements if needed

## Tracked Metrics

- **Distance in Pixels**: Raw distance traveled during drag operations
- **Distance in Millimeters**: Converted distance (6660px = 300mm)
- **Timestamp**: When the measurement was taken

## OSC Message Types Used

The tracker specifically processes these OSC message types:

- `/hid/left_down`: Start of left-button drag
- `/hid/left_up`: End of left-button drag
- `/hid/left_drag`: Left-button drag events (if available)
- `/hid/move`: Mouse movement during drag (only processed during active drag)

## Requirements

- Modern web browser with WebSocket support
- Running Node-HID-Server instance (this handles both OSC message reception and WebSocket communication)
- Browser with localStorage support (for stat persistence)

## Customization

You can modify this example to:

- Track different mouse buttons or key combinations
- Change the pixel-to-millimeter conversion ratio
- Add additional measurement statistics
- Implement different distance calculation algorithms
- Create custom visualizations of the collected data
