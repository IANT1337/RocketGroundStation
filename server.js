const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const path = require('path');
const fs = require('fs');

// Performance monitoring functions
function measureEventLoopLag() {
    const start = process.hrtime();
    setImmediate(() => {
        const delta = process.hrtime(start);
        const nanosec = delta[0] * 1e9 + delta[1];
        const millisec = nanosec / 1e6;
        performanceMetrics.eventLoopLag = millisec;
    });
}

function updatePerformanceMetrics() {
    const now = Date.now();
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    performanceMetrics.memoryUsage = {
        rss: memUsage.rss / 1024 / 1024, // MB
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
        external: memUsage.external / 1024 / 1024, // MB
        arrayBuffers: memUsage.arrayBuffers / 1024 / 1024 // MB
    };
    
    // Update CPU usage
    const cpuUsage = process.cpuUsage(performanceMetrics.cpuUsage.previous || undefined);
    performanceMetrics.cpuUsage = {
        user: cpuUsage.user / 1000, // Convert to milliseconds
        system: cpuUsage.system / 1000, // Convert to milliseconds
        previous: cpuUsage
    };
    
    // Calculate message rate
    const currentTime = now;
    const timeWindow = currentTime - MESSAGE_RATE_WINDOW * 1000;
    
    // Remove old entries from rate buffer
    messageRateBuffer = messageRateBuffer.filter(timestamp => timestamp > timeWindow);
    
    // Calculate messages per second
    performanceMetrics.messagesPerSecond = messageRateBuffer.length / MESSAGE_RATE_WINDOW;
    
    // Check for overload conditions
    checkServerOverload();
    
    // Emit performance data to clients
    io.emit('performance-metrics', performanceMetrics);
    
    lastPerformanceUpdate = now;
    
    // Detailed performance analysis
    analyzeDataFlow();
}

function analyzeDataFlow() {
    const currentTime = Date.now();
    const uptime = (currentTime - performanceMetrics.startTime) / 1000;
    
    // Calculate average processing metrics over time
    const avgProcessingTime = performanceMetrics.telemetryProcessingTime;
    const avgMessageRate = performanceMetrics.messagesPerSecond;
    
    // Determine server capacity status
    let capacityStatus = 'EXCELLENT';
    let capacityScore = 100;
    let recommendations = [];
    
    // Evaluate based on multiple factors
    if (performanceMetrics.eventLoopLag > 100) {
        capacityStatus = 'CRITICAL';
        capacityScore = Math.min(capacityScore, 20);
        recommendations.push('Event loop severely blocked - reduce processing complexity');
    } else if (performanceMetrics.eventLoopLag > 50) {
        capacityStatus = 'POOR';
        capacityScore = Math.min(capacityScore, 40);
        recommendations.push('Event loop lag detected - monitor processing time');
    }
    
    if (avgProcessingTime > 50) {
        capacityStatus = 'CRITICAL';
        capacityScore = Math.min(capacityScore, 25);
        recommendations.push('Telemetry processing time too high - optimize parsing');
    } else if (avgProcessingTime > 25) {
        capacityStatus = 'POOR';
        capacityScore = Math.min(capacityScore, 50);
        recommendations.push('Processing time elevated - consider optimization');
    }
    
    const memoryPercent = (performanceMetrics.memoryUsage.heapUsed / performanceMetrics.memoryUsage.heapTotal) * 100;
    if (memoryPercent > 85) {
        capacityStatus = 'CRITICAL';
        capacityScore = Math.min(capacityScore, 30);
        recommendations.push('High memory usage - check for memory leaks');
    } else if (memoryPercent > 70) {
        capacityStatus = 'POOR';
        capacityScore = Math.min(capacityScore, 60);
        recommendations.push('Memory usage elevated - monitor trends');
    }
    
    if (avgMessageRate > 100) {
        if (capacityStatus === 'EXCELLENT') {
            capacityStatus = 'GOOD';
            capacityScore = Math.min(capacityScore, 80);
        }
        recommendations.push(`High message rate (${avgMessageRate.toFixed(1)}/sec) - monitor server performance closely`);
    }
    
    // Emit capacity analysis to clients
    io.emit('server-capacity-analysis', {
        status: capacityStatus,
        score: capacityScore,
        messageRate: avgMessageRate,
        processingTime: avgProcessingTime,
        eventLoopLag: performanceMetrics.eventLoopLag,
        memoryPercent: memoryPercent,
        uptime: uptime,
        totalMessages: performanceMetrics.totalMessagesReceived,
        recommendations: recommendations,
        timestamp: currentTime
    });
    
    // Log capacity status every 30 seconds
    if (Math.floor(uptime) % 30 === 0 && performanceMetrics.totalMessagesReceived > 0) {
        console.log(`📊 Server Capacity: ${capacityStatus} (${capacityScore}%) | ` +
                   `Rate: ${avgMessageRate.toFixed(1)}/sec | ` +
                   `Processing: ${avgProcessingTime.toFixed(1)}ms | ` +
                   `Memory: ${memoryPercent.toFixed(1)}% | ` +
                   `Lag: ${performanceMetrics.eventLoopLag.toFixed(1)}ms`);
                   
        if (recommendations.length > 0) {
            console.log(`💡 Recommendations: ${recommendations.join(', ')}`);
        }
    }
}

