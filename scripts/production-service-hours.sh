#!/usr/bin/env bash
# Europe/Zurich service hours — avoid production deploys / heavy restarts while venues are open.
#
# Override: FORCE_PRODUCTION_DEPLOY=1
set -euo pipefail

PRODUCTION_SERVICE_HOUR_START="${PRODUCTION_SERVICE_HOUR_START:-11}"
PRODUCTION_SERVICE_HOUR_END="${PRODUCTION_SERVICE_HOUR_END:-23}"

production_service_hours_active() {
  if [[ "${FORCE_PRODUCTION_DEPLOY:-}" == "1" ]]; then
    return 1
  fi
  local hour
  hour="$(TZ=Europe/Zurich date +%H)"
  # Strip leading zero for arithmetic (08 → 8).
  hour=$((10#$hour))
  if [[ "$hour" -ge "$PRODUCTION_SERVICE_HOUR_START" && "$hour" -lt "$PRODUCTION_SERVICE_HOUR_END" ]]; then
    return 0
  fi
  return 1
}

production_service_hours_message() {
  echo "Production changes blocked during service hours (${PRODUCTION_SERVICE_HOUR_START}:00–${PRODUCTION_SERVICE_HOUR_END}:00 Europe/Zurich). Use FORCE_PRODUCTION_DEPLOY=1 only for emergencies."
}