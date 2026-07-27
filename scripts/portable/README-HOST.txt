AMOEBA WARS — Local Host (portable Node)
========================================

This package runs the full multiplayer game server on your PC or Mac
without installing Node.js system-wide.

QUICK START
-----------
Windows:  Double-click  start.bat
Mac/Linux: Open Terminal in this folder and run:
            chmod +x start.sh
            ./start.sh

Then play at:  http://localhost:5173

LAN PARTY
---------
Other devices on the same Wi‑Fi/LAN open:
  http://YOUR-PC-IP:5173
Find your IP with:  ipconfig  (Windows)  or  ifconfig / ip addr  (Mac/Linux)

UPDATING
--------
1. Download a new Install Local Host package from the setup screen.
2. Unzip to a NEW folder (or replace files carefully).
3. Keep your saves/ folder if you want to preserve missions and ship configs.
4. Do not overwrite saves/ unless you intend to.

CONTENTS
--------
  runtime/node/   Portable Node.js runtime (used only by this folder)
  dist/           Built web client
  src/            Game simulation (server-side)
  server.js       Multiplayer host
  start.bat / start.sh
  node_modules/   Production dependencies (or installed on first start)

NOTES
-----
• iPhone / iPad cannot host this package (no portable Node host on iOS).
• First antivirus scan of runtime/node may take a moment.
• Stop the host with Ctrl+C in the console window.
• Optional: set PORT=5180 before starting to use a different port.

REQUIREMENTS
------------
• Windows 10+ (x64) or recent macOS / Linux (matching package platform)
• Network only needed if node_modules was not shipped and first-run install runs
