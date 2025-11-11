# Sound Drops

A physical-space musical instrument that creates sequences based on mouse movement patterns rather than screen coordinates. This allows you to create and replay musical notes based purely on your physical mouse movements without needing to look at the screen.

## Features

- **Physical-Space Interaction**: Works based on mouse movement deltas, not screen coordinates
- Start a sequence with a right-click and drop notes with subsequent right-clicks
- Each note's position is saved based on accumulated mouse movement deltas
- Notes automatically replay when your mouse movement pattern passes through the same delta-space positions
- Customizable musical scales and sound parameters
- Clear list view of notes with their positions relative to the starting point (0,0)
- WebSocket connection to receive mouse events via OSC

## How to Use

1. Connect to the WebSocket server (default: `ws://localhost:3000`)
2. Enable sound by clicking the "Sound Off" button
3. Start a sequence by right-clicking anywhere (this resets the delta tracking)
4. Move your mouse in patterns and right-click to drop notes at different points in your movement
5. Recreate similar movement patterns to replay notes when passing through the same delta-space positions
6. You can use this without looking at the screen - focus on the physical movement of your mouse
7. Adjust sound parameters using the controls

## Controls

### Sound Settings

- **Note Volume**: Controls the volume of the notes
- **Movement Scaling**: Controls how much physical mouse movements are amplified (higher values make small movements cover more distance)
- **Replay Tolerance**: Controls how close you need to be to a note's position for it to replay (smaller values require more precise movements)
- **Musical Scale**: Choose between Pentatonic, Major, and Minor scales
- **Base Frequency**: Sets the base frequency for the first note in the scale

## Requirements

- A modern web browser with JavaScript enabled
- The Node HID Server running to receive OSC messages
- A Mouse Event Dispatcher sending OSC messages

## Technical Details

This example demonstrates:

- Receiving and processing OSC messages via WebSockets
- Tracking mouse movement and calculating positions in delta-space
- Generating musical notes based on scales
- Using the Tone.js library for sound synthesis
- Creating a purely movement-based interaction without relying on screen coordinates

## Integration with Mouse Event Dispatcher

This example works with the Mouse Event Dispatcher application by:

1. Receiving `/hid/move` messages to track mouse position and movement
2. Using `/hid/right_down` messages to trigger note creation
3. Calculating positions based on accumulated delta values for consistent replay
