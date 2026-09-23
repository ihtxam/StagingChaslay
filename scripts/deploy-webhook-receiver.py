#!/usr/bin/env python3
"""Lightweight GitHub/manual deploy webhook for RebornSense production.

Listens on localhost (default :9847). Validates GitHub HMAC (X-Hub-Signature-256)
or Authorization: Bearer <DEPLOY_WEBHOOK_TOKEN>, then runs deploy-hetzner.sh in the
background with a file lock so concurrent pushes do not overlap.

Environment (file or process env):
  DEPLOY_WEBHOOK_SECRET   GitHub webhook secret (HMAC)
  DEPLOY_WEBHOOK_TOKEN    Manual/agent bearer token (optional)
  DEPLOY_WEBHOOK_PORT     Listen port (default 9847)
  DEPLOY_WEBHOOK_PATH     URL path prefix (default /internal/git-deploy)
  DEPLOY_STACK            rebornsense | chaslay (default rebornsense)
  DEPLOY_PATH             Repo path on server
  DEPLOY_BRANCH           Branch to deploy (default main)
  DEPLOY_ON_ANY_MAIN_PUSH 1 = deploy on any push to DEPLOY_BRANCH (default 1)
  DEPLOY_LOG              Log file path
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV_FILE = Path("/root/chaslay-secrets/deploy-webhook.env")


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def cfg(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{stamp}] {msg}\n"
    log_path = cfg("DEPLOY_LOG", "/var/log/rebornsense-deploy-webhook.log")
    try:
        Path(log_path).parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError:
        pass
    sys.stdout.write(line)
    sys.stdout.flush()


def verify_github_signature(secret: str, body: bytes, header: str | None) -> bool:
    if not secret or not header or not header.startswith("sha256="):
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, header)


def verify_bearer(token: str, header: str | None) -> bool:
    if not token or not header:
        return False
    parts = header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    return hmac.compare_digest(parts[1].strip(), token)


def should_deploy(payload: dict[str, Any]) -> tuple[bool, str]:
    branch = cfg("DEPLOY_BRANCH", "main")
    on_any = cfg("DEPLOY_ON_ANY_MAIN_PUSH", "1") not in ("0", "false", "False")

    event = cfg("_GITHUB_EVENT", "")
    if event and event != "push":
        return False, f"ignored event {event}"

    ref = str(payload.get("ref") or "")
    if ref and ref != f"refs/heads/{branch}":
        return False, f"ignored ref {ref}"

    if on_any:
        return True, f"push to {branch}"

    commits = payload.get("commits")
    if not isinstance(commits, list):
        return True, "no commit list — deploy anyway"

    trigger_paths = (
        ".deploy/rebornsense-production",
        ".deploy/chaslay-staging",
    )
    for commit in commits:
        if not isinstance(commit, dict):
            continue
        for key in ("added", "modified", "removed"):
            files = commit.get(key)
            if not isinstance(files, list):
                continue
            for path in files:
                if any(str(path).startswith(p) for p in trigger_paths):
                    return True, f"trigger file {path}"

    return False, "no deploy trigger paths in push"


_deploy_lock = threading.Lock()
_deploy_running = False


def run_deploy(reason: str) -> None:
    global _deploy_running
    with _deploy_lock:
        if _deploy_running:
            log(f"SKIP deploy already running ({reason})")
            return
        _deploy_running = True

    deploy_path = cfg("DEPLOY_PATH", "/root/rebornSense")
    deploy_stack = cfg("DEPLOY_STACK", "rebornsense")
    branch = cfg("DEPLOY_BRANCH", "main")
    log_path = cfg("DEPLOY_LOG", "/var/log/rebornsense-deploy.log")
    script = str(Path(deploy_path) / "scripts" / "deploy-hetzner.sh")

    shell = f"""set -euo pipefail
