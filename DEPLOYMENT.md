# Deployment

Light Role runs as a Docker Compose stack. The environment is determined
entirely by **which compose files + env file are loaded**:

| Environment | Compose files | Env file | How |
| ----------- | ------------- | -------- | --- |
| **local**   | `docker-compose.yml` + `docker-compose.override.yml` (auto-merged) | `.env.local` | `make up` |
| **prod**    | `docker-compose.yml` + `docker-compose.prod.yml` (explicit `-f`) | `.env.prod` | `make prod-up` |

- The **base** `docker-compose.yml` defines the 4 core services (postgres,
  redis, backend, frontend) with **no published ports** — prod-safe defaults.
- The **local override** is auto-loaded by `docker compose` when no `-f` is
  given. It adds `127.0.0.1`-bound datastore/app ports, source bind-mounts for
  hot-reload, and dev commands. It is **never** loaded for prod.
- The **prod override** adds `restart: always`, per-env `env_file`, and the
  `nginx` + `certbot` services. nginx is the only service that publishes ports
  (80/443).

> Because the base has no `ports:` on postgres/redis and Compose **appends**
> list entries, datastore ports can only ever be exposed by the local override —
> prod can never re-expose them.

---

## Local dev quickstart

```bash
cp .env.local.example .env.local      # fill OPENAI_API_KEY if you need AI features
make build
make up
make migrate                          # if you skip the auto-migrate on the local backend command
```

- App: frontend on `http://127.0.0.1:3000`, backend on `http://127.0.0.1:8000`.
- Health check: `http://127.0.0.1:8000/api/health` → `200`.
- `make redis-cli` then `PING` → `PONG` (auth via `$REDIS_PASSWORD`).
- The local backend command already runs `alembic upgrade head` on start, and
  the frontend runs `next dev` (hot reload). Edit a file and see it reload.

---

## 1. First-time prod bootstrap

On the prod host (Ubuntu 24.04, Docker + Compose installed):

```bash
cp .env.prod.example .env.prod
# Fill EVERY `# CHANGE ME`:
#   SECRET_KEY, REDIS_PASSWORD, POSTGRES_PASSWORD, PADDLE_API_KEY,
#   PADDLE_WEBHOOK_SECRET, OPENAI_API_KEY, RESEND_API_KEY, GOOGLE_*,
#   INTERNAL_RENDER_SECRET, SENTRY_DSN, LETSENCRYPT_EMAIL, and the
#   NEXT_PUBLIC_PADDLE_PRICE_ID_* / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.
# Generate secrets with: openssl rand -hex 32

make prod-build          # build frontend (bakes NEXT_PUBLIC_*) and backend images
make cert-init           # SSL bootstrap (see below)
make prod-up             # start the full stack
make prod-migrate        # apply DB migrations
```

### What `make cert-init` does

`nginx/scripts/init-ssl.sh` (reads `DOMAIN` / `API_DOMAIN` / `CERT_DOMAIN` /
`LETSENCRYPT_EMAIL` from `.env.prod`) runs a 4-step bootstrap:

1. Writes a **self-signed placeholder** cert to
   `/etc/letsencrypt/live/${CERT_DOMAIN}/` so nginx can start before a real cert
   exists.
2. Starts nginx (prod compose) — it serves HTTPS over the placeholder cert.
3. Issues the **real Let's Encrypt** cert via the webroot ACME challenge
   (nginx already serving `/.well-known/acme-challenge/`).
4. Reloads nginx to pick up the real cert.

> nginx is reachable over the **placeholder cert** (browser warning) from the
> moment step 2 finishes until step 3/4 complete — useful for a pre-release box.

---

## 2. Domain / cert change at launch

The domain and cert paths are **not** hardcoded in any nginx file — nginx
renders `nginx/templates/prod.conf.template` through envsubst at container start,
substituting only `${DOMAIN}`, `${API_DOMAIN}`, `${CERT_DOMAIN}` (guarded by
`NGINX_ENVSUBST_FILTER`). These three variables live in **`.env.prod`**.

To switch domains (e.g. from a staging subdomain to `lightrole.com`):

```bash
# Edit .env.prod only — no nginx file edits needed:
#   DOMAIN=lightrole.com
#   API_DOMAIN=api.lightrole.com
#   CERT_DOMAIN=lightrole.com
# (and update FRONTEND_URL / NEXT_PUBLIC_API_URL to match; NEXT_PUBLIC_* changes
#  require `make prod-build` since they're baked into the frontend bundle.)

