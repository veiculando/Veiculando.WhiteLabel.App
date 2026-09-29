#!/bin/sh
set -eu

key="${GOOGLE_MAPS_BROWSER_API_KEY:-}"
case "$key" in
  *[!A-Za-z0-9_-]*)
    echo "GOOGLE_MAPS_BROWSER_API_KEY possui caracteres inválidos; mapa será desabilitado." >&2
    key=""
    ;;
esac

origins_json=""
remaining="${PROSPECCAO_ALLOWED_ORIGINS:-}"
# Uma lista vazia desativa o handoff. Cada item precisa ser uma origem exata,
# sem path, curinga ou caracteres capazes de escapar da string JavaScript.
case "$remaining" in
  *,|*,,*)
    echo "PROSPECCAO_ALLOWED_ORIGINS contém lista inválida; prospecção será desabilitada." >&2
    remaining=""
    ;;
esac
while [ -n "$remaining" ]; do
  origin="${remaining%%,*}"
  if [ "$remaining" = "$origin" ]; then
    remaining=""
  else
    remaining="${remaining#*,}"
  fi
  if ! printf '%s\n' "$origin" | grep -Eq '^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?$'; then
    echo "PROSPECCAO_ALLOWED_ORIGINS contém origem inválida; prospecção será desabilitada." >&2
    origins_json=""
    break
  fi
  if [ -n "$origins_json" ]; then origins_json="$origins_json,"; fi
  origins_json="$origins_json'$origin'"
done

printf '%s\n' "window.__VEICULANDO_RUNTIME_CONFIG__ = Object.freeze({ googleMapsBrowserApiKey: '$key', prospeccaoAllowedOrigins: Object.freeze([$origins_json]) });" \
  > /usr/share/nginx/html/assets/runtime-config.js

exec "$@"
