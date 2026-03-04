const net = require('net');
const path = require('path');

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// This will look for prebuilds/*/*.node relative to baseDir
const robot = require('node-gyp-build')(baseDir);

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

robot.setMouseDelay(1);

const server = net.createServer(socket => {
  socket.on('data', async (data) => {
    let message
    try {
      message = JSON.parse(data.toString('utf-8'));
    } catch (error) {
      socket.write('{"status": "error", "message: "' + data.toString('utf-8') + '", "error": "' + error.message + '"}');
    }
    if (message) {
      try {
        switch (message.type) {
          case "mousemove": {
            robot.moveMouse(message.x, message.y);
            break
          }
          case "mouseClick": {
            robot.mouseToggle(message.clickType, message.button);
            //console.log(message.clickType, message.button, "Ok")
            break
          }
          case "scroll": {
            robot.scrollMouse(message.x, message.y);
            //console.log(message.type, "Ok")
            break
          }
          case "keyToggle": {
            // Use unicodeTap for single non-ASCII characters, only on keydown
            if (
              typeof message.key === 'string' &&
              message.key.length === 1 &&
              message.key.charCodeAt(0) > 127 &&
              message.direction === 'down'
            ) {
              robot.unicodeTap(message.key.charCodeAt(0));
            } else {
              // Normalize modifier for right alt / altgr
              let direction = message.direction;
              let modifier = message.modifier || message.modifiers;
              if (modifier) {
                if (typeof modifier === 'string') {
                  if (modifier.toLowerCase() === 'altgr' || modifier.toLowerCase() === 'right_alt') {
                    modifier = 'right_alt';
                  }
                } else if (Array.isArray(modifier)) {
                  modifier = modifier.map(m => (m.toLowerCase() === 'altgr' || m.toLowerCase() === 'right_alt') ? 'right_alt' : m);
                }
                robot.keyToggle(message.key, direction, modifier);
              } else {
                robot.keyToggle(message.key, direction);
              }
            }
            //console.log(message.type, "Ok")
            break
          }
          case "close":
            socket.write('{"status": "ok", "message": "Shutting down"}');
            console.log("Shutdown command received. Closing server...");
            server.close(() => {
              console.log("Server closed.");
              process.exit(0);
            });

            // Force-close all active sockets
            sockets.forEach(s => s.destroy());
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }

      } catch (error) {
        console.error('Failed to process command', error);
        socket.write('{"status": "error", "type": "' + message.type + '", "error": "' + error.message + '"}');
      }
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });

  socket.on('close', () => {
    console.log('Client disconnected.');
  });
});

server.listen(port, () => {
  console.log(`RobotJS Helper listening on port ${port} (admin)`);
});