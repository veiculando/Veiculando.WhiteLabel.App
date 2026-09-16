#!/bin/sh
set -eu

key="${GOOGLE_MAPS_BROWSER_API_KEY:-}"
case "$key" in
  *[!A-Za-z0-9_-]*)
    echo "GOOGLE_MAPS_BROWSER_API_KEY possui caracteres inválidos; mapa será desabilitado." >&2
    key=""
    ;;
esac

printf '%s\n' "window.__VEICULANDO_RUNTIME_CONFIG__ = Object.freeze({ googleMapsBrowserApiKey: '$key' });" \
  > /usr/share/nginx/html/assets/runtime-config.js

exec "$@"
