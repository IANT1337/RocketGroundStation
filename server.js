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

// CSV Buffering Configuration
let csvBuffer = [];
const CSV_BUFFER_SIZE = 200; // Buffer up to 50 records before writing
const CSV_FLUSH_INTERVAL = 5000; // Force flush every 5 seconds (in milliseconds)
let lastCsvFlush = Date.now();
let csvFlushTimer = null;

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
            { id: 'accel_x', title: 'Accel X (g)' },
            { id: 'accel_y', title: 'Accel Y (g)' },
            { id: 'accel_z', title: 'Accel Z (g)' },
            { id: 'gyro_x', title: 'Gyro X (deg/s)' },
            { id: 'gyro_y', title: 'Gyro Y (deg/s)' },
            { id: 'gyro_z', title: 'Gyro Z (deg/s)' },
            { id: 'mag_x', title: 'Mag X (µT)' },
            { id: 'mag_y', title: 'Mag Y (µT)' },
            { id: 'mag_z', title: 'Mag Z (µT)' },
            { id: 'imu_temperature', title: 'IMU Temp (°C)' },
            { id: 'imu_valid', title: 'IMU Valid' },
            { id: 'bus_voltage', title: 'Bus Voltage (V)' },
            { id: 'current', title: 'Current (mA)' },
            { id: 'power', title: 'Power (mW)' },
            { id: 'power_valid', title: 'Power Valid' },
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
    
    if (parts.length !== 26 || parts[0] !== 'TELEM') {
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
        // IMU data from MPU9250
        accel_x: parseFloat(parts[10]), // Accelerometer X (g)
        accel_y: parseFloat(parts[11]), // Accelerometer Y (g)
        accel_z: parseFloat(parts[12]), // Accelerometer Z (g)
        gyro_x: parseFloat(parts[13]), // Gyroscope X (deg/s)
        gyro_y: parseFloat(parts[14]), // Gyroscope Y (deg/s)
        gyro_z: parseFloat(parts[15]), // Gyroscope Z (deg/s)
        mag_x: parseFloat(parts[16]), // Magnetometer X (µT)
        mag_y: parseFloat(parts[17]), // Magnetometer Y (µT)
        mag_z: parseFloat(parts[18]), // Magnetometer Z (µT)
        imu_temperature: parseFloat(parts[19]), // IMU temperature (°C)
        imu_valid: parts[20] === '1' || parts[20].toLowerCase() === 'true', // IMU data validity
        // Power data from INA260
        bus_voltage: parseFloat(parts[21]), // Bus voltage (V)
        current: parseFloat(parts[22]), // Current (mA)
        power: parseFloat(parts[23]), // Power (mW)
        power_valid: parts[24] === '1' || parts[24].toLowerCase() === 'true', // Power data validity
        rssi: parseFloat(parts[25]) // RSSI in dBm (at the end)
    };
    
    debugLog('Parsed telemetry:', parsed);
    return parsed;
}

// CSV Buffer Management Functions
async function flushCsvBuffer() {
    if (csvBuffer.length === 0 || !csvWriter) {
        return;
    }
    
    try {
        debugLog(`Flushing CSV buffer: ${csvBuffer.length} records`);
        await csvWriter.writeRecords(csvBuffer);
        csvBuffer = []; // Clear the buffer after successful write
        lastCsvFlush = Date.now();
        debugLog('CSV buffer flush successful');
        
        // Emit updated buffer status to clients
        io.emit('csv-buffer-status', { 
            bufferSize: 0, 
            maxSize: CSV_BUFFER_SIZE,
            lastFlush: lastCsvFlush 
        });
    } catch (err) {
        console.error('CSV buffer flush error:', err);
        // Don't clear buffer on error - will retry on next flush
    }
}

function addToCsvBuffer(telemetry) {
    csvBuffer.push(telemetry);
    
    // Emit buffer status to clients
    io.emit('csv-buffer-status', { 
        bufferSize: csvBuffer.length, 
        maxSize: CSV_BUFFER_SIZE,
        lastFlush: lastCsvFlush 
    });
    
    // Check if we should flush based on buffer size
    if (csvBuffer.length >= CSV_BUFFER_SIZE) {
        flushCsvBuffer();
        return;
    }
    
    // Check if we should flush based on time
    const timeSinceLastFlush = Date.now() - lastCsvFlush;
    if (timeSinceLastFlush >= CSV_FLUSH_INTERVAL) {
        flushCsvBuffer();
        return;
    }
    
    // Set up timer for time-based flush if not already set
    if (!csvFlushTimer && csvBuffer.length > 0) {
        const timeUntilFlush = CSV_FLUSH_INTERVAL - timeSinceLastFlush;
        csvFlushTimer = setTimeout(() => {
            csvFlushTimer = null;
            flushCsvBuffer();
        }, Math.max(timeUntilFlush, 1000)); // At least 1 second delay
    }
}

function stopCsvBuffering() {
    // Clear timer
    if (csvFlushTimer) {
        clearTimeout(csvFlushTimer);
        csvFlushTimer = null;
    }
    
    // Flush any remaining data
    if (csvBuffer.length > 0) {
        flushCsvBuffer();
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('✅ Client connected - Socket ID:', socket.id);
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
                
                // Emit raw data to all clients for terminal display
                io.emit('raw-data', data.trim());
                
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
                    
                    // Add to CSV buffer (buffered writing for efficiency)
                    if (csvWriter) {
                        debugLog('Adding telemetry to CSV buffer...');
                        addToCsvBuffer(telemetry);
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
            // Flush any remaining CSV data before closing
            if (csvBuffer.length > 0) {
                console.log('Flushing remaining CSV data before disconnection...');
                flushCsvBuffer();
            }
            stopCsvBuffering();
            
            serialPort.close(() => {
                debugLog('Serial port closed');
                socket.emit('serial-status', { connected: false });
            });
        }
    });
    
    // Get available serial ports
    socket.on('get-ports', async () => {
        console.log('📡 Client requested serial ports list');
        try {
            const ports = await SerialPort.list();
            console.log(`📡 Found ${ports.length} serial ports:`, ports.map(p => `${p.path} (${p.manufacturer || 'Unknown'})`));
            socket.emit('ports-list', ports);
        } catch (error) {
            console.error('❌ Error listing ports:', error);
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
    
    // Send raw command to serial port (for terminal)
    socket.on('send-raw-command', (command) => {
        if (serialPort && serialPort.isOpen) {
            try {
                serialPort.write(command + '\n', (err) => {
                    if (err) {
                        console.error('Error sending raw command:', err);
                        socket.emit('raw-command-error', err.message);
                    } else {
                        console.log(`Raw command sent: ${command}`);
                        socket.emit('raw-command-sent', { command, timestamp: moment().toISOString() });
                    }
                });
            } catch (error) {
                console.error('Error sending raw command:', error);
                socket.emit('raw-command-error', error.message);
            }
        } else {
            socket.emit('raw-command-error', 'Serial port not connected');
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected - Socket ID:', socket.id);
        // Flush any remaining CSV data when client disconnects
        if (csvBuffer.length > 0) {
            console.log('Flushing remaining CSV data due to client disconnect...');
            flushCsvBuffer();
        }
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    
    // Flush any remaining CSV data before shutdown
    if (csvBuffer.length > 0) {
        console.log('Flushing remaining CSV data before shutdown...');
        flushCsvBuffer();
    }
    stopCsvBuffering();
    
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
