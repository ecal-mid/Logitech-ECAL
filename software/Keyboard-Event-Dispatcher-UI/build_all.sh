#!/bin/bash

# Print build date and time for reference
echo "Build started at $(date)"

# Always force a complete rebuild
echo "Building development version..."

# Set the application names
APP_NAME="Keyboard-OSC-Dispatcher"
APP_DIR_NAME="KeyboardOSCDispatcher"
BUNDLE_ID="ch.ecal.keyboard-osc-dispatcher"

# Clean up previous build
rm -rf build
mkdir -p build
echo "Build directory cleaned"

# Build the application
mkdir -p build/$APP_NAME.app/Contents/{MacOS,Resources}
swiftc -framework Foundation -framework AppKit -framework SwiftUI -framework CoreGraphics -parse-as-library -o build/$APP_NAME.app/Contents/MacOS/$APP_NAME KeyboardEventDispatcherSwiftUI.swift OSCSupport.swift

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "App compiled successfully"
else
    echo "Build failed!"
    exit 1
fi

# Create Info.plist for development build
echo "Creating Info.plist for development build..."
cat > build/$APP_NAME.app/Contents/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID.dev</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME (Dev)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>$(date +%Y%m%d.%H%M)</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2025 ECAL / Alain Bellet. All rights reserved.</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
    <key>NSSupportsSuddenTermination</key>
    <true/>
</dict>
</plist>
EOF

# Create PkgInfo for development build
echo "Creating PkgInfo for development build..."
echo "APPL????" > build/$APP_NAME.app/Contents/PkgInfo

# Copy icon if it exists
if [ -f "AppIcon.icns" ]; then
    cp "AppIcon.icns" build/$APP_NAME.app/Contents/Resources/
    echo "✅ Icon added to development app bundle"
fi

echo "App built at build/$APP_NAME.app"

# Build release version
echo "Building release version..."
rm -rf build/release

# Ensure development build is up to date
echo "Ensuring development build is up to date..."
touch *.swift  # Touch source files to force recompilation
swiftc -framework Foundation -framework AppKit -framework SwiftUI -framework CoreGraphics -parse-as-library -o build/$APP_NAME.app/Contents/MacOS/$APP_NAME KeyboardEventDispatcherSwiftUI.swift OSCSupport.swift

# Copy the built app to the release directory
echo "Copying built app to release directory..."
mkdir -p build/release/${APP_DIR_NAME}.app/Contents/MacOS
mkdir -p build/release/${APP_DIR_NAME}.app/Contents/Resources

# Copy from development build to release build
cp build/${APP_NAME}.app/Contents/MacOS/${APP_NAME} build/release/${APP_DIR_NAME}.app/Contents/MacOS/${APP_DIR_NAME}

# Update timestamp of the copied executable
touch build/release/${APP_DIR_NAME}.app/Contents/MacOS/${APP_DIR_NAME}

# Check for icon file and copy it if it exists
ICON_FILE="AppIcon.icns"
if [ -f "$ICON_FILE" ]; then
  echo "Copying application icon..."
  cp "$ICON_FILE" build/release/${APP_DIR_NAME}.app/Contents/Resources/
  touch build/release/${APP_DIR_NAME}.app/Contents/Resources/"$ICON_FILE"
  echo "✅ Icon added to app bundle"
else
  echo "⚠️ No icon file found ($ICON_FILE). App will use default icon."
  echo "To add an icon, create an .icns file and place it in the project directory."
fi

# Always recreate Info.plist with current date
echo "Creating Info.plist with current build date..."
cat > build/release/${APP_DIR_NAME}.app/Contents/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_DIR_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>$(date +%Y%m%d.%H%M)</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2025 ECAL / Alain Bellet. All rights reserved.</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
    <key>NSSupportsSuddenTermination</key>
    <true/>
</dict>
</plist>
EOF

# Always recreate PkgInfo
echo "Creating PkgInfo..."
echo "APPL????" > build/release/${APP_DIR_NAME}.app/Contents/PkgInfo

# Set executable permissions and update timestamp
chmod +x build/release/${APP_DIR_NAME}.app/Contents/MacOS/${APP_DIR_NAME}
touch build/release/${APP_DIR_NAME}.app/Contents/MacOS/${APP_DIR_NAME}

# Create a temporary directory for DMG contents
echo "Preparing DMG contents..."
rm -rf build/release/dmg_contents
mkdir -p build/release/dmg_contents
cp -R build/release/${APP_DIR_NAME}.app build/release/dmg_contents/

# Create a README file for the DMG
cat > build/release/dmg_contents/IMPORTANT_READ_ME.txt << EOF
$APP_NAME
ECAL / Alain Bellet 2025

This application captures keyboard events and can send them via OSC protocol.
It requires accessibility permissions to function properly.

INSTALLATION:
1. Drag the application to your Applications folder
2. When you first run the app, right-click on it and select "Open"
3. Grant accessibility permissions when prompted

USAGE:
- The app will appear in your menu bar with a keyboard icon
- Click the icon to show/hide the main window
- Configure OSC settings as needed
- You can block events from specific keyboard devices

For more information, visit: https://www.ecal.ch
EOF

# Create a helper script to remove quarantine
cat > build/release/dmg_contents/remove_quarantine.command << EOF
#!/bin/bash
echo "Removing quarantine attribute from $APP_NAME..."
xattr -d com.apple.quarantine "\$(dirname "\$0")/${APP_DIR_NAME}.app"
echo "Done! You can now run the application normally."
echo "Press any key to close this window."
read -n 1
EOF
chmod +x build/release/dmg_contents/remove_quarantine.command

# Update timestamps of copied files
find build/release/dmg_contents -type f -exec touch {} \;

# Create a ZIP file (more compatible than DMG)
echo "Creating ZIP file..."
cd build/release
zip -r ${APP_DIR_NAME}.zip dmg_contents/*
cd ../..

# Create DMG
echo "Creating DMG..."
hdiutil create -volname "$APP_NAME" -srcfolder build/release/dmg_contents -ov -format UDZO build/release/${APP_DIR_NAME}.dmg

# Clean up temporary directory
rm -rf build/release/dmg_contents

echo "Build completed successfully at $(date)!"
echo "Development build: build/${APP_NAME}.app"
echo "Release build: build/release/${APP_DIR_NAME}.app"
echo "DMG file: build/release/${APP_DIR_NAME}.dmg"
echo "ZIP file: build/release/${APP_DIR_NAME}.zip"
echo
echo "File timestamps:"
ls -la build/${APP_NAME}.app/Contents/MacOS/ 2>/dev/null || echo "Development build not found with expected name"
ls -la build/release/${APP_DIR_NAME}.app/Contents/MacOS/
echo
echo "IMPORTANT: To open on other Macs, instruct users to:"
echo "1. Right-click the app and select 'Open'"
echo "2. Click 'Open' when prompted about the app being from an unidentified developer"
echo "3. Or go to System Preferences > Security & Privacy and click 'Open Anyway'"
