#!/bin/bash
# Script to remove stopFlow from all expo-go test files
# Since stopFlow is not a valid Maestro command, we need to restructure the tests

cd "$(dirname "$0")"

for file in *-expo-go.yml; do
  if grep -q "stopFlow" "$file"; then
    echo "Fixing $file..."
    # Remove stopFlow lines and restructure
    sed -i '' '/stopFlow/d' "$file"
  fi
done

echo "Done! Now manually restructure tests to handle both logged-in and login states properly."
