#!/usr/bin/env bash
# Fail-safe guards: production (DEPLOY_STACK=rebornsense) must NEVER delete Postgres data.
# Source from deploy-hetzner.sh, reset-staging-chaslay-db.sh, and pre-deploy-sanity-check.sh.

deploy_stack_is_production() {
  [[ "${DEPLOY_STACK:-}" == "rebornsense" ]]
}

deploy_path_looks_production() {
  local path="${1:-${DEPLOY_PATH:-}}"
  [[ -z "$path" ]] && return 1
  case "$path" in
    *rebornSense* | *rebornsense* | /root/FoodTruckPOS*)
      return 0
      ;;
  esac
  return 1
}

deploy_wipe_env_vars_active() {
  [[ "${RESET_STAGING_DB:-}" == "1" ]] && return 0
  [[ "${PRODUCTION_DB_FORCE_RESET:-}" == "1" ]] && return 0
  [[ "${FORCE_DB_RESET:-}" == "1" ]] && return 0
  return 1
}

assert_production_postgres_preserved() {
  if deploy_stack_is_production; then
    echo "PRODUCTION SAFEGUARD: postgres volume preserved — DEPLOY_STACK=rebornsense never deletes database data"
  fi
}

abort_if_production_wipe_attempt() {
  if ! deploy_stack_is_production; then
    return 0
  fi

  if [[ -n "${PRODUCTION_DB_FORCE_RESET:-}" ]]; then
    echo "ERROR: PRODUCTION DEPLOY ABORTED — PRODUCTION_DB_FORCE_RESET is forbidden."
    echo "  Production database volumes are NEVER deleted by deploy scripts."
    echo "  Manual recovery only: scripts/recover-rebornsense-data.sh (with CONFIRM=1 on server)."
    exit 1
  fi

  if deploy_wipe_env_vars_active; then
    echo "ERROR: PRODUCTION DEPLOY ABORTED — database wipe env var set while DEPLOY_STACK=rebornsense."
    echo "  Active wipe flags are rejected on production:"
    echo "    RESET_STAGING_DB=${RESET_STAGING_DB:-}"
    echo "    PRODUCTION_DB_FORCE_RESET=${PRODUCTION_DB_FORCE_RESET:-}"
    echo "    FORCE_DB_RESET=${FORCE_DB_RESET:-}"
    echo "  Unset all wipe flags before deploying production."
    exit 1
  fi
}

assert_staging_only_db_reset() {
  if [[ "${RESET_STAGING_DB:-}" != "1" ]]; then
    return 0
  fi

  if deploy_stack_is_production; then
    echo "ERROR: RESET_STAGING_DB=1 is forbidden when DEPLOY_STACK=rebornsense (production)."
    exit 1
  fi

  if [[ "${DEPLOY_STACK:-}" != "chaslay" ]]; then
    echo "ERROR: RESET_STAGING_DB=1 only allowed when DEPLOY_STACK=chaslay (got ${DEPLOY_STACK:-unset})."
    exit 1
  fi

  if deploy_path_looks_production; then
    echo "ERROR: RESET_STAGING_DB=1 refused — DEPLOY_PATH looks like production: ${DEPLOY_PATH:-unset}"
    exit 1
  fi
}

guard_docker_volume_rm_postgres() {
  local volume="$1"
  shift || true

  if [[ "$volume" != *postgres* ]]; then
    docker volume rm "$volume" "$@" 2>/dev/null || true
    return 0
  fi

  if deploy_stack_is_production; then
    echo "ERROR: PRODUCTION GUARD — refusing docker volume rm on postgres volume: $volume"
    exit 1
  fi

  if [[ "${DEPLOY_STACK:-}" != "chaslay" ]]; then
    echo "ERROR: postgres volume rm only allowed when DEPLOY_STACK=chaslay (got ${DEPLOY_STACK:-unset})."
    exit 1
  fi

  if [[ "${RESET_STAGING_DB:-}" != "1" ]]; then
    echo "ERROR: postgres volume rm requires RESET_STAGING_DB=1 (volume: $volume)."
    exit 1
  fi

  if deploy_path_looks_production; then
    echo "ERROR: postgres volume rm refused — DEPLOY_PATH looks like production: ${DEPLOY_PATH:-unset}"
    exit 1
  fi

  echo "STAGING ONLY: removing postgres volume $volume (RESET_STAGING_DB=1, DEPLOY_STACK=chaslay)"
  docker volume rm "$volume" "$@" 2>/dev/null || true
}

pre_deploy_sanity_check() {
  abort_if_production_wipe_attempt
  assert_staging_only_db_reset
  assert_production_postgres_preserved
}