make cert-init           # issue a cert for the new domain
make prod-up             # nginx re-renders the template with the new ${DOMAIN}s
```

---

## 3. Renting a separate dev host later

The cleanest way to add a real dev/staging environment is a **separate host**:

```bash
cp docker-compose.prod.yml docker-compose.dev.yml   # tweak if needed
# Create .env.dev with its own DOMAIN / API_DOMAIN / CERT_DOMAIN and a distinct
# COMPOSE_PROJECT_NAME (e.g. lightrole_dev).
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d
```

A different host means **no port or volume collisions** with prod — this is the
recommended path.

---

## 4. If dev must share the prod host (caveats)

Co-locating dev and prod on one box is **advisory / not recommended**. If you do:

- Use a **distinct `COMPOSE_PROJECT_NAME`** per environment.
- **Important:** the base and prod compose files use **fixed**
  `container_name: lightrole_*` and volume `name: lightrole_*` values. Two stacks
  on one host will **collide** on these names regardless of `COMPOSE_PROJECT_NAME`.
  You must **override or drop** the fixed `container_name:` / volume `name:` in
  the dev overlay so each stack gets project-prefixed names.
- You **cannot double-bind** ports 80/443. Either:
  - bind the dev nginx to `127.0.0.1:8080` (+ `127.0.0.1:8443`) and reach it via
    an SSH tunnel, or
  - run **one shared nginx** with two `server_name` blocks (prod + dev domains).
- Ensure **separate DB volumes** so dev can't read/write the prod database.

---

## Security hardening / operator checklist

The application stack ships with sensible defaults, but the following items are
**manual host-level / operational steps** the operator must complete or revisit.

### verify-datastore-isolation (host firewall)

The base compose file publishes **no** ports for postgres/redis/backend/frontend
— only nginx exposes `80`/`443`. As defence-in-depth, the Hetzner host firewall
(or cloud firewall) must still **DENY** inbound on the datastore/app ports so a
misconfigured overlay or a future change can never expose them. Allow only
`80`, `443`, and SSH.

```bash
# Default-deny inbound, allow outbound
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow only what we serve (SSH first so you don't lock yourself out)
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (ACME + redirect)
sudo ufw allow 443/tcp       # HTTPS

# Explicitly deny the datastore/app ports (belt-and-braces; default-deny
# already covers them, but make the intent auditable)
sudo ufw deny 5432/tcp       # PostgreSQL
sudo ufw deny 6379/tcp       # Redis
sudo ufw deny 8000/tcp       # backend (FastAPI)
sudo ufw deny 3000/tcp       # frontend (Next.js)

sudo ufw enable
sudo ufw status verbose
```

> On Hetzner Cloud you can/should also configure an equivalent **Cloud Firewall**
> in the console with the same allow-list, so the rules apply even if the host
> ufw is ever disabled.

### csp-enforce (flip CSP from report-only to enforced)

The prod CSP currently ships as **`Content-Security-Policy-Report-Only`** in
`nginx/templates/prod.conf.template` — it reports violations but does not block
them. This is deliberate: it lets us observe a real traffic window without
risking breakage to Next.js, Paddle, Google OAuth, or Sentry.

After observing reports for a window (e.g. a week of normal traffic) with **no
legitimate violations**, flip it to enforcing:

1. In `nginx/templates/prod.conf.template`, rename the header from
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
2. Tighten `script-src`: remove `'unsafe-inline'` by adopting per-request
   **nonces** or static **hashes** for Next.js's inline bootstrap script, if
   feasible. Keep the existing allow-list (Paddle, Google, Sentry) intact.
3. Re-render and reload nginx (`make prod-up`), then re-check the console /
   Sentry for CSP errors.

This is a **deliberate later step**, not part of the initial launch.

### nginx-dos / DDoS (scope of nginx-level protection)

nginx now enforces per-IP request-rate (`req_per_ip`, 10r/s + burst) and
connection (`conn_per_ip`, 20) limits plus slow-loris timeouts
(`client_body_timeout`/`client_header_timeout`/`send_timeout` = 10s). These
blunt **L7 / application-layer** abuse and slow-loris attacks only.

> A volumetric **L3/L4 DDoS** (SYN floods, UDP floods, raw bandwidth
> exhaustion) cannot be absorbed at the nginx layer — it requires a CDN/WAF such
> as **Cloudflare** (or Hetzner's upstream DDoS protection) in front of the
> origin. Putting a CDN/WAF in front is an **operator decision** and is
> recommended before any high-traffic launch.

---

## Renewal

The `certbot` service runs a renewal loop (`certbot renew` every 12h). Renewed
certs land in the mounted `/etc/letsencrypt`; nginx picks them up on its next
reload. To force a renewal:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod \
  exec certbot certbot renew
```
