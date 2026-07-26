#!/bin/sh
set -e

ROOT_DIR="${CI_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT_DIR"

echo "Installing JavaScript dependencies for Capacitor iOS pods..."
if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

pnpm install --frozen-lockfile

echo "Installing iOS CocoaPods dependencies..."
cd "$ROOT_DIR/ios/App"
pod install --repo-update
