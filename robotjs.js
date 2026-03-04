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
            // Use unicodeTap for single non-ASCII characters, only on keydown
            console.log("Received keyToggle command:", message.key, message.direction);
            if (
              typeof message.key === "string" &&
              message.key.length === 1 &&
              message.key.charCodeAt(0) > 127
            ) {
              if (message.direction === "down") {
                console.log(message.key, message.key.charCodeAt(0), "Unicode tap");
                robot.unicodeTap(message.key.charCodeAt(0));
              }
            } else {
              // Normalize and validate key for robot.keyToggle
              let direction = message.direction;
              let key = message.key;
              // Map common alternate key names to RobotJS expected names
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
                if (key.toLowerCase() === "shift") key = "shift";
                if (key.toLowerCase() === "alt") key = "alt";
                if (key.toLowerCase() === "right_alt") key = "right_alt";
                if (key.toLowerCase() === "left_alt") key = "alt";
                if (key.toLowerCase() === "tab") key = "tab";
                if (key.toLowerCase() === "enter") key = "enter";
                if (key.toLowerCase() === "return") key = "enter";
                if (key.toLowerCase() === "escape") key = "escape";
                if (key.toLowerCase() === "esc") key = "escape";
                if (key.trim() === "") key = undefined;
              }
              // Only call robot.keyToggle if key is a non-empty string
              if (typeof key === "string" && key.length > 0) {
                let modifier = message.modifier || message.modifiers;
                if (modifier) {
                  if (typeof modifier === "string") {
                    if (
                      modifier.toLowerCase() === "altgr" ||
                      modifier.toLowerCase() === "right_alt"
                    ) {
                      modifier = "right_alt";
                    }
                  } else if (Array.isArray(modifier)) {
                    modifier = modifier.map((m) =>
                      m.toLowerCase() === "altgr" ||
                      m.toLowerCase() === "right_alt"
                        ? "right_alt"
                        : m,
                    );
                  }
                  // Ensure mutually exclusive left/right alt
                  if (Array.isArray(modifier)) {
                    if (
                      modifier.includes("right_alt") &&
                      modifier.includes("alt")
                    ) {
                      modifier = modifier.filter((m) => m !== "alt");
                    }
                  }
                  robot.keyToggle(key, direction, modifier);
                } else {
                  robot.keyToggle(key, direction);
                }
              } else {
                // Optionally log or ignore invalid/empty keys
                // console.warn("Ignored invalid keyToggle command:", message.key, direction);
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
