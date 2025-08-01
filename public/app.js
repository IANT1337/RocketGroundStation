// Initialize socket connection
const socket = io();

// Debug configuration
let DEBUG_ENABLED = false; // Set to true to enable debug console logs
let FULL_LOGGING_ENABLED = false; // Set to true to log every telemetry message

// Debug wrapper function
function debugLog(...args) {
    if (DEBUG_ENABLED) {
        console.log(...args);
    }
}

// Chart instances
let altitudeChart = null;
let pressureChart = null;
let gpsChart = null;
let accelChart = null;
let gyroChart = null;
let temperatureChart = null;
let powerChart = null;

// 3D Visualization instances
let scene = null;
let camera = null;
let renderer = null;
let rocketModel = null;
let animationId = null;
let autoRotate = false;

// Current orientation data
let currentRoll = 0;
let currentPitch = 0;
let currentYaw = 0;

// Data arrays for charts
let timeLabels = [];
let altitudeGpsData = [];
let altitudePressureData = [];
let pressureData = [];
let latitudeData = [];
let longitudeData = [];
let rssiData = []; // RSSI data array
// IMU data arrays
let accelXData = [];
let accelYData = [];
let accelZData = [];
let gyroXData = [];
let gyroYData = [];
let gyroZData = [];
let imuTemperatureData = [];
// Power data arrays
let busVoltageData = [];
let currentData = [];
let powerData = [];

// Telemetry averaging for log display
let telemetryBuffer = [];
let telemetryCounter = 0;

// Terminal variables
let terminalElement = null;
let discardTelemetryPackets = true;
const TELEMETRY_LOG_INTERVAL = 10; // Log every 10th telemetry message as average
const TELEMETRY_AVERAGE_WINDOW = 10; // Average over last 10 messages

// GPS validity tracking
let lastGpsValidTime = null;
let lastGpsValidState = null;
const GPS_INVALID_THRESHOLD = 7000; // 7 seconds in milliseconds

// CSV status tracking
let currentCsvFilename = null;

// DOM elements
const elements = {
    portSelect: document.getElementById('port-select'),
    baudRate: document.getElementById('baud-rate'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    clearDataBtn: document.getElementById('clear-data-btn'),
    refreshPortsBtn: document.getElementById('refresh-ports'),
    debugModeCheckbox: document.getElementById('debug-mode'),
    fullLoggingCheckbox: document.getElementById('full-logging'),
    serialStatus: document.getElementById('serial-status'),
    csvStatus: document.getElementById('csv-status'),
    dataCount: document.getElementById('data-count'),
    messageCount: document.getElementById('message-count'),
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
    pressure_valid: document.getElementById('current-pressure-valid'),
    accel_x: document.getElementById('current-accel-x'),
    accel_y: document.getElementById('current-accel-y'),
    accel_z: document.getElementById('current-accel-z'),
    gyro_x: document.getElementById('current-gyro-x'),
    gyro_y: document.getElementById('current-gyro-y'),
    gyro_z: document.getElementById('current-gyro-z'),
    mag_x: document.getElementById('current-mag-x'),
    mag_y: document.getElementById('current-mag-y'),
    mag_z: document.getElementById('current-mag-z'),
    imu_temperature: document.getElementById('current-imu-temperature'),
    imu_valid: document.getElementById('current-imu-valid'),
    bus_voltage: document.getElementById('current-bus-voltage'),
    current: document.getElementById('current-current'),
    power: document.getElementById('current-power'),
    power_valid: document.getElementById('current-power-valid')
};

// Initialize charts
function initializeCharts() {
    debugLog('Initializing charts...');
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        throw new Error('Chart.js is not loaded');
    }
    if (typeof moment === 'undefined') {
        throw new Error('moment.js is not loaded');
    }
    
    debugLog('Chart.js version available, initializing charts...');
    
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

    // Accelerometer Chart
    const accelCtx = document.getElementById('accel-chart').getContext('2d');
    accelChart = new Chart(accelCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Accel X (m/s²)',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                tension: 0.1
            }, {
                label: 'Accel Y (m/s²)',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                tension: 0.1
            }, {
                label: 'Accel Z (m/s²)',
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
                    title: {
                        display: true,
                        text: 'Acceleration (m/s²)'
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

    // Gyroscope Chart
    const gyroCtx = document.getElementById('gyro-chart').getContext('2d');
    gyroChart = new Chart(gyroCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Gyro X (°/s)',
                data: [],
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.1)',
                tension: 0.1
            }, {
                label: 'Gyro Y (°/s)',
                data: [],
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                tension: 0.1
            }, {
                label: 'Gyro Z (°/s)',
                data: [],
                borderColor: 'rgb(255, 205, 86)',
                backgroundColor: 'rgba(255, 205, 86, 0.1)',
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
                    title: {
                        display: true,
                        text: 'Angular Velocity (°/s)'
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

    // Temperature Chart
    const tempCtx = document.getElementById('temperature-chart').getContext('2d');
    temperatureChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'IMU Temperature (°C)',
                data: [],
                borderColor: 'rgb(255, 99, 71)',
                backgroundColor: 'rgba(255, 99, 71, 0.1)',
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
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });

    // Power Chart
    const powerCtx = document.getElementById('power-chart').getContext('2d');
    powerChart = new Chart(powerCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Bus Voltage (V)',
                data: [],
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                tension: 0.1
            }, {
                label: 'Current (mA)',
                data: [],
                borderColor: 'rgb(220, 53, 69)',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.1,
                yAxisID: 'y1'
            }, {
                label: 'Power (mW)',
                data: [],
                borderColor: 'rgb(13, 202, 240)',
                backgroundColor: 'rgba(13, 202, 240, 0.1)',
                tension: 0.1,
                yAxisID: 'y1'
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
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Voltage (V)'
                    },
                    min: 0,
                    max: 15,
                    ticks: {
                        stepSize: 1
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Current (mA) / Power (mW)'
                    },
                    min: 0,
                    grid: {
                        drawOnChartArea: false,
                    },
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
}

// Initialize 3D Rocket Visualizer
function initialize3DVisualizer() {
    debugLog('Initializing 3D visualizer...');
    
    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
        console.error('Three.js is not loaded');
        return;
    }
    
    const container = document.getElementById('rocket-3d-viewer');
    if (!container) {
        console.error('3D viewer container not found');
        return;
    }
    
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000);
    container.appendChild(renderer.domElement);
    
    // Create rocket model (simplified cylinder with cone)
    createRocketModel();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x00ff00, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x00ff00, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add reference grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x00ff00, 0x004400);
    gridHelper.rotateX(Math.PI / 2);
    scene.add(gridHelper);
    
    // Add coordinate axes
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);
    
    // Start animation loop
    animate3D();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize3D);
    
    // Add event listeners for controls
    setupVisualizerControls();
    
    debugLog('3D visualizer initialized successfully');
}

