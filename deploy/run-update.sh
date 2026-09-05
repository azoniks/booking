#!/usr/bin/env bash
set -euo pipefail
cd /srv/booking
echo running > .deploy/status
exec > .deploy/update.log 2>&1
# Installed outside the checkout, so Git cannot replace a running script.
exec /bin/bash /usr/local/lib/booking/update.sh
