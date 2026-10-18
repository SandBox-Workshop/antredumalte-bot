#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/home/ubuntu/antredumalte-bot"

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

cd "$APP_DIR"

pnpm exec tsx ./scripts/backup-production-data.ts