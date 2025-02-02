#!/bin/bash

# scan_media.sh
# Quick script to scan media directories and add new assets to the database

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting media scan...${NC}"

# Call the scan endpoint
response=$(curl -s -X POST http://localhost:5001/api/v1/scan \
  -H "Content-Type: application/json" \
  -d '{}')

# Extract and display results
total_added=$(echo $response | grep -o '"total_assets_added":[0-9]*' | cut -d':' -f2)
message=$(echo $response | grep -o '"message":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$total_added" ]; then
    echo -e "${GREEN}Scan complete!${NC}"
    echo "New assets added: $total_added"
    echo "Status: $message"
else
    echo -e "${RED}Error during scan. Check if the backend server is running.${NC}"
    echo "Response: $response"
fi 