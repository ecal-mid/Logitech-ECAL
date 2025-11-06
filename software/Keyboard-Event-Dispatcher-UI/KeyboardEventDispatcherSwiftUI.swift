import Cocoa
import SwiftUI
import Foundation
import Network

// MARK: - Main App
@main
struct KeyboardEventDispatcherApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView(appDelegate: appDelegate)
                .frame(minWidth: 600, minHeight: 500)
        }
        .windowStyle(DefaultWindowStyle())
        .windowToolbarStyle(UnifiedWindowToolbarStyle())
    }
}

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var eventTap: CFMachPort?
    var logMessages: [String] = []
    
    // OSC settings
    var oscSender = OSCMessageSender()
    var oscEnabled = true
    var oscHost = "127.0.0.1"
    var oscPort: UInt16 = 8000
    var oscAddressPrefix = "/hid/"  // Using /hid/ prefix for consistency
    
    // OSC event category filters
    var oscSendKeyDown = true     // Key down events
    var oscSendKeyUp = true       // Key up events
    var oscSendModifiers = true   // Modifier key events (flags changed)
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        
        // Request accessibility permissions if needed
        checkAccessibilityPermissions()
        
        // Set up the event tap
        setupEventTap()
        
        // Set up a periodic permission check
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            if self.eventTap == nil {
                if AXIsProcessTrusted() {
                    self.addLogMessage("✅ Accessibility permissions detected. Setting up event monitoring.")
                    self.setupEventTap()
                }
            }
        }
        
        // Initialize OSC
        oscSender.setup(host: oscHost, port: oscPort)
        oscSender.isEnabled = true
        
        // Send test OSC message with proper format: deviceID (int), message (string), value (int)
        oscSender.sendMessage(address: "/keyboard/test", values: [0, "startup", 1])
        
        // Log startup
        addLogMessage("Keyboard Event Dispatcher started")
        addLogMessage("OSC sending to \(oscHost):\(oscPort)")
    }
    
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "keyboard", accessibilityDescription: "Keyboard Event Dispatcher")
            button.action = #selector(toggleWindow)
        }
        
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Show Window", action: #selector(toggleWindow), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Request Permissions", action: #selector(requestPermissions), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
    }
    
    @objc func toggleWindow() {
        if let window = NSApplication.shared.windows.first {
            if window.isVisible {
                window.orderOut(nil)
            } else {
                window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
    }
    
    func checkAccessibilityPermissions() {
        // First check without prompting
        let accessEnabled = AXIsProcessTrusted()
        
        if accessEnabled {
            addLogMessage("✅ Accessibility permissions are granted.")
            return
        }
        
        // If not enabled, show a dialog to guide the user and request permissions once
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Accessibility Permissions Required"
            alert.informativeText = "This application needs accessibility permissions to monitor keyboard events. You will now be prompted to grant these permissions.\n\nIf the prompt doesn't appear, please go to System Preferences > Security & Privacy > Privacy > Accessibility and add this application manually."
            alert.alertStyle = .warning
            alert.addButton(withTitle: "Continue")
            alert.runModal()
            
            // Now prompt for permissions
            let checkOptPrompt = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as NSString
            let options = [checkOptPrompt: true] as CFDictionary
            let _ = AXIsProcessTrustedWithOptions(options)
            
            // Add log messages
            self.addLogMessage("⚠️ Accessibility permissions requested.")
            self.addLogMessage("This application will not be able to monitor keyboard events until permissions are granted.")
            self.addLogMessage("Go to System Preferences > Security & Privacy > Privacy > Accessibility")
            self.addLogMessage("and add this application to the list of allowed apps.")
        }
    }
    
    @objc func requestPermissions() {
        addLogMessage("Requesting accessibility permissions...")
        
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as NSString: true] as CFDictionary
        let _ = AXIsProcessTrustedWithOptions(options)
        
        // Check again after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if AXIsProcessTrusted() {
                self.addLogMessage("✅ Accessibility permissions granted")
                self.setupEventTap()
            } else {
                self.addLogMessage("⚠️ Accessibility permissions not granted")
                self.addLogMessage("Please try again or add manually in System Preferences")
            }
        }
    }
    
    func toggleOSC(_ enabled: Bool) {
        oscEnabled = enabled
        oscSender.isEnabled = enabled
        addLogMessage("OSC output: \(enabled ? "enabled" : "disabled")")
    }
    
    func updateOSCSettings(host: String, port: UInt16, prefix: String) {
        oscHost = host
        oscPort = port
        
        // Ensure prefix starts with / and ends with /
        oscAddressPrefix = prefix
        if !oscAddressPrefix.hasPrefix("/") {
            oscAddressPrefix = "/" + oscAddressPrefix
        }
        if !oscAddressPrefix.hasSuffix("/") {
            oscAddressPrefix += "/"
        }
        
        // Update OSC sender
        oscSender.setup(host: oscHost, port: oscPort)
        addLogMessage("OSC settings updated: \(oscHost):\(oscPort)")
        addLogMessage("OSC address prefix: \(oscAddressPrefix)")
        
        // Send test message
        if oscEnabled {
            // Send with proper format: deviceID (int), message (string), port (int)
            oscSender.sendMessage(address: "\(oscAddressPrefix)settings_updated", values: [0, "settings", Int(oscPort)])
            addLogMessage("OSC test message sent: \(oscAddressPrefix)settings_updated [deviceID=0, message=settings, port=\(oscPort)]")
        }
    }
    
    func updateOSCEventFilters(keyDown: Bool, keyUp: Bool, modifiers: Bool) {
        oscSendKeyDown = keyDown
        oscSendKeyUp = keyUp
        oscSendModifiers = modifiers
        
        addLogMessage("OSC EVENT FILTERS UPDATED:")
        addLogMessage("  - KEY DOWN: \(keyDown ? "ENABLED" : "DISABLED")")
        addLogMessage("  - KEY UP: \(keyUp ? "ENABLED" : "DISABLED")")
        addLogMessage("  - MODIFIERS: \(modifiers ? "ENABLED" : "DISABLED")")
    }
    
    func setupEventTap() {
        // Check accessibility permissions
        if !AXIsProcessTrusted() {
            addLogMessage("⚠️ Accessibility permissions required")
            addLogMessage("Please grant accessibility permissions to capture keyboard events")
            requestPermissions()
            return
        }
        
        // Define event mask for keyboard events only
        let eventMask = (1 << CGEventType.keyDown.rawValue) |
                       (1 << CGEventType.keyUp.rawValue) |
                       (1 << CGEventType.flagsChanged.rawValue)
        
        addLogMessage("Setting up keyboard event tap...")
        
        // Create event tap
        let callback: CGEventTapCallBack = { (proxy, type, cgEvent, refcon) -> Unmanaged<CGEvent>? in
            guard let refcon = refcon else { return Unmanaged.passRetained(cgEvent) }
            let appDelegate = Unmanaged<AppDelegate>.fromOpaque(refcon).takeUnretainedValue()
            
            // Process the event
            appDelegate.processEvent(type: type, cgEvent: cgEvent)
            
            // Always pass the event through (listen-only mode)
            return Unmanaged.passRetained(cgEvent)
        }
        
        // Try different tap types
        let tapTypes: [(CGEventTapLocation, String)] = [
            (.cgSessionEventTap, "Session"),
            (.cghidEventTap, "HID")
        ]
        
        for (tapType, tapName) in tapTypes {
            eventTap = CGEvent.tapCreate(
                tap: tapType,
                place: .tailAppendEventTap,  // Use tail append to ensure events pass through
                options: .listenOnly,        // Listen-only to avoid blocking input
                eventsOfInterest: CGEventMask(eventMask),
                callback: callback,
                userInfo: Unmanaged.passUnretained(self).toOpaque()
            )
            
            if eventTap != nil {
                addLogMessage("✅ Successfully created \(tapName) event tap")
                break
            }
        }
        
        // Enable the event tap
        if let eventTap = eventTap {
            let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
            CGEvent.tapEnable(tap: eventTap, enable: true)
            addLogMessage("✅ Keyboard event monitoring started")
            
            // Set up periodic refresh to prevent timeout
            Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
                guard let self = self, let eventTap = self.eventTap else { return }
                CGEvent.tapEnable(tap: eventTap, enable: true)
            }
        } else {
            addLogMessage("❌ Failed to create event tap")
            addLogMessage("Please check accessibility permissions and restart the app")
        }
    }
    
    func processEvent(type: CGEventType, cgEvent: CGEvent) {
        // Get key code
        let keyCode = cgEvent.getIntegerValueField(.keyboardEventKeycode)
        
        // Get event type name
        let typeName: String
        switch type {
        case .keyDown:
            typeName = "KEY_DOWN"
        case .keyUp:
            typeName = "KEY_UP"
        case .flagsChanged:
            typeName = "FLAGS_CHANGED"
        default:
            typeName = "UNKNOWN"
        }
        
        // Get key name
        let keyName = getKeyName(keyCode: UInt16(keyCode))
        
        // Log the event
        addLogMessage("\(typeName) keyCode: \(keyCode) [\(keyName)]")
        
        // Send OSC message if enabled and event type is enabled
        if oscEnabled {
            // Check if this event type should be sent based on filters
            var eventPassesFilter = false
            switch type {
            case .keyDown:
                eventPassesFilter = oscSendKeyDown
            case .keyUp:
                eventPassesFilter = oscSendKeyUp
            case .flagsChanged:
                eventPassesFilter = oscSendModifiers
            default:
                eventPassesFilter = true
            }
            
            if eventPassesFilter {
                // Create standardized OSC message with unified format
                let address = "\(oscAddressPrefix)\(typeName.lowercased())"
                
                // Parameters: [deviceID, keyName, keyCode]
                // For this implementation we'll use deviceID=0 since we're not differentiating devices
                let deviceID = 0
                
                // Send with the correct format: deviceID (int), keyName (string), keyCode (int)
                // Make sure we're sending the values in the correct order and format
                oscSender.sendMessage(address: address, values: [Int(deviceID), keyName, Int(keyCode)])
                
                addLogMessage("OSC sent: \(address) [deviceID=\(deviceID), key=\(keyName), keyCode=\(keyCode)]")
            } else {
                addLogMessage("OSC skipped: \(typeName) events are filtered out")
            }
        }
    }
    
    func addLogMessage(_ message: String) {
        // Add timestamp
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = dateFormatter.string(from: Date())
        let logMessage = "[\(timestamp)] \(message)"
        
        // Add to log
        DispatchQueue.main.async {
            self.logMessages.append(logMessage)
            
            // Limit log size to prevent memory issues
            if self.logMessages.count > 1000 {
                self.logMessages.removeFirst(self.logMessages.count - 1000)
            }
            
            // Notify observers
            NotificationCenter.default.post(name: NSNotification.Name("LogUpdated"), object: nil)
        }
        
        // Also print to console
        print("KeyboardEventDispatcher: \(logMessage)")
    }
    
    func clearLog() {
        DispatchQueue.main.async {
            self.logMessages.removeAll()
            self.addLogMessage("Log cleared")
        }
    }
    
    func getKeyName(keyCode: UInt16) -> String {
        switch keyCode {
        case 0: return "a"
        case 1: return "s"
        case 2: return "d"
        case 3: return "f"
        case 4: return "h"
        case 5: return "g"
        case 6: return "z"
        case 7: return "x"
        case 8: return "c"
        case 9: return "v"
        case 11: return "b"
        case 12: return "q"
        case 13: return "w"
        case 14: return "e"
        case 15: return "r"
        case 16: return "y"
        case 17: return "t"
        case 18: return "1"
        case 19: return "2"
        case 20: return "3"
        case 21: return "4"
        case 22: return "6"
        case 23: return "5"
        case 24: return "="
        case 25: return "9"
        case 26: return "7"
        case 27: return "-"
        case 28: return "8"
        case 29: return "0"
        case 30: return "]"
        case 31: return "o"
        case 32: return "u"
        case 33: return "["
        case 34: return "i"
        case 35: return "p"
        case 36: return "Return"
        case 37: return "l"
        case 38: return "j"
        case 39: return "'"
        case 40: return "k"
        case 41: return ";"
        case 42: return "\\"
        case 43: return ","
        case 44: return "/"
        case 45: return "n"
        case 46: return "m"
        case 47: return "."
        case 48: return "Tab"
        case 49: return "Space"
        case 50: return "`"
        case 51: return "Delete"
        case 53: return "Escape"
        case 55: return "Command"
        case 56: return "Shift"
        case 57: return "CapsLock"
        case 58: return "Option"
        case 59: return "Control"
        case 60: return "Right Shift"
        case 61: return "Right Option"
        case 62: return "Right Control"
        case 63: return "Function"
        case 64: return "F17"
        case 65: return "."
        case 67: return "*"
        case 69: return "+"
        case 71: return "Clear"
        case 75: return "/"
        case 76: return "Enter"
        case 78: return "-"
        case 79: return "F18"
        case 80: return "F19"
        case 81: return "="
        case 82: return "0"
        case 83: return "1"
        case 84: return "2"
        case 85: return "3"
        case 86: return "4"
        case 87: return "5"
        case 88: return "6"
        case 89: return "7"
        case 91: return "8"
        case 92: return "9"
        case 96: return "F5"
        case 97: return "F6"
        case 98: return "F7"
        case 99: return "F3"
        case 100: return "F8"
        case 101: return "F9"
        case 103: return "F11"
        case 105: return "F13"
        case 106: return "F16"
        case 107: return "F14"
        case 109: return "F10"
        case 111: return "F12"
        case 113: return "F15"
        case 114: return "Help"
        case 115: return "Home"
        case 116: return "Page Up"
        case 117: return "Forward Delete"
        case 118: return "F4"
        case 119: return "End"
        case 120: return "F2"
        case 121: return "Page Down"
        case 122: return "F1"
        case 123: return "Left Arrow"
        case 124: return "Right Arrow"
        case 125: return "Down Arrow"
        case 126: return "Up Arrow"
        default: return "Key\(keyCode)"
        }
    }
}

