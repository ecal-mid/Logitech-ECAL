import Cocoa
import SwiftUI
import Foundation
import Network

// MARK: - Main App
@main
struct HIDEventDispatcherApp: App {
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

    // State variables
    var isBlocking = false
    var blockDeviceID = 0
    var logMessages: [String] = []
    var moveRateLimit: Int = 0 // 0 means no limit
    
    // OSC support
    var oscSender = OSCMessageSender()
    var oscEnabled = false
    var oscHost = "127.0.0.1"
    var oscPort: UInt16 = 8000
    var oscAddressPrefix = "/hid/"  // Prefix for OSC messages
    var oscBlockedOnly = true  // Whether to send only blocked events (true) or all events (false)
    
    // OSC event category filters
    var oscSendButtons = true     // Mouse button events (down/up)
    var oscSendScrollWheel = true // Scroll wheel events
    var oscSendMove = true       // Mouse movement events
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Set up the status bar item
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
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Clean up the event tap
        if let eventTap = eventTap {
            CGEvent.tapEnable(tap: eventTap, enable: false)
        }
    }
    
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "cursorarrow", accessibilityDescription: "HID Event Dispatcher")
            button.action = #selector(toggleWindow(_:))
        }
        
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Show Window", action: #selector(toggleWindow(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Toggle Blocking", action: #selector(toggleBlocking(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        
        // Add permission request menu item
        let permissionItem = NSMenuItem(title: "Request Accessibility Permissions", action: #selector(requestPermissions(_:)), keyEquivalent: "")
        menu.addItem(permissionItem)
        
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
    }
    
    @objc func toggleWindow(_ sender: Any?) {
        if let window = NSApplication.shared.windows.first {
            if window.isVisible {
                window.orderOut(nil)
            } else {
                window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
    }
    
    @objc func toggleBlocking(_ sender: Any?) {
        isBlocking = !isBlocking
        addLogMessage("EVENT PROPAGATION BLOCKING: \(isBlocking ? "ON" : "OFF")")
        addLogMessage("AFFECTED DEVICES: \(isBlocking ? "deviceID \(blockDeviceID) only" : "none")")
        
        // Notify observers
        NotificationCenter.default.post(name: NSNotification.Name("BlockingToggled"), object: nil)
    }
    
    @objc func requestPermissions(_ sender: Any?) {
        addLogMessage("Requesting accessibility permissions...")
        
        let alert = NSAlert()
        alert.messageText = "Accessibility Permissions Required"
        alert.informativeText = "This application needs accessibility permissions to monitor and block input events. You will now be prompted to grant these permissions.\n\nIf the prompt doesn't appear, please go to System Preferences > Security & Privacy > Privacy > Accessibility and add this application manually."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Continue")
        alert.runModal()
        
        // Now prompt for permissions
        let checkOptPrompt = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as NSString
        let options = [checkOptPrompt: true] as CFDictionary
        let _ = AXIsProcessTrustedWithOptions(options)
        
        // Schedule a check to see if permissions were granted
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if AXIsProcessTrusted() {
                self.addLogMessage("✅ Accessibility permissions are now granted.")
                if self.eventTap == nil {
                    self.setupEventTap() // Re-setup the event tap now that we have permissions
                }
            } else {
                self.addLogMessage("⚠️ Accessibility permissions not granted. Please try again or add manually.")
            }
        }
    }
    
    func toggleOSC(_ enabled: Bool) {
        oscEnabled = enabled
        oscSender.isEnabled = enabled
        addLogMessage("OSC OUTPUT: \(enabled ? "ON" : "OFF")")
        if enabled {
            addLogMessage("OSC TARGET: \(oscHost):\(oscPort)")
            addLogMessage("OSC SEND BLOCKED EVENTS ONLY: \(oscBlockedOnly ? "YES" : "NO")")
            oscSender.setup(host: oscHost, port: oscPort)
        }
        
        // Notify observers
        NotificationCenter.default.post(name: NSNotification.Name("OSCToggled"), object: nil)
    }
    
    func toggleOSCBlockedOnly(_ enabled: Bool) {
        oscBlockedOnly = enabled
        addLogMessage("OSC SEND BLOCKED EVENTS ONLY: \(enabled ? "YES" : "NO")")
        
        // Notify observers
        NotificationCenter.default.post(name: NSNotification.Name("OSCSettingsChanged"), object: nil)
    }
    
    func updateOSCEventFilters(buttons: Bool, scrollWheel: Bool, move: Bool) {
        oscSendButtons = buttons
        oscSendScrollWheel = scrollWheel
        oscSendMove = move
        
        addLogMessage("OSC EVENT FILTERS UPDATED:")
        addLogMessage("  - BUTTONS: \(buttons ? "ENABLED" : "DISABLED")")
        addLogMessage("  - SCROLL WHEEL: \(scrollWheel ? "ENABLED" : "DISABLED")")
        addLogMessage("  - MOUSE MOVE: \(move ? "ENABLED" : "DISABLED")")
        
        // Notify observers
        NotificationCenter.default.post(name: NSNotification.Name("OSCEventFiltersChanged"), object: nil)
    }
    
    func updateOSCSettings(host: String, port: UInt16, prefix: String) {
        oscHost = host
        oscPort = port
        oscAddressPrefix = prefix.hasPrefix("/") ? prefix : "/" + prefix
        if !oscAddressPrefix.hasSuffix("/") {
            oscAddressPrefix += "/"
        }
        oscSender.setup(host: host, port: port)
        addLogMessage("OSC TARGET UPDATED: \(host):\(port)")
        addLogMessage("OSC ADDRESS PREFIX: \(oscAddressPrefix)")
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
            alert.informativeText = "This application needs accessibility permissions to monitor and block input events. You will now be prompted to grant these permissions.\n\nIf the prompt doesn't appear, please go to System Preferences > Security & Privacy > Privacy > Accessibility and add this application manually."
            alert.alertStyle = .warning
            alert.addButton(withTitle: "Continue")
            alert.runModal()
            
            // Now prompt for permissions
            let checkOptPrompt = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as NSString
            let options = [checkOptPrompt: true] as CFDictionary
            let _ = AXIsProcessTrustedWithOptions(options)
            
            // Add log messages
            self.addLogMessage("⚠️ Accessibility permissions requested.")
            self.addLogMessage("This application will not be able to monitor HID events until permissions are granted.")
            self.addLogMessage("Go to System Preferences > Security & Privacy > Privacy > Accessibility")
            self.addLogMessage("and add this application to the list of allowed apps.")
        }
    }
    
    func setupEventTap() {
        // Define the event mask for all mouse events
        let eventMask = (1 << CGEventType.leftMouseDown.rawValue) |
                       (1 << CGEventType.leftMouseUp.rawValue) |
                       (1 << CGEventType.leftMouseDragged.rawValue) |
                       (1 << CGEventType.rightMouseDown.rawValue) |
                       (1 << CGEventType.rightMouseUp.rawValue) |
                       (1 << CGEventType.rightMouseDragged.rawValue) |
                       (1 << CGEventType.otherMouseDown.rawValue) |
                       (1 << CGEventType.otherMouseUp.rawValue) |
                       (1 << CGEventType.otherMouseDragged.rawValue) |
                       (1 << CGEventType.mouseMoved.rawValue) |
                       (1 << CGEventType.scrollWheel.rawValue)

        // Create a callback function for the event tap
        let callback: CGEventTapCallBack = { (proxy, type, cgEvent, refcon) -> Unmanaged<CGEvent>? in
            let appDelegate = Unmanaged<AppDelegate>.fromOpaque(refcon!).takeUnretainedValue()
            
            // Convert CGEvent to NSEvent to get the deviceID
            if let nsEvent = NSEvent(cgEvent: cgEvent) {
                // Get event type name in a consistent format
                var typeName = "UNKNOWN"
                switch nsEvent.type {
                case .leftMouseDown: typeName = "LEFT_DOWN"
                case .leftMouseUp: typeName = "LEFT_UP"
                case .leftMouseDragged: typeName = "LEFT_DRAG"
                case .rightMouseDown: typeName = "RIGHT_DOWN"
                case .rightMouseUp: typeName = "RIGHT_UP"
                case .rightMouseDragged: typeName = "RIGHT_DRAG"
                case .otherMouseDown: 
                    // Button 2 is middle button on macOS
                    if nsEvent.buttonNumber == 2 {
                        typeName = "MIDDLE_DOWN"
                    } else {
                        typeName = "BUTTON\(nsEvent.buttonNumber)_DOWN"
                    }
                case .otherMouseUp: 
                    // Button 2 is middle button on macOS
                    if nsEvent.buttonNumber == 2 {
                        typeName = "MIDDLE_UP"
                    } else {
                        typeName = "BUTTON\(nsEvent.buttonNumber)_UP"
                    }
                case .otherMouseDragged: typeName = "MIDDLE_DRAG"
                case .mouseMoved: typeName = "MOVE"
                case .scrollWheel: typeName = "SCROLL"
                default: typeName = "EVENT_\(nsEvent.type.rawValue)"
                }
                
                // Get location
                let loc = NSEvent.mouseLocation
                
                // Get device ID
                let deviceID = nsEvent.deviceID
                
                // Get additional values based on event type
                var additionalValues = ""
                
                switch nsEvent.type {
                case .scrollWheel:
                    additionalValues = "dx:\(nsEvent.deltaX) dy:\(nsEvent.deltaY) dz:\(nsEvent.deltaZ)"
                case .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .mouseMoved:
                    additionalValues = "dx:\(nsEvent.deltaX) dy:\(nsEvent.deltaY)"
                default:
                    additionalValues = "pressure:\(nsEvent.pressure) clicks:\(nsEvent.clickCount)"
                }
                
                // Check if this event will be blocked
                let willBlock = appDelegate.isBlocking && deviceID == appDelegate.blockDeviceID
                
                // Log the event with consistent format including all values
                let logMessage = "\(typeName) at (\(Int(loc.x)), \(Int(loc.y))) deviceID:\(deviceID) \(additionalValues)\(willBlock ? " [BLOCKED]" : "")"
                
                // Add to log (on main thread)
                DispatchQueue.main.async {
                    appDelegate.addLogMessage(logMessage)
                }
                
                // Check if this event type should be sent based on filters
                var eventPassesFilter = false
                switch nsEvent.type {
                case .leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp, .otherMouseDown, .otherMouseUp:
                    eventPassesFilter = appDelegate.oscSendButtons
                case .scrollWheel:
                    eventPassesFilter = appDelegate.oscSendScrollWheel
                case .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged:
                    eventPassesFilter = appDelegate.oscSendMove
                default:
                    eventPassesFilter = true
                }
                
                // Send OSC message if enabled and (event would be blocked OR we don't want to send only blocked events) AND passes filter
                let shouldSendOSC = appDelegate.oscEnabled && (willBlock || !appDelegate.oscBlockedOnly) && eventPassesFilter
                
                if shouldSendOSC {
                    // Create OSC message based on event type
                    let address = "\(appDelegate.oscAddressPrefix)\(typeName.lowercased())"
                    print("Sending OSC message for event: \(address)")
                    
                    // Create a safe copy of the values for OSC
                    var safeValues: [Any] = []
                    
                    // Always add deviceID as the first parameter
                    safeValues.append(deviceID)
                    
                    // Add position values
                    safeValues.append(Int(loc.x))
                    safeValues.append(Int(loc.y))
                    
                    // Add event-specific values safely
                    switch nsEvent.type {
                    case .scrollWheel:
                        safeValues.append(Float(nsEvent.deltaX))
                        safeValues.append(Float(nsEvent.deltaY))
                        safeValues.append(Float(nsEvent.deltaZ))
                    case .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .mouseMoved:
                        safeValues.append(Float(nsEvent.deltaX))
                        safeValues.append(Float(nsEvent.deltaY))
                    default:
                        safeValues.append(Float(nsEvent.pressure))
                        safeValues.append(Int(nsEvent.clickCount))
                    }
                    
                    // Add extra debug info for mouse button events
                    if address.contains("_down") || address.contains("_up") {
                        appDelegate.addLogMessage("DEBUG: Sending OSC button event: \(address) with values: \(safeValues)")
                    }
                    
                    // Send the OSC message on a background queue
                    DispatchQueue.global().async {
                        appDelegate.oscSender.sendMessage(address: address, values: safeValues)
                    }
                    
                    // Log OSC message
                    DispatchQueue.main.async {
                        let oscStatus = willBlock ? "OSC SENT (BLOCKED EVENT):" : "OSC SENT (PASSTHROUGH):"
                        appDelegate.addLogMessage("\(oscStatus) \(address) [deviceID:\(deviceID), \(safeValues.count-1) more values]")
                    }
                }
                
                // Block the event if needed
                if willBlock {
                    return nil  // Return nil to block the event
                }
            }
            
            // Pass the event through
            return Unmanaged.passRetained(cgEvent)
        }

        // Create the event tap
        eventTap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: CGEventMask(eventMask),
            callback: callback,
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        )

        // Enable the event tap if it was created successfully
        if let eventTap = eventTap {
            let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
            CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
            CGEvent.tapEnable(tap: eventTap, enable: true)
            addLogMessage("Event monitoring started successfully.")
        } else {
            addLogMessage("⚠️ Failed to create event tap. Make sure accessibility permissions are granted.")
            
            // Check if permissions are granted but tap creation still failed
            if AXIsProcessTrusted() {
                addLogMessage("⚠️ Permissions appear to be granted, but event tap creation failed.")
                addLogMessage("This might be due to a system restriction or conflict.")
                addLogMessage("Try restarting the application or your computer.")
            } else {
                addLogMessage("⚠️ Accessibility permissions are required.")
                addLogMessage("Use the 'Request Accessibility Permissions' option from the menu bar icon.")
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
        logMessages.append(logMessage)
        
        // Limit log size to prevent memory issues
        if logMessages.count > 1000 {
            logMessages.removeFirst(logMessages.count - 1000)
        }
        
        // Notify UI to update
        NotificationCenter.default.post(name: NSNotification.Name("LogUpdated"), object: nil)
    }
    
    func clearLog() {
        logMessages.removeAll()
        addLogMessage("Log cleared")
    }
    
    func updateMoveRateLimit(_ limit: Int) {
        moveRateLimit = limit
        addLogMessage("MOVE RATE LIMIT: \(limit == 0 ? "DISABLED" : "\(limit) ms")")
    }
}