// Create simplified rocket model
function createRocketModel() {
    const rocketGroup = new THREE.Group();
    
    // Rocket body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8,
        wireframe: false
    });
    const rocketBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    rocketGroup.add(rocketBody);
    
    // Nose cone
    const noseGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
    const noseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00cc00,
        transparent: true,
        opacity: 0.9
    });
    const noseCone = new THREE.Mesh(noseGeometry, noseMaterial);
    noseCone.position.y = 1.9;
    rocketGroup.add(noseCone);
    
    // Fins
    const finGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.4);
    const finMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x008800,
        transparent: true,
        opacity: 0.7
    });
    
    // Add 4 fins
    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(finGeometry, finMaterial);
        fin.position.y = -1.2;
        fin.position.x = Math.cos(i * Math.PI / 2) * 0.35;
        fin.position.z = Math.sin(i * Math.PI / 2) * 0.35;
        fin.lookAt(0, -1.2, 0);
        rocketGroup.add(fin);
    }
    
    // Engine nozzle
    const nozzleGeometry = new THREE.CylinderGeometry(0.15, 0.25, 0.4, 8);
    const nozzleMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x006600,
        transparent: true,
        opacity: 0.8
    });
    const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
    nozzle.position.y = -1.7;
    rocketGroup.add(nozzle);
    
    // Set initial orientation (nose pointing up)
    rocketGroup.rotation.x = 0;
    rocketGroup.rotation.y = 0;
    rocketGroup.rotation.z = 0;
    
    rocketModel = rocketGroup;
    scene.add(rocketModel);
}

// Animation loop for 3D scene
function animate3D() {
    animationId = requestAnimationFrame(animate3D);
    
    // Auto-rotate camera if enabled
    if (autoRotate) {
        const time = Date.now() * 0.001;
        camera.position.x = Math.cos(time) * 5;
        camera.position.z = Math.sin(time) * 5;
        camera.lookAt(0, 0, 0);
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize3D() {
    const container = document.getElementById('rocket-3d-viewer');
    if (container && camera && renderer) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

// Setup visualizer controls
function setupVisualizerControls() {
    const resetBtn = document.getElementById('reset-orientation');
    const autoRotateBtn = document.getElementById('auto-rotate');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Reset camera position
            camera.position.set(0, 0, 5);
            camera.lookAt(0, 0, 0);
            
            // Reset rocket orientation
            if (rocketModel) {
                rocketModel.rotation.set(0, 0, 0);
            }
            
            // Reset orientation values
            currentRoll = 0;
            currentPitch = 0;
            currentYaw = 0;
            updateOrientationDisplay();
            
            debugLog('3D view reset');
        });
    }
    
    if (autoRotateBtn) {
        autoRotateBtn.addEventListener('click', () => {
            autoRotate = !autoRotate;
            autoRotateBtn.textContent = autoRotate ? 'Stop Auto Rotate' : 'Auto Rotate';
            autoRotateBtn.classList.toggle('active', autoRotate);
            debugLog('Auto rotate:', autoRotate);
        });
    }
}

