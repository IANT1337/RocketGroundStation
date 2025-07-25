// Initialize socket connection
const socket = io();

// Chart instances
let altitudeChart = null;
let pressureChart = null;
let gpsChart = null;

// Data arrays for charts
let timeLabels = [];
let altitudeGpsData = [];
let altitudePressureData = [];
let pressureData = [];
let latitudeData = [];
let longitudeData = [];

// DOM elements
const elements = {
    portSelect: document.getElementById('port-select'),
    baudRate: document.getElementById('baud-rate'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    clearDataBtn: document.getElementById('clear-data-btn'),
    refreshPortsBtn: document.getElementById('refresh-ports'),
    exportCsvBtn: document.getElementById('export-csv'),
    autoScrollCheckbox: document.getElementById('auto-scroll'),
    serialStatus: document.getElementById('serial-status'),
    csvStatus: document.getElementById('csv-status'),
    dataCount: document.getElementById('data-count'),
    telemetryLog: document.getElementById('telemetry-log'),
    sleepCmd: document.getElementById('sleep-cmd'),
    maintCmd: document.getElementById('maint-cmd'),
    flightCmd: document.getElementById('flight-cmd'),
    lastCommand: document.getElementById('last-command')
};

// Current data elements mapping
const currentDataElements = {
    timestamp: document.getElementById('current-timestamp'),
    mode: document.getElementById('current-mode'),
    latitude: document.getElementById('current-latitude'),
    longitude: document.getElementById('current-longitude'),
    altitude_gps: document.getElementById('current-altitude-gps'),
    altitude_pressure: document.getElementById('current-altitude-pressure'),
    pressure: document.getElementById('current-pressure'),
    gps_valid: document.getElementById('current-gps-valid'),
    pressure_valid: document.getElementById('current-pressure-valid')
};

// Initialize charts
function initializeCharts() {
    console.log('Initializing charts...');
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        throw new Error('Chart.js is not loaded');
    }
    if (typeof moment === 'undefined') {
        throw new Error('moment.js is not loaded');
    }
    
    console.log('Chart.js version available, initializing charts...');
    
    // Altitude Chart
    const altitudeCtx = document.getElementById('altitude-chart').getContext('2d');
    altitudeChart = new Chart(altitudeCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'GPS Altitude (m)',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1
            }, {
                label: 'Pressure Altitude (m)',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Altitude (m)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            animation: {
                duration: 0
            }
        }
    });

    // Pressure Chart
    const pressureCtx = document.getElementById('pressure-chart').getContext('2d');
    pressureChart = new Chart(pressureCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Pressure (Pa)',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Pressure (Pa)'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });

    // GPS Position Chart
    const gpsCtx = document.getElementById('gps-chart').getContext('2d');
    gpsChart = new Chart(gpsCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'GPS Position',
                data: [],
                backgroundColor: 'rgb(255, 206, 86)',
                borderColor: 'rgb(255, 206, 86)',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Longitude'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Latitude'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

// Update current data display
function updateCurrentData(data) {
    Object.keys(currentDataElements).forEach(key => {
        const element = currentDataElements[key];
        if (element) {
            let value = data[key];
            
            // Format values
            if (key === 'timestamp') {
                // Handle numeric timestamp - could be milliseconds or other format
                if (typeof value === 'string' && !isNaN(value)) {
                    // If it's a numeric string, treat it as milliseconds if it's large enough
                    const numValue = parseInt(value);
                    if (numValue > 1000000000) { // If > 1 billion, likely milliseconds since epoch
                        value = moment(numValue).format('YYYY-MM-DD HH:mm:ss');
                    } else {
                        // Otherwise, just show the raw timestamp with current time
                        value = `${value} (${moment().format('HH:mm:ss')})`;
                    }
                } else if (moment(value).isValid()) {
                    value = moment(value).format('YYYY-MM-DD HH:mm:ss');
                } else {
                    value = value || '-';
                }
            } else if (key === 'mode') {
                // Handle numeric mode values
                const modeNames = {
                    '0': 'INIT',
                    '1': 'PAD',
                    '2': 'FLIGHT',
                    '3': 'APOGEE',
                    '4': 'DESCENT',
                    '5': 'RECOVERY'
                };
                value = modeNames[value] || value || '-';
            } else if (key === 'latitude' || key === 'longitude') {
                value = typeof value === 'number' ? value.toFixed(6) : '-';
            } else if (key === 'altitude_gps' || key === 'altitude_pressure') {
                value = typeof value === 'number' ? `${value.toFixed(1)} m` : '- m';
            } else if (key === 'pressure') {
                value = typeof value === 'number' ? `${value.toFixed(0)} Pa` : '- Pa';
            } else if (key === 'gps_valid' || key === 'pressure_valid') {
                element.className = `data-value status-indicator ${value ? 'valid' : 'invalid'}`;
                value = value ? '✓ Valid' : '✗ Invalid';
            }
            
            element.textContent = value;
            
            // Remove the flash animation - no more visual disruption
        }
    });
}

// Update charts with new data
function updateCharts(data) {
    console.log('updateCharts called with:', data);
    
    // Validate that we have the required chart instances
    if (!altitudeChart || !pressureChart || !gpsChart) {
        console.error('Chart instances not initialized');
        throw new Error('Chart instances not initialized');
    }
    
    // Validate that moment is available
    if (typeof moment !== 'function') {
        console.error('Moment.js not available');
        throw new Error('Moment.js not available');
    }
    
    const timestamp = moment(data.server_timestamp);
    if (!timestamp.isValid()) {
        console.error('Invalid timestamp:', data.server_timestamp);
        throw new Error('Invalid timestamp: ' + data.server_timestamp);
    }
    
    console.log('Timestamp:', timestamp.format());
    
    // Create a simple time label for the x-axis
    const timeLabel = timestamp.format('HH:mm:ss');
    
    // Add new data point to our arrays
    timeLabels.push(timeLabel);
    altitudeGpsData.push(data.altitude_gps);
    altitudePressureData.push(data.altitude_pressure);
    pressureData.push(data.pressure);
    
    // Add data to chart labels and datasets
    altitudeChart.data.labels.push(timeLabel);
    altitudeChart.data.datasets[0].data.push(data.altitude_gps);
    altitudeChart.data.datasets[1].data.push(data.altitude_pressure);
    
    pressureChart.data.labels.push(timeLabel);
    pressureChart.data.datasets[0].data.push(data.pressure);
    
    console.log('Chart data lengths:', {
        timeLabels: timeLabels.length,
        altitudeGps: altitudeGpsData.length,
        altitudePressure: altitudePressureData.length,
        pressure: pressureData.length,
        altitudeChart0: altitudeChart.data.datasets[0].data.length,
        altitudeChart1: altitudeChart.data.datasets[1].data.length,
        pressureChart0: pressureChart.data.datasets[0].data.length
    });
    
    // Update GPS chart if coordinates are valid
    if (data.gps_valid && data.latitude && data.longitude) {
        gpsChart.data.datasets[0].data.push({
            x: data.longitude,
            y: data.latitude
        });
        console.log('Added GPS point:', data.longitude, data.latitude);
    }
    
    // Keep only last 100 points for time-series charts
    const maxPoints = 100;
    if (timeLabels.length > maxPoints) {
        timeLabels.splice(0, timeLabels.length - maxPoints);
        altitudeGpsData.splice(0, altitudeGpsData.length - maxPoints);
        altitudePressureData.splice(0, altitudePressureData.length - maxPoints);
        pressureData.splice(0, pressureData.length - maxPoints);
        
        // Clean up chart data as well
        altitudeChart.data.labels.splice(0, altitudeChart.data.labels.length - maxPoints);
        altitudeChart.data.datasets[0].data.splice(0, altitudeChart.data.datasets[0].data.length - maxPoints);
        altitudeChart.data.datasets[1].data.splice(0, altitudeChart.data.datasets[1].data.length - maxPoints);
        pressureChart.data.labels.splice(0, pressureChart.data.labels.length - maxPoints);
        pressureChart.data.datasets[0].data.splice(0, pressureChart.data.datasets[0].data.length - maxPoints);
    }
    
    // Keep only last 100 points for GPS chart as well
    if (gpsChart.data.datasets[0].data.length > maxPoints) {
        gpsChart.data.datasets[0].data.splice(0, gpsChart.data.datasets[0].data.length - maxPoints);
    }
    
    // Update charts
    console.log('Updating charts...');
    try {
        altitudeChart.update('none');
        console.log('Altitude chart updated');
    } catch (error) {
        console.error('Error updating altitude chart:', error);
        throw error;
    }
    
    try {
        pressureChart.update('none');
        console.log('Pressure chart updated');
    } catch (error) {
        console.error('Error updating pressure chart:', error);
        throw error;
    }
    
    try {
        gpsChart.update('none');
        console.log('GPS chart updated');
    } catch (error) {
        console.error('Error updating GPS chart:', error);
        throw error;
    }
    
    console.log('All charts updated successfully');
}

// Add log entry
function addLogEntry(message, type = 'info') {
    const timestamp = moment().format('HH:mm:ss.SSS');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${message}`;
    
    elements.telemetryLog.appendChild(logEntry);
    
    // Auto-scroll if enabled
    if (elements.autoScrollCheckbox.checked) {
        elements.telemetryLog.scrollTop = elements.telemetryLog.scrollHeight;
    }
    
    // Keep only last 1000 entries
    const entries = elements.telemetryLog.children;
    if (entries.length > 1000) {
        elements.telemetryLog.removeChild(entries[0]);
    }
}

// Load available serial ports
function loadPorts() {
    socket.emit('get-ports');
}

// Send rocket command
function sendRocketCommand(command) {
    if (confirm(`Are you sure you want to send the ${command} command to the rocket?`)) {
        socket.emit('send-command', command);
        elements.lastCommand.textContent = command;
        addLogEntry(`🚀 COMMAND SENT: ${command}`, 'info');
    }
}

// Event Listeners
elements.refreshPortsBtn.addEventListener('click', loadPorts);

elements.connectBtn.addEventListener('click', () => {
    const port = elements.portSelect.value;
    const baudRate = elements.baudRate.value;
    
    if (!port) {
        alert('Please select a serial port');
        return;
    }
    
    socket.emit('connect-serial', port, baudRate);
    addLogEntry(`Attempting to connect to ${port} at ${baudRate} baud...`);
});

elements.disconnectBtn.addEventListener('click', () => {
    socket.emit('disconnect-serial');
});

elements.clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data?')) {
        socket.emit('clear-data');
    }
});

elements.exportCsvBtn.addEventListener('click', () => {
    // Create CSV content from current data
    const csvContent = generateCsvContent();
    downloadCsv(csvContent, `telemetry_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
});

