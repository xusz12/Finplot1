#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
if ! command -v node >/dev/null || [[ ! -d node_modules ]]; then
  echo '请先安装 Node.js 22+，并在项目目录执行 npm ci。'
  read -r -p '按回车关闭。'
  exit 1
fi
if [[ ! -f dist/version.json ]]; then npm run build; fi
npm start