// Update rocket orientation based on IMU data
function updateRocketOrientation(accelX, accelY, accelZ, gyroX, gyroY, gyroZ) {
    if (!rocketModel) return;
    
    // Calculate roll and pitch from accelerometer data
    // Roll (rotation around X-axis)
    currentRoll = Math.atan2(accelY, accelZ) * (180 / Math.PI);
    
    // Pitch (rotation around Y-axis)
    currentPitch = Math.atan2(-accelX, Math.sqrt(accelY * accelY + accelZ * accelZ)) * (180 / Math.PI);
    
    // For yaw, we would need magnetometer data or integrate gyroscope data
    // For now, we'll use a simple integration of gyro Z
    currentYaw += gyroZ * 0.1; // Simple integration (this would drift in real application)
    
    // Apply rotations to the rocket model
    // Note: Three.js uses radians, so convert from degrees
    rocketModel.rotation.x = currentPitch * (Math.PI / 180);
    rocketModel.rotation.y = currentYaw * (Math.PI / 180);
    rocketModel.rotation.z = currentRoll * (Math.PI / 180);
    
    // Update the orientation display
    updateOrientationDisplay();
}

// Update orientation display values
function updateOrientationDisplay() {
    const rollElement = document.getElementById('current-roll');
    const pitchElement = document.getElementById('current-pitch');
    const yawElement = document.getElementById('current-yaw');
    
    if (rollElement) rollElement.textContent = `${currentRoll.toFixed(1)}°`;
    if (pitchElement) pitchElement.textContent = `${currentPitch.toFixed(1)}°`;
    if (yawElement) yawElement.textContent = `${currentYaw.toFixed(1)}°`;
}

// Function to determine GPS validity status with 5-second delay
function getGpsValidityStatus(currentGpsValid) {
    const currentTime = Date.now();
    
    // If GPS state has changed, update the tracking
    if (lastGpsValidState !== currentGpsValid) {
        lastGpsValidState = currentGpsValid;
        lastGpsValidTime = currentTime;
    }
    
    // If GPS is currently valid, always show as valid
    if (currentGpsValid) {
        return true;
    }
    
    // If GPS is invalid, check if it's been invalid for more than 5 seconds
    if (!currentGpsValid && lastGpsValidTime !== null) {
        const timeSinceChange = currentTime - lastGpsValidTime;
        // Only show as invalid if it's been invalid for more than the threshold
        return timeSinceChange < GPS_INVALID_THRESHOLD;
    }
    
    // Default case - if we don't have tracking data yet, follow current state
    return currentGpsValid;
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
                    '0': 'SLEEP',
                    '1': 'FLIGHT',
                    '2': 'MAINTENANCE',
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
            } else if (key === 'gps_valid') {
                // Use the delayed GPS validity logic
                const displayValid = getGpsValidityStatus(value);
                element.className = `data-value status-indicator ${displayValid ? 'valid' : 'invalid'}`;
                value = displayValid ? '✓ Valid' : '✗ Invalid';
            } else if (key === 'pressure_valid') {
                element.className = `data-value status-indicator ${value ? 'valid' : 'invalid'}`;
                value = value ? '✓ Valid' : '✗ Invalid';
            } else if (key.startsWith('accel_') || key.startsWith('gyro_')) {
                // Format accelerometer and gyroscope values
                value = typeof value === 'number' ? value.toFixed(3) : '-';
            } else if (key.startsWith('mag_')) {
                // Format magnetometer values
                value = typeof value === 'number' ? value.toFixed(1) : '-';
            } else if (key === 'imu_temperature') {
                // Format IMU temperature
                value = typeof value === 'number' ? `${value.toFixed(1)} °C` : '- °C';
            } else if (key === 'imu_valid') {
                // Format IMU validity indicator
                element.className = `data-value status-indicator ${value ? 'valid' : 'invalid'}`;
                value = value ? '✓ Valid' : '✗ Invalid';
            } else if (key === 'bus_voltage') {
                // Format bus voltage
                value = typeof value === 'number' ? `${value.toFixed(2)} V` : '- V';
            } else if (key === 'current') {
                // Format current
                value = typeof value === 'number' ? `${value.toFixed(1)} mA` : '- mA';
            } else if (key === 'power') {
                // Format power
                value = typeof value === 'number' ? `${value.toFixed(0)} mW` : '- mW';
            } else if (key === 'power_valid') {
                // Format power validity indicator
                element.className = `data-value status-indicator ${value ? 'valid' : 'invalid'}`;
                value = value ? '✓ Valid' : '✗ Invalid';
            }
            
            element.textContent = value;
            
            // Remove the flash animation - no more visual disruption
        }
    });
}

