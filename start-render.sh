#!/usr/bin/env bash
echo "🏗️ Building project..."
npm run build

echo "🚀 Starting NestJS backend..."
node dist/main.js
