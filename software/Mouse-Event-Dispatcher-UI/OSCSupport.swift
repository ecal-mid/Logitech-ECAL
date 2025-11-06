import Foundation
import Network
import CoreGraphics

// OSC Message Sender class to handle sending OSC messages over UDP
class OSCMessageSender {
    private var connection: NWConnection?
    private var host: NWEndpoint.Host = "127.0.0.1"
    private var port: NWEndpoint.Port = 8000
    
    var isEnabled = false
    
    func setup(host: String, port: UInt16) {
        self.host = NWEndpoint.Host(host)
        self.port = NWEndpoint.Port(rawValue: port) ?? 8000
        setupConnection()
    }   
    
    
    private func setupConnection() {
        // Close any existing connection
        connection?.cancel()
        
        // Create a new connection
        connection = NWConnection(host: host, port: port, using: .udp)
        
        // Set up the connection state handler
        connection?.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("OSC connection ready to \(self?.host ?? "unknown"):\(self?.port.rawValue ?? 0)")
            case .failed(let error):
                print("OSC connection failed: \(error)")
                self?.connection?.cancel()
                // Try to reconnect after a delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                    self?.setupConnection()
                }
            default:
                break
            }
        }
        
        // Start the connection
        connection?.start(queue: .global())
    }
    
    func sendMessage(address: String, values: [Any]) {
        guard isEnabled, let connection = connection else { return }
        
        // STEP 1: Clean the address - ensure it starts with / and has no type tag info
        var cleanAddress = address.hasPrefix("/") ? address : "/" + address
        
        // Remove any type tag information that might have been accidentally included
        if let commaIndex = cleanAddress.firstIndex(of: ",") {
            cleanAddress = String(cleanAddress[..<commaIndex])
        }
        
        //print("Clean OSC address: \(cleanAddress)")
        
        // STEP 2: Create a clean type tag string
        var typeTagString = ","
        for value in values {
            if value is Int || value is Int32 || value is Int64 {
                typeTagString.append("i")
            } else if value is Float || value is Double || value is CGFloat {
                typeTagString.append("f")
            } else if value is String {
                typeTagString.append("s")
            } else {
                typeTagString.append("f") // Default to float
            }
        }
        
        //print("Clean type tag string: \(typeTagString)")
        
        // STEP 3: Build the OSC message from scratch with careful padding
        var data = Data()
        
        // Add address with null terminator
        data.append(contentsOf: cleanAddress.utf8)
        data.append(0) // Explicit null terminator
        
        // Add padding to align to 4-byte boundary
        while data.count % 4 != 0 {
            data.append(0)
        }
        
        // Add type tag string with null terminator
        data.append(contentsOf: typeTagString.utf8)
        data.append(0) // Explicit null terminator
        
        // Add padding to align to 4-byte boundary
        while data.count % 4 != 0 {
            data.append(0)
        }
        
        // Add argument values
        for value in values {
            if let intValue = value as? Int {
                // Convert to Int32 and append in big-endian format
                let int32Value = Int32(max(Int(Int32.min), min(Int(Int32.max), intValue)))
                var bigEndianValue = int32Value.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            } else if let int32Value = value as? Int32 {
                var bigEndianValue = int32Value.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            } else if let floatValue = value as? Float {
                var bigEndianValue = floatValue.bitPattern.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            } else if let doubleValue = value as? Double {
                let floatValue = Float(doubleValue)
                var bigEndianValue = floatValue.bitPattern.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            } else if let cgFloatValue = value as? CGFloat {
                let floatValue = Float(cgFloatValue)
                var bigEndianValue = floatValue.bitPattern.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            } else if let stringValue = value as? String {
                data.append(contentsOf: stringValue.utf8)
                data.append(0) // Null terminator
                
                // Add padding to align to 4-byte boundary
                while data.count % 4 != 0 {
                    data.append(0)
                }
            } else {
                // Default: add a 0.0 float
                let zero: Float = 0.0
                var bigEndianValue = zero.bitPattern.bigEndian
                data.append(contentsOf: withUnsafeBytes(of: &bigEndianValue) { Array($0) })
            }
        }
        
        // STEP 4: Send the OSC message
        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                print("Failed to send OSC message: \(error)")
            }
        })
    }
}