// Process INA260 power data (ESP32 already sends converted values)
function processINA260Data(data) {
    // ESP32 sends data in correct units: V, mA, mW
    // No conversion needed, just log unusual values for debugging
    if (data.bus_voltage > 20 || data.bus_voltage < 0) {
        console.log(`Unusual voltage reading: ${data.bus_voltage}V`);
    }
    
    if (Math.abs(data.current) > 5000) {
        console.log(`High current reading: ${data.current}mA`);
    }
    
    if (data.power > 50000) {
        console.log(`High power reading: ${data.power}mW`);
    }
    
    return data;
}

// Update charts with new data
function updateCharts(data) {
    debugLog('updateCharts called with:', data);
    
    // Process INA260 power data if needed
    data = processINA260Data(data);
    
    // Validate that we have the required chart instances
    if (!altitudeChart || !pressureChart || !gpsChart || !accelChart || !gyroChart || !temperatureChart || !powerChart) {
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
    
    debugLog('Timestamp:', timestamp.format());
    
    // Create a simple time label for the x-axis
    const timeLabel = timestamp.format('HH:mm:ss');
    
    // Add new data point to our arrays
    timeLabels.push(timeLabel);
    altitudeGpsData.push(data.altitude_gps);
    altitudePressureData.push(data.altitude_pressure);
    pressureData.push(data.pressure);
    rssiData.push(data.rssi); // Store RSSI data
    
    // Add IMU data to arrays
    accelXData.push(data.accel_x);
    accelYData.push(data.accel_y);
    accelZData.push(data.accel_z);
    gyroXData.push(data.gyro_x);
    gyroYData.push(data.gyro_y);
    gyroZData.push(data.gyro_z);
    imuTemperatureData.push(data.imu_temperature);
    
    // Add power data to arrays
    busVoltageData.push(data.bus_voltage);
    currentData.push(data.current);
    powerData.push(data.power);
    
    // Debug power data values - log any power readings for monitoring
    if (data.power_valid && (data.bus_voltage > 0 || data.current !== 0 || data.power > 0)) {
        debugLog('Power data received:', {
            bus_voltage: data.bus_voltage,
            current: data.current,
            power: data.power,
            power_valid: data.power_valid
        });
    }
    
    // Add data to chart labels and datasets
    altitudeChart.data.labels.push(timeLabel);
    altitudeChart.data.datasets[0].data.push(data.altitude_gps);
    altitudeChart.data.datasets[1].data.push(data.altitude_pressure);
    
    pressureChart.data.labels.push(timeLabel);
    pressureChart.data.datasets[0].data.push(data.pressure);
    
    // Add IMU data to charts
    accelChart.data.labels.push(timeLabel);
    accelChart.data.datasets[0].data.push(data.accel_x);
    accelChart.data.datasets[1].data.push(data.accel_y);
    accelChart.data.datasets[2].data.push(data.accel_z);
    
    gyroChart.data.labels.push(timeLabel);
    gyroChart.data.datasets[0].data.push(data.gyro_x);
    gyroChart.data.datasets[1].data.push(data.gyro_y);
    gyroChart.data.datasets[2].data.push(data.gyro_z);
    
    temperatureChart.data.labels.push(timeLabel);
    temperatureChart.data.datasets[0].data.push(data.imu_temperature);
    
    // Add power data to charts
    powerChart.data.labels.push(timeLabel);
    powerChart.data.datasets[0].data.push(data.bus_voltage);
    powerChart.data.datasets[1].data.push(data.current);
    powerChart.data.datasets[2].data.push(data.power);
    
    debugLog('Chart data lengths:', {
        timeLabels: timeLabels.length,
        altitudeGps: altitudeGpsData.length,
        altitudePressure: altitudePressureData.length,
        pressure: pressureData.length,
        rssi: rssiData.length,
        accelX: accelXData.length,
        accelY: accelYData.length,
        accelZ: accelZData.length,
        gyroX: gyroXData.length,
        gyroY: gyroYData.length,
        gyroZ: gyroZData.length,
        imuTemp: imuTemperatureData.length,
        busVoltage: busVoltageData.length,
        current: currentData.length,
        power: powerData.length,
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
        debugLog('Added GPS point:', data.longitude, data.latitude);
    }
    
    // Keep only last 100 points for time-series charts
    const maxPoints = 100;
    if (timeLabels.length > maxPoints) {
        timeLabels.splice(0, timeLabels.length - maxPoints);
        altitudeGpsData.splice(0, altitudeGpsData.length - maxPoints);
        altitudePressureData.splice(0, altitudePressureData.length - maxPoints);
        pressureData.splice(0, pressureData.length - maxPoints);
        rssiData.splice(0, rssiData.length - maxPoints); // Clean RSSI data array
        
        // Clean up IMU data arrays
        accelXData.splice(0, accelXData.length - maxPoints);
        accelYData.splice(0, accelYData.length - maxPoints);
        accelZData.splice(0, accelZData.length - maxPoints);
        gyroXData.splice(0, gyroXData.length - maxPoints);
        gyroYData.splice(0, gyroYData.length - maxPoints);
        gyroZData.splice(0, gyroZData.length - maxPoints);
        imuTemperatureData.splice(0, imuTemperatureData.length - maxPoints);
        
        // Clean up power data arrays
        busVoltageData.splice(0, busVoltageData.length - maxPoints);
        currentData.splice(0, currentData.length - maxPoints);
        powerData.splice(0, powerData.length - maxPoints);
        
        // Clean up chart data as well
        altitudeChart.data.labels.splice(0, altitudeChart.data.labels.length - maxPoints);
        altitudeChart.data.datasets[0].data.splice(0, altitudeChart.data.datasets[0].data.length - maxPoints);
        altitudeChart.data.datasets[1].data.splice(0, altitudeChart.data.datasets[1].data.length - maxPoints);
        pressureChart.data.labels.splice(0, pressureChart.data.labels.length - maxPoints);
        pressureChart.data.datasets[0].data.splice(0, pressureChart.data.datasets[0].data.length - maxPoints);
        
        // Clean up IMU chart data
        accelChart.data.labels.splice(0, accelChart.data.labels.length - maxPoints);
        accelChart.data.datasets[0].data.splice(0, accelChart.data.datasets[0].data.length - maxPoints);
        accelChart.data.datasets[1].data.splice(0, accelChart.data.datasets[1].data.length - maxPoints);
        accelChart.data.datasets[2].data.splice(0, accelChart.data.datasets[2].data.length - maxPoints);
        
        gyroChart.data.labels.splice(0, gyroChart.data.labels.length - maxPoints);
        gyroChart.data.datasets[0].data.splice(0, gyroChart.data.datasets[0].data.length - maxPoints);
        gyroChart.data.datasets[1].data.splice(0, gyroChart.data.datasets[1].data.length - maxPoints);
        gyroChart.data.datasets[2].data.splice(0, gyroChart.data.datasets[2].data.length - maxPoints);
        
        temperatureChart.data.labels.splice(0, temperatureChart.data.labels.length - maxPoints);
        temperatureChart.data.datasets[0].data.splice(0, temperatureChart.data.datasets[0].data.length - maxPoints);
        
        // Clean up power chart data
        powerChart.data.labels.splice(0, powerChart.data.labels.length - maxPoints);
        powerChart.data.datasets[0].data.splice(0, powerChart.data.datasets[0].data.length - maxPoints);
        powerChart.data.datasets[1].data.splice(0, powerChart.data.datasets[1].data.length - maxPoints);
        powerChart.data.datasets[2].data.splice(0, powerChart.data.datasets[2].data.length - maxPoints);
    }
    
    // Keep only last 100 points for GPS chart as well
    if (gpsChart.data.datasets[0].data.length > maxPoints) {
        gpsChart.data.datasets[0].data.splice(0, gpsChart.data.datasets[0].data.length - maxPoints);
    }
    
    // Update charts
    debugLog('Updating charts...');
    try {
        altitudeChart.update('none');
        debugLog('Altitude chart updated');
    } catch (error) {
        console.error('Error updating altitude chart:', error);
        throw error;
    }
    
    try {
        pressureChart.update('none');
        debugLog('Pressure chart updated');
    } catch (error) {
        console.error('Error updating pressure chart:', error);
        throw error;
    }
    
    try {
        gpsChart.update('none');
        debugLog('GPS chart updated');
    } catch (error) {
        console.error('Error updating GPS chart:', error);
        throw error;
    }
    
    // Update IMU charts
    try {
        accelChart.update('none');
        debugLog('Accelerometer chart updated');
    } catch (error) {
        console.error('Error updating accelerometer chart:', error);
        throw error;
    }
    
    try {
        gyroChart.update('none');
        debugLog('Gyroscope chart updated');
    } catch (error) {
        console.error('Error updating gyroscope chart:', error);
        throw error;
    }
    
    try {
        temperatureChart.update('none');
        debugLog('Temperature chart updated');
    } catch (error) {
        console.error('Error updating temperature chart:', error);
        throw error;
    }
    
    // Update power chart
    try {
        powerChart.update('none');
        debugLog('Power chart updated');
    } catch (error) {
        console.error('Error updating power chart:', error);
        throw error;
    }
    
    debugLog('All charts updated successfully');
    
    // Update 3D rocket orientation if visualizer is initialized
    if (rocketModel) {
        updateRocketOrientation(
            data.accel_x || 0,
            data.accel_y || 0, 
            data.accel_z || 0,
            data.gyro_x || 0,
            data.gyro_y || 0,
            data.gyro_z || 0
        );
    }
}

// Process telemetry for averaged logging
function processTelemetryForLogging(data) {
    // If full logging is enabled, log every message
    if (FULL_LOGGING_ENABLED) {
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
        debugLog(logMessage);
        return;
    }
    
    // Add to buffer for averaging
    telemetryBuffer.push(data);
    
    // Keep buffer size manageable
    if (telemetryBuffer.length > TELEMETRY_AVERAGE_WINDOW) {
        telemetryBuffer.shift();
    }
    
    telemetryCounter++;
    
    // Only log averaged data every N messages
    if (telemetryCounter % TELEMETRY_LOG_INTERVAL === 0) {
        // Calculate averages from buffer
        const avgData = calculateTelemetryAverages();
        const modeNames = {
            '0': 'INIT',
            '1': 'PAD',
            '2': 'FLIGHT',
            '3': 'APOGEE',
            '4': 'DESCENT',
            '5': 'RECOVERY'
        };
        
        // Use the most recent mode (modes don't average well)
        const modeName = modeNames[data.mode] || data.mode;
        
        const logMessage = `AVG TELEM (${telemetryBuffer.length} msgs): ${modeName} | GPS: ${avgData.latitude?.toFixed(6)}, ${avgData.longitude?.toFixed(6)} | Alt: ${avgData.altitude_gps?.toFixed(1)}m (GPS), ${avgData.altitude_pressure?.toFixed(1)}m (Press) | Pressure: ${avgData.pressure?.toFixed(1)}Pa | Valid: GPS=${data.gps_valid ? 'Y' : 'N'}, Press=${data.pressure_valid ? 'Y' : 'N'}`;
        debugLog(logMessage);
    }
}

// Calculate averages from telemetry buffer
function calculateTelemetryAverages() {
    if (telemetryBuffer.length === 0) return {};
    
    const sums = {
        latitude: 0,
        longitude: 0,
        altitude_gps: 0,
        altitude_pressure: 0,
        pressure: 0,
        rssi: 0
    };
    
    let validCount = {
        latitude: 0,
        longitude: 0,
        altitude_gps: 0,
        altitude_pressure: 0,
        pressure: 0,
        rssi: 0
    };
    
    telemetryBuffer.forEach(data => {
        if (typeof data.latitude === 'number' && !isNaN(data.latitude)) {
            sums.latitude += data.latitude;
            validCount.latitude++;
        }
        if (typeof data.longitude === 'number' && !isNaN(data.longitude)) {
            sums.longitude += data.longitude;
            validCount.longitude++;
        }
        if (typeof data.altitude_gps === 'number' && !isNaN(data.altitude_gps)) {
            sums.altitude_gps += data.altitude_gps;
            validCount.altitude_gps++;
        }
        if (typeof data.altitude_pressure === 'number' && !isNaN(data.altitude_pressure)) {
            sums.altitude_pressure += data.altitude_pressure;
            validCount.altitude_pressure++;
        }
        if (typeof data.pressure === 'number' && !isNaN(data.pressure)) {
            sums.pressure += data.pressure;
            validCount.pressure++;
        }
        if (typeof data.rssi === 'number' && !isNaN(data.rssi)) {
            sums.rssi += data.rssi;
            validCount.rssi++;
        }
    });
    
    const averages = {};
    Object.keys(sums).forEach(key => {
        if (validCount[key] > 0) {
            averages[key] = sums[key] / validCount[key];
        }
    });
    
    return averages;
}

// Terminal functions
function addTerminalLine(message, type = 'received') {
    if (!terminalElement) return;
    
    const timestamp = moment().format('HH:mm:ss.SSS');
    const terminalLine = document.createElement('div');
    terminalLine.className = `terminal-line ${type}`;
    
    if (type === 'sent') {
        terminalLine.innerHTML = `<span class="terminal-timestamp">[${timestamp}] ></span> ${message}`;
    } else {
        terminalLine.innerHTML = `<span class="terminal-timestamp">[${timestamp}]</span> ${message}`;
    }
    
    terminalElement.appendChild(terminalLine);
    
    // Auto-scroll to bottom
    terminalElement.scrollTop = terminalElement.scrollHeight;
    
    // Keep only last 1000 entries
    const entries = terminalElement.children;
    if (entries.length > 1000) {
        terminalElement.removeChild(entries[0]);
    }
}

function clearTerminal() {
    if (terminalElement) {
        terminalElement.innerHTML = '<div class="terminal-line info">Terminal cleared.</div>';
    }
}

function sendTerminalCommand() {
    const commandInput = document.getElementById('command-input');
    const command = commandInput.value.trim();
    
    if (!command) return;
    
    // Add command to terminal display
    addTerminalLine(command, 'sent');
    
    // Send command via socket
    socket.emit('send-raw-command', command);
    
    // Clear input
    commandInput.value = '';
}

function initializeTerminal() {
    terminalElement = document.getElementById('terminal-output');
    const commandInput = document.getElementById('command-input');
    const sendButton = document.getElementById('send-command');
    const clearButton = document.getElementById('clear-terminal');
    const discardCheckbox = document.getElementById('discard-telemetry');
    
    // Event listeners
    sendButton.addEventListener('click', sendTerminalCommand);
    clearButton.addEventListener('click', clearTerminal);
    
    // Enter key to send command
    commandInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTerminalCommand();
        }
    });
    
    // Discard telemetry checkbox
    discardCheckbox.addEventListener('change', (e) => {
        discardTelemetryPackets = e.target.checked;
    });
    
    // Initialize discard setting
    discardTelemetryPackets = discardCheckbox.checked;
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
        addTerminalLine(`🚀 COMMAND SENT: ${command}`, 'sent');
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
    addTerminalLine(`Attempting to connect to ${port} at ${baudRate} baud...`, 'info');
});

