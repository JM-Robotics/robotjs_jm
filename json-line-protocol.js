'use strict';

const DEFAULT_MAX_FRAME_BYTES = 64 * 1024;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;

function createProtocolError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function encodeJsonLine(value, maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') {
        throw createProtocolError('JSON_LINE_NOT_SERIALIZABLE', 'JSON-line value is not serializable');
    }
    const frame = Buffer.from(json, 'utf8');
    if (frame.length > maxFrameBytes) {
        throw createProtocolError('JSON_LINE_FRAME_TOO_LARGE', 'JSON-line frame exceeds the size limit');
    }
    return Buffer.concat([frame, Buffer.from('\n')]);
}

function createJsonLineDecoder({
    maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
    onMessage,
    onError,
} = {}) {
    if (typeof onMessage !== 'function') {
        throw new TypeError('createJsonLineDecoder requires onMessage');
    }

    let pending = Buffer.alloc(0);
    let discardingOversizedFrame = false;

    const reportError = (error) => {
        if (typeof onError === 'function') onError(error);
    };

    const consumeFrame = () => {
        let frame = pending;
        pending = Buffer.alloc(0);
        if (frame.length > 0 && frame[frame.length - 1] === CARRIAGE_RETURN) {
            frame = frame.subarray(0, frame.length - 1);
        }
        if (frame.length === 0) return;

        try {
            const parsed = JSON.parse(frame.toString('utf8'));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw createProtocolError('JSON_LINE_OBJECT_REQUIRED', 'JSON-line frame must contain an object');
            }
            onMessage(parsed);
        } catch (error) {
            reportError(error.code
                ? error
                : createProtocolError('JSON_LINE_INVALID_JSON', 'JSON-line frame contains invalid JSON'));
        }
    };

    return {
        push(chunk) {
            const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk || '');
            let offset = 0;

            while (offset < input.length) {
                const newlineIndex = input.indexOf(NEWLINE, offset);
                const end = newlineIndex === -1 ? input.length : newlineIndex;
                const segment = input.subarray(offset, end);

                if (!discardingOversizedFrame) {
                    if (pending.length + segment.length > maxFrameBytes) {
                        pending = Buffer.alloc(0);
                        discardingOversizedFrame = newlineIndex === -1;
                        reportError(createProtocolError(
                            'JSON_LINE_FRAME_TOO_LARGE',
                            'JSON-line frame exceeds the size limit',
                        ));
                    } else if (segment.length > 0) {
                        pending = pending.length === 0
                            ? Buffer.from(segment)
                            : Buffer.concat([pending, segment]);
                    }
                } else if (newlineIndex !== -1) {
                    discardingOversizedFrame = false;
                }

                if (newlineIndex === -1) break;
                if (!discardingOversizedFrame) consumeFrame();
                offset = newlineIndex + 1;
            }
        },
        reset() {
            pending = Buffer.alloc(0);
            discardingOversizedFrame = false;
        },
    };
}

module.exports = {
    DEFAULT_MAX_FRAME_BYTES,
    createJsonLineDecoder,
    encodeJsonLine,
};
