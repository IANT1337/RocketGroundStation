// Initialize socket connection
const socket = io();

// Socket connection event handlers
socket.on('connect', () => {
    console.log('Socket.IO connected successfully');
    // Load ports when connection is established
    setTimeout(() => {
        console.log('Loading ports after connection...');
        loadPorts();
    }, 500); // Small delay to ensure server is ready
});

socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

// Debug configuration
let DEBUG_ENABLED = false; // Set to true to enable debug console logs

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



// Chart update rate control
let chartUpdateRate = 10; // Default to 10 data points
let currentRocketMode = '-';
let currentRocketModeNumeric = null; // Track numeric mode value
let chartDataBuffer = []; // Buffer for averaging chart data
let chartUpdateCounter = 0;
let userHasSetChartRate = false; // Track if user has manually set the chart rate

// Terminal variables
let terminalElement = null;


// GPS validity tracking
let lastGpsValidTime = null;
let lastGpsValidState = null;
const GPS_INVALID_THRESHOLD = 7000; // 7 seconds in milliseconds

// CSV status tracking
let currentCsvFilename = null;

// DOM elements - will be initialized in DOMContentLoaded
let elements = {};

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
                    },
                    ticks: {
                        stepSize: 1
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
                    
                                        },
                    ticks: {
                        stepSize: 1
                    }
                },
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
                    },
                    ticks: {
                        stepSize: 1
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

// Chart update rate management functions
function updateChartUpdateRate() {
    if (!elements.chartUpdateRateSelect) {
        console.log('Chart update rate select not available, using default rate');
        return;
    }
    const newRate = parseInt(elements.chartUpdateRateSelect.value);
    chartUpdateRate = newRate;
    
    // Mark that user has manually set the chart rate
    userHasSetChartRate = true;
    
    // Clear the buffer when rate changes
    chartDataBuffer = [];
    chartUpdateCounter = 0;
    
    addTerminalLine(`Chart update rate changed to 1:${newRate} (${newRate === 1 ? 'real-time' : 'averaged'})`, 'info');
    debugLog(`Chart update rate set to: ${newRate}`);
}

function setChartUpdateRateByMode(mode) {
    // For SLEEP mode, always set to real-time regardless of user preference
    // For other modes, don't auto-change if user has manually set the rate
    if (userHasSetChartRate && mode !== '0') {
        debugLog(`Skipping auto chart rate change - user has manually set rate to ${chartUpdateRate}`);
        
        // Still update the mode indicator
        const modeNames = {
            '0': 'SLEEP',
            '1': 'FLIGHT',
            '2': 'MAINTENANCE',
            '3': 'APOGEE',
            '4': 'DESCENT',
            '5': 'RECOVERY'
        };
        
        const modeName = modeNames[mode] || mode;
        currentRocketMode = modeName;
        currentRocketModeNumeric = mode;
        
        if (elements.currentModeIndicator) {
            elements.currentModeIndicator.textContent = `Mode: ${modeName}`;
        }
        
        return;
    }
    
    let newRate;
    const modeNames = {
        '0': 'SLEEP',
        '1': 'FLIGHT',
        '2': 'MAINTENANCE',
        '3': 'APOGEE',
        '4': 'DESCENT',
        '5': 'RECOVERY'
    };
    
    const modeName = modeNames[mode] || mode;
    currentRocketMode = modeName;
    currentRocketModeNumeric = mode;
    
    // Update mode indicator
    if (elements.currentModeIndicator) {
        elements.currentModeIndicator.textContent = `Mode: ${modeName}`;
    }
    
    // Set default rates based on mode
    if (mode === '0' || modeName === 'SLEEP') {
        newRate = 1; // Real-time for sleep mode
    } else if (mode === '2' || modeName === 'FLIGHT' || mode === '1' || modeName === 'MAINTENANCE') {
        newRate = 1; // Averaged for maintenance and flight modes
    } else {
        newRate = 10; // Default for other modes
    }
    
    // Only update if rate has changed
    if (newRate !== chartUpdateRate) {
        if (elements.chartUpdateRateSelect) {
            elements.chartUpdateRateSelect.value = newRate;
        }
        chartUpdateRate = newRate;
        
        // Clear the buffer when rate changes
        chartDataBuffer = [];
        chartUpdateCounter = 0;
        
        if (modeName === 'SLEEP') {
            addTerminalLine(`Chart update rate set to real-time for ${modeName} mode (updates every data point)`, 'info');
        } else {
            addTerminalLine(`Chart update rate auto-set to 1:${newRate} for ${modeName} mode (${newRate === 1 ? 'real-time' : 'averaged'})`, 'info');
        }
        debugLog(`Chart update rate auto-set to: ${newRate} for mode: ${modeName}`);
    }
}

function averageChartData(dataArray) {
    if (dataArray.length === 0) return {};
    
    const result = {};
    const sums = {};
    const counts = {};
    
    // Initialize sums and counts for all numeric fields
    dataArray.forEach(data => {
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'number' && !isNaN(data[key])) {
                if (!sums[key]) {
                    sums[key] = 0;
                    counts[key] = 0;
                }
                sums[key] += data[key];
                counts[key]++;
            }
        });
    });
    
    // Calculate averages
    Object.keys(sums).forEach(key => {
        if (counts[key] > 0) {
            result[key] = sums[key] / counts[key];
        }
    });
    
    // Use the most recent values for non-numeric fields
    const lastData = dataArray[dataArray.length - 1];
    Object.keys(lastData).forEach(key => {
        if (typeof lastData[key] !== 'number' || isNaN(lastData[key])) {
            result[key] = lastData[key];
        }
    });
    
    // Use the most recent timestamp
    result.server_timestamp = lastData.server_timestamp;
    
    return result;
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
        if (!element) {
            // Skip if element doesn't exist - no error
            return;
        }
        
        try {
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
                // Handle numeric mode values and automatically update chart rate
                const modeNames = {
                    '0': 'SLEEP',
                    '1': 'FLIGHT',
                    '2': 'MAINTENANCE',
                    '3': 'APOGEE',
                    '4': 'DESCENT',
                    '5': 'RECOVERY'
                };
                
                // Check if mode has changed and update chart rate accordingly
                const numericMode = String(value);
                if (value !== undefined && value !== null && numericMode !== currentRocketModeNumeric) {
                    currentRocketModeNumeric = numericMode;
                    setChartUpdateRateByMode(numericMode);
                }
                
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
            
            element.textContent = value;
        } catch (error) {
            console.warn(`Error updating element '${key}':`, error);
            // Continue with other elements
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
// Helper function to check if a value should be included in charts (excludes zero values)
// Zero values are considered invalid sensor data and should not be plotted
// This improves chart readability by avoiding misleading zero spikes
// Note: Logs still contain all data including zeros
function isValidForChart(value) {
    return value !== null && value !== undefined && value !== 0 && !isNaN(value);
}

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
    
    // Add data to buffer for averaging
    chartDataBuffer.push(data);
    chartUpdateCounter++;
    
    // Always update GPS chart immediately (not affected by update rate)
    if (data.gps_valid && isValidForChart(data.latitude) && isValidForChart(data.longitude)) {
        gpsChart.data.datasets[0].data.push({
            x: data.longitude,
            y: data.latitude
        });
        
        // Keep only last 100 GPS points
        if (gpsChart.data.datasets[0].data.length > 100) {
            gpsChart.data.datasets[0].data.splice(0, gpsChart.data.datasets[0].data.length - 100);
        }
        
        gpsChart.update('none');
        debugLog('GPS chart updated');
    }
    
    // Check if we should update the time-series charts
    if (chartUpdateCounter >= chartUpdateRate) {
        // Process the buffered data
        let processedData;
        
        if (chartUpdateRate === 1) {
            // Real-time mode - use the latest data point
            processedData = data;
        } else {
            // Averaging mode - average the buffered data
            processedData = averageChartData(chartDataBuffer);
        }
        
        // Create a simple time label for the x-axis
        const timeLabel = moment(processedData.server_timestamp).format('HH:mm:ss');
        
        // Add new data point to our arrays (only valid values)
        timeLabels.push(timeLabel);
        altitudeGpsData.push(isValidForChart(processedData.altitude_gps) ? processedData.altitude_gps : null);
        altitudePressureData.push(isValidForChart(processedData.altitude_pressure) ? processedData.altitude_pressure : null);
        pressureData.push(isValidForChart(processedData.pressure) ? processedData.pressure : null);
        rssiData.push(processedData.rssi); // RSSI can be negative, so don't filter zeros
        
        // Add IMU data to arrays (only valid values)
        accelXData.push(isValidForChart(processedData.accel_x) ? processedData.accel_x : null);
        accelYData.push(isValidForChart(processedData.accel_y) ? processedData.accel_y : null);
        accelZData.push(isValidForChart(processedData.accel_z) ? processedData.accel_z : null);
        gyroXData.push(isValidForChart(processedData.gyro_x) ? processedData.gyro_x : null);
        gyroYData.push(isValidForChart(processedData.gyro_y) ? processedData.gyro_y : null);
        gyroZData.push(isValidForChart(processedData.gyro_z) ? processedData.gyro_z : null);
        imuTemperatureData.push(isValidForChart(processedData.imu_temperature) ? processedData.imu_temperature : null);
        
        // Add power data to arrays (only valid values)
        busVoltageData.push(isValidForChart(processedData.bus_voltage) ? processedData.bus_voltage : null);
        currentData.push(isValidForChart(processedData.current) ? processedData.current : null);
        powerData.push(isValidForChart(processedData.power) ? processedData.power : null);
        
        // Debug power data values
        if (processedData.power_valid && (processedData.bus_voltage > 0 || processedData.current !== 0 || processedData.power > 0)) {
            debugLog('Power data processed:', {
                bus_voltage: processedData.bus_voltage,
                current: processedData.current,
                power: processedData.power,
                power_valid: processedData.power_valid,
                averaged_from: chartDataBuffer.length + ' points'
            });
        }
        
        // Add data to chart labels and datasets (only add non-zero values)
        altitudeChart.data.labels.push(timeLabel);
        altitudeChart.data.datasets[0].data.push(isValidForChart(processedData.altitude_gps) ? processedData.altitude_gps : null);
        altitudeChart.data.datasets[1].data.push(isValidForChart(processedData.altitude_pressure) ? processedData.altitude_pressure : null);
        
        pressureChart.data.labels.push(timeLabel);
        pressureChart.data.datasets[0].data.push(isValidForChart(processedData.pressure) ? processedData.pressure : null);
        
        // Add IMU data to charts (only add non-zero values)
        accelChart.data.labels.push(timeLabel);
        accelChart.data.datasets[0].data.push(isValidForChart(processedData.accel_x) ? processedData.accel_x : null);
        accelChart.data.datasets[1].data.push(isValidForChart(processedData.accel_y) ? processedData.accel_y : null);
        accelChart.data.datasets[2].data.push(isValidForChart(processedData.accel_z) ? processedData.accel_z : null);
        
        gyroChart.data.labels.push(timeLabel);
        gyroChart.data.datasets[0].data.push(isValidForChart(processedData.gyro_x) ? processedData.gyro_x : null);
        gyroChart.data.datasets[1].data.push(isValidForChart(processedData.gyro_y) ? processedData.gyro_y : null);
        gyroChart.data.datasets[2].data.push(isValidForChart(processedData.gyro_z) ? processedData.gyro_z : null);
        
        temperatureChart.data.labels.push(timeLabel);
        temperatureChart.data.datasets[0].data.push(isValidForChart(processedData.imu_temperature) ? processedData.imu_temperature : null);
        
        // Add power data to charts (only add non-zero values)
        powerChart.data.labels.push(timeLabel);
        powerChart.data.datasets[0].data.push(isValidForChart(processedData.bus_voltage) ? processedData.bus_voltage : null);
        powerChart.data.datasets[1].data.push(isValidForChart(processedData.current) ? processedData.current : null);
        powerChart.data.datasets[2].data.push(isValidForChart(processedData.power) ? processedData.power : null);
        
        debugLog('Chart data lengths:', {
            timeLabels: timeLabels.length,
            chartUpdateRate: chartUpdateRate,
            bufferSize: chartDataBuffer.length
        });
        
        // Keep only last 100 points for time-series charts
        const maxPoints = 100;
        if (timeLabels.length > maxPoints) {
            const pointsToRemove = timeLabels.length - maxPoints;
            
            timeLabels.splice(0, pointsToRemove);
            altitudeGpsData.splice(0, pointsToRemove);
            altitudePressureData.splice(0, pointsToRemove);
            pressureData.splice(0, pointsToRemove);
            rssiData.splice(0, pointsToRemove);
            
            // Clean up IMU data arrays
            accelXData.splice(0, pointsToRemove);
            accelYData.splice(0, pointsToRemove);
            accelZData.splice(0, pointsToRemove);
            gyroXData.splice(0, pointsToRemove);
            gyroYData.splice(0, pointsToRemove);
            gyroZData.splice(0, pointsToRemove);
            imuTemperatureData.splice(0, pointsToRemove);
            
            // Clean up power data arrays
            busVoltageData.splice(0, pointsToRemove);
            currentData.splice(0, pointsToRemove);
            powerData.splice(0, pointsToRemove);
            
            // Clean up chart data as well
            altitudeChart.data.labels.splice(0, pointsToRemove);
            altitudeChart.data.datasets[0].data.splice(0, pointsToRemove);
            altitudeChart.data.datasets[1].data.splice(0, pointsToRemove);
            pressureChart.data.labels.splice(0, pointsToRemove);
            pressureChart.data.datasets[0].data.splice(0, pointsToRemove);
            
            // Clean up IMU chart data
            accelChart.data.labels.splice(0, pointsToRemove);
            accelChart.data.datasets[0].data.splice(0, pointsToRemove);
            accelChart.data.datasets[1].data.splice(0, pointsToRemove);
            accelChart.data.datasets[2].data.splice(0, pointsToRemove);
            
            gyroChart.data.labels.splice(0, pointsToRemove);
            gyroChart.data.datasets[0].data.splice(0, pointsToRemove);
            gyroChart.data.datasets[1].data.splice(0, pointsToRemove);
            gyroChart.data.datasets[2].data.splice(0, pointsToRemove);
            
            temperatureChart.data.labels.splice(0, pointsToRemove);
            temperatureChart.data.datasets[0].data.splice(0, pointsToRemove);
            
            // Clean up power chart data
            powerChart.data.labels.splice(0, pointsToRemove);
            powerChart.data.datasets[0].data.splice(0, pointsToRemove);
            powerChart.data.datasets[1].data.splice(0, pointsToRemove);
            powerChart.data.datasets[2].data.splice(0, pointsToRemove);
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
        
        debugLog('All time-series charts updated successfully');
        
        // Clear the buffer and reset counter
        chartDataBuffer = [];
        chartUpdateCounter = 0;
    }
    
    // Update 3D rocket orientation if visualizer is initialized (always real-time)
    // Only update with valid (non-zero) sensor values
    if (rocketModel) {
        updateRocketOrientation(
            isValidForChart(data.accel_x) ? data.accel_x : 0,
            isValidForChart(data.accel_y) ? data.accel_y : 0, 
            isValidForChart(data.accel_z) ? data.accel_z : 0,
            isValidForChart(data.gyro_x) ? data.gyro_x : 0,
            isValidForChart(data.gyro_y) ? data.gyro_y : 0,
            isValidForChart(data.gyro_z) ? data.gyro_z : 0
        );
    }
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
    
    // Event listeners
    sendButton.addEventListener('click', sendTerminalCommand);
    clearButton.addEventListener('click', clearTerminal);
    
    // Enter key to send command
    commandInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTerminalCommand();
        }
    });
}

