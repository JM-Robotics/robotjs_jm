// Track currently pressed modifier keys
const activeModifiers = new Set();

const net = require("net");
const path = require("path");

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// This will look for prebuilds/*/*.node relative to baseDir
const robot = require("node-gyp-build")(baseDir);

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

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
            let rawKey = message.key;
            let normKey =
              typeof rawKey === "string" ? rawKey.toLowerCase() : rawKey;
            if (
              normKey === "altgraph" ||
              normKey === "rightalt" ||
              normKey === "right_alt"
            )
              normKey = "right_alt";
            if (
              normKey === "alt" ||
              normKey === "leftalt" ||
              normKey === "left_alt"
            )
              normKey = "alt";
            if (normKey === "shift") normKey = "shift";
            if (normKey === "control" || normKey === "ctrl")
              normKey = "control";
            // Track modifier state
            if (
              normKey === "right_alt" ||
              normKey === "alt" ||
              normKey === "shift" ||
              normKey === "control"
            ) {
              if (message.direction === "down") {
                activeModifiers.add(normKey);
              } else if (message.direction === "up") {
                activeModifiers.delete(normKey);
              }
            }
            console.log(
              "Received keyToggle command:",
              message.key,
              message.direction,
            );
            // Special handling: if right-alt is held and key is 2 or @, always send keyToggle('2', direction, 'right_alt')
            if (
              activeModifiers.has("right_alt") &&
              (message.key === "2" || message.key === "@")
            ) {
              robot.keyToggle("2", message.direction, "right_alt");
            } else if (
              typeof message.key === "string" &&
              message.key.length === 1 &&
              message.key.charCodeAt(0) > 127
            ) {
              if (message.direction === "down") {
                console.log(
                  message.key,
                  message.key.charCodeAt(0),
                  "Unicode tap",
                );
                robot.unicodeTap(message.key.charCodeAt(0));
              }
            } else {
              // Normalize and validate key for robot.keyToggle
              let direction = message.direction;
              let key = message.key;

              // Map common alternate key names to RobotJS expected names
              let mods = [];
              if (typeof key === "string") {
                if (key.toLowerCase() === "altgraph") key = "right_alt";
                if (key.toLowerCase() === "altgr") key = "right_alt";
                if (key.toLowerCase() === "control") key = "control";
                if (key.toLowerCase() === "ctrl") key = "control";
                if (key.toLowerCase() === "meta") key = "command";
                if (key.toLowerCase() === "windows") key = "command";
                if (key.toLowerCase() === "win") key = "command";
                if (key.toLowerCase() === "capslock") key = "caps_lock";
                if (key.toLowerCase() === "backspace") key = "backspace";
                // Determine modifiers from activeModifiers set
                if (activeModifiers.has("right_alt")) mods.push("right_alt");
                if (activeModifiers.has("alt")) mods.push("alt");
                if (activeModifiers.has("shift")) mods.push("shift");
                if (activeModifiers.has("control")) mods.push("control");
                if (key.toLowerCase() === "alt") key = "alt";
                if (key.toLowerCase() === "right_alt") key = "right_alt";
                if (key.toLowerCase() === "left_alt") key = "alt";
                if (key.toLowerCase() === "tab") key = "tab";
                if (key.toLowerCase() === "enter") key = "enter";
                if (key.toLowerCase() === "return") key = "enter";
                if (key.toLowerCase() === "escape") key = "escape";
                if (key.toLowerCase() === "esc") key = "escape";
                if (key != " " && key.trim() === "") key = undefined;
              }

              if (mods.length > 0) {
                // Ensure mutually exclusive left/right alt
                if (mods.includes("right_alt") && mods.includes("alt")) {
                  mods = mods.filter((m) => m !== "alt");
                }
                key = key.toLowerCase()
                console.log("keyToggle",key, direction, mods)
                robot.keyToggle(key, direction, mods);
              } else {
                robot.keyToggle(key, direction);
              }
            }
            //console.log(message.type, "Ok")
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
