// Track currently pressed modifier keys
const activeModifiers = new Set();

const net = require("net");
const path = require("path");

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// This will look for prebuilds/*/*.node relative to baseDir
const robot = require("node-gyp-build")(baseDir);

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

const MODIFIERKEYSNAMES = ["alt", "right_alt", "shift", "control", "command"];

robot.setMouseDelay(1);

const server = net.createServer((socket) => {
  socket.on("data", async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString("utf-8"));
    } catch (error) {
      socket.write(
        '{"status": "error", "message: "' +
          data.toString("utf-8") +
          '", "error": "' +
          error.message +
          '"}',
      );
    }
    if (message) {
      try {
        switch (message.type) {
          case "mousemove": {
            robot.moveMouse(message.x, message.y);
            break;
          }
          case "mouseClick": {
            robot.mouseToggle(message.clickType, message.button);
            //console.log(message.clickType, message.button, "Ok")
            break;
          }
          case "scroll": {
            robot.scrollMouse(message.x, message.y);
            //console.log(message.type, "Ok")
            break;
          }
          case "keyToggle": {
            // Modifier tracking logic
            // Normalize key for modifier tracking

            if (
              typeof message.key === "string" &&
              message.key.length === 1 &&
              message.key.charCodeAt(0) > 127
            ) {
              if (message.direction === "down") {
                console.log("Unicode tap", message.key, message.key.charCodeAt(0));
                robot.unicodeTap(message.key.charCodeAt(0));
              }
              return; // Don't proceed to keyToggle for unicode characters
            }

            // Special mapping for characters that require modifiers (e.g., #, @, etc.)
            const specialCharMap = {
              "#": "3",
              "@": "2",
              "$": "4",
              "&": "6",
              "{": "7",
              "[": "8",
              "]": "9",
              "}": "0",
              "|": "<",
              "\\":"<",
              "~": "+",
              "^": "^",
              // Add more as needed for your keyboard layout
            };

            let normKey = reMapKey(message.key);

            // Track modifier state
            if (MODIFIERKEYSNAMES.includes(normKey)) {
              if (message.direction === "down") {
                activeModifiers.add(normKey);
              }
              if (message.direction === "up") {
                activeModifiers.delete(normKey);
              }
              return; // Don't send keyToggle for modifier keys themselves  
            }

            // Check if the key is a special character that needs modifiers
            if (specialCharMap[normKey]) {
              console.log(`Special character '${normKey}' mapped to '${specialCharMap[normKey]}' `);
              normKey = specialCharMap[normKey];
            }

            // Normalize and validate key for robot.keyToggle
            let direction = message.direction;

            let mods = Array.from(activeModifiers);
            try {
              if (mods.length > 0) {
                // Ensure mutually exclusive left/right alt
                if (mods.includes("alt") && mods.includes("right_alt")) {
                  mods = mods.filter((m) => m !== "alt");
                }
                robot.keyToggle(normKey, direction, mods);
              } else {
                robot.keyToggle(normKey, direction);
              }
            } catch (error) {
              console.error("Error in keyToggle with", normKey, direction, mods);
              console.error("Error in keyToggle:", error.message);
              throw error;
            }

            break;
          }
          case "close":
            socket.write('{"status": "ok", "message": "Shutting down"}');
            console.log("Shutdown command received. Closing server...");
            server.close(() => {
              console.log("Server closed.");
              process.exit(0);
            });

            // Force-close all active sockets
            sockets.forEach((s) => s.destroy());
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Failed to process command", error);
        socket.write(
          '{"status": "error", "type": "' +
            message.type +
            '", "error": "' +
            error.message +
            '"}',
        );
      }
    }
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });

  socket.on("close", () => {
    console.log("Client disconnected.");
  });
});

server.listen(port, () => {
  console.log(`RobotJS Helper listening on port ${port} (admin)`);
});

function reMapKey(key) {
  let normKey = key.toLowerCase();
  const RIGHTALTKEYSNAMES = ["right_alt", "altgr", "altgraph"];
  const LEFTALTKEYSNAMES = ["alt", "left_alt", "leftalt"];
  const SHIFTKEYSNAMES = ["shift"];
  const CONTROLKEYSNAMES = ["control", "ctrl"];
  const METAKEYSNAMES = ["meta", "windows", "win", "command"];

  if (RIGHTALTKEYSNAMES.includes(normKey)) normKey = "right_alt";
  if (LEFTALTKEYSNAMES.includes(normKey)) normKey = "alt";
  if (SHIFTKEYSNAMES.includes(normKey)) normKey = "shift";
  if (CONTROLKEYSNAMES.includes(normKey)) normKey = "control";
  if (METAKEYSNAMES.includes(normKey)) normKey = "command";

  if (normKey === "capslock") normKey = "caps_lock";
  if (normKey === "backspace") normKey = "backspace";
  if (normKey === "tab") normKey = "tab";
  if (normKey === "enter") normKey = "enter";
  if (normKey === "return") normKey = "enter";
  if (normKey === "escape") normKey = "escape";
  if (normKey === "esc") normKey = "escape";
  if (normKey != " " && normKey.trim() === "") normKey = undefined;

  console.log("mapped key:", `'${key}' => '${normKey}'`);
  return normKey;
}