// MARK: - Content View
struct ContentView: View {
    @ObservedObject var viewModel: ViewModel
    @State private var isFirstAppear: Bool = true
    @FocusState private var focusedField: FocusableField?
    
    enum FocusableField {
        case host, port, prefix, none
    }
    
    init(appDelegate: AppDelegate) {
        self.viewModel = ViewModel(appDelegate: appDelegate)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with controls
            VStack(spacing: 10) {
                HStack {
                    Text("Keyboard Event to OSC Dispatcher")
                        .font(.title)
                        .fontWeight(.bold)
                    Spacer()
                    
                    if !viewModel.accessibilityGranted {
                        Button(action: {
                            viewModel.requestPermissions()
                        }) {
                            Label("Request Permissions", systemImage: "lock.shield")
                        }
                        .buttonStyle(.bordered)
                    }
                }
                
                Divider()
                    .padding(.vertical, 5)
                
                // OSC controls
                VStack(spacing: 8) {
                    HStack {
                        Toggle("Send OSC Messages", isOn: $viewModel.oscEnabled)
                            .toggleStyle(SwitchToggleStyle())
                            .onChange(of: viewModel.oscEnabled) { oldValue, newValue in
                                viewModel.toggleOSC()
                            }
                        Spacer()
                    }
                    
                    Divider()
                        .padding(.vertical, 5)
                    
                    // Event category filters
                    VStack(spacing: 8) {
                        Text("Event Categories to Send via OSC:")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        HStack(spacing: 15) {
                            // Key Down filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendKeyDown)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendKeyDown) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Key Down")
                                    .font(.caption)
                            }
                            
                            // Key Up filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendKeyUp)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendKeyUp) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Key Up")
                                    .font(.caption)
                            }
                            
                            // Modifiers filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendModifiers)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendModifiers) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Modifiers")
                                    .font(.caption)
                            }
                            
                            Spacer()
                        }
                    }
                    .disabled(!viewModel.oscEnabled)
                    .opacity(viewModel.oscEnabled ? 1.0 : 0.6)
                    
