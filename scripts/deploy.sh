#!/bin/bash
set -euo pipefail

APP_DIR="/root/.openclaw/workspace/experiments/gemini-live"
SERVICE="gemini-live"
LOG_TAG="gemini-deploy"

log() { logger -t "$LOG_TAG" "$1"; echo "$(date -u '+%Y-%m-%d %H:%M:%S') $1"; }

cd "$APP_DIR"

log "Starting deploy..."

# Pull latest code
git fetch origin main
BEFORE=$(git rev-parse --short HEAD)
git reset --hard origin/main
AFTER=$(git rev-parse --short HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    log "No changes ($AFTER) — restarting anyway"
else
    log "Updated $BEFORE → $AFTER"
fi

# Install/update Python dependencies if requirements.txt changed
if [ -f requirements.txt ]; then
    .venv/bin/pip install -r requirements.txt --quiet 2>/dev/null || true
fi

# Deploy Convex functions if needed
npx convex deploy --yes 2>/dev/null || true

# Restart the service
systemctl restart "$SERVICE"

# Wait and verify
sleep 3
if systemctl is-active --quiet "$SERVICE"; then
    log "✅ Deploy successful — $AFTER is live"
else
    log "❌ Deploy failed — $SERVICE is not running"
    journalctl -u "$SERVICE" --no-pager -n 20
    exit 1
fi