function checkServerOverload() {
    let isCurrentlyOverloaded = false;
    const reasons = [];
    
    // Check event loop lag
    if (performanceMetrics.eventLoopLag > PERFORMANCE_THRESHOLDS.eventLoopLag) {
        isCurrentlyOverloaded = true;
        reasons.push(`Event loop lag: ${performanceMetrics.eventLoopLag.toFixed(1)}ms`);
    }
    
    // Check memory usage (as percentage of heap total)
    const heapUsagePercent = performanceMetrics.memoryUsage.heapUsed / performanceMetrics.memoryUsage.heapTotal;
    if (heapUsagePercent > PERFORMANCE_THRESHOLDS.memoryUsage) {
        isCurrentlyOverloaded = true;
        reasons.push(`Memory usage: ${(heapUsagePercent * 100).toFixed(1)}%`);
    }
    
    // Check telemetry processing time
    if (performanceMetrics.telemetryProcessingTime > PERFORMANCE_THRESHOLDS.processingTime) {
        isCurrentlyOverloaded = true;
        reasons.push(`Processing time: ${performanceMetrics.telemetryProcessingTime.toFixed(1)}ms`);
    }
    
    // Check message rate (alert if unexpectedly high)
    if (performanceMetrics.messagesPerSecond > PERFORMANCE_THRESHOLDS.messageRate) {
        isCurrentlyOverloaded = true;
        reasons.push(`High message rate: ${performanceMetrics.messagesPerSecond.toFixed(1)}/sec`);
    }
    
    if (isCurrentlyOverloaded) {
        performanceMetrics.overloadCount++;
        if (performanceMetrics.overloadCount >= PERFORMANCE_THRESHOLDS.overloadThreshold) {
            const now = Date.now();
            // Only alert if it's been at least 10 seconds since last alert
            if (!performanceMetrics.isOverloaded || (now - performanceMetrics.lastOverloadAlert) > 10000) {
                performanceMetrics.isOverloaded = true;
                performanceMetrics.lastOverloadAlert = now;
                console.log(`⚠️  SERVER OVERLOAD DETECTED: ${reasons.join(', ')}`);
                // Emit overload alert to clients
                io.emit('server-overload-alert', {
                    isOverloaded: true,
                    reasons: reasons,
                    metrics: performanceMetrics
                });
            }
        }
    } else {
        if (performanceMetrics.isOverloaded) {
            console.log('✅ Server performance back to normal');
            io.emit('server-overload-alert', {
                isOverloaded: false,
                reasons: [],
                metrics: performanceMetrics
            });
        }
        performanceMetrics.overloadCount = Math.max(0, performanceMetrics.overloadCount - 1);
        performanceMetrics.isOverloaded = false;
    }
}

// Start performance monitoring
function startPerformanceMonitoring() {
    // Measure event loop lag every 100ms
    setInterval(measureEventLoopLag, 100);
    
    // Update performance metrics every second
    setInterval(updatePerformanceMetrics, PERFORMANCE_UPDATE_INTERVAL);
    
    console.log('📊 Performance monitoring started');
}

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