// Rocket control event listeners
elements.sleepCmd.addEventListener('click', () => {
    sendRocketCommand('SLEEP');
});

elements.maintCmd.addEventListener('click', () => {
    sendRocketCommand('MAINT');
});

elements.flightCmd.addEventListener('click', () => {
    sendRocketCommand('FLIGHT');
});

// Generate CSV content from current chart data
function generateCsvContent() {
    let csv = 'Timestamp,GPS_Altitude,Pressure_Altitude,Pressure,Longitude,Latitude\n';
    
    for (let i = 0; i < timeLabels.length; i++) {
        const timestamp = timeLabels[i].format('YYYY-MM-DD HH:mm:ss');
        const gpsAlt = altitudeGpsData[i] ? altitudeGpsData[i].y : '';
        const pressAlt = altitudePressureData[i] ? altitudePressureData[i].y : '';
        const pressure = pressureData[i] ? pressureData[i].y : '';
        
        // Find corresponding GPS data
        let longitude = '';
        let latitude = '';
        const gpsPoint = gpsChart.data.datasets[0].data.find(point => 
            Math.abs(moment(point.timestamp).diff(timeLabels[i])) < 1000
        );
        if (gpsPoint) {
            longitude = gpsPoint.x;
            latitude = gpsPoint.y;
        }
        
        csv += `${timestamp},${gpsAlt},${pressAlt},${pressure},${longitude},${latitude}\n`;
    }
    
    return csv;
}

