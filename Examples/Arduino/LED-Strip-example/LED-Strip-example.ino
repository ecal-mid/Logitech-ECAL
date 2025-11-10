/*---------------------------------------------------------------------------------------------

  RECEIVE OSC MESSAGES FROM HID EVENTS
  NEOPIXEL STRIP EXAMPLE
  use lib OSC https://github.com/CNMAT/OSC
  WORKSHOP LOGITECH x ECAL 2025
  V1 AB/ECAL 2025

  --------------------------------------------------------------------------------------------- */

#include <WiFi.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <OSCMessage.h>
#include <OSCBundle.h>
#include <OSCData.h>
#include <Preferences.h>
#include <Adafruit_NeoPixel.h>

#define WIFI_SSID "ECALEVENT"
#define WIFI_PASS "perpetua"

// NeoPixel LED strip configuration
#define LED_PIN 13     // Pin connected to the NeoPixel strip
#define LED_COUNT 10   // Number of LEDs in the strip
#define BRIGHTNESS 100 // Brightness level (0-255)

// Create NeoPixel object
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Variables for LED control
int currentHue = 0;       // Current hue value for color wheel effect
int scrollGaugeLevel = 0; // Current gauge level (0-10)
bool gaugeMode = true;    // Toggle between gauge mode (true) and color mode (false)

WiFiUDP Udp;                         // A UDP instance to let us send and receive packets over UDP
IPAddress outIp(192, 168, 1, 14);    // remote IP of your computer (to send OSC messages)
int outPort = 8888;                  // remote port to send OSC messages
const unsigned int localPort = 8000; // local port to listen for OSC messages
bool authorisedIP = false;
IPAddress lastOutIp(10, 189, 8, 81);
char ipAsChar[15];

OSCErrorCode error;
Preferences preferences; // to save persistent data (board name)

String boardName = "Board_OSC"; // no space in the name

/* ------- Define pins and vars for button + encoder */
// Button
const int buttonPin = 9;
unsigned int buttonState = 0;
unsigned int buttonLastState = -1;

// Timing
unsigned long lastSentMillis = 0;
int sendDelayInMillis = 10000; // delay for automatically sending values to UR (not event based)

// Sensor values
int32_t value_1 = 0;

/* Server for IP table update */
HTTPClient httpclient;

void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println("");
  Serial.println("=== LED Strip Example Starting ===");

  // internal led
  pinMode(LED_BUILTIN, OUTPUT);
  // BUTTON
  pinMode(buttonPin, INPUT_PULLUP);

  // Initialize NeoPixel strip
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.show(); // Initialize all pixels to 'off'

  // Show startup animation
  startupAnimation();

  // Start Wifi and UDP
  startWifiAndUdp();
  // Publish to IP table (online)
  // https://ecal-mid.ch/esp32watcher
  updateIpTable();

  // Print initial mode
  Serial.println("Initial mode: Gauge Mode");
  Serial.println("- Right click to toggle between gauge and color modes");
  Serial.println("- Left click to reset gauge level");
  Serial.println("- Move mouse in color mode to change colors");
  Serial.println("- Scroll in gauge mode to adjust gauge level");
}

void loop()
{

  /* --------- SEND OSC MSGS */

  // BUTTON
  // read the state of the pushbutton value:
  buttonState = digitalRead(buttonPin);

  if (buttonState != buttonLastState)
  {
    outSendValues();
    buttonLastState = buttonState;
  }

  if (millis() - lastSentMillis > sendDelayInMillis)
  {
    lastSentMillis = millis();
    value_1 = value_1 + 1;
    // send values regularely
    outSendValues();
  }

  /* --------- CHECK INCOMMING OSC MSGS */
  OSCMessage msg;
  int size = Udp.parsePacket();
  if (size > 0)
  {
    while (size--)
    {
      msg.fill(Udp.read());
    }
    if (!msg.hasError())
    {
      msg.dispatch("/hid/move", inHIDMove);
      msg.dispatch("/hid/left_down", inHIDLeftDown);
      msg.dispatch("/hid/left_up", inHIDLeftUp);
      msg.dispatch("/hid/right_down", inHIDRightDown);
      msg.dispatch("/hid/right_up", inHIDRightUp);
      msg.dispatch("/hid/middle_down", inHIDMiddleDown);
      msg.dispatch("/hid/middle_up", inHIDMiddleUp);
      msg.dispatch("/hid/scroll", inHIDScroll);
    }
    else
    {
      error = msg.getError();
      Serial.print("error: ");
      Serial.println(error);
    }
  }
}

/* --------- FUNCTIONS ------------ */

/* --------- OUTGOING OSC COMMANDS FUNCTIONS ------------ */
void outSendValues()
{ // in button, encoder
  OSCMessage msg("/ESP32/state/");
  msg.add(value_1);
  msg.add(buttonState);
  Udp.beginPacket(outIp, outPort);
  msg.send(Udp);
  Udp.endPacket();
  msg.empty();
  Serial.println("message sent /ESP32/state/");
  delay(10);
}