elements.disconnectBtn.addEventListener('click', () => {
    socket.emit('disconnect-serial');
});

elements.clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data?')) {
        socket.emit('clear-data');
    }
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

// Debug mode controls
elements.debugModeCheckbox.addEventListener('change', (e) => {
    DEBUG_ENABLED = e.target.checked;
    addTerminalLine(`Debug mode ${DEBUG_ENABLED ? 'enabled' : 'disabled'}`, 'info');
});

elements.fullLoggingCheckbox.addEventListener('change', (e) => {
    FULL_LOGGING_ENABLED = e.target.checked;
    addTerminalLine(`Full telemetry logging ${FULL_LOGGING_ENABLED ? 'enabled' : 'disabled'}`, 'info');
});

// Socket event handlers for terminal
socket.on('raw-data', (data) => {
    // Check if this looks like a telemetry packet and should be discarded
    const isTelemetryPacket = data.startsWith('TELEM');
    
    if (discardTelemetryPackets && isTelemetryPacket) {
        // Don't show telemetry packets in terminal if discard is enabled
        return;
    }
    
    addTerminalLine(data, 'received');
});

socket.on('raw-command-sent', (data) => {
    addTerminalLine(`Command sent: ${data.command}`, 'info');
});

socket.on('raw-command-error', (error) => {
    addTerminalLine(`Command error: ${error}`, 'error');
});

