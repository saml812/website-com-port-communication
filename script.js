
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
        output.textContent = "Web Serial API not supported on non-Chromium-based browser.";
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

        appendOutput(`Connected to serial port with configuration:\n`);
        appendOutput(`Baud Rate: ${baudRate}, Data Bits: ${dataBits}, Stop Bits: ${stopBits}\n`);
        appendOutput(`Parity: ${parity}, Buffer Size: ${bufferSize}, Flow Control: ${flowControl}\n\n`);

        const textDecoder = new TextDecoderStream();
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        const textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        updateConnectionStatus(true);

        readLoop();

    } catch (error) {
        appendOutput(`Connection failed: ${error.message}\n`);
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

        appendOutput('Disconnected from serial port.\n\n');
        updateConnectionStatus(false);
        
    } catch (error) {
        appendOutput(`Disconnection error: ${error.message}\n`);
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
        while (reader) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            appendOutput(`Received: ${value}`);
            console.log('Received:', value);
        }
    } catch (error) {
        if (error.name === 'NetworkError') {
            appendOutput('Device disconnected\n');
            updateConnectionStatus(false);
        } else if (error.name !== 'AbortError') {
            appendOutput(`Read error: ${error.message}\n`);
            console.error("Read error:", error);
        }
    }
}

async function sendMessage() {
    if (!writer || !port) {
        appendOutput("Error: No active connection to send message.\n");
        return;
    }

    const message = messageInput.value;
    if (!message) return;

    try {   
        await writer.write(message + '\n');
        appendOutput(`Sent: ${message}\n`);
        messageInput.value = '';
    } catch (error) {
        appendOutput(`Send error: ${error.message}\n`);
        console.error('Send error:', error);
        
        if (error.name === 'NetworkError') {
            updateConnectionStatus(false);
        }
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

function appendOutput(text) {
    const formattedText = text.replace(/\\n/g, '\n');
    output.textContent += formattedText;
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    output.textContent = '';
}