/* --------- INCOMMING OSC COMMANDS FUNCTIONS ------------ */

void inBegin(OSCMessage &msg)
{ // no value required
  Serial.println("Begin message received");
}

void inSetValue(OSCMessage &msg)
{ // int value
  float val = msg.getFloat(0);
  Serial.print("/arduino/value: ");
  Serial.println(val * 100);
}

void inConnect(OSCMessage &msg)
{ // string value "ip:port"
  /*lastKeepAliveReceived = millis();
  clientConnected = true;
  char newIpAndPort[20];
  int str_length = msg.getString(0, newIpAndPort, 20);
  String ipAndportString = String(newIpAndPort);
  // split IP and Port
  int colonPos = ipAndportString.indexOf(":");
  String ipString = ipAndportString.substring(0, colonPos);
  String PortString = ipAndportString.substring(colonPos + 1, ipAndportString.length());
  outIp.fromString(ipString);
  outPort = PortString.toInt();
  // save iP as Char Array for sending
  WiFi.localIP().toString().toCharArray(ipAsChar, 15);
  Serial.print("New remote IP: ");
  Serial.println(outIp);
  Serial.print("New remote Port: ");
  Serial.println(outPort);*/
}

void inRestartESP(OSCMessage &msg)
{ // no value needed
  restartESP();
}

/* --------- HID INCOMMING OSC MESSAGES FUNCTIONS ------------ */

void inHIDLeftDown(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  internalLed(1);
  Serial.print("/hid/left_down: ");
  Serial.println(deviceID);

  // Reset the scroll gauge level to zero when left mouse button is pressed
  scrollGaugeLevel = 0;
  updateScrollGauge(0); // Update the display
}

void inHIDLeftUp(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  internalLed(0);
  Serial.print("/hid/left_up: ");
  Serial.println(deviceID);
}

void inHIDRightDown(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  Serial.print("/hid/right_down: ");
  Serial.println(deviceID);

  // Toggle between gauge mode and color mode
  gaugeMode = !gaugeMode;

  // Make the mode change very obvious with a visual indicator
  // Flash all LEDs white briefly
  for (int i = 0; i < LED_COUNT; i++)
  {
    strip.setPixelColor(i, strip.Color(255, 255, 255));
  }
  strip.show();
  delay(100); // Brief flash

  if (gaugeMode)
  {
    // If switching to gauge mode, update the gauge display
    Serial.println("=== SWITCHED TO GAUGE MODE ===");
    // Show gauge at current level
    updateScrollGauge(0);
  }
  else
  {
    // If switching to color mode, show a rainbow to indicate color mode
    Serial.println("=== SWITCHED TO COLOR MODE ===");

    // Show a rainbow pattern to indicate color mode is active
    for (int i = 0; i < LED_COUNT; i++)
    {
      strip.setPixelColor(i, colorHSV(i * 65536 / LED_COUNT, 255, 255));
    }
    strip.show();
    delay(300);

    // Then update with current hue
    updateStripColor(10, 10); // Larger change to ensure visible update
  }
}

void inHIDRightUp(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  Serial.print("/hid/right_up: ");
  Serial.println(deviceID);
}

void inHIDMiddleDown(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  Serial.print("/hid/middle_down: ");
  Serial.println(deviceID);
}

void inHIDMiddleUp(OSCMessage &msg)
{ // no value required
  int deviceID = msg.getInt(0);
  Serial.print("/hid/middle_up: ");
  Serial.println(deviceID);
}

void inHIDMove(OSCMessage &msg)
{ // float values dx, dy (delta movement)
  int deviceID = msg.getInt(0);
  float dx = msg.getFloat(3);
  float dy = msg.getFloat(4);
  Serial.print("/hid/move: ");
  Serial.print(deviceID);
  Serial.print(", ");
  Serial.print(dx);
  Serial.print(", ");
  Serial.println(dy);

  // Only update color in color mode (not gauge mode)
  if (!gaugeMode)
  {
    Serial.println("Color mode active - updating colors");
    // Update LED strip color based on mouse movement delta
    updateStripColor(dx, dy);
  }
  else
  {
    // In gauge mode, we don't update colors with movement
    // This debug message helps confirm we're in the right mode
    if (abs(dx) > 5.0 || abs(dy) > 5.0)
    { // Only log for significant movements
      Serial.println("Gauge mode active - ignoring movement for colors");
    }
  }
}

