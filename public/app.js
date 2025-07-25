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
    // Altitude Chart
    const altitudeCtx = document.getElementById('altitude-chart').getContext('2d');
    altitudeChart = new Chart(altitudeCtx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'GPS Altitude (m)',
                data: altitudeGpsData,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1
            }, {
                label: 'Pressure Altitude (m)',
                data: altitudePressureData,
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
                    type: 'time',
                    time: {
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
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
            labels: timeLabels,
            datasets: [{
                label: 'Pressure (Pa)',
                data: pressureData,
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
                    type: 'time',
                    time: {
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
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
    const timestamp = moment(data.server_timestamp);
    
    // Add new data point
    timeLabels.push(timestamp);
    altitudeGpsData.push({ x: timestamp, y: data.altitude_gps });
    altitudePressureData.push({ x: timestamp, y: data.altitude_pressure });
    pressureData.push({ x: timestamp, y: data.pressure });
    
    // Update GPS chart if coordinates are valid
    if (data.gps_valid && data.latitude && data.longitude) {
        gpsChart.data.datasets[0].data.push({
            x: data.longitude,
            y: data.latitude
        });
    }
    
    // Keep only last 100 points
    const maxPoints = 100;
    if (timeLabels.length > maxPoints) {
        timeLabels.splice(0, timeLabels.length - maxPoints);
        altitudeGpsData.splice(0, altitudeGpsData.length - maxPoints);
        altitudePressureData.splice(0, altitudePressureData.length - maxPoints);
        pressureData.splice(0, pressureData.length - maxPoints);
    }
    
    // Update charts
    altitudeChart.update('none');
    pressureChart.update('none');
    gpsChart.update('none');
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
    updateCurrentData(data);
    updateCharts(data);
    
    // Update data count
    elements.dataCount.textContent = timeLabels.length;
    
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
    initializeCharts();
    loadPorts();
    addLogEntry('Ground Station initialized');
});