// MARK: - Content View
struct ContentView: View {
    @ObservedObject var viewModel: ViewModel
    
    init(appDelegate: AppDelegate) {
        self.viewModel = ViewModel(appDelegate: appDelegate)
    }
    
    var body: some View {
        ZStack {
            // Background color that changes based on blocking state
            (viewModel.isBlocking ? Color.yellow.opacity(0.2) : Color(NSColor.windowBackgroundColor))
                .edgesIgnoringSafeArea(.all)
                .animation(.easeInOut(duration: 0.3), value: viewModel.isBlocking)
            
            VStack(spacing: 0) {
            // Header with controls
            VStack(spacing: 10) {
                HStack {
                    Text("HID Event to OSC Dispatcher")
                        .font(.title)
                        .fontWeight(.bold)
                    Spacer()
                }
                
                // Blocking controls
                HStack {
                    Toggle("Block Events Propagation of external mouse (deviceID 0)", isOn: $viewModel.isBlocking)
                        .toggleStyle(SwitchToggleStyle())
                        .onChange(of: viewModel.isBlocking) { oldValue, newValue in
                            viewModel.toggleBlocking()
                        }
                    
                    Spacer()
                }
                
                // Add vertical divider
                Divider()
                    .padding(.vertical, 5)
                
                // OSC controls
                VStack(spacing: 8) {
                    VStack(spacing: 8) {
                        HStack {
                            Toggle("Send OSC Messages", isOn: $viewModel.oscEnabled)
                                .toggleStyle(SwitchToggleStyle())
                                .onChange(of: viewModel.oscEnabled) { oldValue, newValue in
                                    viewModel.toggleOSC()
                                }
                            Spacer()
                        }
                        
                        HStack {
                            Toggle("Send OSC Messages from blocked device only", isOn: $viewModel.oscBlockedOnly)
                                .toggleStyle(SwitchToggleStyle())
                                .onChange(of: viewModel.oscBlockedOnly) { oldValue, newValue in
                                    viewModel.toggleOSCBlockedOnly()
                                }
                                .disabled(!viewModel.oscEnabled)
                                .opacity(viewModel.oscEnabled ? 1.0 : 0.6)
                            Spacer()
                        }
                    }
                    
                    // Vertical divider
                    Divider()
                        .padding(.vertical, 5)
                    
                    HStack {
                        Text("OSC Target:")
                        TextField("Host", text: $viewModel.oscHost)
                            .frame(width: 120)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
                        Text(":")
                        
                        TextField("Port", value: $viewModel.oscPort, formatter: NumberFormatter())
                            .frame(width: 60)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
                        Text("Prefix:")
                        
                        TextField("Prefix", text: $viewModel.oscAddressPrefix)
                            .frame(width: 80)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
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
                    
                    // Event category filters
                    VStack(spacing: 8) {
                        Text("Event Categories to Send via OSC:")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        HStack(spacing: 15) {
                            // Mouse Buttons filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendButtons)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendButtons) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Buttons")
                                    .font(.caption)
                            }
                            
                            // Scroll Wheel filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendScrollWheel)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendScrollWheel) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Scroll")
                                    .font(.caption)
                            }
                            
                            // Mouse Move filter
                            VStack(spacing: 4) {
                                Toggle("", isOn: $viewModel.oscSendMove)
                                    .toggleStyle(SwitchToggleStyle())
                                    .labelsHidden()
                                    .onChange(of: viewModel.oscSendMove) { oldValue, newValue in
                                        viewModel.updateOSCEventFilters()
                                    }
                                Text("Move")
                                    .font(.caption)
                            }
                            
                            Spacer()
                        }
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
                             "Status: Monitoring Mouse events" : 
                             "Status: Accessibility permissions required")
                            .font(.footnote)
                    }
                    Spacer()
                    Text("Events logged: \(viewModel.logMessages.count)")
                        .font(.footnote)
                }
                .padding(8)
                .background(viewModel.isBlocking ? Color.yellow.opacity(0.3) : Color(NSColor.windowBackgroundColor))
                .animation(.easeInOut(duration: 0.3), value: viewModel.isBlocking)
                
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
        }
    }
}

