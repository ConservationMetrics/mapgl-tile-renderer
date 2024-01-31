#!/bin/sh

# Start Xvfb
echo "Starting Xvfb"
Xvfb ${DISPLAY} -screen 0 "1024x768x24" -ac +extension GLX +render -noreset  -nolisten tcp  &
Xvfb_pid="$!"
echo "Waiting for Xvfb (PID: $Xvfb_pid) to be ready..."

timeout=10 # Timeout in seconds
start_time=$(date +%s)
while ! xdpyinfo -display ${DISPLAY} > /dev/null 2>&1; do
    sleep 0.1
    now=$(date +%s)
    if [ $(($now - $start_time)) -ge $timeout ]; then
        echo "Xvfb server didn't start within the timeout period. Exiting..."
        exit 1
    fi
done
echo "Xvfb is running"

# Check if QueueName env var (e.g. for Azure) is set
if [ "$QueueName" = "mappacker-requests" ]; then
    # Run the queue service
    node src/queue_service.js
else
    # Default to the CLI API
    node src/cli.js "$@"
fi
