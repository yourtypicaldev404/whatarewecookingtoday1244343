#!/bin/bash
cd /home/ubuntu/stfu.fun || exit 1
/usr/bin/git fetch -q
LOCAL=$(/usr/bin/git rev-parse HEAD)
REMOTE=$(/usr/bin/git rev-parse @{u})
if [ "$LOCAL" != "$REMOTE" ]; then
  /usr/bin/git pull -q
  /usr/local/bin/pm2 restart stfufun-deploy
  echo "$(date): deployed $(git rev-parse --short HEAD)"
fi
