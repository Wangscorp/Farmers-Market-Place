#!/bin/bash

# Function to determine toast type based on message content
get_toast_type() {
    local message="$1"
    if [[ "$message" =~ (successful|completed|updated|created|sent|removed|logged out) ]]; then
        echo "success"
    elif [[ "$message" =~ (Failed|Error|Please|Minimum|Invalid|You must|select|enter|upload) ]]; then
        echo "error"
    else
        echo "info"
    fi
}

# Process each JSX file
for file in $(find src -name "*.jsx" -exec grep -l "alert(" {} \;); do
    echo "Processing $file"
    
    # Create a temporary file
    cp "$file" "${file}.tmp"
    
    # Replace alert calls with toast calls
    sed -i 's/alert(/toast.success(/g' "$file"
    
    # Now refine the replacements based on content
    # Replace success messages
    sed -i 's/toast\.success(".*successful.*")/toast.success(\1!)/g' "$file"
    sed -i 's/toast\.success(".*completed.*")/toast.success(\1!)/g' "$file"
    sed -i 's/toast\.success(".*updated.*")/toast.success(\1!)/g' "$file"
    sed -i 's/toast\.success(".*created.*")/toast.success(\1!)/g' "$file"
    sed -i 's/toast\.success(".*sent.*")/toast.success(\1!)/g' "$file"
    sed -i 's/toast\.success(".*removed.*")/toast.success(\1!)/g' "$file"
    
    # Replace error messages
    sed -i 's/toast\.success("Failed[^"]*")/toast.error(\1)/g' "$file"
    sed -i 's/toast\.success("Error[^"]*")/toast.error(\1)/g' "$file"
    sed -i 's/toast\.success("Please[^"]*")/toast.error(\1)/g' "$file"
    sed -i 's/toast\.success("Minimum[^"]*")/toast.error(\1)/g' "$file"
    sed -i 's/toast\.success("Invalid[^"]*")/toast.error(\1)/g' "$file"
    sed -i 's/toast\.success("You must[^"]*")/toast.error(\1)/g' "$file"
    
    # Replace warning messages
    sed -i 's/toast\.success(".*log.*in.*")/toast.warning(\1)/g' "$file"
    
    echo "Finished processing $file"
done

echo "Alert replacement completed!"
