#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Removing quarantine attribute from HID Event Dispatcher app..."
xattr -d com.apple.quarantine "$DIR/HIDEventDispatcherUI.app" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Quarantine attribute successfully removed!"
    echo "You can now open the app normally."
else
    echo "⚠️  No quarantine attribute found or permission denied."
    echo "If you still can't open the app, try right-clicking it and selecting 'Open'."
fi

echo ""
echo "Press any key to close this window..."
read -n 1 -s
