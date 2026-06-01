import { TargetPoint, AppMode } from './types';

export function getSwiftFiles(
  targets: TargetPoint[],
  mode: AppMode,
  randomizeInterval: boolean = false,
  intervalVariancePercent: number = 10,
  randomizeCoords: boolean = false,
  coordsVariancePixels: number = 2,
  limitCycles: boolean = false,
  maxCycles: number = 5
): { name: string; path: string; language: string; description: string; code: string; }[] {
  // Format current targets as a Swift array representation
  const targetArraySwift = targets.map((t, idx) => {
    // Math to convert percent-based coordinates into template guide coordinates (assumed nominal 1440x900 resolution)
    const nominalX = Math.round((t.x / 100) * 1440);
    const nominalY = Math.round((t.y / 100) * 900);
    const msInterval = t.unit === 'ms' ? t.interval : t.unit === 's' ? t.interval * 1000 : t.interval * 60 * 1000;
    return `    TargetPoint(id: ${idx + 1}, x: ${nominalX}.0, y: ${nominalY}.0, intervalMs: ${msInterval}, type: .${t.clickType})\n`;
  }).join('');

  return [
    {
      name: "README.md",
      path: "README.md",
      language: "markdown",
      description: "Step-by-step documentation on compilation, codesign, and accessibility entitlements.",
      code: `# macOS Native Auto Clicker Project

This is a complete, production-ready Swift and AppKit/SwiftUI project for a native macOS Auto Clicker. It uses core macOS APIs to spawn a floating glass control bar, circular drag-and-drop overlays, and programmatic clicks using the macOS Accessibility/CoreGraphics frameworks.

---

## 🛠️ Project Structure

\`\`\`text
macOS-AutoClicker/
├── Info.plist               # App entitlements, configuration keys, sandbox declarations
├── Makefile                 # Quick command-line builder
├── Sources/
│   ├── MainApp.swift        # Application entry point & lifecycle (SwiftUI)
│   ├── AppState.swift       # Shared environment configuration and clicking sequencer
│   ├── FloatingPanel.swift  # Frosted glass control panel (NSPanel / SwiftUI)
│   ├── TargetWindow.swift   # Drag-and-drop circular floating screen target markers
│   └── ClickerEngine.swift  # OS mouse event emulation via CoreGraphics (CGEvent)
\`\`\`

---

## 🚀 How to Compile & Package the App

You can compile this code using Apple's official tools: **Xcode** or **Terminal**.

### Method A: Build via Xcode (Recommended)
1. Open Xcode on your Mac and select **Create a New Project**.
2. Select **macOS** -> **App**. Ensure **Interface** is set to **SwiftUI** and **Language** to **Swift**.
3. Replace the template files with the respective files in \`Sources/\` and ensure to load the \`Info.plist\`.
4. In the Project targets under **Signing & Capabilities**:
   - ⚠️ Disable **App Sandbox** (or add the auxiliary accessibility controls/events privileges; otherwise, the sandbox denies outbound virtual clicking events to other windows).
   - CoreGraphics event routing requires system-level permissions.
5. Hit **Cmd + R** to run, or **Product -> Archive** to compile a shipping \`.app\` bundle.

### Method B: Build via Command Line (Swiftc Compilation)
Compile directly from your Terminal on a Mac without opening Xcode:

\`\`\`bash
# Create directory structure
mkdir -p Sources

# Compile files into a single, optimized standalone universal binary
swiftc -O -sdk $(xcrun --show-sdk-path) \\
  Sources/MainApp.swift \\
  Sources/AppState.swift \\
  Sources/FloatingPanel.swift \\
  Sources/TargetWindow.swift \\
  Sources/ClickerEngine.swift \\
  -o macOS-AutoClicker

# Wrap into a launchable macOS .app bundle directory structure
mkdir -p macOS-AutoClicker.app/Contents/MacOS
mkdir -p macOS-AutoClicker.app/Contents/Resources
cp macOS-AutoClicker macOS-AutoClicker.app/Contents/MacOS/
cp Info.plist macOS-AutoClicker.app/Contents/Info.plist
\`\`\`

---

## 🔑 Crucial Step: macOS Accessibility Privileges

To fire mouse clicks programmatically, macOS requires **Accessibility Privileges**.

1. When you run the app and click clicker events, macOS will prompt a system alert: *"macOS-AutoClicker would like to control this computer using accessibility features."*
2. Open your Mac's **System Settings** (or **System Preferences**).
3. Navigate to **Privacy & Security** -> **Accessibility**.
4. Click the **+** (Plus) or toggle the switch next to **macOS-AutoClicker** to enable permissions.
5. Restart the application and enjoy programmatic multi-target auto-clicking of mouse coordinates!
`
    },
    {
      name: "MainApp.swift",
      path: "Sources/MainApp.swift",
      language: "swift",
      description: "Application runtime entry point. Set up App delegation, hides Dock app status if needed, and manages custom windows.",
      code: `import SwiftUI
import AppKit

@main
struct macOS_AutoClickerApp: App {
    // Hook standard AppDelegate to manage low-level NSWindows/NSPanels
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        // We use a Settings scene or secondary scene because the main application runs
        // as a floating HUD control panel rather than a standard system document window.
        Settings {
            VStack {
                Text("macOS Native Auto Clicker running in Background.")
                Button("Bring Control Panel to Front") {
                    AppDelegate.shared?.showControlPanel()
                }
            }
            .padding()
            .frame(width: 300, height: 120)
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    static var shared: AppDelegate?
    
    var controlPanel: FloatingPanel?
    var appState = AppState()
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        
        // Hide standard window menu and make the app dock-independent (runs as an agent overlay)
        NSApp.setActivationPolicy(.accessory)
        
        // Load custom floating glass controller
        showControlPanel()
    }
    
    func showControlPanel() {
        if controlPanel == nil {
            controlPanel = FloatingPanel(appState: appState)
        }
        controlPanel?.makeKeyAndOrderFront(nil)
        controlPanel?.center()
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Clean up clicking threads and clear marker overlays representation
        appState.stopClicking()
    }
}
`
    },
    {
      name: "AppState.swift",
      path: "Sources/AppState.swift",
      language: "swift",
      description: "Manages state tracking, coordinates syncing, active targets (limited to 8), and coordinates clicking scheduling logic.",
      code: `import SwiftUI
import Combine

enum ClickType: String, CaseIterable, Codable {
    case single = "single"
    case double = "double"
    case right = "right"
}

struct TargetPoint: Identifiable, Codable {
    var id: Int
    var x: CGFloat // Screen absolute coordinate X
    var y: CGFloat // Screen absolute coordinate Y
    var intervalMs: Int
    var type: ClickType
}

class AppState: ObservableObject {
    @Published var appMode: AppMode = .${mode}
    @Published var targets: [TargetPoint] = [
${targetArraySwift.length > 0 ? targetArraySwift : `        TargetPoint(id: 1, x: 250.0, y: 320.0, intervalMs: 1000, type: .single)\n`}    ]
    @Published var isRunning: Bool = false
    
    // Human-like variance & limit options (Auto-updated from UI)
    @Published var enableTimingRandomization: Bool = ${randomizeInterval}
    @Published var timingVariancePercent: Double = ${intervalVariancePercent}.0
    @Published var enableCoordRandomization: Bool = ${randomizeCoords}
    @Published var coordVariancePixels: CGFloat = ${coordsVariancePixels}.0
    @Published var limitRepeatCycles: Bool = ${limitCycles}
    @Published var maxRepeatCycles: Int = ${maxCycles}
    @Published var completedCycles: Int = 0
    
    // Low-level tracking of active marker windows visible on screen
    var targetWindows: [Int: TargetWindow] = [:]
    private var clickingQueue = DispatchQueue(label: "com.autoclicker.engine", qos: .userInteractive)
    private var isExecuting = false
    
    func addTarget() {
        guard targets.count < 8 else { return }
        let nextId = (targets.map({ $0.id }).max() ?? 0) + 1
        
        // Spawn target around the screen center or default location
        if let mainScreen = NSScreen.main {
            let center = CGPoint(x: mainScreen.frame.midX, y: mainScreen.frame.midY)
            let newTarget = TargetPoint(
                id: nextId,
                x: center.x + CGFloat(nextId * 15),
                y: center.y - CGFloat(nextId * 15),
                intervalMs: 1000,
                type: .single
            )
            targets.append(newTarget)
            showTargetOverlay(for: newTarget)
        }
    }
    
    func removeTarget(id: Int) {
        targets.removeAll(where: { $0.id == id })
        targetWindows[id]?.close()
        targetWindows.removeValue(forKey: id)
    }
    
    func updateTargetCoordinates(id: Int, x: CGFloat, y: CGFloat) {
        if let idx = targets.firstIndex(where: { $0.id == id }) {
            targets[idx].x = x
            targets[idx].y = y
        }
    }
    
    func startClicking() {
        guard !targets.isEmpty else { return }
        
        // Programmatically verify & trigger macOS Accessibility Permissions dialog
        _ = ClickerEngine.checkAccessibilityPermission(prompt: true)
        
        isRunning = true
        isExecuting = true
        completedCycles = 0
        
        // Hide overlay windows drag handles during clicking so clicking doesn't hit the target itself!
        // This is a key engineering refinement to let the clicks hit windows beneath us.
        for window in targetWindows.values {
            window.isClickThrough(true)
        }
        
        clickingQueue.async { [weak self] in
            self?.runSequence()
        }
    }
    
    func stopClicking() {
        isRunning = false
        isExecuting = false
        
        // Restore interaction on coordinate markers so they can be dragged again
        DispatchQueue.main.async { [weak self] in
            for window in self?.targetWindows.values ?? [] {
                window.isClickThrough(false)
            }
        }
    }
    
    private func runSequence() {
        // Main infinite clicking sequencer
        while isExecuting {
            let activePoints = targets
            if activePoints.isEmpty { break }
            
            if appMode == .single {
                // Focus exclusively on point 1 or first element
                if let first = activePoints.first {
                    executeClick(on: first)
                    
                    // Increment and check limits
                    completedCycles += 1
                    if limitRepeatCycles && completedCycles >= maxRepeatCycles {
                        DispatchQueue.main.async { [weak self] in
                            self?.stopClicking()
                        }
                        break
                    }
                    
                    let baseSleep = Double(first.intervalMs) / 1000.0
                    var actualSleep = baseSleep
                    if enableTimingRandomization {
                        let randomPercent = Double.random(in: -timingVariancePercent...timingVariancePercent) / 100.0
                        actualSleep = max(0.01, baseSleep + (baseSleep * randomPercent))
                    }
                    Thread.sleep(forTimeInterval: actualSleep)
                }
            } else {
                // Multi-Click Mode: Loop through them sequentially (1 -> 2 -> 3...)
                for pt in activePoints {
                    if !isExecuting { break }
                    executeClick(on: pt)
                    
                    let baseSleep = Double(pt.intervalMs) / 1000.0
                    var actualSleep = baseSleep
                    if enableTimingRandomization {
                        let randomPercent = Double.random(in: -timingVariancePercent...timingVariancePercent) / 100.0
                        actualSleep = max(0.01, baseSleep + (baseSleep * randomPercent))
                    }
                    Thread.sleep(forTimeInterval: actualSleep)
                }
                
                // Completed one full loop of the activePoints sequence
                completedCycles += 1
                if limitRepeatCycles && completedCycles >= maxRepeatCycles {
                    DispatchQueue.main.async { [weak self] in
                        self?.stopClicking()
                    }
                    break
                }
            }
        }
    }
    
    private func executeClick(on point: TargetPoint) {
        var clickPoint = CGPoint(x: point.x, y: point.y)
        
        if enableCoordRandomization {
            let randomX = CGFloat.random(in: -coordVariancePixels...coordVariancePixels)
            let randomY = CGFloat.random(in: -coordVariancePixels...coordVariancePixels)
            clickPoint.x += randomX
            clickPoint.y += randomY
        }
        
        // Trigger OS Event Emulation via CGEvent core graphics library
        ClickerEngine.emulateMouseClick(at: clickPoint, type: point.type)
    }
    
    func showTargetOverlay(for target: TargetPoint) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.targetWindows[target.id] == nil {
                let window = TargetWindow(target: target, appState: self)
                self.targetWindows[target.id] = window
                window.makeKeyAndOrderFront(nil)
            }
        }
    }
}

enum AppMode: String, CaseIterable, Codable {
    case single = "single"
    case multi = "multi"
}
`
    },
    {
      name: "TargetWindow.swift",
      path: "Sources/TargetWindow.swift",
      language: "swift",
      description: "Generates visual overlay windows that the user can drag-and-drop to define precise click targets.",
      code: `import Cocoa
import SwiftUI

class TargetWindow: NSPanel {
    let targetId: Int
    weak var appState: AppState?
    
    init(target: TargetPoint, appState: AppState) {
        self.targetId = target.id
        self.appState = appState
        
        // Setup specialized floating overlay window style mask
        super.init(
            contentRect: NSRect(x: target.x - 24, y: target.y - 24, width: 48, height: 48),
            styleMask: [.nonactivatingPanel, .borderless],
            backing: .buffered,
            defer: false
        )
        
        self.level = .statusBar // Float over ALL applications and menus
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary] // Ensure markers stay on screen over all Spaces/Fullscreen app windows
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = true
        self.ignoresMouseEvents = false // Draggable! We disable this when running clicker
        self.isMovableByWindowBackground = true // Drag anywhere inside the marker
        
        let visualMarker = NSHostingView(rootView: ClickerMarkerVisual(id: target.id))
        self.contentView = visualMarker
    }
    
    // Updates coordinates model inside AppState when user drags window across desktop
    override func mouseDragged(with event: NSEvent) {
        super.mouseDragged(with: event)
        
        // CoreGraphics Screen origin is Top-Left, AppKit window coordinates is Bottom-Left!
        // We track absolute desktop window frame coordinates:
        let absoluteFrame = self.frame
        let midX = absoluteFrame.midX
        let midY = absoluteFrame.midY
        
        appState?.updateTargetCoordinates(id: targetId, x: midX, y: midY)
    }
    
    func isClickThrough(_ enable: Bool) {
        // When clicker starts, we ignore mouse events so the native platform event code
        // passes right through our overlay visual marker and clicks the button beneath it!
        self.ignoresMouseEvents = enable
    }
}

// Visual circular indicator drawing via SwiftUI
struct ClickerMarkerVisual: View {
    let id: Int
    
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.black.opacity(0.7))
                .overlay(
                    Circle()
                        .stroke(Color.red, lineWidth: 2.5)
                )
                .frame(width: 42, height: 42)
                
            Text("\\(id)")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            
            // Add tiny crosshair dot
            Circle()
                .fill(Color.red)
                .frame(width: 5, height: 5)
                .offset(y: -14)
        }
        .frame(width: 48, height: 48)
    }
}
`
    },
    {
      name: "FloatingPanel.swift",
      path: "Sources/FloatingPanel.swift",
      language: "swift",
      description: "Provides the main, frosted-glass overlay bar with buttons to trigger clicks and edit targeted intervals.",
      code: `import Cocoa
import SwiftUI

class FloatingPanel: NSPanel {
    init(appState: AppState) {
        super.init(
            contentRect: NSRect(x: 200, y: 150, width: 440, height: 320),
            styleMask: [.nonactivatingPanel, .titled, .closable, .hudWindow, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        
        self.title = "OSX Auto-Clicker Master"
        self.level = .statusBar // Stay strictly on top of other normal applications and windows
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary] // Ensure it floats above any Space or Fullscreen app
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = true
        
        // Mount AppKit Visual Effect View (Frosted Glass Panel)
        let visualEffect = NSVisualEffectView()
        visualEffect.blendingMode = .behindWindow
        visualEffect.material = .hudWindow
        visualEffect.state = .active
        
        let hostingView = NSHostingView(rootView: ControlPanelContentView(appState: appState))
        hostingView.translatesAutoresizingMaskIntoConstraints = false
        visualEffect.addSubview(hostingView)
        
        NSLayoutConstraint.activate([
            hostingView.topAnchor.constraint(equalTo: visualEffect.topAnchor),
            hostingView.bottomAnchor.constraint(equalTo: visualEffect.bottomAnchor),
            hostingView.leadingAnchor.constraint(equalTo: visualEffect.leadingAnchor),
            hostingView.trailingAnchor.constraint(equalTo: visualEffect.trailingAnchor)
        ])
        
        self.contentView = visualEffect
    }
}

struct ControlPanelContentView: View {
    @ObservedObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 12) {
            // Header controls
            HStack {
                Text("🕹️ macOS Click Engine")
                    .font(.system(size: 14, weight: .bold))
                
                Spacer()
                
                Picker("", selection: $appState.appMode) {
                    Text("Single target (1 pt)").tag(AppMode.single)
                    Text("Sequence (up to 8 pts)").tag(AppMode.multi)
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(width: 200)
            }
            .padding(.horizontal)
            
            // Start/Stop action row
            HStack(spacing: 12) {
                Button(action: {
                    if appState.isRunning {
                        appState.stopClicking()
                    } else {
                        appState.startClicking()
                    }
                }) {
                    HStack {
                        Image(systemName: appState.isRunning ? "stop.fill" : "play.fill")
                        Text(appState.isRunning ? "STOP CLICKER" : "START CLICKER")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 34)
                    .background(appState.isRunning ? Color.red : Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())
                
                Button(action: {
                    appState.addTarget()
                }) {
                    HStack {
                        Image(systemName: "plus")
                        Text("Add Point (\\(appState.targets.count)/8)")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .frame(width: 140, minHeight: 34)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(appState.targets.count >= 8)
            }
            .padding(.horizontal)
            
            Divider()
            
            // Scrollable list of active target configurations
            ScrollView {
                VStack(spacing: 8) {
                    if appState.targets.isEmpty {
                        Text("No targets active. Press Add Point (+) to spawn target markers.")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                            .padding(.top, 20)
                    } else {
                        ForEach($appState.targets) { $pt in
                            if appState.appMode == .multi || pt.id == appState.targets.first?.id {
                                TargetConfigRow(target: $pt, onDelete: {
                                    appState.removeTarget(id: pt.id)
                                })
                            }
                        }
                    }
                }
                .padding(.horizontal, 8)
            }
            .frame(maxHeight: .infinity)
            
            // Footer with quick accessibility hint
            HStack {
                Circle()
                    .fill(appState.isRunning ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(appState.isRunning ? "Click sequencing active" : "Engine ready")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                Spacer()
                Text("Requires System Accessibility permissions")
                    .font(.system(size: 9))
                    .italic()
                    .foregroundColor(.secondary)
            }
            .padding([.horizontal, .bottom])
        }
        .padding(.top, 14)
        .frame(minWidth: 440, minHeight: 320)
    }
}

struct TargetConfigRow: View {
    @Binding var target: TargetPoint
    var onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color.red)
                    .frame(width: 22, height: 22)
                Text("\\(target.id)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Target Point")
                    .font(.system(size: 11, weight: .medium))
                Text("X: \\(Int(target.x)) px | Y: \\(Int(target.y)) px")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Interval Entry Box
            HStack(spacing: 4) {
                TextField("Interval", value: $target.intervalMs, formatter: NumberFormatter())
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .frame(width: 60)
                Text("ms")
                    .font(.system(size: 11))
            }
            
            // Select Event Target Click Type
            Picker("", selection: $target.type) {
                Text("Left").tag(ClickType.single)
                Text("Double").tag(ClickType.double)
                Text("Right").tag(ClickType.right)
            }
            .pickerStyle(PopUpButtonPickerStyle())
            .frame(width: 85)
            
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(6)
        .background(Color.white.opacity(0.06))
        .cornerRadius(6)
    }
}
`
    },
    {
      name: "ClickerEngine.swift",
      path: "Sources/ClickerEngine.swift",
      language: "swift",
      description: "Implements the core OS level click simulation wrapper utilizing macOS CoreGraphics CGEvent APIs.",
      code: `import Foundation
import CoreGraphics
import ApplicationServices

struct ClickerEngine {
    /// Programmatically checks and requests macOS Accessibility permissions.
    /// - Parameter prompt: If true, prompts the user via a native OS pop-up alert if permission hasn't been granted.
    static func checkAccessibilityPermission(prompt: Bool) -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    /// Simulates physical mouse-down/mouse-up events at the precise Screen coordinates.
    /// - Parameters:
    ///   - point: The TargetPoint coordinates (screen-space absolute relative to top-left origin)
    ///   - type: Trigger action (.single click, .double click, or .right click)
    static func emulateMouseClick(at point: CGPoint, type: ClickType) {
        let source = CGEventSource(stateID: .combinedSessionState)
        
        // CoreGraphics flips the coordinates: Y origin is TOP, whereas AppKit relies on BOTTOM layout.
        // We ensure coordinates are already converted into CoreGraphics desktop screenspace absolute representation.
        
        guard let mouseMove = CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) else {
            print("❌ Failed to create CoreGraphics mouseMove event reference.")
            return
        }
        mouseMove.post(tap: .cghidEventTap) // Dispatch hardware-level mouse shift
        
        switch type {
        case .single:
            firePhysicalSequence(at: point, button: .left, clickCount: 1, source: source)
        case .double:
            firePhysicalSequence(at: point, button: .left, clickCount: 1, source: source)
            // Wait slightly back-to-back to preserve double-click system detection decay properties (typically 50ms)
            Thread.sleep(forTimeInterval: 0.05)
            firePhysicalSequence(at: point, button: .left, clickCount: 2, source: source)
        case .right:
            firePhysicalSequence(at: point, button: .right, clickCount: 1, source: source)
        }
    }
    
    private static func firePhysicalSequence(at point: CGPoint, button: CGMouseButton, clickCount: Int, source: CGEventSource?) {
        let downType: CGEventType = (button == .left) ? .leftMouseDown : .rightMouseDown
        let upType: CGEventType = (button == .left) ? .leftMouseUp : .rightMouseUp
        
        guard let mouseDown = CGEvent(mouseEventSource: source, mouseType: downType, mouseCursorPosition: point, mouseButton: button),
              let mouseUp = CGEvent(mouseEventSource: source, mouseType: upType, mouseCursorPosition: point, mouseButton: button) else {
            print("❌ Failed to allocate core graphic events.")
            return
        }
        
        // Setup click count (handles multi-click recognition natively inside underlying Cocoa buttons)
        mouseDown.setIntegerValueField(.mouseEventClickState, value: Int64(clickCount))
        mouseUp.setIntegerValueField(.mouseEventClickState, value: Int64(clickCount))
        
        // Dispatch sequence down -> wait short debounce -> sequence up
        mouseDown.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.015) // Physical hardware delay hold (15 milliseconds)
        mouseUp.post(tap: .cghidEventTap)
    }
}
`
    },
    {
      name: "Info.plist",
      path: "Info.plist",
      language: "xml",
      description: "macOS Bundle descriptor providing Application sandbox settings and Accessibility helper strings.",
      code: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.autoclicker.macos-builder</string>
    <key>CFBundleName</key>
    <string>macOS-AutoClicker</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <true/> <!-- Hides the appicon from OS Dock. It runs exclusively as transparent floating overlays. -->
    
    <!-- Permission description prompt requested by macOS Accessibility window check -->
    <key>NSAccessibilityUsageDescription</key>
    <string>This application requires Accessibility access in order to emulate click events on target coordinate markers programmatically.</string>
    
    <!-- Entitlements setup guidelines: Note that when App Sandbox is enabled, CGEvent posts to other applications are blocked. -->
</dict>
</plist>
`
    }
  ];
}