// MARK: - View Model
class ViewModel: ObservableObject {
    private var appDelegate: AppDelegate
    
    @Published var isBlocking: Bool = false
    @Published var logMessages: [String] = []
    @Published var oscEnabled: Bool = false
    @Published var oscHost: String = "127.0.0.1"
    @Published var oscPort: UInt16 = 8000
    @Published var oscAddressPrefix: String = "/hid/"
    @Published var oscBlockedOnly: Bool = true
    @Published var moveRateLimit: Int = 0
    @Published var accessibilityGranted: Bool = false
    
    // OSC event category filters
    @Published var oscSendButtons: Bool = true
    @Published var oscSendScrollWheel: Bool = true
    @Published var oscSendMove: Bool = true
    
    init(appDelegate: AppDelegate) {
        self.appDelegate = appDelegate
        
        // Initialize from app delegate
        self.isBlocking = appDelegate.isBlocking
        self.logMessages = appDelegate.logMessages
        self.oscEnabled = appDelegate.oscEnabled
        self.oscHost = appDelegate.oscHost
        self.oscPort = appDelegate.oscPort
        self.oscAddressPrefix = appDelegate.oscAddressPrefix
        self.oscBlockedOnly = appDelegate.oscBlockedOnly
        self.moveRateLimit = appDelegate.moveRateLimit
        self.accessibilityGranted = AXIsProcessTrusted()
        
        // Initialize event category filters
        self.oscSendButtons = appDelegate.oscSendButtons
        self.oscSendScrollWheel = appDelegate.oscSendScrollWheel
        self.oscSendMove = appDelegate.oscSendMove
        
        // Set up notification observer for log updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(logUpdated),
            name: NSNotification.Name("LogUpdated"),
            object: nil
        )
        
