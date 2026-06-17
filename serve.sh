#!/usr/bin/env bash
# 本地预览：在当前目录启动静态服务器
PORT="${1:-8080}"
echo "本地预览启动中 → http://localhost:$PORT"
python3 -m http.server "$PORT"
