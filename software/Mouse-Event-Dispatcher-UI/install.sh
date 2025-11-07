#!/bin/bash

# Mouse-OSC-Dispatcher Installer Script
# This script installs the app and removes quarantine attributes

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="MouseOSCDispatcher.app"

echo -e "${BLUE}=== Mouse OSC Dispatcher Installer ===${NC}"
echo "This script will install the application and remove quarantine attributes."

# Check if the app exists in the same directory as the script
if [ ! -d "$SCRIPT_DIR/$APP_NAME" ]; then
    echo -e "${RED}Error: $APP_NAME not found in the same directory as this script.${NC}"
    exit 1
fi

# Create Applications directory if it doesn't exist
mkdir -p /Applications

# Copy application to the Applications folder
echo -e "\n${GREEN}Copying application to Applications folder...${NC}"
cp -R "$SCRIPT_DIR/$APP_NAME" /Applications/

# Remove quarantine attribute
echo -e "\n${GREEN}Removing quarantine attribute...${NC}"
xattr -d com.apple.quarantine "/Applications/$APP_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Quarantine attribute successfully removed!${NC}"
else
    echo -e "${RED}⚠️ No quarantine attribute found or permission denied.${NC}"
    echo "If you still can't open the app, try right-clicking it and selecting 'Open'."
fi

echo -e "\n${GREEN}Installation complete!${NC}"
echo "Mouse OSC Dispatcher has been installed to your Applications folder."
echo -e "You can now run it normally without Gatekeeper warnings.\n"

echo "Press any key to close this window..."
read -n 1 -s
