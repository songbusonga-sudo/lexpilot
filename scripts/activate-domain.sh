#!/usr/bin/env bash
set -euo pipefail
domain=lexpilot.mizki.online
if ! getent ahostsv4 "$domain" | awk '{print $1}' | grep -qx '62.234.114.47'; then
  echo 'DNS is not ready: add lexpilot A 62.234.114.47 first.' >&2
  exit 2
fi
sudo certbot certonly --webroot -w /var/www/qingdun-acme -d "$domain" --non-interactive --agree-tos
sudo cp /etc/nginx/sites-available/lexpilot /etc/nginx/sites-available/lexpilot.before-https
sudo install -m 644 /tmp/lexpilot.nginx.conf /etc/nginx/sites-available/lexpilot
if ! sudo nginx -t; then
  sudo cp /etc/nginx/sites-available/lexpilot.before-https /etc/nginx/sites-available/lexpilot
  exit 1
fi
python3 - <<'PY'
from pathlib import Path
for filename, name in [('/opt/qingdun/shared/.env', 'PUBLIC_ORIGIN'), ('/opt/qingdun/shared/.deploy-access', 'URL')]:
    path = Path(filename)
    lines = path.read_text().splitlines()
    entry = name + '=https://lexpilot.mizki.online'
    if any(line.startswith(name+'=') for line in lines):
        lines = [entry if line.startswith(name+'=') else line for line in lines]
    else:
        lines.append(entry)
    path.write_text('\n'.join(lines)+'\n')
    path.chmod(0o600)
PY
sudo systemctl restart qingdun
sudo systemctl reload nginx
sudo install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\n/usr/sbin/nginx -t && /bin/systemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/qingdun-reload-nginx >/dev/null
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/qingdun-reload-nginx
echo 'Domain HTTPS activated: https://lexpilot.mizki.online'
