let port = null;
let reader = null;
let writer = null;

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const messageInput = document.getElementById('messageInput');
const output = document.getElementById('output');
const status = document.getElementById('status');

if (!('serial' in navigator)) {
    output.textContent = "Web Serial API not supported on not Chromium-based browser."
    connectBtn.disabled = true;
}

async function connect() {
    try {
        // select a single serial port and openning
        port = await navigator.serial.requestPort();

        const baudRate = parseInt(document.getElementById('baudRate').value);
        const dataBits = parseInt(document.getElementById('dataBits').value);
        const stopBits = parseInt(document.getElementById('stopBits').value);
        const parity = document.getElementById('parity').value;
        const bufferSize = parseInt(document.getElementById('bufferSize').value);
        const flowControl = document.getElementById('flowControl').value;

        await port.open({
            baudRate: baudRate,
            dataBits: dataBits,
            stopBits: stopBits,
            parity: parity,
            bufferSize: bufferSize,
            flowControl: flowControl
        });

        appendOutput(`Connected to serial port with configuration:\n`);
        appendOutput(`Baud Rate: ${baudRate}, Data Bits: ${dataBits}, Stop Bits: ${stopBits}\n`);
        appendOutput(`Parity: ${parity}, Buffer Size: ${bufferSize}, Flow Control: ${flowControl}\n\n`);

        // Set up the reader for incoming data
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        // Set up the writer for outgoing data
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        // Start reading incoming data
        readLoop();
    } catch (error) {
        appendOutput(`Connection failed: ${error.message}\n`);
        console.error('Connection error:', error);
    }
}

async function readLoop() {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                reader.releaseLock();
                break;
            }
            appendOutput(`Received: ${value}`);
            console.log(value);
        }
    } catch (error) {
        appendOutput(`Read error: ${error.message}\n`);
        console.error('Read error:', error);
    }
}