// Download CSV file
function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Socket event handlers
socket.on('ports-list', (ports) => {
    elements.portSelect.innerHTML = '<option value="">Select Port...</option>';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
        elements.portSelect.appendChild(option);
    });
    addLogEntry(`Found ${ports.length} serial ports`);
});

socket.on('ports-error', (error) => {
    addLogEntry(`Error listing ports: ${error}`, 'error');
});

socket.on('serial-status', (status) => {
    if (status.connected) {
        elements.serialStatus.textContent = `Connected (${status.port})`;
        elements.serialStatus.className = 'status-value connected';
        elements.connectBtn.disabled = true;
        elements.disconnectBtn.disabled = false;
        // Enable rocket control buttons when connected
        elements.sleepCmd.disabled = false;
        elements.maintCmd.disabled = false;
        elements.flightCmd.disabled = false;
        addLogEntry(`Connected to ${status.port} at ${status.baudRate} baud`, 'info');
    } else {
        elements.serialStatus.textContent = 'Disconnected';
        elements.serialStatus.className = 'status-value disconnected';
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;
        // Disable rocket control buttons when disconnected
        elements.sleepCmd.disabled = true;
        elements.maintCmd.disabled = true;
        elements.flightCmd.disabled = true;
        addLogEntry('Disconnected from serial port', 'warning');
    }
});

