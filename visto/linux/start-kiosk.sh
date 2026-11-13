#!/bin/sh
# VistoOS · linux/start-kiosk.sh — startet den Browser im Kiosk auf device.html
#
# STATUS: Vorlage, auf echter Visto-Hardware UNGETESTET.
#
# Wird von cage (Wayland-Kiosk) aufgerufen, siehe visto-kiosk.service:
#     cage -d -s -- /opt/visto/linux/start-kiosk.sh
# Einstellungen über die Umgebung (z. B. /etc/default/visto):
#     VISTO_ROOT      Ordner mit VistoOS                 (Standard /opt/visto)
#     VISTO_URL       Startadresse                        (Standard http://127.0.0.1:7707/device.html?platform=linux)
#     VISTO_PROFILE   dauerhaftes Browser-Profil          (Standard /var/lib/visto/profile) – hier liegen die Einstellungen
#     VISTO_BROWSER   chromium | cog | auto               (Standard auto: Chromium, sonst Cog)
#     VISTO_OUTPUT    Wayland-Ausgang für wlr-randr       (z. B. DSI-1; leer = nichts umstellen)
#     VISTO_MODE      Bildmodus                           (Standard 1080x1080@90)
set -eu

ROOT="${VISTO_ROOT:-/opt/visto}"
URL="${VISTO_URL:-http://127.0.0.1:7707/device.html?platform=linux}"
PROFILE="${VISTO_PROFILE:-/var/lib/visto/profile}"
BROWSER="${VISTO_BROWSER:-auto}"
MODE="${VISTO_MODE:-1080x1080@90}"

mkdir -p "$PROFILE"

# Bildmodus setzen (1080 × 1080, 90 Hz), falls ein Ausgang genannt ist und wlr-randr installiert ist
if [ -n "${VISTO_OUTPUT:-}" ] && command -v wlr-randr >/dev/null 2>&1; then
  wlr-randr --output "$VISTO_OUTPUT" --mode "$MODE" || echo "start-kiosk: Bildmodus $MODE ließ sich nicht setzen" >&2
fi

# Läuft vistod (liefert die Seite aus)? Sonst direkt von der Platte laden – das OS läuft dann mit dem
# Web-Treiber als Rückfall und versucht die Brücke im Hintergrund weiter.
case "$URL" in
  http://127.0.0.1:*|http://localhost:*)
    PORT=$(printf '%s' "$URL" | sed -n 's#^http://[^:/]*:\([0-9][0-9]*\).*#\1#p')
    OK=0
    i=0
    while [ "$i" -lt 30 ]; do
      if python3 -c "import socket,sys; s=socket.create_connection(('127.0.0.1', int(sys.argv[1])), 1); s.close()" "${PORT:-7707}" 2>/dev/null; then OK=1; break; fi
      i=$((i + 1))
      sleep 0.5
    done
    if [ "$OK" -ne 1 ]; then
      echo "start-kiosk: vistod antwortet nicht – lade $ROOT/device.html direkt" >&2
      URL="file://$ROOT/device.html?platform=linux"
    fi
    ;;
esac

if [ "$BROWSER" = "auto" ]; then
  if command -v chromium >/dev/null 2>&1; then BROWSER=chromium
  elif command -v chromium-browser >/dev/null 2>&1; then BROWSER=chromium-browser
  elif command -v cog >/dev/null 2>&1; then BROWSER=cog
  else echo "start-kiosk: weder Chromium noch Cog gefunden" >&2; exit 1
  fi
fi

case "$BROWSER" in
  cog)
    # WPE WebKit (schlank, gut für kleine Rechner). Optionen je nach Cog-Version prüfen: cog --help-all
    exec cog --platform=wl "$URL"
    ;;
  *)
    exec "$BROWSER" \
      --kiosk \
      --ozone-platform=wayland \
      --user-data-dir="$PROFILE" \
      --window-size=1080,1080 \
      --force-device-scale-factor=1 \
      --no-first-run \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-features=Translate,TranslateUI \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --autoplay-policy=no-user-gesture-required \
      --use-fake-ui-for-media-stream \
      --password-store=basic \
      --check-for-update-interval=31536000 \
      "$URL"
    ;;
esac
