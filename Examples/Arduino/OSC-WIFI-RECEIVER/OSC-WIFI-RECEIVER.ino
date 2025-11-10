/*---------------------------------------------------------------------------------------------

  RECEIVE OSC MESSAGES FROM HID EVENTS
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
#include "your_secrets.h"
#include <Preferences.h>

#define WIFI_SSID "ECALEVENT" // Wifi name
#define WIFI_PASS "perpetua"  // Wifi password

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
  // internal led
  pinMode(LED_BUILTIN, OUTPUT);
  // BUTTON
  pinMode(buttonPin, INPUT_PULLUP);

  // Start Wifi and UDP
  startWifiAndUdp();
  // Publish to IP table (online)
  // https://ecal-mid.ch/esp32watcher
  updateIpTable();
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
{ // int values x, y
  int deviceID = msg.getInt(0);
  float dx = msg.getFloat(3);
  float dy = msg.getFloat(4);
  Serial.print("/hid/move: ");
  Serial.print(deviceID);
  Serial.print(", ");
  Serial.print(dx);
  Serial.print(", ");
  Serial.println(dy);
}

void inHIDScroll(OSCMessage &msg)
{ // int value
  int deviceID = msg.getInt(0);
  float scrollx = msg.getFloat(3);
  float scrolly = msg.getFloat(4);
  Serial.print("/hid/scroll: ");
  Serial.print(deviceID);
  Serial.print(", ");
  Serial.print(scrollx);
  Serial.print(", ");
  Serial.println(scrolly);
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