socket.on('serial-error', (error) => {
    addLogEntry(`Serial error: ${error}`, 'error');
    elements.serialStatus.textContent = 'Error';
    elements.serialStatus.className = 'status-value disconnected';
});

socket.on('csv-status', (status) => {
    if (status.logging) {
        elements.csvStatus.textContent = `Logging: ${status.filename}`;
        elements.csvStatus.className = 'status-value connected';
        addLogEntry(`CSV logging started: ${status.filename}`, 'info');
    } else {
        elements.csvStatus.textContent = 'Inactive';
        elements.csvStatus.className = 'status-value';
    }
});

socket.on('telemetry-data', (data) => {
    console.log('Received telemetry data:', data);
    
    try {
        updateCurrentData(data);
    } catch (error) {
        console.error('Error updating current data:', error);
        addLogEntry(`Error updating current data: ${error.message}`, 'error');
    }
    
    try {
        updateCharts(data);
        // Update data count after successful chart update
        elements.dataCount.textContent = timeLabels.length;
    } catch (error) {
        console.error('Error updating charts:', error);
        addLogEntry(`Error updating charts: ${error.message}`, 'error');
        // Still update data count even if charts fail
        elements.dataCount.textContent = (parseInt(elements.dataCount.textContent) || 0) + 1;
    }
    
    // Add to log with proper mode formatting
    const modeNames = {
        '0': 'INIT',
        '1': 'PAD',
        '2': 'FLIGHT',
        '3': 'APOGEE',
        '4': 'DESCENT',
        '5': 'RECOVERY'
    };
    const modeName = modeNames[data.mode] || data.mode;
    const logMessage = `TELEM: ${modeName} | GPS: ${data.latitude?.toFixed(6)}, ${data.longitude?.toFixed(6)} | Alt: ${data.altitude_gps?.toFixed(1)}m (GPS), ${data.altitude_pressure?.toFixed(1)}m (Press) | Pressure: ${data.pressure?.toFixed(1)}Pa | Valid: GPS=${data.gps_valid ? 'Y' : 'N'}, Press=${data.pressure_valid ? 'Y' : 'N'}`;
    addLogEntry(logMessage);
});

