#!/bin/bash
# ──────────────────────────────────────────────────────────────
# init-ssl.sh — Bootstrap SSL certificates for the prod nginx
#
# Strategy:
#   1. Generate a self-signed placeholder cert so nginx can start
#   2. Start nginx (HTTPS config works with placeholder cert)
#   3. Issue real Let's Encrypt cert via webroot (nginx serves ACME challenges)
#   4. Reload nginx to pick up the real cert
#
# Domains/email are read from .env.prod (DOMAIN / API_DOMAIN / CERT_DOMAIN /
# LETSENCRYPT_EMAIL) and/or overridden by CLI args.
#
# Usage:
#   bash nginx/scripts/init-ssl.sh
#   bash nginx/scripts/init-ssl.sh --email admin@lightrole.com
#   bash nginx/scripts/init-ssl.sh --domains "lightrole.com api.lightrole.com" \
#        --cert-name lightrole.com --email admin@lightrole.com --staging
#
# Run from the project root (where docker-compose.yml lives).
# ──────────────────────────────────────────────────────────────

set -euo pipefail

ENV_FILE=".env.prod"

# Prod compose invocation (the local override must NOT be loaded here).
PROD_COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file ${ENV_FILE}"

# ── Defaults (documented dev fallbacks; real values come from .env.prod) ─────
# Example dev values for reference:
#   DOMAIN="dev.lightrole.com"  API_DOMAIN="dev-api.lightrole.com"
#   CERT_DOMAIN="dev.lightrole.com"
DOMAIN=""
API_DOMAIN=""
CERT_DOMAIN=""
EMAIL=""
STAGING=""

# ── Load values from .env.prod if present ────────────────────────────────────
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a
    . "${ENV_FILE}"
    set +a
    DOMAIN="${DOMAIN:-}"
    API_DOMAIN="${API_DOMAIN:-}"
    CERT_DOMAIN="${CERT_DOMAIN:-}"
    EMAIL="${LETSENCRYPT_EMAIL:-}"
fi

# ── Parse arguments (override env values) ────────────────────────────────────
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --domains)   ARG_DOMAINS="$2"; shift ;;
        --cert-name) CERT_DOMAIN="$2"; shift ;;
        --email)     EMAIL="$2"; shift ;;
        --staging)   STAGING="--staging" ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
    shift
done

# Domains to request a cert for. From --domains arg, else DOMAIN + API_DOMAIN.
if [ -n "${ARG_DOMAINS:-}" ]; then
    DOMAINS="${ARG_DOMAINS}"
else
    DOMAINS="${DOMAIN} ${API_DOMAIN}"
fi

# Cert lives under the CERT_DOMAIN name (matches nginx ssl_certificate path).
CERT_DOMAIN="${CERT_DOMAIN:-${DOMAIN}}"
CERT_DIR="/etc/letsencrypt/live/${CERT_DOMAIN}"

# ── Validate ─────────────────────────────────────────────────────────────────
if [ -z "${DOMAINS// /}" ]; then
    echo "ERROR: no domains. Set DOMAIN/API_DOMAIN in ${ENV_FILE} or pass --domains."
    exit 1
fi
if [ -z "${CERT_DOMAIN}" ]; then
    echo "ERROR: no cert name. Set CERT_DOMAIN in ${ENV_FILE} or pass --cert-name."
    exit 1
fi
if [ -z "$EMAIL" ]; then
    echo "ERROR: no email. Set LETSENCRYPT_EMAIL in ${ENV_FILE} or pass --email."
    exit 1
fi

# ── Check if real cert already exists ────────────────────────────────────────
if [ -f "${CERT_DIR}/fullchain.pem" ]; then
    # Check if it is a self-signed placeholder (CN=localhost)
    ISSUER=$(openssl x509 -in "${CERT_DIR}/fullchain.pem" -noout -issuer 2>/dev/null || true)
    if echo "$ISSUER" | grep -q "CN = localhost"; then
        echo "Found placeholder self-signed cert. Will replace with real cert."
    else
        echo "Real certificate already exists at ${CERT_DIR}."
        echo "To renew, run: ${PROD_COMPOSE} exec certbot certbot renew"
        exit 0
    fi
fi

echo ""
echo "=== Light Role SSL Bootstrap ==="
echo "Domains:   ${DOMAINS}"
echo "Cert name: ${CERT_DOMAIN}"
echo "Email:     ${EMAIL}"
[ -n "$STAGING" ] && echo "Mode:      STAGING (test cert)"
echo ""

# ── Step 1: Generate self-signed placeholder cert ────────────────────────────
echo "[1/4] Generating self-signed placeholder certificate..."
sudo mkdir -p "${CERT_DIR}"
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj '/CN=localhost' \
    2>/dev/null
echo "      Placeholder cert created."

# ── Step 2: Start nginx with placeholder cert ────────────────────────────────
echo "[2/4] Starting nginx with placeholder certificate..."
${PROD_COMPOSE} up -d nginx
echo "      Waiting for nginx to become ready..."
sleep 3

# Verify nginx is running
if ! ${PROD_COMPOSE} ps nginx | grep -q "Up\|running"; then
    echo "ERROR: nginx failed to start. Check logs:"
    ${PROD_COMPOSE} logs nginx --tail 20
    exit 1
fi
echo "      nginx is running."

# ── Step 3: Issue real cert via webroot ──────────────────────────────────────
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
    --cert-name "${CERT_DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    ${STAGING}

echo "      Certificate issued successfully."

# ── Step 4: Reload nginx with real cert ──────────────────────────────────────
echo "[4/4] Reloading nginx with real certificate..."
${PROD_COMPOSE} exec nginx nginx -s reload
echo "      nginx reloaded."

echo ""
echo "=== Done! ==="
for d in ${DOMAINS}; do
    echo "  https://${d}"
done
echo ""
echo "Certbot auto-renewal is handled by the certbot service."
echo "Start it with: ${PROD_COMPOSE} up -d certbot"
