#!/bin/bash

# Kill any existing processes
pkill -f "python run.py"
pkill -f "node.*start"

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start backend
cd backend
export PYTHONPATH=$PYTHONPATH:$(pwd)
python run.py &
cd ..

# Wait for backend to start
sleep 2

# Start frontend
cd frontend
npm start &
cd ..

# Wait for both processes
wait 