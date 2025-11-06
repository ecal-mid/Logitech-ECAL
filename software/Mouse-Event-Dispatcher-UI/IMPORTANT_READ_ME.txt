IMPORTANT: HOW TO OPEN HID EVENT DISPATCHER ON MACOS
==================================================

If you see a message saying the app is damaged or can't be opened, this is due to macOS security features (Gatekeeper). Here's how to fix it:

METHOD 1: RIGHT-CLICK TO OPEN
----------------------------
1. Locate the HIDEventDispatcherUI app in Finder
2. Right-click (or Control+click) on the app
3. Select "Open" from the menu
4. Click "Open" when prompted about the app being from an unidentified developer
5. The app should now open and will be remembered as safe to open in the future

METHOD 2: SECURITY & PRIVACY SETTINGS
-----------------------------------
1. Try to open the app normally (it will be blocked)
2. Open System Preferences > Security & Privacy
3. In the General tab, look for a message about HIDEventDispatcherUI being blocked
4. Click "Open Anyway" next to this message
5. Confirm by clicking "Open" in the dialog that appears

METHOD 3: TERMINAL COMMAND (ADVANCED)
-----------------------------------
1. Open Terminal (Applications > Utilities > Terminal)
2. Run this command, replacing the path with the actual location of the app:
   xattr -d com.apple.quarantine /path/to/HIDEventDispatcherUI.app
3. Try opening the app normally

ACCESSIBILITY PERMISSIONS
------------------------
After successfully opening the app, you'll need to grant it accessibility permissions:
1. The app will prompt you for these permissions
2. Go to System Preferences > Security & Privacy > Privacy > Accessibility
3. Add HIDEventDispatcherUI to the list of allowed apps

If you continue to have issues, please contact the development team for assistance.
