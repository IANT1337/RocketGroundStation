<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Rocket ESP32 Ground Station Project

This is a Node.js web application for telemetry data visualization from a serial COM port, specifically designed for rocket ground station operations.

## Project Context

- **Technology Stack**: Node.js, Express.js, Socket.IO, Chart.js, HTML5, CSS3
- **Purpose**: Real-time telemetry data visualization, logging, and plotting from ESP32 rocket systems
- **Data Format**: "TELEM,timestamp,mode,latitude,longitude,altitude_gps,altitude_pressure,pressure,gps_valid,pressure_valid" where timestamp is numeric, mode is numeric (0-5), and validity flags are 1/0

## Key Features

- Serial port communication for telemetry data reception
- Real-time data visualization with multiple charts (altitude, pressure, GPS position)
- CSV data logging with automatic file generation
- Web-based interface with responsive design
- Live data updates using WebSocket connections

## Development Guidelines

When working with this codebase:

1. **Serial Communication**: Use the `serialport` package for COM port interactions
2. **Real-time Updates**: Leverage Socket.IO for live data streaming between server and clients
3. **Data Visualization**: Utilize Chart.js for creating responsive and interactive charts
4. **Error Handling**: Implement robust error handling for serial port connectivity issues
5. **Data Persistence**: Ensure CSV logging functionality for data analysis and backup
6. **UI/UX**: Maintain responsive design principles for various screen sizes

## Code Style

- Use modern JavaScript ES6+ features
- Follow Node.js best practices for server-side development
- Implement proper error handling and logging
- Use consistent naming conventions (camelCase for variables, kebab-case for CSS classes)
- Comment complex logic and data parsing functions

## Testing Considerations

- Test with various baud rates and COM ports
- Validate telemetry data parsing with malformed input
- Ensure WebSocket connections handle reconnection scenarios
- Test CSV export functionality with large datasets
