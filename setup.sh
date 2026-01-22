#!/bin/bash

# SO360 CRM MFE Repository Setup Script
# This script creates a new git repository for the CRM MFE

set -e

echo "🚀 SO360 CRM MFE Setup"
echo "======================="
echo ""

# Determine the target directory
TARGET_DIR="${1:-/Users/praveenvr/Work/Projects/so360-crm}"

echo "📁 Target directory: $TARGET_DIR"
echo ""

# Create target directory
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️  Directory already exists. Remove it first or choose a different location."
    exit 1
fi

echo "Creating directory structure..."
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# Initialize git
echo "Initializing git repository..."
git init
git branch -M main

# Copy all files from crm-setup directory
echo "Copying project files..."
cp -r /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/* .
cp -r /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/.github .
cp /Users/praveenvr/Work/Projects/so360-shell-fe/crm-setup/.gitignore .

# Install dependencies
echo "Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. Update package.json with your repository URL"
echo "3. npm run dev (starts dev server on port 3004)"
echo "4. npm run build (creates production build)"
echo ""
echo "To integrate with Shell:"
echo "- Make sure Shell is running on port 3002"
echo "- Shell will load CRM from http://localhost:3004/assets/remoteEntry.js"
echo ""