// Socket event handlers
socket.on('ports-list', (ports) => {
    elements.portSelect.innerHTML = '<option value="">Select Port...</option>';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
        elements.portSelect.appendChild(option);
    });
    addTerminalLine(`Found ${ports.length} serial ports`, 'info');
});

socket.on('ports-error', (error) => {
    addTerminalLine(`Error listing ports: ${error}`, 'error');
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
        // Enable terminal controls when connected
        document.getElementById('command-input').disabled = false;
        document.getElementById('send-command').disabled = false;
        addTerminalLine(`Connected to ${status.port} at ${status.baudRate} baud`, 'info');
    } else {
        elements.serialStatus.textContent = 'Disconnected';
        elements.serialStatus.className = 'status-value disconnected';
        elements.connectBtn.disabled = false;
        elements.disconnectBtn.disabled = true;
        // Disable rocket control buttons when disconnected
        elements.sleepCmd.disabled = true;
        elements.maintCmd.disabled = true;
        elements.flightCmd.disabled = true;
        // Disable terminal controls when disconnected
        document.getElementById('command-input').disabled = true;
        document.getElementById('send-command').disabled = true;
        addTerminalLine('Disconnected from serial port', 'info');
    }
});

socket.on('serial-error', (error) => {
    addTerminalLine(`Serial error: ${error}`, 'error');
    elements.serialStatus.textContent = 'Error';
    elements.serialStatus.className = 'status-value disconnected';
});

