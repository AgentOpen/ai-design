#!/usr/bin/env bash
# =====================================================================
# fetch-vendor.sh — 下载前端依赖到本地 vendor/
# 用法: bash fetch-vendor.sh
# 适用: 离线部署 / CDN 被墙时的兜底
# =====================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vendor"
mkdir -p "$DIR"

# 多个 CDN 源，按可用性顺序
download() {
  local name=$1
  local out=$2
  shift; shift
  for url in "$@"; do
    echo "  尝试: ${url}"
    if curl -fsSL --max-time 30 "$url" -o "$out" 2>/dev/null; then
      local size=$(wc -c < "$out")
      if [ "$size" -gt 1000 ]; then
        echo "  ✓ ${name} 下载成功（$(($size/1024))KB）"
        return 0
      fi
    fi
    echo "  ✗ 失败，尝试下一个源"
  done
  echo "  ⚠ ${name} 所有源都失败了"
  return 1
}

echo ""
echo "[1/3] React 18"
download "react" "$DIR/react.production.min.js" \
  "https://unpkg.com/react@18.2.0/umd/react.production.min.js" \
  "https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js" \
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js" \
  || OK=false

echo ""
echo "[2/3] ReactDOM 18"
download "react-dom" "$DIR/react-dom.production.min.js" \
  "https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js" \
  "https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js" \
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js" \
  || OK=false

echo ""
echo "[3/3] Three.js 0.160"
download "three" "$DIR/three.min.js" \
  "https://unpkg.com/three@0.160.0/build/three.min.js" \
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js" \
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js" \
  || OK=false

echo ""
if [ "${OK:-true}" = "false" ]; then
  echo "⚠ 部分依赖下载失败。若所在网络无法访问以上 CDN，请："
  echo "  1. 用代理后重试此脚本"
  echo "  2. 或在能联网的机器下载后传到 vendor/ 目录"
  exit 1
fi
echo "✓ 全部依赖已下载到 vendor/，可完全离线运行。"
ls -lh "$DIR/"*.js 2>/dev/null
