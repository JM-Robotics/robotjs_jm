// Track currently pressed modifier keys
const activeModifiers = new Set();

const { dir } = require('console');
const net = require('net');
const path = require('path');

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// This will look for prebuilds/*/*.node relative to baseDir
const robot = require('node-gyp-build')(baseDir);

const DEFAULT_PORT = 13337;
const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;

robot.setMouseDelay(1);

const server = net.createServer((socket) => {
    socket.on('data', async (data) => {
        let message;
        try {
            message = JSON.parse(data.toString('utf-8'));
        } catch (error) {
            socket.write('{"status": "error", "message: "' + data.toString('utf-8') + '", "error": "' + error.message + '"}');
        }
        if (message) {
            try {
                switch (message.type) {
                    case 'mousemove': {
                        robot.moveMouse(message.x, message.y);
                        break;
                    }
                    case 'mouseClick': {
                        robot.mouseToggle(message.clickType, message.button);
                        break;
                    }
                    case 'scroll': {
                        robot.scrollMouse(message.x, message.y);
                        break;
                    }
                    case 'keyToggle': {
                        //old method used by pilot v <= 1.54
                        robot.keyToggle(message.key, message.direction);
                        break;
                    }
                    case 'keyTap': {
                        keyTap(message);
                        break;
                    }
                    case 'close':
                        socket.write('{"status": "ok", "message": "Shutting down"}');
                        console.log('Shutdown command received. Closing server...');
                        server.close(() => {
                            console.log('Server closed.');
                            process.exit(0);
                        });

                        // Force-close all active sockets
                        sockets.forEach((s) => s.destroy());
                        break;
                    default:
                        console.warn('Unknown message type:', message.type);
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

function keyTap(data) {
    if (data.keyCode > 127) {
        const charFromKey = data.key.toCharCode(0);
        console.log(`unicodeTap: '${data.keyCode}', '${data.key}'  => ('${charFromKey}')`);
        robot.unicodeTap();
    } else {
        const normalizedKey = normalizeKey(data.key);
        if (normalizedKey != data.key) {
            console.log(`Normalized key: '${data.key}' => '${normalizedKey}'`);
            robot.keyToggle(normalizedKey, data.direction);
        } else {
            const charFromCode = String.fromCharCode(data.keyCode);
            console.log(`keyToggling keyCode: '${data.keyCode}' => ('${charFromCode}'). Direction: ${data.direction}`);
            robot.keyToggle(charFromCode, data.direction);
        }
    }
}

function normalizeKey(key) {
    let normKey = key.toLowerCase();
    const RIGHTALTKEYSNAMES = ['right_alt', 'altgr', 'altgraph'];
    const LEFTALTKEYSNAMES = ['alt', 'left_alt', 'leftalt'];
    const SHIFTKEYSNAMES = ['shift'];
    const CONTROLKEYSNAMES = ['control', 'ctrl'];
    const METAKEYSNAMES = ['meta', 'windows', 'win', 'command'];

    if (RIGHTALTKEYSNAMES.includes(normKey)) normKey = 'right_alt';
    if (LEFTALTKEYSNAMES.includes(normKey)) normKey = 'alt';
    if (SHIFTKEYSNAMES.includes(normKey)) normKey = 'shift';
    if (CONTROLKEYSNAMES.includes(normKey)) normKey = 'control';
    if (METAKEYSNAMES.includes(normKey)) normKey = 'command';

    if (normKey === 'capslock') normKey = 'caps_lock';
    if (normKey === 'backspace') normKey = 'backspace';
    if (normKey === 'tab') normKey = 'tab';
    if (normKey === 'enter') normKey = 'enter';
    if (normKey === 'return') normKey = 'enter';
    if (normKey === 'escape') normKey = 'escape';
    if (normKey === 'esc') normKey = 'escape';
    if (normKey != ' ' && normKey.trim() === '') normKey = undefined;

    //console.log('mapped key:', `'${key}' => '${normKey}'`);
    return normKey;
}

function specialMap(key) {
    const specialCharMap = {
        '!': '1',
        '"': '2',
        '#': '3',
        $: '4',
        '%': '5',
        '&': '6',
        '/': '7',
        '(': '8',
        ')': '9',
        '=': '0',

        '@': '2',
        '{': '7',
        '[': '8',
        ']': '9',
        '}': '0',

        '|': '<',
        '\\': '<',

        '~': '+',
        '^': '^',
        '?': '+',

        '*': "'",
        "'": "'",

        ':': '.',
        ';': ',',

        '>': '.',
        '<': '<',

        _: '-',
        '+': '+',
    };
    if (specialCharMap[key]) {
        console.log(`Special character '${key}' mapped to '${specialCharMap[key]}' `);
        return specialCharMap[key];
    }
    return key;
}

//
