# Rocket Ground Station

A web-based telemetry visualization system for receiving, plotting, and logging data from RFD900x-based rocket systems via serial communication.

<img width="1548" height="1795" alt="image" src="https://github.com/user-attachments/assets/878dd9cd-e478-4802-88a5-84bdc5e3b572" />


## Features

- **Real-time Data Reception**: Connects to RFD900x via serial COM port
- **Live Visualization**: Interactive charts for altitude, pressure, and GPS position data
- **Data Logging**: Automatic CSV logging with timestamped files
- **Web Interface**: Modern, responsive web dashboard accessible on local network
- **Rocket Control**: Send commands (SLEEP, MAINT, FLIGHT) to the rocket via serial port
- **Network Access**: Access the dashboard from any device on your local network
- **Multiple Charts**: 
  - Altitude tracking (GPS vs Pressure-based)
  - Pressure monitoring
  - GPS position plotting
- **Export Functionality**: Export data to CSV format
- **Connection Management**: Easy serial port selection and configuration

## Data Format

The application expects telemetry data in the following format:
```
TELEM,timestamp,mode,latitude,longitude,altitude_gps,altitude_pressure,pressure,gps_valid,pressure_valid
```

Where:
- **timestamp**: Numeric timestamp (milliseconds since epoch or counter)
- **mode**: Numeric mode value (0=INIT, 1=PAD, 2=FLIGHT, 3=APOGEE, 4=DESCENT, 5=RECOVERY)
- **latitude**: GPS latitude in decimal degrees
- **longitude**: GPS longitude in decimal degrees  
- **altitude_gps**: GPS-based altitude in meters
- **altitude_pressure**: Pressure-based altitude in meters
- **pressure**: Atmospheric pressure in Pascals
- **gps_valid**: GPS validity flag (1=valid, 0=invalid)
- **pressure_valid**: Pressure sensor validity flag (1=valid, 0=invalid)

Example:
```
TELEM,51423,2,40.712800,-74.006000,1500.5,1485.2,95432,1,1
```

## Installation

1. **Clone or download** this repository
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the server**:
   ```bash
   npm start
   ```
   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Usage

1. **Start the server**:
   ```bash
   npm start
   ```
   The server will display both local and network access URLs.

2. **Access the dashboard**:
   - **Local access**: `http://localhost:3000`
   - **Network access**: `http://[YOUR_IP]:3000` (displayed in console)
   - Other devices on your network can access the same URL

3. **Connect to RFD900x**:
   - Select your RFD900x's COM port from the dropdown
   - Set the baud rate (default: 115200)
   - Click the Connect button to start receiving data

4. **Control the rocket**:
   - Use the rocket control panel to send commands
   - Available commands: SLEEP, MAINT, FLIGHT
   - Commands are sent immediately over the serial connection

5. **Monitor and analyze**:
   - View real-time telemetry data and charts
   - Data is automatically logged to CSV files in the `logs/` directory
   - Export additional data using the Export CSV button

## Dependencies

- **express**: Web server framework
- **socket.io**: Real-time bidirectional communication
- **serialport**: Serial port communication
- **csv-writer**: CSV file generation
- **moment**: Date/time handling

## Project Structure

```
RocketGroundStation/
├── server.js              # Main server application
├── package.json           # Dependencies and scripts
├── public/                # Static web files
│   ├── index.html        # Main web interface
│   ├── styles.css        # Styling
│   └── app.js            # Client-side JavaScript
├── logs/                 # CSV log files (auto-created)
└── .github/
```

## Configuration

### Serial Port Settings
- **Baud Rate**: Configurable (9600, 19200, 38400, 57600, 115200)
- **Data Format**: 8N1 (8 data bits, no parity, 1 stop bit)
- **Auto-detection**: Available ports are automatically detected

### Data Storage
- **CSV Logging**: Automatic timestamped CSV files
- **File Location**: `logs/` directory
- **Retention**: Manual cleanup (files are not automatically deleted)

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restart on file changes.

### Adding New Features
1. **Server-side**: Modify `server.js` for backend functionality
2. **Client-side**: Edit files in the `public/` directory
3. **Styling**: Update `public/styles.css`
4. **Charts**: Extend chart configurations in `public/app.js`

## Troubleshooting

### Common Issues

1. **Serial Port Access Denied**
   - Ensure no other applications are using the COM port
   - Check if the RFD900x is properly connected
   - Try running with administrator privileges on Windows

2. **No Data Received**
   - Verify the baud rate matches your RFD900x configuration
   - Check the data format matches the expected format
   - Ensure the RFD900x is sending data in the correct format

3. **Charts Not Updating**
   - Check the browser console for JavaScript errors
   - Ensure WebSocket connection is established
   - Verify the telemetry data format is correct

4. **Network Access Issues**
   - Ensure your firewall allows connections on port 3000
   - Check that all devices are on the same network
   - Try disabling Windows Defender Firewall temporarily to test
   - On Windows, you may need to allow Node.js through the firewall

5. **Command Sending Fails**
   - Verify the serial port is connected and open
   - Check that the RFD900x is configured to receive commands
   - Ensure the command format matches what your ESP32 expects

### Port Permissions (Linux/macOS)
Add your user to the dialout group:
```bash
sudo usermod -a -G dialout $USER
```
Then log out and back in.

## License

MIT License - feel free to use and modify for your projects.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Note**: This application is designed for educational and hobbyist rocket projects. Always follow local regulations and safety guidelines when working with rocket systems.