socket.on('csv-status', (status) => {
    if (status.logging) {
        currentCsvFilename = status.filename;
        elements.csvStatus.textContent = `${status.filename}`;
        elements.csvStatus.className = 'status-value connected';
        addTerminalLine(`CSV logging started: ${status.filename}`, 'info');
    } else {
        currentCsvFilename = null;
        elements.csvStatus.textContent = 'Inactive';
        elements.csvStatus.className = 'status-value';
    }
});

socket.on('csv-buffer-status', (bufferStatus) => {
    // Update CSV status to include buffer information
    if (currentCsvFilename && bufferStatus.bufferSize > 0) {
        const bufferPercent = Math.round((bufferStatus.bufferSize / bufferStatus.maxSize) * 100);
        elements.csvStatus.textContent = `Logging: ${currentCsvFilename} (Buffer: ${bufferStatus.bufferSize}/${bufferStatus.maxSize})`;
        
        // Change color based on buffer fullness
        if (bufferPercent > 80) {
            elements.csvStatus.className = 'status-value status-indicator warning';
        } else {
            elements.csvStatus.className = 'status-value connected';
        }
    } else if (currentCsvFilename) {
        // Buffer is empty, show normal logging status
        elements.csvStatus.textContent = `Logging: ${currentCsvFilename}`;
        elements.csvStatus.className = 'status-value connected';
    }
});

