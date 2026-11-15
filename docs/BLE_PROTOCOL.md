# Bluetooth contract between the SoleSense device and this app

BLE = Bluetooth Low Energy. GATT = Generic Attribute Profile, the BLE way of
exposing named values ("characteristics") grouped into "services".

The app (`src/lib/device.ts`) looks for a device that advertises the service
below and subscribes to one characteristic. No firmware exists yet; this file
is the contract the ESP32 firmware has to meet for "Connect a SoleSense" to work.

| Item | Value |
| --- | --- |
| Service UUID | `7a0e0001-5c1b-4f6e-9d3a-50a1e5e25e00` |
| Force characteristic UUID | `7a0e0002-5c1b-4f6e-9d3a-50a1e5e25e00` |
| Properties | Notify |
| Payload | 4 bytes, IEEE 754 float32, little-endian |
| Unit | gram-force (gf), already calibrated and tared |
| Rate | 20 to 50 notifications per second |

Rules:

- The device must include the service UUID in its advertising packet, otherwise
  the browser's device picker will not list it.
- Send 0 (or small noise around 0) when nothing is pressed.
- The app treats a press as applied when the force stays within 10 ± 1.5 gf for
  1 second. Those numbers are constants at the top of `src/lib/device.ts`.
- Web Bluetooth needs HTTPS (GitHub Pages provides it) and Chrome or Edge on
  Android, Windows, macOS or Linux. It does not work in Safari or on iPhone.

Minimal Arduino-ESP32 sketch outline:

```cpp
#include <BLEDevice.h>
#define SERVICE "7a0e0001-5c1b-4f6e-9d3a-50a1e5e25e00"
#define FORCE   "7a0e0002-5c1b-4f6e-9d3a-50a1e5e25e00"
BLECharacteristic *force;

void setup() {
  BLEDevice::init("SoleSense");
  BLEService *svc = BLEDevice::createServer()->createService(SERVICE);
  force = svc->createCharacteristic(FORCE, BLECharacteristic::PROPERTY_NOTIFY);
  force->addDescriptor(new BLE2902());
  svc->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE);
  BLEDevice::startAdvertising();
}

void loop() {
  float gf = readForceGf();   // Hall sensor on GPIO34 -> calibrated gram-force
  force->setValue((uint8_t *)&gf, 4);
  force->notify();
  delay(30);
}
```

This sketch has not been run on hardware.
