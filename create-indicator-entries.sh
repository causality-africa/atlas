#!/bin/bash

# Base URL for the API
API_BASE="http://127.0.0.1:8080/v1/indicators"

# Function to handle rate limiting
handle_rate_limit() {
    local response_headers=$1
    local retry_after=$(echo "$response_headers" | grep -i "retry-after" | cut -d' ' -f2 | tr -d '\r')

    if [ -n "$retry_after" ]; then
        local wait_time=$((retry_after + 5))

        echo "Rate limit hit. API suggested $retry_after seconds. Waiting for $wait_time seconds..."
        sleep "$wait_time"
        return 0
    fi
    return 1
}

# Function to process indicators
process_indicators() {
    local indicators=$1

    echo "$indicators" | jq -c '.results[]' | while read -r indicator; do
        # Extract fields
        CODE=$(echo "$indicator" | jq -r '.code')
        NAME=$(echo "$indicator" | jq -r '.name')
        CATEGORY=$(echo "$indicator" | jq -r '.category')
        UNIT=$(echo "$indicator" | jq -r '.unit')
        DESCRIPTION=$(echo "$indicator" | jq -r '.description')

        # Create category directory if it doesn't exist
        mkdir -p "content/$CATEGORY"

        # Create the file path
        FILE_PATH="content/$CATEGORY/$CODE.md"

        # Skip if file already exists
        if [ -f "$FILE_PATH" ]; then
            echo "Skipping $CODE - file already exists"
            continue
        fi

        # Create the front matter
        cat > "$FILE_PATH" << EOF
---
title: "$NAME"
summary: "$DESCRIPTION"
date: $(date +"%Y-%m-%dT%H:%M:%S%z")
type: indicator
---

{{< chart
    type="line"
    title="$NAME"
    description="$DESCRIPTION"
    indicator="$CODE"
    unit="$UNIT"
    time-start="1950-01-01"
    time-end="2030-12-31"
    region="AFR"
    locations="BW,CD,EG,GH,KE,MU,NG,RW,TD,ZA"
>}}

{{< table
    title="$NAME"
    indicators="$CODE"
    units="$UNIT"
    time-start="1950-01-01"
    time-end="2030-12-31"
    region="AFR"
>}}
EOF

        echo "Created $FILE_PATH"
    done
}

# Main function to fetch and process all pages
fetch_all_indicators() {
    local url="$API_BASE"
    local more=true
    local page=1

    while [ "$more" = "true" ]; do
        echo "Fetching page $page..."

        # Use a temporary file to store headers
        headers_file=$(mktemp)

        # Fetch data with headers
        response=$(curl -s -D "$headers_file" "$url")

        # Check if we hit rate limit
        if handle_rate_limit "$(cat "$headers_file")"; then
            # If we hit the rate limit, retry the same URL
            rm "$headers_file"
            continue
        fi

        # Clean up headers file
        rm "$headers_file"

        # Check if curl succeeded
        if [ $? -ne 0 ]; then
            echo "Failed to fetch indicators from API"
            return 1
        fi

        # Process the current page
        process_indicators "$response"

        # Check if there are more pages
        more=$(echo "$response" | jq -r '.more')

        # If there are more pages, update the URL with the page parameter
        if [ "$more" = "true" ]; then
            page=$((page + 1))
            url="$API_BASE?page=$page"
        fi
    done

    echo "All indicators processed!"
}

# Start the process
fetch_all_indicators