// Load available serial ports
function loadPorts() {
    console.log('loadPorts() called - emitting get-ports event');
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

// Initialize event listeners (called from initializeApp after DOM elements are ready)
function initializeEventListeners() {
    // Port management event listeners
    elements.refreshPortsBtn.addEventListener('click', loadPorts);

    // Add test button event listener
    const testPortsBtn = document.getElementById('test-ports');
    if (testPortsBtn) {
        testPortsBtn.addEventListener('click', () => {
            console.log('=== PORT TEST CLICKED ===');
            console.log('Socket connected:', socket.connected);
            console.log('Port select element:', elements.portSelect);
            console.log('Current dropdown content:', elements.portSelect ? elements.portSelect.innerHTML : 'N/A');
            loadPorts();
        });
    }

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

    elements.cameraCmd.addEventListener('click', () => {
        sendRocketCommand('CAM_TOGGLE');
    });

    // Debug mode controls
    elements.debugModeCheckbox.addEventListener('change', (e) => {
        DEBUG_ENABLED = e.target.checked;
        addTerminalLine(`Debug mode ${DEBUG_ENABLED ? 'enabled' : 'disabled'}`, 'info');
    });

    // Chart update rate control (only if element exists)
    if (elements.chartUpdateRateSelect) {
        elements.chartUpdateRateSelect.addEventListener('change', updateChartUpdateRate);
    }

    debugLog('Event listeners initialized successfully');
}

// Socket event handlers for terminal
socket.on('raw-data', (data) => {
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
    console.log('=== PORTS LIST RECEIVED ===');
    console.log('Received ports list:', ports); // Debug log
    console.log('Port select element:', elements.portSelect);
    console.log('Port select element exists:', !!elements.portSelect);
    
    if (!elements.portSelect) {
        console.error('❌ Port select element not found!');
        console.log('Trying to find element by ID directly...');
        const directElement = document.getElementById('port-select');
        console.log('Direct element lookup result:', directElement);
        return;
    }
    
    try {
        console.log('Clearing existing options...');
        elements.portSelect.innerHTML = '<option value="">Select Port...</option>';
        
        console.log('Adding', ports.length, 'ports...');
        ports.forEach((port, index) => {
            console.log(`Adding port ${index + 1}:`, port);
            const option = document.createElement('option');
            option.value = port.path;
            option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
            elements.portSelect.appendChild(option);
            console.log(`✅ Added port: ${port.path} - ${port.manufacturer || 'Unknown'}`);
        });
        
        console.log('✅ Port dropdown updated successfully with', elements.portSelect.options.length, 'total options');
        addTerminalLine(`Found ${ports.length} serial ports`, 'info');
    } catch (error) {
        console.error('❌ Error updating port dropdown:', error);
        console.error('Error details:', error.stack);
    }
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
        elements.cameraCmd.disabled = false;
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
        elements.cameraCmd.disabled = true;
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
    
    // Initialize DOM elements
    try {
        elements = {
            portSelect: document.getElementById('port-select'),
            baudRate: document.getElementById('baud-rate'),
            connectBtn: document.getElementById('connect-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            clearDataBtn: document.getElementById('clear-data-btn'),
            refreshPortsBtn: document.getElementById('refresh-ports'),
            debugModeCheckbox: document.getElementById('debug-mode'),
            chartUpdateRateSelect: document.getElementById('chart-update-rate'), // May not exist
            currentModeIndicator: document.getElementById('current-mode-indicator'), // May not exist
            serialStatus: document.getElementById('serial-status'),
            csvStatus: document.getElementById('csv-status'),
            dataCount: document.getElementById('data-count'),
            messageCount: document.getElementById('message-count'),
            sleepCmd: document.getElementById('sleep-cmd'),
            maintCmd: document.getElementById('maint-cmd'),
            flightCmd: document.getElementById('flight-cmd'),
            cameraCmd: document.getElementById('camera-cmd'),
            lastCommand: document.getElementById('last-command')
        };

        // Current data elements mapping
        currentDataElements = {
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
            // Note: Magnetometer elements don't exist in HTML, removed to prevent errors
            // mag_x: document.getElementById('current-mag-x'),
            // mag_y: document.getElementById('current-mag-y'), 
            // mag_z: document.getElementById('current-mag-z'),
            imu_temperature: document.getElementById('current-imu-temperature'),
            imu_valid: document.getElementById('current-imu-valid'),
            bus_voltage: document.getElementById('current-bus-voltage'),
            current: document.getElementById('current-current'),
            power: document.getElementById('current-power'),
            power_valid: document.getElementById('current-power-valid')
        };

        // Validate DOM elements
        console.log('DOM Elements validation:');
        Object.keys(elements).forEach(key => {
            if (!elements[key]) {
                console.error(`❌ Element '${key}' not found!`);
            } else {
                console.log(`✅ Element '${key}' found`);
            }
        });

        debugLog('DOM elements initialized successfully');
    } catch (error) {
        console.error('Error initializing DOM elements:', error);
    }
    
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
    
    // Don't load ports here - wait for socket connection
    // try {
    //     loadPorts();
    //     debugLog('Ports loading initiated');
    // } catch (error) {
    //     console.error('Error loading ports:', error);
    // }
    
    // Initialize chart update rate
    try {
        updateChartUpdateRate();
        debugLog('Chart update rate initialized');
    } catch (error) {
        console.error('Error initializing chart update rate:', error);
    }
    
    // Initialize event listeners
    try {
        initializeEventListeners();
        debugLog('Event listeners initialized successfully');
    } catch (error) {
        console.error('Error initializing event listeners:', error);
    }
    
    // Initialize complete - all notifications now go to terminal
    addTerminalLine('✅ Ground Station initialized', 'info');
    debugLog('Application initialization complete');
}
