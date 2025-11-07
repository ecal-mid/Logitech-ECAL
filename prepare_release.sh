#!/bin/bash

# Exit on error
set -e

# Get version from argument or prompt user
if [ -z "$1" ]; then
  read -p "Enter version number (e.g., 1.0.0): " VERSION
else
  VERSION=$1
fi

# Remove 'v' prefix if provided
VERSION=${VERSION#v}

echo "Preparing release v$VERSION..."

# Create release directory
RELEASE_DIR="release/v$VERSION"
mkdir -p $RELEASE_DIR

# Build Mouse Event Dispatcher
echo "Building Mouse Event Dispatcher..."
cd software/Mouse-Event-Dispatcher-UI
./build_all.sh
cd ../..

# Build Keyboard Event Dispatcher
echo "Building Keyboard Event Dispatcher..."
cd software/Keyboard-Event-Dispatcher-UI
./build_all.sh
cd ../..

# Copy ZIP files to release directory with version in filename (DMG files excluded due to Apple security restrictions)
echo "Copying ZIP files to release directory..."
cp software/Mouse-Event-Dispatcher-UI/build/release/MouseOSCDispatcher.zip $RELEASE_DIR/MouseOSCDispatcher-v$VERSION.zip
cp software/Keyboard-Event-Dispatcher-UI/build/release/KeyboardOSCDispatcher.zip $RELEASE_DIR/KeyboardOSCDispatcher-v$VERSION.zip

# Note: DMG files are not included as they are blocked by Apple security

# Create release notes template
echo "Creating release notes template..."
cat > $RELEASE_DIR/RELEASE_NOTES.md << EOF
# HID Event Dispatchers v$VERSION

This release includes both the Mouse and Keyboard Event Dispatcher applications.

## Mouse Event Dispatcher

### Features
- Captures mouse movement, clicks, and scroll events
- Sends events via OSC with configurable host/port
- Rate limiting for mouse movement events

### Changes
- [Add changes here]

## Keyboard Event Dispatcher

### Features
- Captures key down, key up, and modifier key events
- Configurable event filtering
- Sends events via OSC with configurable host/port

### Changes
- [Add changes here]

## System Requirements
- macOS 10.15 or later
- Accessibility permissions must be granted for both applications
EOF

echo "Release v$VERSION prepared in $RELEASE_DIR"
echo "Please edit $RELEASE_DIR/RELEASE_NOTES.md with the specific changes for this release"
echo ""
echo "To create a GitHub release:"
echo "1. Go to GitHub and create a new release with tag v$VERSION"
echo "2. Copy the contents of $RELEASE_DIR/RELEASE_NOTES.md into the release description"
echo "3. Upload the DMG and ZIP files from the $RELEASE_DIR directory"