                    Divider()
                        .padding(.vertical, 5)
                    
                    HStack {
                        Text("OSC Target:")
                        TextField("Host", text: $viewModel.oscHost)
                            .frame(width: 120)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focusedField, equals: .host)
                        
                        Text(":")
                        
                        TextField("Port", value: $viewModel.oscPort, formatter: NumberFormatter())
                            .frame(width: 60)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focusedField, equals: .port)
                        
                        Text("Prefix:")
                        
                        TextField("Prefix", text: $viewModel.oscAddressPrefix)
                            .frame(width: 80)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focusedField, equals: .prefix)
                        
                        Button(action: {
                            viewModel.updateOSCSettings()
                        }) {
                            Text("Apply")
                        }
                        .buttonStyle(.bordered)
                        
                        Spacer()
                    }
                    .disabled(!viewModel.oscEnabled)
                    .opacity(viewModel.oscEnabled ? 1.0 : 0.6)
                }
                
                Divider()
                    .padding(.vertical, 5)
            }
            .padding()
            
            // Log view
            VStack(spacing: 0) {
                // Log header with Clear button
                HStack {
                    Text("Event Log")
                        .font(.headline)
                    Spacer()
                    Button(action: {
                        viewModel.clearLog()
                    }) {
                        Label("Clear Log", systemImage: "trash")
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal)
                .padding(.vertical, 5)
                .background(Color(NSColor.controlBackgroundColor))
                
                Divider()
                    .padding(.bottom, 4)
                
                // Log content
                ScrollViewReader { scrollView in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 2) {
                            ForEach(viewModel.logMessages, id: \.self) { message in
                                Text(message)
                                    .font(.system(size: 11, design: .monospaced))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(viewModel.logMessages.firstIndex(of: message)! % 2 == 0 ? Color.clear : Color.gray.opacity(0.1))
                                    .id(message)
                            }
                        }
                        .onChange(of: viewModel.logMessages.count) { oldValue, newValue in
                            if let lastMessage = viewModel.logMessages.last {
                                scrollView.scrollTo(lastMessage, anchor: .bottom)
                            }
                        }
                    }
                    .background(Color(NSColor.textBackgroundColor))
                }
            }
            
            // Status bar
            VStack(spacing: 0) {
                HStack {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(viewModel.accessibilityGranted ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(viewModel.accessibilityGranted ? 
                             "Status: Monitoring keyboard events" : 
                             "Status: Accessibility permissions required")
                            .font(.footnote)
                    }
                    Spacer()
                    Text("Events logged: \(viewModel.logMessages.count)")
                        .font(.footnote)
                }
                .padding(8)
                .background(Color(NSColor.windowBackgroundColor))
                
                // Credits
                HStack {
                    Spacer()
                    Text("ECAL / Alain Bellet 2025 / V1")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                    Spacer()
                }
                .padding(.bottom, 4)
                .background(Color(NSColor.windowBackgroundColor))
            }
        }
        .onAppear {
            // Ensure no field is focused at startup
            if isFirstAppear {
                DispatchQueue.main.async {
                    focusedField = nil
                    isFirstAppear = false
                }
            }
        }
    }
}

