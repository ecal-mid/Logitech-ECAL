# Scroll Distance Tracker

A web application that tracks and measures scroll wheel events, calculating the total distance traveled based on scroll wheel delta values. This example demonstrates how to process scroll wheel events from the Mouse Event Dispatcher and visualize the data.

## Features

- **Scroll Wheel Event Tracking**: Captures and processes scroll wheel delta values
- **Real-time Visualization**: Visual feedback for scroll direction and magnitude
- **Distance Calculation**: Converts scroll delta values to distance units and millimeters
- **Measurement History**: Records and displays scroll measurements with timestamps
- **Data Export**: Export measurements as CSV for further analysis
- **WebSocket Connection**: Connects to the Node HID Server to receive OSC messages

## How to Use

1. Start the Node HID Server (make sure it's configured to send scroll wheel events)
2. Open the Scroll Distance Tracker in a web browser
3. Connect to the WebSocket server (default: `ws://localhost:3000`)
4. Use your mouse's scroll wheel to generate scroll events
5. The application will track the scroll distance and display measurements
6. Export measurements as CSV for data analysis

## Understanding the Data

- **Current Delta**: The most recent scroll wheel delta value received
- **Total Distance (units)**: Accumulated raw distance in arbitrary scroll wheel units
- **Total Distance (m/mm)**: Converted physical distance in meters and millimeters
- **Measurement Cards**: Individual scroll sessions showing both raw units and converted physical measurements

Important: The raw scroll wheel units remain consistent regardless of the calibration factor. The calibration factor only affects the conversion to physical measurements (meters and millimeters).

## Technical Details

This example demonstrates:

- Processing OSC messages from the Node HID Server
- Handling scroll wheel events and delta values
- Calculating and accumulating distance from scroll events
- Converting arbitrary units to physical measurements (meters and millimeters)
- Real-time visualization of scroll direction and magnitude
- Storing and exporting measurement data

## Requirements

- A modern web browser with JavaScript enabled
- The Node HID Server running to receive OSC messages
- A Mouse Event Dispatcher sending scroll wheel events via OSC

## Calibration

The application tracks two types of measurements:

1. **Raw Scroll Units**: These are the unprocessed values from the scroll wheel events. These values remain consistent regardless of calibration settings.

2. **Physical Measurements**: These are derived by applying a calibration factor to convert raw units to physical distances (meters and millimeters).

The conversion factor (SCROLL_TO_MM) is currently calibrated based on the following ratio:

- 190,000 scroll units = 0.42 meters (420 mm)
- Therefore, 1 scroll unit = 420/190000 ≈ 0.00221 mm

This calibration provides accurate physical measurements for scroll wheel movements. The application displays both the raw units and the converted physical measurements to ensure consistency.

If you need to recalibrate for your specific mouse and system settings:

1. Measure a known physical distance (e.g., 0.5 meters)
2. Scroll that exact distance and note the raw scroll units accumulated
3. Calculate: conversion factor = physical distance in mm / raw scroll units
4. Update the SCROLL_TO_MM constant in the code

Note: Changing the calibration factor will not affect the raw unit measurements, only their conversion to physical distances.
