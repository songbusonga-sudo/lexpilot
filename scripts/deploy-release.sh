#!/usr/bin/env bash
set -euo pipefail
archive=${1:?archive required}
release_id=${2:?release ID required}
[[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}$ ]] || exit 2
[[ "$archive" == "/tmp/qingdun-${release_id}.tar.gz" ]] || exit 2
base=/opt/qingdun
release="$base/releases/$release_id"
export PATH="/opt/qingdun-runtime/node/bin:$PATH"
mkdir -p "$release" "$base/shared/data" "$base/shared/backups"
tar -xzf "$archive" -C "$release"
cd "$release"
npm ci --omit=dev --no-audit --no-fund
ln -s "$base/shared/data" data
ln -s "$base/shared/.env" .env
if [[ -f "$base/shared/data/qingdun.sqlite" ]]; then
  python3 - "$base/shared/data/qingdun.sqlite" "$base/shared/backups/$release_id.sqlite" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as target:
    source.backup(target)
PY
fi
previous=$(readlink -f "$base/current" || true)
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
sudo systemctl restart qingdun
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8266/api/health >/dev/null; then
    echo "Released $release_id; health check passed."
    rm -f "$archive"
    exit 0
  fi
  sleep 1
done
if [[ -n "$previous" && -d "$previous" && "$previous" != "$base/current" ]]; then
  ln -s "$previous" "$base/current.rollback"
  mv -Tf "$base/current.rollback" "$base/current"
  sudo systemctl restart qingdun
fi
echo 'Health check failed; previous release restored when available.' >&2
sudo journalctl -u qingdun -n 30 --no-pager
exit 1
