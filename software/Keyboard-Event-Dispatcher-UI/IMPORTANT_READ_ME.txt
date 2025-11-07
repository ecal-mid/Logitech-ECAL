IMPORTANT: HOW TO INSTALL KEYBOARD EVENT DISPATCHER ON MACOS
======================================================

Due to macOS security features (Gatekeeper), you need to use our installer script to properly install the app:

RECOMMENDED METHOD: USE THE INSTALLER SCRIPT
------------------------------------------
1. Open Terminal (Applications > Utilities > Terminal)
2. Drag and drop the 'install.sh' file from this folder into the Terminal window
3. Press Enter to run the script
4. Enter your password if prompted
5. The app will be installed to your Applications folder and ready to use

This is the ONLY reliable method to bypass macOS security restrictions.

ALTERNATIVE METHODS (LESS RELIABLE)
--------------------------------
Manual Terminal Command
1. Open Terminal (Applications > Utilities > Terminal)
2. Run this command, replacing the path with the actual location of the app:
   xattr -d com.apple.quarantine /path/to/KeyboardOSCDispatcher.app

ACCESSIBILITY PERMISSIONS
------------------------
After successfully opening the app, you'll need to grant it accessibility permissions:
1. The app will prompt you for these permissions
2. Go to System Preferences > Security & Privacy > Privacy > Accessibility
3. Add KeyboardOSCDispatcher to the list of allowed apps

If you continue to have issues, please contact the development team for assistance.
