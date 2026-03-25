#!/bin/bash
# ──────────────────────────────────────────────────────────────
# init-ssl.sh — Bootstrap SSL certificates for lightrole dev
#
# Strategy:
#   1. Generate a self-signed placeholder cert so nginx can start
#   2. Start nginx (HTTPS config works with placeholder cert)
#   3. Issue real Let's Encrypt cert via webroot (nginx serves ACME challenges)
#   4. Reload nginx to pick up the real cert
#
# Usage:
#   bash nginx/scripts/init-ssl.sh --email admin@lightrole.com
#   bash nginx/scripts/init-ssl.sh --email admin@lightrole.com --staging
#
# Run from the project root (where docker-compose.yml lives).
# ──────────────────────────────────────────────────────────────

set -euo pipefail

DOMAINS="dev.lightrole.com dev-api.lightrole.com"
PRIMARY_DOMAIN="dev.lightrole.com"
CERT_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
EMAIL=""
STAGING=""

# ── Parse arguments ──────────────────────────────────────────
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --email)  EMAIL="$2"; shift ;;
        --staging) STAGING="--staging" ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$EMAIL" ]; then
    echo "Usage: $0 --email your@email.com [--staging]"
    exit 1
fi

# ── Check if real cert already exists ────────────────────────
if [ -f "${CERT_DIR}/fullchain.pem" ]; then
    # Check if it is a self-signed placeholder (CN=localhost)
    ISSUER=$(openssl x509 -in "${CERT_DIR}/fullchain.pem" -noout -issuer 2>/dev/null || true)
    if echo "$ISSUER" | grep -q "CN = localhost"; then
        echo "Found placeholder self-signed cert. Will replace with real cert."
    else
        echo "Real certificate already exists at ${CERT_DIR}."
        echo "To renew, run: docker compose exec certbot certbot renew"
        exit 0
    fi
fi

echo ""
echo "=== Light Role SSL Bootstrap ==="
echo "Domains: ${DOMAINS}"
echo "Email:   ${EMAIL}"
[ -n "$STAGING" ] && echo "Mode:    STAGING (test cert)"
echo ""

# ── Step 1: Generate self-signed placeholder cert ────────────
echo "[1/4] Generating self-signed placeholder certificate..."
sudo mkdir -p "${CERT_DIR}"
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj '/CN=localhost' \
    2>/dev/null
echo "      Placeholder cert created."

# ── Step 2: Start nginx with placeholder cert ────────────────
echo "[2/4] Starting nginx with placeholder certificate..."
docker compose up -d nginx
echo "      Waiting for nginx to become ready..."
sleep 3

# Verify nginx is running
if ! docker compose ps nginx | grep -q "Up\|running"; then
    echo "ERROR: nginx failed to start. Check logs:"
    docker compose logs nginx --tail 20
    exit 1
fi
echo "      nginx is running."

# ── Step 3: Issue real cert via webroot ──────────────────────
echo "[3/4] Requesting Let's Encrypt certificate..."

# Build -d flags for all domains
DOMAIN_FLAGS=""
for d in ${DOMAINS}; do
    DOMAIN_FLAGS="${DOMAIN_FLAGS} -d ${d}"
done

docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v lightrole_certbot_webroot:/var/www/certbot \
    certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    ${DOMAIN_FLAGS} \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    ${STAGING}

echo "      Certificate issued successfully."

# ── Step 4: Reload nginx with real cert ──────────────────────
echo "[4/4] Reloading nginx with real certificate..."
docker compose exec nginx nginx -s reload
echo "      nginx reloaded."

echo ""
echo "=== Done! ==="
echo "  https://dev.lightrole.com"
echo "  https://dev-api.lightrole.com"
echo ""
echo "Certbot auto-renewal is handled by the certbot service."
echo "Start it with: docker compose up -d certbot"