void inHIDScroll(OSCMessage &msg)
{ // float values scrollx, scrolly (delta scroll)
  int deviceID = msg.getInt(0);
  float scrollx = msg.getFloat(3);
  float scrolly = msg.getFloat(4);
  Serial.print("/hid/scroll: ");
  Serial.print(deviceID);
  Serial.print(", ");
  Serial.print(scrollx);
  Serial.print(", ");
  Serial.println(scrolly);

  // Only update gauge in gauge mode
  if (gaugeMode)
  {
    // Update LED strip gauge based on scroll delta value
    // Using vertical scroll (scrolly) for the gauge
    // Positive scrolly is scroll up, negative is scroll down
    updateScrollGauge(scrolly);
  }
}

/* --------- YOUR CUSTOM FUNCTIONS ------------ */

void internalLed(int state)
{
  if (state == 1)
  {
    digitalWrite(LED_BUILTIN, HIGH);
  }
  else
  {
    digitalWrite(LED_BUILTIN, LOW);
  }
}

// Convert hue, saturation, value to RGB
uint32_t colorHSV(uint16_t hue, uint8_t sat, uint8_t val)
{
  return strip.ColorHSV(hue, sat, val);
}

// Update strip color based on mouse movement
void updateStripColor(float dx, float dy)
{
  // Use dx and dy to adjust the hue
  // Since these are delta values (movement changes), scale them appropriately
  // Multiply by a factor to make the color changes more noticeable
  float movementMagnitude = sqrt(dx * dx + dy * dy) * 10.0; // Increased sensitivity multiplier

  // Debug output to see the actual magnitude
  Serial.print("Movement magnitude: ");
  Serial.println(movementMagnitude);

  // Lower threshold to detect smaller movements
  if (movementMagnitude > 0.1)
  { // Reduced threshold from 0.5 to 0.1
    // Increase the color change amount for more noticeable changes
    currentHue = (currentHue + (int)(movementMagnitude * 200)) % 65536; // Increased multiplier from 100 to 200

    // Set all LEDs to the new color
    for (int i = 0; i < LED_COUNT; i++)
    {
      strip.setPixelColor(i, colorHSV(currentHue, 255, 255));
    }
    strip.show();

    // Debug output to see the current hue
    Serial.print("Current hue: ");
    Serial.println(currentHue);
  }
}

// Update LED gauge based on scroll value
void updateScrollGauge(float scrollValue)
{
  // Since scroll values are delta values, scale appropriately
  // Negative scrollValue means scrolling down, positive means scrolling up
  // Adjust sensitivity with multiplier - may need tuning based on actual scroll behavior
  scrollGaugeLevel += scrollValue * 0.2;

  // Keep within bounds
  if (scrollGaugeLevel < 0)
    scrollGaugeLevel = 0;
  if (scrollGaugeLevel > LED_COUNT)
    scrollGaugeLevel = LED_COUNT;

  // Debug output
  Serial.print("Gauge level: ");
  Serial.println(scrollGaugeLevel);

  // Update LED strip as gauge
  for (int i = 0; i < LED_COUNT; i++)
  {
    if (i < scrollGaugeLevel)
    {
      // Lit LEDs - gradient from green to red
      uint32_t color = strip.ColorHSV(map(i, 0, LED_COUNT - 1, 21845, 0), 255, 255); // 21845 is ~120° (green), 0 is red
      strip.setPixelColor(i, color);
    }
    else
    {
      // Unlit LEDs
      strip.setPixelColor(i, strip.Color(0, 0, 0));
    }
  }
  strip.show();
}

// Startup animation
void startupAnimation()
{
  // Rainbow chase animation
  for (int j = 0; j < 256; j += 8)
  {
    for (int i = 0; i < strip.numPixels(); i++)
    {
      strip.setPixelColor(i, colorHSV((i * 65536 / strip.numPixels()) + j * 256, 255, 255));
    }
    strip.show();
    delay(20);
  }

  // Turn off all LEDs
  for (int i = 0; i < strip.numPixels(); i++)
  {
    strip.setPixelColor(i, strip.Color(0, 0, 0));
  }
  strip.show();
}

/* --------- OTHER FUNCTIONS ------------ */

void startWifiAndUdp()
{
  // Connect to WiFi network
  Serial.println();
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tryCount = 0;
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
  // Start UDP
  Serial.println("Starting UDP");
  if (!Udp.begin(localPort))
  {
    Serial.println("Error starting UDP");
    return;
  }
  Serial.print("Local port: ");
  Serial.println(localPort);
  Serial.print("Remote IP: ");
  Serial.println(outIp);
}

void updateIpTable()
{
  httpclient.begin("https://ecal-mid.ch/esp32watcher/update.php?name=" + boardName + "&ip=" + WiFi.localIP().toString() + "&wifi=" + WIFI_SSID);
  int httpResponseCode = httpclient.GET();
  if (httpResponseCode > 0)
  {
    String payload = httpclient.getString();
    Serial.println(payload);
  }
  else
  {
    Serial.print("Error code: ");
    Serial.println(httpResponseCode);
  }
  // Free resources
  httpclient.end();
}

void restartESP()
{
  Serial.print("Restarting now");
  ESP.restart();
}