socket.on('telemetry-data', (data) => {
    debugLog('Received telemetry data:', data);
    
    // Update message counter
    const currentCount = parseInt(elements.messageCount.textContent) || 0;
    elements.messageCount.textContent = currentCount + 1;
    
    try {
        updateCurrentData(data);
    } catch (error) {
        console.error('Error updating current data:', error);
        addTerminalLine(`Error updating current data: ${error.message}`, 'error');
    }
    
    try {
        updateCharts(data);
        // Update data count after successful chart update
        elements.dataCount.textContent = timeLabels.length;
    } catch (error) {
        console.error('Error updating charts:', error);
        addTerminalLine(`Error updating charts: ${error.message}`, 'error');
        // Still update data count even if charts fail
        elements.dataCount.textContent = (parseInt(elements.dataCount.textContent) || 0) + 1;
    }
    
    // Process telemetry for averaged logging instead of logging every message
    processTelemetryForLogging(data);
});

socket.on('telemetry-history', (data) => {
    // Load historical data
    data.forEach(telemetry => {
        updateCharts(telemetry);
    });
    elements.dataCount.textContent = data.length;
    addTerminalLine(`Loaded ${data.length} historical data points`, 'info');
});

socket.on('data-cleared', () => {
    // Clear all data arrays
    timeLabels.length = 0;
    altitudeGpsData.length = 0;
    altitudePressureData.length = 0;
    pressureData.length = 0;
    rssiData.length = 0; // Clear RSSI data array
    
    // Clear telemetry averaging variables
    telemetryBuffer.length = 0;
    telemetryCounter = 0;
    
    // Reset GPS validity tracking
    lastGpsValidTime = null;
    lastGpsValidState = null;
    
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
    elements.messageCount.textContent = '0';
    addTerminalLine('All data cleared', 'info');
});

socket.on('command-sent', (data) => {
    addTerminalLine(`✅ Command "${data.command}" sent successfully`, 'info');
});

socket.on('command-error', (error) => {
    addTerminalLine(`❌ Command error: ${error}`, 'error');
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM Content Loaded - Initializing application...');
    
    // Wait for libraries to load
    const checkLibraries = () => {
        const chartAvailable = typeof Chart !== 'undefined';
        const momentAvailable = typeof moment !== 'undefined';
        const socketAvailable = typeof io !== 'undefined';
        const threeAvailable = typeof THREE !== 'undefined';
        
        debugLog('Library status:', {
            'Chart.js': chartAvailable,
            'moment.js': momentAvailable,
            'Socket.io': socketAvailable,
            'Three.js': threeAvailable
        });
        
        if (!chartAvailable) {
            console.error('Chart.js is not loaded');
            // Use console.error instead of addLogEntry since terminal may not be ready yet
            return false;
        }
        
        if (!momentAvailable) {
            console.error('moment.js is not loaded');
            // Use console.error instead of addLogEntry since terminal may not be ready yet
            return false;
        }
        
        if (!socketAvailable) {
            console.error('Socket.io is not loaded');
            // Use console.error instead of addLogEntry since terminal may not be ready yet
            return false;
        }
        
        if (!threeAvailable) {
            console.error('Three.js is not loaded');
            // Use console.error instead of addLogEntry since terminal may not be ready yet
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
                }
            }, 1000);
        } else {
            initializeApp();
        }
    }, 200);
});

function initializeApp() {
    debugLog('Initializing application...');
    
    try {
        initializeCharts();
        debugLog('Charts initialized successfully');
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
    
    try {
        initialize3DVisualizer();
        debugLog('3D visualizer initialized successfully');
    } catch (error) {
        console.error('Error initializing 3D visualizer:', error);
    }
    
    try {
        initializeTerminal();
        debugLog('Terminal initialized successfully');
    } catch (error) {
        console.error('Error initializing terminal:', error);
    }
    
    try {
        loadPorts();
        debugLog('Ports loading initiated');
    } catch (error) {
        console.error('Error loading ports:', error);
    }
    
    // Initialize complete - all notifications now go to terminal
    addTerminalLine('✅ Ground Station initialized', 'info');
    debugLog('Application initialization complete');
}
