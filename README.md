# Logitech-ECAL HID Event Dispatchers

A collection of tools for capturing and dispatching HID (Human Interface Device) events via OSC (Open Sound Control) protocol.

## Components

### Mouse Event Dispatcher

A macOS application that captures mouse events and sends them via OSC.

- Located in: `software/Mouse-Event-Dispatcher-UI/`
- Features:
  - Captures mouse movement, clicks, and scroll events
  - Sends events via OSC with configurable host/port
  - Rate limiting for mouse movement events
  - Accessibility permissions handling

### Keyboard Event Dispatcher

A macOS application that captures keyboard events and sends them via OSC.

- Located in: `software/Keyboard-Event-Dispatcher-UI/`
- Features:
  - Captures key down, key up, and modifier key events
  - Configurable event filtering (key down, key up, modifiers)
  - Sends events via OSC with configurable host/port
  - Accessibility permissions handling

### Node HID Server

A Node.js server that receives OSC messages and forwards them via WebSockets.

- Located in: `software/Node-HID-Server/`
- Features:
  - Listens for OSC messages on configurable port
  - Forwards messages to connected WebSocket clients
  - Web interface for configuration and monitoring
  - Message filtering and logging capabilities

## Building the Applications

Each application has its own build script:

```bash
# For Mouse Event Dispatcher
cd software/Mouse-Event-Dispatcher-UI
./build_all.sh

# For Keyboard Event Dispatcher
cd software/Keyboard-Event-Dispatcher-UI
./build_all.sh

# For Node HID Server
cd software/Node-HID-Server
npm install
npm start
```

## OSC Message Reference

The applications use the following OSC message formats for communication:

### HID Event Messages (Mouse/Keyboard → OSC)

| Address Pattern | Description | Parameters |
|----------------|-------------|------------|
| `/hid/move` | Mouse movement | `deviceID` (int), `x` (int), `y` (int), `deltaX` (float), `deltaY` (float) |
| `/hid/left_down` | Left mouse button down | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/left_up` | Left mouse button up | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/right_down` | Right mouse button down | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/right_up` | Right mouse button up | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/middle_down` | Middle mouse button down | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/middle_up` | Middle mouse button up | `deviceID` (int), `x` (int), `y` (int), `pressure` (float), `clickCount` (int) |
| `/hid/scroll` | Mouse scroll wheel | `deviceID` (int), `x` (int), `y` (int), `deltaX` (float), `deltaY` (float), `deltaZ` (float) |
| `/hid/key_down` | Keyboard key down | `deviceID` (int), `keyCode` (int), `characters` (string), `modifiers` (int) |
| `/hid/key_up` | Keyboard key up | `deviceID` (int), `keyCode` (int), `characters` (string), `modifiers` (int) |
| `/hid/flags_changed` | Modifier keys changed | `deviceID` (int), `modifiers` (int) |


## Download

You can download the latest release from the [GitHub Releases page](https://github.com/ecal-mid/Logitech-ECAL/releases/latest).

### Latest Release

- **Mouse Event Dispatcher**: [Download DMG](https://github.com/ecal-mid/Logitech-ECAL/releases/latest/download/MouseOSCDispatcher-v1.0.0.dmg) | [Download ZIP](https://github.com/ecal-mid/Logitech-ECAL/releases/latest/download/MouseOSCDispatcher-v1.0.0.zip)
- **Keyboard Event Dispatcher**: [Download DMG](https://github.com/ecal-mid/Logitech-ECAL/releases/latest/download/KeyboardOSCDispatcher-v1.0.0.dmg) | [Download ZIP](https://github.com/ecal-mid/Logitech-ECAL/releases/latest/download/KeyboardOSCDispatcher-v1.0.0.zip)

> **Note**: You'll need to replace "yourusername" with your actual GitHub username and update version numbers as needed.

## Requirements

- macOS 10.15 or later
- Xcode Command Line Tools (for building Swift applications)
- Node.js 14+ (for Node HID Server)

## Credits

ECAL / Media & Interaction Design / Alain Bellet
