#!/usr/bin/env bash
set -euo pipefail
base=/opt/qingdun
runtime=/opt/qingdun-runtime
if [[ ! -x "$runtime/node/bin/node" ]]; then
  download=/tmp/qingdun-runtime-download
  mkdir -p "$download"
  cd "$download"
  curl -fsSL --connect-timeout 20 --max-time 90 -o SHASUMS256.txt https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
  node_archive=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
  [[ "$node_archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]]
  curl -fL --connect-timeout 20 --max-time 300 -o "$node_archive" "https://nodejs.org/dist/latest-v24.x/$node_archive"
  awk -v filename="$node_archive" '$2 == filename' SHASUMS256.txt | sha256sum -c -
  sudo install -d "$runtime/node"
  sudo tar -xJf "$node_archive" --strip-components=1 -C "$runtime/node"
fi
sudo install -d -o ubuntu -g ubuntu -m 700 "$base" "$base/shared"
sudo install -d -o ubuntu -g ubuntu "$base/releases" "$base/shared/data" "$base/shared/backups"
chmod 600 "$base/shared/.env" "$base/shared/.deploy-access"
sudo python3 - <<'PY'
from pathlib import Path
import subprocess
lines = Path('/opt/qingdun/shared/.deploy-access').read_text().splitlines()
values = dict(line.split('=', 1) for line in lines if '=' in line and not line.startswith('#'))
hashed = subprocess.run(['openssl', 'passwd', '-6', '-stdin'], input=values['PASSWORD']+'\n', text=True, capture_output=True, check=True).stdout.strip()
Path('/etc/nginx/qingdun.htpasswd').write_text(values['USERNAME']+':'+hashed+'\n')
PY
sudo chown root:www-data /etc/nginx/qingdun.htpasswd
sudo chmod 640 /etc/nginx/qingdun.htpasswd
sudo install -m 644 /tmp/qingdun.service /etc/systemd/system/qingdun.service
sudo install -m 644 /tmp/qingdun.nginx.conf /etc/nginx/sites-available/qingdun
sudo ln -sfn /etc/nginx/sites-available/qingdun /etc/nginx/sites-enabled/qingdun
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable qingdun
echo 'Runtime, systemd service, and HTTPS proxy prepared.'
