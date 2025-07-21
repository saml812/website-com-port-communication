let port = null;
let reader = null;
let writer = null;
let readableStreamClosed = null;
let writableStreamClosed = null;
let connectBtn, disconnectBtn, sendBtn, clearBtn, messageInput, output, status;

document.addEventListener('DOMContentLoaded', function () {
    connectBtn = document.getElementById("connectBtn");
    disconnectBtn = document.getElementById("disconnectBtn");
    sendBtn = document.getElementById("sendBtn");
    clearBtn = document.getElementById("clearBtn");
    messageInput = document.getElementById("messageInput");
    output = document.getElementById("output");
    status = document.getElementById("status");

    if (!("serial" in navigator)) {
        appendLine("Error", "Web Serial API not supported on this browser.");
        connectBtn.disabled = true;
    }

    connectBtn.addEventListener('click', connect);
    disconnectBtn.addEventListener('click', disconnect);
    sendBtn.addEventListener('click', sendMessage);
    clearBtn.addEventListener('click', clearOutput);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (port) {
            disconnect();
        }
    });
});

// Add a line to the output as a new DOM element
function appendLine(prefix, message) {
    const line = document.createElement('div');
    line.className = `line ${prefix.toLowerCase()}`;
    line.textContent = `${prefix}: ${message}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

async function connect() {
    try {
        port = await navigator.serial.requestPort();

        const baudRate = parseInt(document.getElementById('baudRate')?.value) || 9600;
        const dataBits = parseInt(document.getElementById('dataBits')?.value) || 8;
        const stopBits = parseInt(document.getElementById('stopBits')?.value) || 1;
        const parity = document.getElementById('parity')?.value || 'none';
        const bufferSize = parseInt(document.getElementById('bufferSize')?.value) || 255;
        const flowControl = document.getElementById('flowControl')?.value || 'none';

        await port.open({
            baudRate: baudRate,
            dataBits: dataBits,
            stopBits: stopBits,
            parity: parity,
            bufferSize: bufferSize,
            flowControl: flowControl
        });

        appendLine("Info", `Connected with Baud: ${baudRate}, DataBits: ${dataBits}, StopBits: ${stopBits}`);
        appendLine("Info", `Parity: ${parity}, Buffer: ${bufferSize}, Flow: ${flowControl}`);

        const textDecoder = new TextDecoderStream();
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);

        const lineStream = textDecoder.readable
            .pipeThrough(new TransformStream(new LineBreakTransformer()));
        reader = lineStream.getReader();

        const textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        updateConnectionStatus(true);

        readLoop();
    } catch (error) {
        appendLine("Error", `Connection failed: ${error.message}`);
        console.error('Connection error:', error);
        updateConnectionStatus(false);
    }
}

async function disconnect() {
    try {
        if (reader) {
            await reader.cancel();
            reader = null;
        }
        if (writer) {
            await writer.close();
            writer = null;
        }
        if (readableStreamClosed) {
            await readableStreamClosed.catch(() => {});
            readableStreamClosed = null;
        }
        if (writableStreamClosed) {
            await writableStreamClosed.catch(() => {});
            writableStreamClosed = null;
        }
        if (port) {
            await port.close();
            port = null;
        }
        appendLine("Info", 'Disconnected from serial port.');
        updateConnectionStatus(false);
    } catch (error) {
        appendLine("Error", `Disconnection error: ${error.message}`);
        console.error('Disconnection error:', error);
        reader = null;
        writer = null;
        port = null;
        readableStreamClosed = null;
        writableStreamClosed = null;
        updateConnectionStatus(false);
    }
}

async function readLoop() {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value !== undefined) {
                appendLine("Received", value);
                console.log('Received:', value);
            }
        }
    } catch (error) {
        appendLine("Error", `Read error: ${error.message}`);
        console.error("Read error:", error);
    }
}

async function sendMessage() {
    if (!writer || !port) {
        appendLine("Error", "No active connection.");
        return;
    }
    const message = messageInput.value;
    if (!message) return;

    try {
        await writer.write(message + '\n');
        appendLine("Sent", message);
        messageInput.value = '';
    } catch (error) {
        appendLine("Error", `Send error: ${error.message}`);
        console.error('Send error:', error);
    }
}

function updateConnectionStatus(connected) {
    if (connected) {
        status.textContent = "Connected";
        status.className = "status connected";
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        sendBtn.disabled = false;
        messageInput.disabled = false;
    } else {
        status.textContent = "Disconnected";
        status.className = "status disconnected";
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        sendBtn.disabled = true;
        messageInput.disabled = true;
    }
}

function clearOutput() {
    output.innerHTML = '';
}

// LineBreakTransformer
class LineBreakTransformer {
    constructor() {
        this.container = '';
    }
    transform(chunk, controller) {
        this.container += chunk;
        const lines = this.container.split(/\r?\n/);
        this.container = lines.pop();
        for (const line of lines) controller.enqueue(line);
    }
    flush(controller) {
        if (this.container) controller.enqueue(this.container);
    }
}