// Performance monitoring variables
let performanceMetrics = {
    startTime: Date.now(),
    totalMessagesReceived: 0,
    messagesPerSecond: 0,
    lastMessageTime: Date.now(),
    eventLoopLag: 0,
    memoryUsage: {},
    cpuUsage: {},
    telemetryProcessingTime: 0,
    csvWriteTime: 0,
    socketEmitTime: 0,
    isOverloaded: false,
    overloadCount: 0,
    lastOverloadAlert: 0 // Add cooldown for overload alerts
};

let messageRateBuffer = [];
const MESSAGE_RATE_WINDOW = 10; // Calculate rate over last 10 seconds
let lastPerformanceUpdate = Date.now();
const PERFORMANCE_UPDATE_INTERVAL = 1000; // Update performance metrics every 1 second

// Performance thresholds for detecting server overload
const PERFORMANCE_THRESHOLDS = {
    eventLoopLag: 100, // ms - warning if event loop lag > 100ms
    memoryUsage: 0.95, // Warn if using > 95% of heap (Node.js can handle high heap usage)
    processingTime: 50, // ms - warn if telemetry processing > 50ms
    messageRate: 100, // messages/second - expected max rate for alerting
    overloadThreshold: 5 // Number of consecutive overload detections before alerting (increased)
};

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

// Serve Moment.js from node_modules
app.use('/moment', express.static(path.join(__dirname, 'node_modules/moment/min')));

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
        accel_x: -parseFloat(parts[12]), // Accelerometer X (g) - corrected: was Z, inverted sign
        accel_y: parseFloat(parts[11]), // Accelerometer Y (g)
        accel_z: -parseFloat(parts[10]), // Accelerometer Z (g) - corrected: was X, inverted sign
        gyro_x: -parseFloat(parts[15]), // Gyroscope X (deg/s) - corrected: was Z, inverted sign
        gyro_y: parseFloat(parts[14]), // Gyroscope Y (deg/s)
        gyro_z: -parseFloat(parts[13]), // Gyroscope Z (deg/s) - corrected: was X, inverted sign
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
function convertBooleansForCsv(telemetry) {
    // Create a copy of the telemetry object with boolean values converted to 1/0
    const csvTelemetry = { ...telemetry };
    csvTelemetry.gps_valid = telemetry.gps_valid ? 1 : 0;
    csvTelemetry.pressure_valid = telemetry.pressure_valid ? 1 : 0;
    csvTelemetry.imu_valid = telemetry.imu_valid ? 1 : 0;
    csvTelemetry.power_valid = telemetry.power_valid ? 1 : 0;
    return csvTelemetry;
}

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
    // Convert boolean values to 1/0 for faster CSV logging
    const csvTelemetry = convertBooleansForCsv(telemetry);
    csvBuffer.push(csvTelemetry);
    
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
    
    // Send current performance metrics to new client
    socket.emit('performance-metrics', performanceMetrics);
    
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
                const processingStartTime = process.hrtime();
                
                debugLog(`Raw serial data received: "${data}"`);
                
                // Track message rate
                const currentTime = Date.now();
                messageRateBuffer.push(currentTime);
                performanceMetrics.totalMessagesReceived++;
                performanceMetrics.lastMessageTime = currentTime;
                
                // Emit raw data to all clients for terminal display
                const socketStartTime = process.hrtime();
                io.emit('raw-data', data.trim());
                const socketDelta = process.hrtime(socketStartTime);
                performanceMetrics.socketEmitTime = (socketDelta[0] * 1e9 + socketDelta[1]) / 1e6; // Convert to ms
                
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
                        const csvStartTime = process.hrtime();
                        debugLog('Adding telemetry to CSV buffer...');
                        addToCsvBuffer(telemetry);
                        const csvDelta = process.hrtime(csvStartTime);
                        performanceMetrics.csvWriteTime = (csvDelta[0] * 1e9 + csvDelta[1]) / 1e6; // Convert to ms
                    } else {
                        debugLog('No CSV writer available');
                    }
                } else {
                    debugLog('Failed to parse telemetry data');
                }
                
                // Calculate total processing time
                const processingDelta = process.hrtime(processingStartTime);
                performanceMetrics.telemetryProcessingTime = (processingDelta[0] * 1e9 + processingDelta[1]) / 1e6; // Convert to ms
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
    
    // Start performance monitoring after server starts
    startPerformanceMonitoring();
});
