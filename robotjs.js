const net = require('net');
const path = require('path');

function requireNative(moduleName, modulePath) {
  try {
    if (process.pkg) {
      // When running inside a pkg executable
      const tempPath = path.join(path.dirname(process.execPath), modulePath);
      return require(tempPath);
    } else {
      // Normal require when running via node
      return require(moduleName);
    }
  } catch (err) {
    console.error('Failed to load native module:', err);
    throw err;
  }
}

const robot = requireNative('robotjs_jm', 'build/Release/robotjs.node');

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

robot.setMouseDelay(1);

const server = net.createServer(socket => {
  socket.on('data', async (data) => {
    let message
    try {
      message = JSON.parse(data.toString('utf-8'));
    } catch (error) {
      socket.write('{"status": "error", "message: "'+data.toString('utf-8')+'", "error": "' + error.message + '"}');
    }
    if (message) {
      try {
        if (message.type === 'mousemove') {
          robot.moveMouse(message.x, message.y);
        } else if (message.type === 'mouseClick') {
          robot.mouseToggle(message.clickType, message.button);
        } else if (message.type === 'scroll') {
          robot.scrollMouse(message.x, message.y);
        } else if (message.type === 'keyToggle') {
          robot.keyToggle(message.key, message.direction);
        }

        socket.write('{"status": "ok"}');
      } catch (error) {
        console.error('Failed to process command', error);
        socket.write('{"status": "error", "type": "' + message.type + '", "error": "' + error.message + '"}');
      }
    }
  });
});

server.listen(port, () => {
  console.log(`RobotJS Helper listening on port ${port} (admin)`);
});