# Arduino Examples for Logitech x ECAL Workshop

This directory contains Arduino examples for the Logitech x ECAL Workshop 2025. These examples demonstrate how to use ESP32 microcontrollers to receive and process OSC (Open Sound Control) messages from HID (Human Interface Device) events.

## Requirements

- ESP32 microcontroller
- Arduino IDE
- Required libraries:
  - [WiFi](https://github.com/espressif/arduino-esp32)
  - [WiFiUdp](https://github.com/espressif/arduino-esp32)
  - [HTTPClient](https://github.com/espressif/arduino-esp32)
  - [OSC](https://github.com/CNMAT/OSC) - Open Sound Control library
  - [Adafruit_NeoPixel](https://github.com/adafruit/Adafruit_NeoPixel) (for LED-Strip-example only)

## Examples

### 1. OSC-WIFI-RECEIVER

A basic example that demonstrates how to receive OSC messages from HID events (mouse movements, clicks, scrolls) over WiFi.

**Features:**

- Connects to WiFi network
- Listens for OSC messages on port 8000
- Processes HID events (mouse movements, clicks, scrolls)
- Sends state information via OSC
- Controls the built-in LED based on mouse clicks

### 2. LED-Strip-example

An extended example that builds on the OSC-WIFI-RECEIVER functionality and adds control of a NeoPixel LED strip.

**Features:**

- All features from the basic OSC-WIFI-RECEIVER
- Controls a NeoPixel LED strip based on HID events
- Two operating modes:
  - **Gauge Mode**: Displays a level gauge on the LED strip controlled by mouse scroll
  - **Color Mode**: Changes the color of the LED strip based on mouse movement
- Mode switching via right mouse click
- Reset gauge level via left mouse click

## Getting Started

1. Install the required libraries in your Arduino IDE
2. Connect your ESP32 to your computer
3. Open one of the example sketches
4. Configure the WiFi settings in the sketch:

   ```cpp
   #define WIFI_SSID "********"  // Replace with your WiFi name
   #define WIFI_PASS "********"    // Replace with your WiFi password
   ```

5. For the LED-Strip-example, connect a NeoPixel LED strip to pin 13 (or modify the pin in the code)
6. Upload the sketch to your ESP32
7. Open the Serial Monitor (115200 baud) to see debug information

## OSC Message Format

These examples listen for the following OSC messages:

- `/hid/move` - Mouse movement events with delta x and y values
- `/hid/left_down`, `/hid/left_up` - Left mouse button events
- `/hid/right_down`, `/hid/right_up` - Right mouse button events
- `/hid/middle_down`, `/hid/middle_up` - Middle mouse button events
- `/hid/scroll` - Mouse scroll events with delta x and y values

## IP Table Registration

Both examples automatically register themselves to an online IP table at:
[https://ecal-mid.ch/esp32watcher](https://ecal-mid.ch/esp32watcher)

This makes it easier to discover and connect to your ESP32 devices on the network.

## Workshop Information

These examples are part of the Logitech x ECAL Workshop 2025.
