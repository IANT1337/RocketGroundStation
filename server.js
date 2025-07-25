const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const path = require('path');
const fs = require('fs');

// Debug configuration
const DEBUG_ENABLED = false; // Set to true to enable debug console logs

// Debug wrapper function
function debugLog(...args) {
    if (DEBUG_ENABLED) {
        console.log(...args);
    }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration
const PORT = process.env.PORT || 3000;
let serialPort = null;
let parser = null;
let csvWriter = null;

// Data storage for plotting
let telemetryData = [];
const MAX_DATA_POINTS = 100; // Keep last 100 data points for plotting

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve Chart.js from node_modules
app.use('/chart.js', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));

// Initialize CSV writer
function initializeCsvWriter() {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `telemetry_${timestamp}.csv`;
    const logsDir = path.join(__dirname, 'logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
    
    csvWriter = createCsvWriter({
        path: path.join(logsDir, filename),
        header: [
            { id: 'timestamp', title: 'Timestamp' },
            { id: 'mode', title: 'Mode' },
            { id: 'latitude', title: 'Latitude' },
            { id: 'longitude', title: 'Longitude' },
            { id: 'altitude_gps', title: 'Altitude GPS (m)' },
            { id: 'altitude_pressure', title: 'Altitude Pressure (m)' },
            { id: 'pressure', title: 'Pressure (Pa)' },
            { id: 'gps_valid', title: 'GPS Valid' },
            { id: 'pressure_valid', title: 'Pressure Valid' },
            { id: 'rssi', title: 'RSSI (dBm)' }
        ]
    });
    
    console.log(`CSV logging initialized: ${filename}`);
    return filename;
}

// Parse telemetry data
function parseTelemetryData(data) {
    const parts = data.trim().split(',');
    debugLog(`Parsing data: "${data.trim()}" -> ${parts.length} parts:`, parts);
    
    if (parts.length !== 11 || parts[0] !== 'TELEM') {
        debugLog(`Parse failed: length=${parts.length}, first=${parts[0]}`);
        return null;
    }
    
    const parsed = {
        timestamp: parts[1], // Raw timestamp (could be milliseconds or other format)
        mode: parts[2], // Mode as received (could be number or string)
        latitude: parseFloat(parts[3]),
        longitude: parseFloat(parts[4]),
        altitude_gps: parseFloat(parts[5]),
        altitude_pressure: parseFloat(parts[6]),
        pressure: parseFloat(parts[7]),
        gps_valid: parts[8] === '1' || parts[8].toLowerCase() === 'true',
        pressure_valid: parts[9] === '1' || parts[9].toLowerCase() === 'true',
        rssi: parseFloat(parts[10]) // RSSI in dBm
    };
    
    debugLog('Parsed telemetry:', parsed);
    return parsed;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    debugLog('Client connected');
    
    // Send current data to new client
    socket.emit('telemetry-history', telemetryData);
    
    // Handle serial port connection request
    socket.on('connect-serial', async (portName, baudRate) => {
        try {
            if (serialPort && serialPort.isOpen) {
                serialPort.close();
            }
            
            serialPort = new SerialPort({
                path: portName,
                baudRate: parseInt(baudRate) || 9600
            });
            
            parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            serialPort.on('open', () => {
                console.log(`Serial port ${portName} opened at ${baudRate} baud`);
                socket.emit('serial-status', { connected: true, port: portName, baudRate });
                
                // Initialize CSV writer when port opens
                const filename = initializeCsvWriter();
                socket.emit('csv-status', { logging: true, filename });
            });
            
            serialPort.on('error', (err) => {
                console.error('Serial port error:', err);
                socket.emit('serial-error', err.message);
            });
            
            parser.on('data', async (data) => {
                debugLog(`Raw serial data received: "${data}"`);
                const telemetry = parseTelemetryData(data);
                if (telemetry) {
                    debugLog('Telemetry parsed successfully');
                    // Add server timestamp
                    telemetry.server_timestamp = moment().toISOString();
                    
                    // Add to data array
                    telemetryData.push(telemetry);
                    
                    // Keep only last MAX_DATA_POINTS
                    if (telemetryData.length > MAX_DATA_POINTS) {
                        telemetryData.shift();
                    }
                    
                    // Emit to all clients
                    debugLog('Emitting telemetry data to clients');
                    io.emit('telemetry-data', telemetry);
                    
                    // Log to CSV
                    if (csvWriter) {
                        try {
                            debugLog('Writing to CSV...');
                            await csvWriter.writeRecords([telemetry]);
                            debugLog('CSV write successful');
                        } catch (err) {
                            console.error('CSV write error:', err);
                        }
                    } else {
                        debugLog('No CSV writer available');
                    }
                } else {
                    debugLog('Failed to parse telemetry data');
                }
            });
            
        } catch (error) {
            console.error('Error connecting to serial port:', error);
            socket.emit('serial-error', error.message);
        }
    });
    
    // Handle serial port disconnection
    socket.on('disconnect-serial', () => {
        if (serialPort && serialPort.isOpen) {
            serialPort.close(() => {
                debugLog('Serial port closed');
                socket.emit('serial-status', { connected: false });
            });
        }
    });
    
    // Get available serial ports
    socket.on('get-ports', async () => {
        try {
            const ports = await SerialPort.list();
            socket.emit('ports-list', ports);
        } catch (error) {
            console.error('Error listing ports:', error);
            socket.emit('ports-error', error.message);
        }
    });
    
    // Clear data
    socket.on('clear-data', () => {
        telemetryData = [];
        io.emit('data-cleared');
    });
    
    // Send command to rocket
    socket.on('send-command', (command) => {
        if (serialPort && serialPort.isOpen) {
            try {
                serialPort.write(command + '\n', (err) => {
                    if (err) {
                        console.error('Error sending command:', err);
                        socket.emit('command-error', err.message);
                    } else {
                        console.log(`Command sent: ${command}`);
                        socket.emit('command-sent', { command, timestamp: moment().toISOString() });
                    }
                });
            } catch (error) {
                console.error('Error sending command:', error);
                socket.emit('command-error', error.message);
            }
        } else {
            socket.emit('command-error', 'Serial port not connected');
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (serialPort && serialPort.isOpen) {
        serialPort.close();
    }
    server.close(() => {
        process.exit(0);
    });
});

// Get local network IP address
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    
    // Return the first non-internal IPv4 address found
    for (const interfaceName in results) {
        if (results[interfaceName].length > 0) {
            return results[interfaceName][0];
        }
    }
    return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('='.repeat(60));
    console.log('ROCKET ESP32 GROUND STATION SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`Local access:    http://localhost:${PORT}`);
    console.log(`Network access:  http://${localIP}:${PORT}`);
    console.log('');
    console.log('Access from other devices on your network:');
    console.log(`   • Computers: http://${localIP}:${PORT}`);
    console.log(`   • Phones/Tablets: http://${localIP}:${PORT}`);
    console.log('');
    console.log('Make sure your firewall allows connections on port', PORT);
    console.log('='.repeat(60));
});
