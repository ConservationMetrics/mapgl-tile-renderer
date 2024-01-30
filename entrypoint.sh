#!/bin/bash

# Start Xvfb
echo "Starting Xvfb..."
start-stop-daemon --start --pidfile /tmp/xvfb.pid --make-pidfile --background --exec /usr/bin/Xvfb -- :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset

sleep 5
echo "Xvfb started"

# Run your application
node src/cli.js "$@"
