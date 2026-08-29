#!/usr/bin/env bash
# Deploy Chaslay / Rebornsense stack on Hetzner.
set -euo pipefail

DEPLOY_STACK="${DEPLOY_STACK:-chaslay}"
if [[ -n "${DEPLOY_PATH:-}" ]]; then
  REPO_DIR="$DEPLOY_PATH"
elif [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
  REPO_DIR="/root/rebornSense"
else
  REPO_DIR="${HOME}/FoodTruckPOS"
fi
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"

# CADDYFILE must be exported before ANY docker compose command (compose defaults to chaslay).
export_stack_caddyfile() {
  if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
    export CADDYFILE="${CADDYFILE:-$REPO_DIR/deploy/Caddyfile.rebornsense}"
  else
    export CADDYFILE="${CADDYFILE:-$REPO_DIR/deploy/Caddyfile.chaslay}"
  fi
}

# docker compose with stack CADDYFILE + secrets env file (never rely on compose default).
dc() {
  export_stack_caddyfile
  docker compose --env-file .env.production "$@"
}

if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: deploy path does not exist: $REPO_DIR"
  echo ""
  if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
    echo "Bootstrap Rebornsense (91.98.41.165):"
    echo "  ssh root@91.98.41.165"
    echo "  bash /root/rebornSense/scripts/setup-rebornsense-server.sh"
    echo "  # or re-init /root/FoodTruckPOS:"
    echo "  LEGACY_PATH=/root/FoodTruckPOS bash /root/rebornSense/scripts/setup-rebornsense-server.sh"
  else
    echo "Bootstrap Chaslay:"
    echo "  bash scripts/setup-hetzner-server.sh"
  fi
  exit 1
fi

cd "$REPO_DIR"
export_stack_caddyfile

echo "=== ChaslayReborn deploy ($DEPLOY_STACK) @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="

mkdir -p "$SECRETS_DIR"
ENV_FILE="$SECRETS_DIR/.env.production"
LEGACY_ENV="$SECRETS_DIR/backend.env"

rand_hex() {
  openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p -c 48 | head -1
}

env_get() {
  # env_get KEY file
  local key="$1" file="$2"
  [[ -f "$file" ]] || return 0
  # shellcheck disable=SC2002
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//' || true
}

ensure_env_production() {
  local jwt dbpass adminpass legacy_jwt legacy_admin legacy_dburl

  if [[ -f "$REPO_DIR/.env.production" && ! -L "$REPO_DIR/.env.production" && ! -f "$ENV_FILE" ]]; then
    cp "$REPO_DIR/.env.production" "$ENV_FILE"
    echo "Migrated secrets: .env.production -> $ENV_FILE"
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$REPO_DIR/.env.production.example" "$ENV_FILE"
    echo "Created $ENV_FILE from example"
  fi

  # Pull useful values from legacy Reborn backend.env when present
  legacy_admin="$(env_get SUPERADMIN_PASSWORD "$LEGACY_ENV")"
  legacy_jwt="$(env_get LICENSE_SECRET "$LEGACY_ENV")"
  legacy_dburl="$(env_get DATABASE_URL "$LEGACY_ENV")"

  jwt="$(env_get JWT_SECRET "$ENV_FILE")"
  dbpass="$(env_get POSTGRES_PASSWORD "$ENV_FILE")"
  adminpass="$(env_get SEED_SUPERADMIN_PASSWORD "$ENV_FILE")"

  # Replace placeholders / empty required values
  if [[ -z "$jwt" || "$jwt" == replace-with-long-random-secret* ]]; then
    jwt="${legacy_jwt:-}"
    [[ -n "$jwt" && ${#jwt} -ge 16 ]] || jwt="$(rand_hex)"
    if grep -qE '^JWT_SECRET=' "$ENV_FILE"; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt}|" "$ENV_FILE"
    else
      echo "JWT_SECRET=${jwt}" >>"$ENV_FILE"
    fi
    echo "Set JWT_SECRET in $ENV_FILE"
  fi

  if [[ -z "$dbpass" || "$dbpass" == replace-with-strong-db-password* ]]; then
    # Prefer password embedded in legacy DATABASE_URL user:pass@
    if [[ -n "$legacy_dburl" ]]; then
      dbpass="$(printf '%s' "$legacy_dburl" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
    fi
    [[ -n "$dbpass" ]] || dbpass="$(rand_hex)"
    if grep -qE '^POSTGRES_PASSWORD=' "$ENV_FILE"; then
      sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${dbpass}|" "$ENV_FILE"
    else
      echo "POSTGRES_PASSWORD=${dbpass}" >>"$ENV_FILE"
    fi
    echo "Set POSTGRES_PASSWORD in $ENV_FILE"
  fi

  # Bootstrap panel password (seed syncs this into Postgres on every migrate)
  adminpass="${SEED_SUPERADMIN_PASSWORD_OVERRIDE:-${adminpass:-RebornAdmin123!}}"
  if [[ -n "$legacy_admin" && "$legacy_admin" != "change_me_superadmin_password" && -z "${SEED_SUPERADMIN_PASSWORD_OVERRIDE:-}" && ( -z "$adminpass" || "$adminpass" == "RebornAdmin123!" || "$adminpass" == "ChaslayAdmin123!" ) ]]; then
    adminpass="$legacy_admin"
  fi
  if grep -qE '^SEED_SUPERADMIN_PASSWORD=' "$ENV_FILE"; then
    sed -i "s|^SEED_SUPERADMIN_PASSWORD=.*|SEED_SUPERADMIN_PASSWORD=${adminpass}|" "$ENV_FILE"
  else
    echo "SEED_SUPERADMIN_PASSWORD=${adminpass}" >>"$ENV_FILE"
  fi
  echo "Synced SEED_SUPERADMIN_PASSWORD in $ENV_FILE"
  # Recovery default for panel login (override with SEED_SUPERADMIN_PASSWORD_OVERRIDE)
  if [[ "${FORCE_CHASLAY_ADMIN_BOOTSTRAP:-1}" == "1" ]]; then
    sed -i "s|^SEED_SUPERADMIN_PASSWORD=.*|SEED_SUPERADMIN_PASSWORD=RebornAdmin123!|" "$ENV_FILE"
    echo "Forced SEED_SUPERADMIN_PASSWORD=RebornAdmin123! (set FORCE_CHASLAY_ADMIN_BOOTSTRAP=0 to keep custom)"
  fi

  # Ensure host defaults per stack (CADDYFILE must live in .env.production — compose defaults to chaslay)
  if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
    grep -qE '^DOMAIN=' "$ENV_FILE" || echo 'DOMAIN=rebornsense.com' >>"$ENV_FILE"
    grep -qE '^PUBLIC_APP_URL=' "$ENV_FILE" || echo 'PUBLIC_APP_URL=https://app.rebornsense.com' >>"$ENV_FILE"
    grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE" || echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.rebornsense.com' >>"$ENV_FILE"
    grep -qE '^CORS_ALLOW_ALL=' "$ENV_FILE" || echo 'CORS_ALLOW_ALL=true' >>"$ENV_FILE"
    if grep -qE '^ACME_EMAIL=' "$ENV_FILE"; then
      sed -i 's|^ACME_EMAIL=.*|ACME_EMAIL=admin@rebornsense.com|' "$ENV_FILE"
    else
      echo 'ACME_EMAIL=admin@rebornsense.com' >>"$ENV_FILE"
    fi
    sed -i 's|^DOMAIN=.*|DOMAIN=rebornsense.com|' "$ENV_FILE"
    sed -i 's|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=https://app.rebornsense.com|' "$ENV_FILE"
    if grep -qE '^CADDYFILE=' "$ENV_FILE"; then
      sed -i 's|^CADDYFILE=.*|CADDYFILE=./deploy/Caddyfile.rebornsense|' "$ENV_FILE"
    else
      echo 'CADDYFILE=./deploy/Caddyfile.rebornsense' >>"$ENV_FILE"
    fi
    if grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE"; then
      sed -i 's|^PUBLIC_RECEIPT_BASE_URL=.*|PUBLIC_RECEIPT_BASE_URL=https://pay.rebornsense.com|' "$ENV_FILE"
    else
      echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.rebornsense.com' >>"$ENV_FILE"
    fi
    export_stack_caddyfile
  else
    grep -qE '^DOMAIN=' "$ENV_FILE" || echo 'DOMAIN=chaslay.com' >>"$ENV_FILE"
    grep -qE '^PUBLIC_APP_URL=' "$ENV_FILE" || echo 'PUBLIC_APP_URL=https://app.chaslay.com' >>"$ENV_FILE"
    grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE" || echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
    grep -qE '^CORS_ALLOW_ALL=' "$ENV_FILE" || echo 'CORS_ALLOW_ALL=true' >>"$ENV_FILE"
    grep -qE '^ACME_EMAIL=' "$ENV_FILE" || echo 'ACME_EMAIL=admin@chaslay.com' >>"$ENV_FILE"
    sed -i 's|^DOMAIN=.*|DOMAIN=chaslay.com|' "$ENV_FILE"
    sed -i 's|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=https://app.chaslay.com|' "$ENV_FILE"
    if grep -qE '^CADDYFILE=' "$ENV_FILE"; then
      sed -i 's|^CADDYFILE=.*|CADDYFILE=./deploy/Caddyfile.chaslay|' "$ENV_FILE"
    else
      echo 'CADDYFILE=./deploy/Caddyfile.chaslay' >>"$ENV_FILE"
    fi
    if grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE"; then
      sed -i 's|^PUBLIC_RECEIPT_BASE_URL=.*|PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com|' "$ENV_FILE"
    else
      echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
    fi
    export_stack_caddyfile
  fi

  # Recover / normalize Brevo (Sendinblue) keys from this file or legacy Reborn envs
  ensure_brevo_env "$ENV_FILE"
}

# Copy KEY=value from SRC into DEST if DEST is missing/empty for that key
copy_env_key() {
  local src="$1" dest="$2" key="$3"
  local val
  val="$(grep -E "^${key}=" "$src" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  [[ -n "$val" ]] || return 0
  if grep -qE "^${key}=" "$dest"; then
    local existing
    existing="$(grep -E "^${key}=" "$dest" | tail -n1 | cut -d= -f2- || true)"
    if [[ -z "$existing" ]]; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$dest"
      echo "Filled empty ${key} in $dest from legacy env"
    fi
  else
    echo "${key}=${val}" >>"$dest"
    echo "Imported ${key} into $dest from legacy env"
  fi
}

ensure_brevo_env() {
  local dest="$1"
  local candidates=(
    "$dest"
    /root/chaslay-secrets/.env
    /root/chaslay/.env
    /root/chaslay/.env.production
    /root/Reborn/.env
    /root/Reborn/.env.production
    /root/FoodTruckPOS/backend/.env
    /root/FoodTruckPOS/.env
    /opt/chaslay/.env
    /opt/chaslay/.env.production
  )

  local src
  for src in "${candidates[@]}"; do
    [[ -f "$src" ]] || continue
    copy_env_key "$src" "$dest" "BREVO_API_KEY"
    copy_env_key "$src" "$dest" "SENDINBLUE_API_KEY"
    copy_env_key "$src" "$dest" "SIB_API_KEY"
    copy_env_key "$src" "$dest" "BREVO_FROM_EMAIL"
    copy_env_key "$src" "$dest" "BREVO_SENDER_EMAIL"
    copy_env_key "$src" "$dest" "SENDINBLUE_FROM_EMAIL"
    copy_env_key "$src" "$dest" "BREVO_FROM_NAME"
    copy_env_key "$src" "$dest" "FROM_EMAIL"
    copy_env_key "$src" "$dest" "MAIL_FROM"
  done

  # Normalize aliases ? BREVO_* so docker-compose always has the preferred names
  local api from name
  api="$(grep -E '^(BREVO_API_KEY|SENDINBLUE_API_KEY|SIB_API_KEY)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"
  from="$(grep -E '^(BREVO_FROM_EMAIL|BREVO_SENDER_EMAIL|SENDINBLUE_FROM_EMAIL|FROM_EMAIL|MAIL_FROM)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"
  name="$(grep -E '^(BREVO_FROM_NAME|SENDINBLUE_FROM_NAME|MAIL_FROM_NAME)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"

  if [[ -n "$api" ]]; then
    if grep -qE '^BREVO_API_KEY=' "$dest"; then
      sed -i "s|^BREVO_API_KEY=.*|BREVO_API_KEY=${api}|" "$dest"
    else
      echo "BREVO_API_KEY=${api}" >>"$dest"
    fi
  fi
  if [[ -n "$from" ]]; then
    if grep -qE '^BREVO_FROM_EMAIL=' "$dest"; then
      sed -i "s|^BREVO_FROM_EMAIL=.*|BREVO_FROM_EMAIL=${from}|" "$dest"
    else
      echo "BREVO_FROM_EMAIL=${from}" >>"$dest"
    fi
  fi
  if [[ -n "$name" ]]; then
    if grep -qE '^BREVO_FROM_NAME=' "$dest"; then
      sed -i "s|^BREVO_FROM_NAME=.*|BREVO_FROM_NAME=${name}|" "$dest"
    else
      echo "BREVO_FROM_NAME=${name}" >>"$dest"
    fi
  elif ! grep -qE '^BREVO_FROM_NAME=' "$dest"; then
    echo "BREVO_FROM_NAME=Reborn" >>"$dest"
  fi

  if grep -qE '^BREVO_API_KEY=.+' "$dest"; then
    echo "Brevo API key: present"
  else
    echo "Brevo API key: MISSING (set BREVO_API_KEY or SENDINBLUE_API_KEY in $dest)"
  fi
  if grep -qE '^BREVO_FROM_EMAIL=.+' "$dest"; then
    echo "Brevo from email: present ($(grep -E '^BREVO_FROM_EMAIL=' "$dest" | cut -d= -f2-))"
  else
    echo "Brevo from email: MISSING"
  fi
}

ensure_env_production

ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Git pull ==="
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "ERROR: $REPO_DIR is not a git repository (no .git directory)."
  echo ""
  echo "Deploy needs 'git fetch' to pull latest code. Common fixes:"
  echo ""
  if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
    echo "  A) Fresh clone (recommended):"
    echo "     bash $REPO_DIR/scripts/setup-rebornsense-server.sh"
    echo "     # from any copy of the script, or after manual clone to /root/rebornSense"
    echo ""
    echo "  B) Re-init existing /root/FoodTruckPOS files in place:"
    echo "     LEGACY_PATH=/root/FoodTruckPOS DEPLOY_PATH=$REPO_DIR bash scripts/setup-rebornsense-server.sh"
    echo ""
    echo "  C) Manual re-init in $REPO_DIR:"
    echo "     cd $REPO_DIR"
    echo "     git init && git remote add origin git@github.com:ihtxam/rebornSense.git"
    echo "     git fetch origin main && git reset --hard origin/main"
    echo ""
    echo "GitHub is private — use SSH deploy key /root/.ssh/rebornsense_deploy (see DEPLOY.md)."
  else
    echo "  bash scripts/setup-hetzner-server.sh"
    echo "  # or: git clone https://github.com/ihtxam/FoodTruckPOS.git $REPO_DIR"
  fi
  exit 1
fi

# Concurrent deploys can race on refs/remotes/origin/main (cannot lock ref).
git_fetch_main_with_retry() {
  local attempt max_attempts=3 sleep_secs=2
  local git_dir lock_file
  git_dir="$(git rev-parse --git-dir)"
  lock_file="$git_dir/refs/remotes/origin/main.lock"

  for attempt in $(seq 1 "$max_attempts"); do
    if [[ -f "$lock_file" ]]; then
      echo "Removing stale git ref lock: $lock_file"
      rm -f "$lock_file"
    fi
    if git fetch --prune origin main; then
      return 0
    fi
    local err="$?"
    echo "git fetch attempt $attempt/$max_attempts failed (exit $err)"
    if [[ "$attempt" -lt "$max_attempts" ]]; then
      sleep "$sleep_secs"
      sleep_secs=$((sleep_secs * 2))
    fi
  done
  echo "ERROR: git fetch origin main failed after $max_attempts attempts"
  return 1
}

git_fetch_main_with_retry
git reset --hard origin/main
chmod +x "$REPO_DIR/scripts/deploy-hetzner.sh" || true

# Re-exec updated script so new ensure_env_production / seed logic is used
if [[ "${DEPLOY_POST_PULL:-}" != "1" ]]; then
  echo "=== Re-executing updated deploy script ==="
  exec env DEPLOY_POST_PULL=1 bash "$REPO_DIR/scripts/deploy-hetzner.sh"
fi

ensure_env_production
ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

# Print-agent EXE is gitignored (~40MB). Cross-compile Windows binary with pkg in Docker.
echo "=== Build print-agent Windows EXE ==="
DOWNLOADS_DIR="$REPO_DIR/backend/public/downloads"
mkdir -p "$DOWNLOADS_DIR"
SETUP_EXE="$DOWNLOADS_DIR/reborn-print-agent-setup.exe"
LEGACY_SETUP_EXE="$DOWNLOADS_DIR/chaslayreborn-print-agent-setup.exe"
if [[ "${SKIP_PRINT_AGENT_BUILD:-0}" != "1" ]]; then
  BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if docker run --rm \
    -e "BUILT_AT=$BUILT_AT" \
    -v "$REPO_DIR/print-agent:/app" \
    -v "$DOWNLOADS_DIR:/out" \
    -w /app \
    node:20-bookworm \
    bash -c 'set -euo pipefail
      npm ci
      AGENT_VERSION="$(node -p "require(\"./package.json\").version")"
      mkdir -p dist
      npx pkg . --targets node18-win-x64 --output dist/reborn-print-agent.exe
      cp -f dist/reborn-print-agent.exe dist/reborn-print-agent-setup.exe
      cp -f dist/reborn-print-agent.exe /out/reborn-print-agent.exe
      cp -f dist/reborn-print-agent-setup.exe /out/reborn-print-agent-setup.exe
      cp -f /out/reborn-print-agent-setup.exe /out/chaslayreborn-print-agent-setup.exe
      printf "%s\n" \
        "{" \
        "  \"name\": \"reborn-print-agent\"," \
        "  \"version\": \"${AGENT_VERSION}\"," \
        "  \"setupFile\": \"reborn-print-agent-setup.exe\"," \
        "  \"builtAt\": \"${BUILT_AT}\"," \
        "  \"platform\": \"win32-x64\"," \
        "  \"signed\": false" \
        "}" > /out/reborn-print-agent.json
      cp -f /out/reborn-print-agent.json /out/chaslayreborn-print-agent.json
      echo "Print-agent manifest version: ${AGENT_VERSION}"
      head -c 2 /out/reborn-print-agent-setup.exe | grep -q MZ
      ls -la /out/reborn-print-agent*.exe /out/chaslayreborn-print-agent-setup.exe 2>/dev/null || ls -la /out/*.exe
    '; then
    echo "Print-agent EXE ready: $SETUP_EXE ($(wc -c < "$SETUP_EXE" | tr -d " ") bytes)"
  else
    echo "WARNING: print-agent build failed. /downloads will 404 until rebuilt."
    echo "  Manual: powershell -File print-agent/build-installer.ps1 then scp EXE to $DOWNLOADS_DIR"
  fi
else
  echo "SKIP_PRINT_AGENT_BUILD=1 - using existing $SETUP_EXE (if any)"
fi
if [[ ! -f "$SETUP_EXE" ]] || [[ "$(wc -c < "$SETUP_EXE" | tr -d " ")" -lt 1000000 ]]; then
  echo "WARNING: $SETUP_EXE missing or too small - Windows will report a corrupted download"
fi

echo "=== Build Print Bridge Android APK ==="
BRIDGE_APK="$DOWNLOADS_DIR/reborn-print-bridge.apk"
BRIDGE_VERSION="$(grep -E 'versionName\s*=' "$REPO_DIR/print-agent-android/app/build.gradle.kts" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/' | head -1)"
[[ -n "$BRIDGE_VERSION" ]] || BRIDGE_VERSION="0.0.0"
if [[ "${SKIP_ANDROID_BRIDGE_BUILD:-0}" != "1" ]]; then
  BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if docker run --rm \
    -e "ANDROID_SDK_ROOT=/opt/android-sdk-linux" \
    -e "GRADLE_USER_HOME=/tmp/gradle-home" \
    -v "$REPO_DIR/print-agent-android:/project" \
    -v "$DOWNLOADS_DIR:/out" \
    -w /project \
    mingc/android-build-box:latest \
    bash -c 'set -euo pipefail
      export GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false"
      rm -rf /project/.gradle /project/app/build /tmp/gradle-home /tmp/gradle-project-cache
      mkdir -p /opt/android-sdk/.android /tmp/gradle-home /tmp/gradle-project-cache
      if [[ ! -f /opt/android-sdk/.android/debug.keystore ]]; then
        keytool -genkeypair -v \
          -keystore /opt/android-sdk/.android/debug.keystore \
          -storepass android -alias androiddebugkey -keypass android \
          -keyalg RSA -keysize 2048 -validity 10000 \
          -dname "CN=Reborn Print Bridge,O=Reborn,C=CH"
      fi
      chmod +x ./gradlew
      ./gradlew --stop 2>/dev/null || true
      ./gradlew assembleRelease --no-daemon --no-build-cache \
        -g /tmp/gradle-home \
        --project-cache-dir=/tmp/gradle-project-cache
      APK="$(find app/build/outputs/apk/release -name "*.apk" | head -1)"
      test -n "$APK"
      cp -f "$APK" /out/reborn-print-bridge.apk
      head -c 2 /out/reborn-print-bridge.apk | grep -q PK
      ls -la /out/reborn-print-bridge.apk
    '; then
    printf '%s\n' \
      "{" \
      "  \"name\": \"reborn-print-bridge\"," \
      "  \"version\": \"${BRIDGE_VERSION}\"," \
      "  \"apkFile\": \"reborn-print-bridge.apk\"," \
      "  \"builtAt\": \"${BUILT_AT}\"," \
      "  \"platform\": \"android\"," \
      "  \"signed\": false" \
      "}" > "$DOWNLOADS_DIR/reborn-print-bridge.json"
    echo "Print Bridge APK ready: $BRIDGE_APK v${BRIDGE_VERSION} ($(wc -c < "$BRIDGE_APK" | tr -d " ") bytes)"
  else
    echo "WARNING: Print Bridge APK build failed. Android download will 404 until rebuilt."
    echo "  Manual: cd print-agent-android && ./gradlew assembleRelease"
    echo "  Then copy app/build/outputs/apk/release/*.apk to $BRIDGE_APK"
  fi
else
  echo "SKIP_ANDROID_BRIDGE_BUILD=1 - using existing $BRIDGE_APK (if any)"
fi
if [[ ! -f "$BRIDGE_APK" ]] || ! head -c 2 "$BRIDGE_APK" | grep -q PK; then
  echo "WARNING: $BRIDGE_APK missing or not a valid APK (expected PK zip header)"
fi

compose_project_name() {
  local dir="${1:-$REPO_DIR}"
  if [[ -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
    printf '%s' "$COMPOSE_PROJECT_NAME"
    return 0
  fi
  basename "$dir" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g'
}

stop_compose_stack() {
  local dir="$1"
  [[ -f "$dir/docker-compose.yml" ]] || return 0
  echo "docker compose down: $dir"
  (
    cd "$dir"
    if [[ "$(realpath "$dir" 2>/dev/null || echo "$dir")" == "$(realpath "$REPO_DIR" 2>/dev/null || echo "$REPO_DIR")" ]]; then
      dc down --remove-orphans 2>/dev/null || true
    else
      docker compose down --remove-orphans 2>/dev/null || true
    fi
  ) || true
}

stop_conflicting_http_stacks() {
  local current_project dir project name port repo_real legacy_real
  current_project="$(compose_project_name "$REPO_DIR")"
  repo_real="$(realpath "$REPO_DIR" 2>/dev/null || echo "$REPO_DIR")"

  echo "=== Free ports 80/443 (compose project: $current_project) ==="

  # Known trees that may still run an old Caddy on :80/:443
  local legacy_dirs=(
    /root/FoodTruckPOS
    /root/FoodTruckPOS/backend
    /root/chaslay
    /root/Chaslay
    /root/rebornSense
  )
  for dir in "${legacy_dirs[@]}"; do
    legacy_real="$(realpath "$dir" 2>/dev/null || echo "$dir")"
    [[ "$legacy_real" == "$repo_real" ]] && continue
    stop_compose_stack "$dir"
  done

  # Legacy backend-only compose inside the current repo (pre-root docker-compose.yml layout)
  if [[ -f "$REPO_DIR/backend/docker-compose.yml" && ! -f "$REPO_DIR/docker-compose.yml" ]]; then
    stop_compose_stack "$REPO_DIR/backend"
  elif [[ -f "$REPO_DIR/backend/docker-compose.yml" ]]; then
    stop_compose_stack "$REPO_DIR/backend"
  fi

  # Old compose project names (directory-derived or hand-set)
  for project in backend foodtruckpos chaslay reborn rebornsense; do
    [[ "$project" == "$current_project" ]] && continue
    echo "docker compose -p $project down"
    docker compose -p "$project" down --remove-orphans 2>/dev/null || true
  done

  # Remove any container still publishing :80 or :443 outside this deploy's project
  for port in 80 443; do
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      if [[ "$name" == "${current_project}-caddy-"* ]]; then
        continue
      fi
      project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$name" 2>/dev/null || true)"
      if [[ -n "$project" && "$project" == "$current_project" ]]; then
        continue
      fi
      echo "Removing port blocker: $name (publish $port)"
      docker rm -f "$name" 2>/dev/null || true
    done < <(docker ps --filter "publish=$port" --format '{{.Names}}' 2>/dev/null || true)
  done

  docker rm -f \
    backend-caddy-1 backend-api-1 backend-receipts-1 backend-postgres-1 \
    foodtruckpos-caddy-1 chaslay-caddy-1 2>/dev/null || true

  echo "Port 80: $(docker ps --filter publish=80 --format '{{.Names}}' 2>/dev/null | paste -sd' ' - || echo 'free')"
  echo "Port 443: $(docker ps --filter publish=443 --format '{{.Names}}' 2>/dev/null | paste -sd' ' - || echo 'free')"
}

stop_conflicting_http_stacks

echo "=== Docker build & start ==="
export_stack_caddyfile
migrate_project="$(compose_project_name "$REPO_DIR")"
# Interrupted deploys can leave hash-prefixed migrate containers that block recreate.
docker ps -aq --filter "name=${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
docker ps -aq --filter "name=_${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
  APP_URL="https://app.rebornsense.com"
  API_URL="https://api.rebornsense.com"
else
  APP_URL="https://app.chaslay.com"
  API_URL="https://api.chaslay.com"
fi
echo "CADDYFILE=$CADDYFILE"
# migrate is a one-shot job — starting it via `up` leaves rebornsense-migrate-1 behind and blocks later deploys.
docker ps -aq --filter "name=${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
docker ps -aq --filter "name=_${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
# Leftover API containers from a failed recreate block the next deploy.
docker ps -aq --filter "name=${migrate_project}-api" | xargs -r docker rm -f 2>/dev/null || true
docker ps -aq --filter "name=_${migrate_project}-api" | xargs -r docker rm -f 2>/dev/null || true
dc up -d --build db api dashboard caddy

# Caddyfile is bind-mounted; reload in place (avoid --force-recreate name conflicts)
echo "=== Reload Caddy ==="
caddy_project="$(compose_project_name "$REPO_DIR")"
docker ps -aq --filter "name=${caddy_project}-caddy" --filter "status=exited" | xargs -r docker rm -f 2>/dev/null || true
dc up -d caddy
if dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null; then
  echo "Caddy reloaded"
else
  echo "Caddy reload failed; restarting container"
  dc restart caddy 2>/dev/null || true
fi

echo "=== Verify Caddy TLS config ==="
CADDY_CONTAINER="$(dc ps -q caddy 2>/dev/null | head -1)"
if [[ -n "$CADDY_CONTAINER" ]]; then
  if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
    if ! docker exec "$CADDY_CONTAINER" grep -q 'app.rebornsense.com' /etc/caddy/Caddyfile 2>/dev/null; then
      echo "ERROR: Caddy is not using deploy/Caddyfile.rebornsense (wrong bind mount)."
      echo "  Fix: grep CADDYFILE /root/chaslay-secrets/.env.production"
      echo "  Expected: CADDYFILE=./deploy/Caddyfile.rebornsense"
      exit 1
    fi
  fi
  echo "Caddyfile host block sample:"
  docker exec "$CADDY_CONTAINER" grep -E '^[a-z*].*\.(rebornsense|chaslay)\.com|^https://' /etc/caddy/Caddyfile 2>/dev/null | head -8 || true
fi

echo "=== Wait for services ==="
sleep 20

echo "=== Database migrate / seed ==="
# Failed prior deploys can leave a stopped migrate container (e.g. rebornsense-migrate-1).
docker ps -aq --filter "name=${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
docker ps -aq --filter "name=_${migrate_project}-migrate" | xargs -r docker rm -f 2>/dev/null || true
# drizzle-kit push can OOM (exit 137) on small VMs; schema-repair covers DDL.
dc run --rm migrate || echo "WARNING: migrate job failed or OOM; continuing (schema-repair will patch columns)"

if [[ -f "$REPO_DIR/backend/sql/ensure-adyen-features.sql" ]]; then
  echo "=== Apply Adyen feature SQL patches ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-adyen-features.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-gift-cards-ecard.sql" ]]; then
  echo "=== Apply e-gift card SQL patches ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-gift-cards-ecard.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-refunds.sql" ]]; then
  echo "=== Apply refund / payment breakdown SQL patches ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-refunds.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-delivery-platforms.sql" ]]; then
  echo "=== Apply delivery platform SQL patches ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-delivery-platforms.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-vat-after-discount.sql" ]]; then
  echo "=== Apply VAT after discount SQL patch ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-vat-after-discount.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-cash-movements.sql" ]]; then
  echo "=== Apply POS cash in/out SQL patch ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-cash-movements.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-order-center.sql" ]]; then
  echo "=== Apply order-center SQL patches ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-order-center.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-orders-staff-id.sql" ]]; then
  echo "=== Apply orders.staff_id SQL patch ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-orders-staff-id.sql" || true
fi

if [[ -f "$REPO_DIR/backend/sql/ensure-pos-sessions-print-agent.sql" ]]; then
  echo "=== Apply pos_sessions.print_agent_online SQL patch ==="
  dc exec -T db \
    psql -U "${POSTGRES_USER:-manupos}" -d "${POSTGRES_DB:-manupos}" \
    < "$REPO_DIR/backend/sql/ensure-pos-sessions-print-agent.sql" || true
fi

echo "=== Health checks ==="
API_HEALTH="$(curl -sf http://127.0.0.1:3000/health || dc exec -T api wget -qO- http://127.0.0.1:3000/health || true)"
echo "local api: ${API_HEALTH:-unreachable}"
curl -sf "${API_URL}/health" || true
echo
echo "=== Schema repair (idempotent column patches) ==="
curl -sf -X POST http://127.0.0.1:3000/health/schema-repair || \
  dc exec -T api wget -qO- --post-data='' http://127.0.0.1:3000/health/schema-repair || true
curl -sf -X POST "${API_URL}/health/schema-repair" || true
echo

# Print-agent download must be a real PE, not SPA HTML / JSON 404
PRINT_HDR="$(curl -sI "${APP_URL}/downloads/reborn-print-agent-setup.exe" || true)"
PRINT_LEN="$(printf '%s' "$PRINT_HDR" | awk -F': ' 'tolower($1)=="content-length"{gsub(/\r/,""); print $2; exit}')"
PRINT_CT="$(printf '%s' "$PRINT_HDR" | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,""); print $2; exit}')"
PRINT_MAGIC="$(curl -sL "${APP_URL}/downloads/reborn-print-agent-setup.exe" | head -c 2 | od -An -tx1 | tr -d ' \n' || true)"
echo "print-agent download: Content-Type=${PRINT_CT:-?} Content-Length=${PRINT_LEN:-?} magic=${PRINT_MAGIC:-?}"
if [[ "${PRINT_MAGIC:-}" != "4d5a" ]] || [[ "${PRINT_LEN:-0}" -lt 1000000 ]]; then
  echo "WARNING: print-agent download is not a valid Windows EXE (expected MZ / ~40MB)"
else
  echo "print-agent download OK (MZ PE)"
fi

BRIDGE_HDR="$(curl -sI "${APP_URL}/downloads/reborn-print-bridge.apk" || true)"
BRIDGE_LEN="$(printf '%s' "$BRIDGE_HDR" | awk -F': ' 'tolower($1)=="content-length"{gsub(/\r/,""); print $2; exit}')"
BRIDGE_CT="$(printf '%s' "$BRIDGE_HDR" | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,""); print $2; exit}')"
BRIDGE_MAGIC="$(curl -sL "${APP_URL}/downloads/reborn-print-bridge.apk" | head -c 2 | od -An -tx1 | tr -d ' \n' || true)"
BRIDGE_JSON_VERSION="$(curl -sf "${APP_URL}/downloads/reborn-print-bridge.json" 2>/dev/null | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || true)"
echo "print-bridge download: Content-Type=${BRIDGE_CT:-?} Content-Length=${BRIDGE_LEN:-?} magic=${BRIDGE_MAGIC:-?} version=${BRIDGE_JSON_VERSION:-?}"
if [[ "${BRIDGE_MAGIC:-}" != "504b" ]] || [[ "${BRIDGE_LEN:-0}" -lt 100000 ]]; then
  echo "WARNING: print-bridge download is not a valid APK (expected PK / >100KB) or not published yet"
else
  echo "print-bridge download OK (PK zip/APK)"
fi
echo

POS_AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/v1/pos/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck@chaslay.local","password":"wrong"}' || true)
if [[ "$POS_AUTH_CODE" == "400" || "$POS_AUTH_CODE" == "401" || "$POS_AUTH_CODE" == "403" ]]; then
  echo "pos-auth OK (route live, HTTP $POS_AUTH_CODE)"
elif [[ "$POS_AUTH_CODE" == "404" ]]; then
  echo "ERROR: /v1/pos/auth/login not found (404)"
  exit 1
else
  echo "pos-auth HTTP ${POS_AUTH_CODE:-unreachable}"
fi

FLOOR_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H 'X-Api-Key: invalid' http://127.0.0.1:3000/v1/floor/main-pos || true)
echo "floor/main-pos HTTP ${FLOOR_CODE:-unreachable} (401 expected without valid API key)"


echo "=== Legacy license volume probe (non-fatal) ==="
bash "$REPO_DIR/scripts/recover-chaslay-licenses.sh" || true

echo "=== Email provider check ==="
if grep -qE '^BREVO_API_KEY=.+' "$ENV_FILE" && grep -qE '^BREVO_FROM_EMAIL=.+' "$ENV_FILE"; then
  echo "Brevo ready for merchant invite emails"
else
  echo "WARNING: Brevo not fully configured ? invite links will be copy-only until BREVO_API_KEY + BREVO_FROM_EMAIL are set"
fi

echo "=== Deploy complete ==="
if [[ "$DEPLOY_STACK" == "rebornsense" ]]; then
  echo "  Admin:  https://app.rebornsense.com/"
  echo "  API:    https://api.rebornsense.com/health"
  echo "  Shop:   https://shop.rebornsense.com/"
  echo "  Pay:    https://pay.rebornsense.com/receipt/"
  echo "  Status: https://status.rebornsense.com/"
else
  echo "  Admin:  https://app.chaslay.com/"
  echo "  API:    https://api.chaslay.com/health"
  echo "  Shop:   https://shop.chaslay.com/"
  echo "  Pay:    https://pay.chaslay.com/receipt/"
  echo "  Status: https://status.chaslay.com/"
fi
echo "  Secrets: $ENV_FILE"