socket.on('telemetry-history', (data) => {
    // Load historical data
    data.forEach(telemetry => {
        updateCharts(telemetry);
    });
    elements.dataCount.textContent = data.length;
    addLogEntry(`Loaded ${data.length} historical data points`);
});

socket.on('data-cleared', () => {
    // Clear all data arrays
    timeLabels.length = 0;
    altitudeGpsData.length = 0;
    altitudePressureData.length = 0;
    pressureData.length = 0;
    
    // Clear chart data
    altitudeChart.data.datasets[0].data.length = 0;
    altitudeChart.data.datasets[1].data.length = 0;
    pressureChart.data.datasets[0].data.length = 0;
    gpsChart.data.datasets[0].data.length = 0;
    
    // Update charts
    altitudeChart.update();
    pressureChart.update();
    gpsChart.update();
    
    // Reset current data display
    Object.values(currentDataElements).forEach(element => {
        if (element.id.includes('valid')) {
            element.textContent = '-';
            element.className = 'data-value status-indicator';
        } else if (element.id.includes('altitude') || element.id.includes('pressure')) {
            element.textContent = element.id.includes('pressure') && !element.id.includes('altitude') ? '- Pa' : '- m';
        } else {
            element.textContent = '-';
        }
    });
    
    elements.dataCount.textContent = '0';
    addLogEntry('All data cleared', 'warning');
});

socket.on('command-sent', (data) => {
    addLogEntry(`✅ Command "${data.command}" sent successfully`, 'info');
});

socket.on('command-error', (error) => {
    addLogEntry(`❌ Command error: ${error}`, 'error');
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing application...');
    
    // Wait for libraries to load
    const checkLibraries = () => {
        const chartAvailable = typeof Chart !== 'undefined';
        const momentAvailable = typeof moment !== 'undefined';
        const socketAvailable = typeof io !== 'undefined';
        
        console.log('Library status:', {
            'Chart.js': chartAvailable,
            'moment.js': momentAvailable,
            'Socket.io': socketAvailable
        });
        
        if (!chartAvailable) {
            console.error('Chart.js is not loaded');
            addLogEntry('❌ Chart.js failed to load', 'error');
            return false;
        }
        
        if (!momentAvailable) {
            console.error('moment.js is not loaded');
            addLogEntry('❌ moment.js failed to load', 'error');
            return false;
        }
        
        if (!socketAvailable) {
            console.error('Socket.io is not loaded');
            addLogEntry('❌ Socket.io failed to load', 'error');
            return false;
        }
        
        return true;
    };
    
    // Try to initialize after a short delay to ensure scripts are loaded
    setTimeout(() => {
        if (!checkLibraries()) {
            console.error('Required libraries not loaded, retrying in 1 second...');
            setTimeout(() => {
                if (checkLibraries()) {
                    initializeApp();
                } else {
                    console.error('Failed to load required libraries after retry');
                    addLogEntry('❌ Failed to load required libraries. Please refresh the page.', 'error');
                }
            }, 1000);
        } else {
            initializeApp();
        }
    }, 200);
});

function initializeApp() {
    console.log('Initializing application...');
    
    try {
        initializeCharts();
        console.log('Charts initialized successfully');
    } catch (error) {
        console.error('Error initializing charts:', error);
        addLogEntry(`❌ Error initializing charts: ${error.message}`, 'error');
    }
    
    try {
        loadPorts();
        console.log('Ports loading initiated');
    } catch (error) {
        console.error('Error loading ports:', error);
        addLogEntry(`❌ Error loading ports: ${error.message}`, 'error');
    }
    
    addLogEntry('✅ Ground Station initialized');
    console.log('Application initialization complete');
}
