#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Installing Mercurial ==="
pip3 install --quiet mercurial

echo "=== Installing xvfb ==="
apt-get update -qq
apt-get install -y -qq xvfb

echo "=== Installing VS Code ==="
LATEST_DEB=$(curl -sL "https://packages.microsoft.com/repos/code/pool/main/c/code/" \
    | grep -oP 'href="code_[^"]*_amd64\.deb"' \
    | sed 's/href="//;s/"//' \
    | sort -V \
    | tail -1)
echo "Downloading $LATEST_DEB..."
curl -Lo /tmp/code.deb "https://packages.microsoft.com/repos/code/pool/main/c/code/${LATEST_DEB}"
dpkg -i /tmp/code.deb || apt-get install -y -f
rm -f /tmp/code.deb

echo "=== Compiling TypeScript ==="
npm run compile --prefix "$PROJECT_DIR"

echo "=== Running integration tests ==="
VSCODE_EXECUTABLE_PATH="/usr/share/code/code" xvfb-run -a npm run test:integration --prefix "$PROJECT_DIR"
