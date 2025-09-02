#!/bin/bash

# This script is used to setup the AWS CLI config file.
# It appends the sections from the local ./aws-config file to the global ~/.aws/config file.
#
# How It Works
#
# - File Existence:
#   The script verifies that ./aws-config exists and creates ~/.aws/config (and its parent directory) if needed.
#
# - Parsing Sections:
#   It reads the local configuration file line by line. Every time it encounters a section header (a line starting with [ and ending with ]), it:
#
#   - Checks if a section with the same header already exists in ~/.aws/config (using grep -Fq to match the literal header).
#   - If not found, it appends the entire block (the header and its following lines until the next header) to ~/.aws/config.
#
# - Non-Duplication:
#   Each section is only appended if its header is not found in the destination file. This prevents duplicate entries.

set -euo pipefail

# Paths for local and destination configuration files.
LOCAL_CONFIG="./aws-config"
DEST_CONFIG="$HOME/.aws/config"

# Check if the local config file exists.
if [[ ! -f "$LOCAL_CONFIG" ]]; then
    echo "Error: Local config file '$LOCAL_CONFIG' not found."
    exit 1
fi

# Ensure the destination directory exists.
DEST_DIR=$(dirname "$DEST_CONFIG")
mkdir -p "$DEST_DIR"

# Create the destination config file if it doesn't exist.
touch "$DEST_CONFIG"

# Variables to keep the current section block.
current_block=""
current_header=""

# Process the local config file line by line.
while IFS= read -r line; do
    # Check if the line is a section header (e.g., [sso-session monster-make])
    if [[ $line =~ ^\[.+\]$ ]]; then
        # Process the previous section block, if any.
        if [[ -n "$current_header" ]]; then
            if ! grep -Fq "$current_header" "$DEST_CONFIG"; then
                # Append a blank line before adding the section.
                echo "" >> "$DEST_CONFIG"
                echo "$current_block" >> "$DEST_CONFIG"
                echo "Appended section: $current_header"
            else
                echo "Section $current_header already exists. Skipping."
            fi
        fi
        # Start a new block with the current header.
        current_header="$line"
        current_block="$line"
    else
        # Append the line to the current block.
        current_block="${current_block}"$'\n'"$line"
    fi
done < "$LOCAL_CONFIG"

# Process the last section if present.
if [[ -n "$current_header" ]]; then
    if ! grep -Fq "$current_header" "$DEST_CONFIG"; then
        echo "" >> "$DEST_CONFIG"
        echo "$current_block" >> "$DEST_CONFIG"
        echo "Appended section: $current_header"
    else
        echo "Section $current_header already exists. Skipping."
    fi
fi

echo "AWS CLI config file setup complete."
