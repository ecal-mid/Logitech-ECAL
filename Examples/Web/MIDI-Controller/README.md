# HID to MIDI Controller

This web application transforms HID (Human Interface Device) events from the Node-HID-Server into MIDI messages using the Web MIDI API. It allows you to map mouse movements, button clicks, scroll events, and keyboard presses to MIDI notes and control change (CC) messages.

## Features

- Connect to the Node-HID-Server via WebSocket
- Initialize MIDI output using the Web MIDI API
- Map HID events to MIDI messages:
  - Mouse movement (X/Y deltas) → MIDI CC or Note velocity
  - Mouse buttons (left/right/middle) → MIDI Note On/Off or CC
  - Scroll events → MIDI CC or Note velocity
  - Keyboard events → MIDI Note On/Off or CC
- Real-time visualization of MIDI values
- Message log showing both HID events and MIDI messages

## Requirements

- A modern web browser that supports the Web MIDI API (Chrome, Edge)
- Running Node-HID-Server (from the Logitech-ECAL project)
- MIDI software or hardware to receive the MIDI messages

## Usage

1. Start the Node-HID-Server:

   ```bash
   cd /path/to/Logitech-ECAL/software/Node-HID-Server
   node server.js
   ```

2. Open the HID to MIDI Controller in a web browser:
   - Either serve the files using a local web server
   - Or open the HTML file directly in Chrome/Edge

3. Connect to the WebSocket server:
   - The default URL is `ws://localhost:3001`
   - Click "Connect" to establish the connection

4. Initialize MIDI:
   - Click "Initialize MIDI" to request MIDI access
   - Select a MIDI output device from the dropdown

5. Configure MIDI mappings:
   - Choose between "CC Message", "Note On/Off", or "Disabled" for each HID event
   - Set the CC number or Note number for each mapping
   - The current MIDI values will be displayed in real-time

6. Use your mouse and keyboard to generate MIDI messages!

## Mouse Movement Behavior

The mouse movement mapping uses delta values (how much the mouse has moved) rather than absolute screen positions:

- Movement starts from a center value (64 in MIDI range)
- Moving the mouse in a direction increases or decreases the value
- Values are constrained to the MIDI range (0-127)
- When movement stops, values gradually return to center (64)
- This creates a joystick-like behavior that's ideal for expressive control

## Browser Compatibility

The Web MIDI API is currently supported in:

- Google Chrome
- Microsoft Edge
- Opera

It is NOT supported in:

- Firefox
- Safari

## Security Notes

- The Web MIDI API requires a secure context (HTTPS) when deployed online
- For local development, `localhost` is considered secure
- When using this in production, ensure you're serving over HTTPS

## Troubleshooting

- If no MIDI devices appear, make sure your MIDI devices are connected before loading the page
- Some browsers may require you to reload the page after connecting MIDI devices
- Check the browser console for any errors related to MIDI access

## License

© 2025 ECAL / Media & Interaction Design
