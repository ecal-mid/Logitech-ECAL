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

## Download

You can download the latest release from the [GitHub Releases page](https://github.com/yourusername/Logitech-ECAL/releases/latest).

### Latest Release

- **Mouse Event Dispatcher**: [Download DMG](https://github.com/yourusername/Logitech-ECAL/releases/latest/download/MouseOSCDispatcher-v1.0.0.dmg) | [Download ZIP](https://github.com/yourusername/Logitech-ECAL/releases/latest/download/MouseOSCDispatcher-v1.0.0.zip)
- **Keyboard Event Dispatcher**: [Download DMG](https://github.com/yourusername/Logitech-ECAL/releases/latest/download/KeyboardOSCDispatcher-v1.0.0.dmg) | [Download ZIP](https://github.com/yourusername/Logitech-ECAL/releases/latest/download/KeyboardOSCDispatcher-v1.0.0.zip)

> **Note**: You'll need to replace "yourusername" with your actual GitHub username and update version numbers as needed.

## Requirements

- macOS 10.15 or later
- Xcode Command Line Tools (for building Swift applications)
- Node.js 14+ (for Node HID Server)

## Credits

ECAL / Media & Interaction Design / Alain Bellet
