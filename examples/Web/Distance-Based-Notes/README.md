# Distance-Based Notes

A physical-space musical instrument that creates sequences based on the distance traveled by the mouse rather than fixed positions. Notes are manually placed with left-clicks and saved with their corresponding distance from the start, allowing for precise control over the musical sequence while still maintaining the distance-based playback mechanism.

## Features

- **Distance-Based Interaction**: Works based on the actual distance traveled by your mouse
- **Simple Control Scheme**:
  - **Right-click**: Start recording mode or switch to playback mode
  - **Left-click**: Drop notes during recording mode
  - **Long Left Press**: Reset sequence and start new recording (clears all notes)
  - **Right-click + drag**: Restart the sequence (resets total distance to 0 without clearing notes)
- Notes are saved with their distance from the start point
- Base frequency automatically increases with distance, creating higher-pitched notes as you move further
- Notes automatically replay when your total movement distance passes through the same points
- Customizable replay tolerance for fine-tuning how precisely you need to match distances
- Clear list view of notes with their distances and frequencies
- WebSocket connection to receive mouse events via OSC

## How to Use

1. Connect to the WebSocket server (default: `ws://localhost:3000`)
2. Enable sound by clicking the "Sound Off" button
3. **Start Recording**: Right-click to start recording mode
4. **Drop Notes**: Move your mouse and left-click to manually place notes at desired distances
5. **Enter Playback**: Right-click again to reset distance and enter playback mode
6. **Playback**: Move your mouse - as your total distance passes previous note positions, they will replay
7. **Reset Playback**: Right-click and drag to restart playback from distance 0 (without clearing notes)
8. **New Recording**: Long press the left mouse button to clear all notes and start a new recording
9. You can use this without looking at the screen - focus on the physical movement of your mouse

## Controls

### Sound Settings

- **Note Volume**: Controls the volume of the notes
- **Distance Threshold**: Sets the scale of the distance display (for reference only, doesn't affect note placement)
- **Replay Tolerance**: Controls how close your total distance needs to be to a note's distance for it to replay (smaller values require more precise movements)
- **Musical Scale**: Choose between Pentatonic, Major, and Minor scales
- **Base Frequency**: Sets the initial base frequency for notes
- **Pitch Increment**: Controls how quickly the base frequency increases with distance (higher values create more dramatic pitch changes)

## Requirements

- A modern web browser with JavaScript enabled
- The Node HID Server running to receive OSC messages
- A Mouse Event Dispatcher sending OSC messages

## Technical Details

This example demonstrates:

- Receiving and processing OSC messages via WebSockets
- Tracking mouse movement and calculating distances traveled
- Automatically generating notes based on movement thresholds
- Using the Tone.js library for sound synthesis
- Creating a purely movement-based interaction that responds to physical distance

## Integration with Mouse Event Dispatcher

This example works with the Mouse Event Dispatcher application by:

1. Receiving `/hid/move` messages to track mouse position and calculate distances
2. Using `/hid/right_down` messages to start the sequence
3. Calculating distances between consecutive mouse positions to determine when to drop notes

## Differences from Sound Drops

While the Sound Drops example places notes at specific delta-space positions that you explicitly choose with right-clicks, this Distance-Based Notes example:

1. Automatically drops notes based on how far you've moved
2. Focuses on the magnitude of movement rather than specific positions
3. Creates a more continuous musical experience that directly maps physical effort to musical density