// MARK: - View Model
class ViewModel: ObservableObject {
    private var appDelegate: AppDelegate
    
    @Published var oscEnabled: Bool = true
    @Published var oscHost: String = "127.0.0.1"
    @Published var oscPort: UInt16 = 8000
    @Published var oscAddressPrefix: String = "/hid/"
    @Published var logMessages: [String] = []
    @Published var accessibilityGranted: Bool = false
    
    // OSC event category filters
    @Published var oscSendKeyDown: Bool = true
    @Published var oscSendKeyUp: Bool = true
    @Published var oscSendModifiers: Bool = true
    
    init(appDelegate: AppDelegate) {
        self.appDelegate = appDelegate
        
        // Initialize from app delegate
        self.oscEnabled = appDelegate.oscEnabled
        self.oscHost = appDelegate.oscHost
        self.oscPort = appDelegate.oscPort
        self.oscAddressPrefix = appDelegate.oscAddressPrefix
        self.logMessages = appDelegate.logMessages
        self.accessibilityGranted = AXIsProcessTrusted()
        
        // Initialize event category filters
        self.oscSendKeyDown = appDelegate.oscSendKeyDown
        self.oscSendKeyUp = appDelegate.oscSendKeyUp
        self.oscSendModifiers = appDelegate.oscSendModifiers
        
        // Set up notification observer for log updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(logUpdated),
            name: NSNotification.Name("LogUpdated"),
            object: nil
        )
        
        // Set up a timer to check accessibility permissions
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                self?.accessibilityGranted = AXIsProcessTrusted()
            }
        }
    }
    
    @objc func logUpdated() {
        DispatchQueue.main.async {
            self.logMessages = self.appDelegate.logMessages
        }
    }
    
    func toggleOSC() {
        appDelegate.toggleOSC(oscEnabled)
    }
    
    func updateOSCSettings() {
        appDelegate.updateOSCSettings(host: oscHost, port: oscPort, prefix: oscAddressPrefix)
    }
    
    func updateOSCEventFilters() {
        appDelegate.updateOSCEventFilters(keyDown: oscSendKeyDown, keyUp: oscSendKeyUp, modifiers: oscSendModifiers)
    }
    
    func clearLog() {
        appDelegate.clearLog()
    }
    
    func requestPermissions() {
        appDelegate.requestPermissions()
    }
}
