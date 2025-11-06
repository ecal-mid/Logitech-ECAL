# Mouse Sound Generator

A specialized WebSocket client that generates sound based on mouse movements and clicks.

## Features

- Connects to the Node-HID-Server via WebSocket
- Generates dynamic sounds based on mouse movement speed
- Produces different sounds for different mouse buttons
- Provides real-time waveform visualization
- Adjustable sound parameters (frequency, sensitivity, volume)
- Clean, responsive UI

## How to Use

1. Start the Node-HID-Server (from the `/software/Node-HID-Server` directory):

   ```bash
   npm start
   ```

2. Open the Mouse Sound Generator:

   Simply open the `index.html` file in a web browser directly or serve it using the Node-HID-Server's built-in web server.

3. Connect to the WebSocket server:
   - The default URL is `ws://localhost:3000`
   - Click the "Connect" button to establish a connection

4. Enable sound:
   - Click the "Sound Off" button to toggle sound on
   - Note: Browser security requires user interaction to enable audio

5. Adjust sound parameters:
   - Base Frequency: Sets the fundamental tone for movement sounds
   - Speed Sensitivity: Controls how much mouse speed affects pitch
   - Click Volume: Adjusts the volume of mouse click sounds
   - Click Pitch: Sets the base pitch for mouse click sounds

6. Interact with your mouse:
   - Move your mouse to generate continuous tones that vary with speed
   - Click different mouse buttons to produce percussive sounds

## Sound Generation

The application uses two different sound generators:

1. **Movement Sound**: A sine wave oscillator that changes frequency based on mouse movement speed
   - Faster movements produce higher pitches
   - The sound fades out when movement stops

2. **Click Sound**: A membrane synthesizer that produces percussive sounds
   - Left, right, and middle buttons produce slightly different pitches
   - Volume and base pitch can be adjusted

## OSC Message Types Used

The sound generator processes these OSC message types:

- `/hid/move`: Mouse movement events (with speed calculation)
- `/hid/left_down`: Left mouse button clicks
- `/hid/right_down`: Right mouse button clicks
- `/hid/middle_down`: Middle mouse button clicks

## Requirements

- Modern web browser with Web Audio API support
- Running Node-HID-Server instance
- Browser security settings that allow audio playback

## Technical Details

The application uses:

- Web Audio API via Tone.js for sound synthesis
- Canvas API for waveform visualization
- WebSockets for real-time communication with the Node-HID-Server

## Customization

You can modify this example to:

- Add different sound generators for various mouse events
- Implement spatial audio based on mouse position
- Create more complex sound patterns and sequences
- Add additional visualizations of sound parameters
- Implement sound presets for different use cases