unset RESET_STAGING_DB PRODUCTION_DB_FORCE_RESET FORCE_DB_RESET
export DEPLOY_STACK={deploy_stack}
export DEPLOY_PATH={deploy_path}
cd {deploy_path}
bash scripts/pre-deploy-sanity-check.sh 2>/dev/null || true
git fetch origin {branch}
git reset --hard origin/{branch}
bash {script}
"""
    log(f"START deploy ({reason}) stack={deploy_stack} path={deploy_path}")
    try:
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(f"\n=== webhook deploy {datetime.now(timezone.utc).isoformat()} ({reason}) ===\n")
            proc = subprocess.run(
                ["flock", "-n", "/var/lock/rebornsense-deploy.lock", "bash", "-lc", shell],
                stdout=fh,
                stderr=subprocess.STDOUT,
                check=False,
            )
        if proc.returncode == 0:
            log(f"DONE deploy ({reason})")
        else:
            log(f"FAIL deploy exit={proc.returncode} ({reason})")
    except Exception as exc:  # noqa: BLE001
        log(f"ERROR deploy ({reason}): {exc}")
    finally:
        with _deploy_lock:
            _deploy_running = False


class DeployWebhookHandler(BaseHTTPRequestHandler):
    server_version = "RebornDeployWebhook/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        log(f"{self.address_string()} {fmt % args}")

    def _reject(self, code: int, msg: str) -> None:
        body = json.dumps({"ok": False, "error": msg}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _accept(self, msg: str, queued: bool) -> None:
        body = json.dumps({"ok": True, "message": msg, "queued": queued}).encode("utf-8")
        self.send_response(202 if queued else 200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = cfg("DEPLOY_WEBHOOK_PATH", "/internal/git-deploy")
        if urlparse(self.path).path.rstrip("/") == f"{path}/health".rstrip("/"):
            self._accept("healthy", queued=False)
            return
        self._reject(404, "not found")

    def do_POST(self) -> None:  # noqa: N802
        expected_path = cfg("DEPLOY_WEBHOOK_PATH", "/internal/git-deploy").rstrip("/")
        req_path = urlparse(self.path).path.rstrip("/")
        if req_path != expected_path:
            self._reject(404, "not found")
            return

        length = int(self.headers.get("Content-Length") or "0")
        if length > 2_000_000:
            self._reject(413, "payload too large")
            return
        body = self.rfile.read(length)

        secret = cfg("DEPLOY_WEBHOOK_SECRET")
        token = cfg("DEPLOY_WEBHOOK_TOKEN")
        github_sig = self.headers.get("X-Hub-Signature-256")
        auth = self.headers.get("Authorization")
        github_event = self.headers.get("X-GitHub-Event")

        github_ok = verify_github_signature(secret, body, github_sig)
        bearer_ok = verify_bearer(token, auth)

        if not github_ok and not bearer_ok:
            self._reject(401, "unauthorized")
            return

        payload: dict[str, Any] = {}
        if body:
            try:
                parsed = json.loads(body.decode("utf-8"))
                if isinstance(parsed, dict):
                    payload = parsed
            except json.JSONDecodeError:
                if not bearer_ok:
                    self._reject(400, "invalid json")
                    return

        if github_event:
            os.environ["_GITHUB_EVENT"] = github_event

        ok, reason = should_deploy(payload if payload else {"ref": f"refs/heads/{cfg('DEPLOY_BRANCH', 'main')}"})
        if not ok:
            log(f"IGNORE {reason}")
            self._accept(reason, queued=False)
            return

        threading.Thread(target=run_deploy, args=(reason,), daemon=True).start()
        self._accept(f"deploy queued: {reason}", queued=True)


def main() -> None:
    env_file = Path(cfg("DEPLOY_WEBHOOK_ENV_FILE", str(DEFAULT_ENV_FILE)))
    load_env_file(env_file)

    host = cfg("DEPLOY_WEBHOOK_HOST", "0.0.0.0")
    port = int(cfg("DEPLOY_WEBHOOK_PORT", "9847") or "9847")
    path = cfg("DEPLOY_WEBHOOK_PATH", "/internal/git-deploy")

    log(f"Listening on http://{host}:{port}{path}")
    log(f"Health: http://{host}:{port}{path}/health")
    server = ThreadingHTTPServer((host, port), DeployWebhookHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
