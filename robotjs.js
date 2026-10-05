'use strict';

const net = require('net');
const path = require('path');
const { createBrowserInputAdapter } = require('./browser-input-adapter');
const { createJsonLineDecoder, encodeJsonLine } = require('./json-line-protocol');
const { createRobotHelperCommandHandler } = require('./robot-helper-command-handler');

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const robot = require('node-gyp-build')(baseDir);
const port = parseInt(process.argv[2], 10) || 13337;
const sockets = new Set();

robot.setMouseDelay(1);

const server = net.createServer((socket) => {
    sockets.add(socket);
    const inputAdapter = createBrowserInputAdapter(robot);
    const send = (message) => socket.write(encodeJsonLine(message));
    const close = () => {
        server.close(() => process.exit(0));
        for (const activeSocket of sockets) activeSocket.destroy();
    };
    const handleCommand = createRobotHelperCommandHandler({ robot, inputAdapter, send, close });
    const decoder = createJsonLineDecoder({
        onMessage: handleCommand,
        onError: (error) => send({
            status: 'error',
            type: 'protocol',
            requestId: '',
            error: {
                code: error.code || 'JSON_LINE_INVALID_FRAME',
                message: 'Invalid framed RobotJS command',
            },
        }),
    });

    socket.on('data', (data) => decoder.push(data));
    socket.on('error', (error) => console.error('RobotJS helper socket error:', error.message));
    socket.on('close', () => {
        sockets.delete(socket);
        try { inputAdapter.releaseAll(); }
        catch (error) { console.error('RobotJS helper could not release held input:', error.message); }
    });
});

server.listen(port, () => {
    console.log(`RobotJS Helper listening on port ${port} (admin)`);
});