        // Set up notification observer for blocking toggle
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(blockingToggled),
            name: NSNotification.Name("BlockingToggled"),
            object: nil
        )
        
        // Set up notification observer for OSC toggle
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(oscToggled),
            name: NSNotification.Name("OSCToggled"),
            object: nil
        )
        
        // Set up notification observer for OSC settings changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(oscSettingsChanged),
            name: NSNotification.Name("OSCSettingsChanged"),
            object: nil
        )
        
        // Set up notification observer for OSC event filters changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(oscEventFiltersChanged),
            name: NSNotification.Name("OSCEventFiltersChanged"),
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
    
    @objc func blockingToggled() {
        DispatchQueue.main.async {
            self.isBlocking = self.appDelegate.isBlocking
        }
    }
    
    @objc func oscToggled() {
        DispatchQueue.main.async {
            self.oscEnabled = self.appDelegate.oscEnabled
        }
    }
    
    @objc func oscSettingsChanged() {
        DispatchQueue.main.async {
            self.oscBlockedOnly = self.appDelegate.oscBlockedOnly
        }
    }
    
    @objc func oscEventFiltersChanged() {
        DispatchQueue.main.async {
            self.oscSendButtons = self.appDelegate.oscSendButtons
            self.oscSendScrollWheel = self.appDelegate.oscSendScrollWheel
            self.oscSendMove = self.appDelegate.oscSendMove
        }
    }
    
    func toggleBlocking() {
        appDelegate.toggleBlocking(nil)
    }
    
    func toggleOSC() {
        appDelegate.toggleOSC(oscEnabled)
    }
    
    func toggleOSCBlockedOnly() {
        appDelegate.toggleOSCBlockedOnly(oscBlockedOnly)
    }
    
    func updateOSCEventFilters() {
        appDelegate.updateOSCEventFilters(buttons: oscSendButtons, scrollWheel: oscSendScrollWheel, move: oscSendMove)
    }
    
    func updateOSCSettings() {
        appDelegate.updateOSCSettings(host: oscHost, port: oscPort, prefix: oscAddressPrefix)
    }
    
    func updateMoveRateLimit() {
        appDelegate.updateMoveRateLimit(moveRateLimit)
    }
    
    func clearLog() {
        appDelegate.clearLog()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
