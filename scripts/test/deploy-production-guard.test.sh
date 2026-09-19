#!/usr/bin/env bash
# Unit tests for scripts/lib/deploy-production-guard.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GUARD="$ROOT/scripts/lib/deploy-production-guard.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

run_expect_fail() {
  local label="$1"
  shift
  if ( set +e; "$@" >/dev/null 2>&1 ); then
    fail "$label — expected failure, got success"
  fi
  pass "$label"
}

run_expect_ok() {
  local label="$1"
  shift
  if ! "$@" >/dev/null 2>&1; then
    fail "$label — expected success, got failure"
  fi
  pass "$label"
}

# shellcheck disable=SC1090
source "$GUARD"

run_expect_ok "production deploy with no wipe flags" \
  env DEPLOY_STACK=rebornsense DEPLOY_PATH=/root/rebornSense bash -c "source '$GUARD'; pre_deploy_sanity_check"

run_expect_fail "production rejects RESET_STAGING_DB=1" \
  env DEPLOY_STACK=rebornsense RESET_STAGING_DB=1 DEPLOY_PATH=/root/rebornSense bash -c "source '$GUARD'; pre_deploy_sanity_check"

run_expect_fail "production rejects PRODUCTION_DB_FORCE_RESET=1" \
  env DEPLOY_STACK=rebornsense PRODUCTION_DB_FORCE_RESET=1 bash -c "source '$GUARD'; pre_deploy_sanity_check"

run_expect_fail "production rejects any PRODUCTION_DB_FORCE_RESET env var (even =0)" \
  env DEPLOY_STACK=rebornsense PRODUCTION_DB_FORCE_RESET=0 bash -c "source '$GUARD'; pre_deploy_sanity_check"

run_expect_fail "staging reset on production path refused" \
  env DEPLOY_STACK=chaslay RESET_STAGING_DB=1 DEPLOY_PATH=/root/rebornSense bash -c "source '$GUARD'; assert_staging_only_db_reset"

run_expect_ok "staging reset allowed on staging path" \
  env DEPLOY_STACK=chaslay RESET_STAGING_DB=1 DEPLOY_PATH=/root/StagingChaslay bash -c "source '$GUARD'; assert_staging_only_db_reset"

run_expect_fail "postgres volume rm blocked on production stack" \
  env DEPLOY_STACK=rebornsense bash -c "source '$GUARD'; guard_docker_volume_rm_postgres rebornsense_postgres_data"

run_expect_fail "postgres volume rm blocked without RESET_STAGING_DB" \
  env DEPLOY_STACK=chaslay DEPLOY_PATH=/root/StagingChaslay bash -c "source '$GUARD'; guard_docker_volume_rm_postgres stagingchaslay_postgres_data"

echo "All deploy-production-guard tests passed."
