# Simple Scroll Distance

A minimalist web application that tracks and displays the total distance traveled using scroll wheel events. This simplified version focuses only on real-time distance tracking without logging or exporting functionality.

## Features

- **Live Distance Display**: Shows the accumulated distance in both raw units and physical measurements (meters/millimeters)
- **Visual Scroll Feedback**: Provides visual indication of scroll direction and intensity
- **WebSocket Connection**: Connects to the Node HID Server to receive OSC messages
- **Reset Functionality**: Allows resetting the distance counter with a button click

## How to Use

1. Start the Node HID Server (make sure it's configured to send scroll wheel events)
2. Open the Simple Scroll Distance application in a web browser
3. Connect to the WebSocket server (default: `ws://localhost:3000`)
4. Use your mouse's scroll wheel to generate scroll events
5. The application will track and display the accumulated distance in real-time
6. Click the "Reset Distance" button to start a new measurement

## Technical Details

This example demonstrates:

- Processing OSC messages from the Node HID Server
- Handling scroll wheel events and delta values
- Calculating and accumulating distance from scroll events
- Converting arbitrary units to physical measurements (meters and millimeters)
- Real-time visualization of scroll direction and magnitude

## Calibration

The conversion factor (SCROLL_TO_MM) is calibrated based on the following ratio:

- 190,000 scroll units = 0.42 meters (420 mm)
- Therefore, 1 scroll unit = 420/190000 ≈ 0.00221 mm

This calibration provides accurate physical measurements for scroll wheel movements.
