# ──────────────────────────────────────────────────────────────
# Light Role — convenience targets.
#   Local  = base + auto-merged docker-compose.override.yml, .env.local
#   Prod   = base + docker-compose.prod.yml (explicit -f), .env.prod
# ──────────────────────────────────────────────────────────────

LOCAL = docker compose --env-file .env.local
PROD  = docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod

.PHONY: help \
        up down logs build ps migrate shell-backend redis-cli \
        prod-up prod-down prod-logs prod-build prod-migrate cert-init

help:
	@echo "Local targets (uses .env.local):"
	@echo "  make up             - start the local stack (detached)"
	@echo "  make down           - stop the local stack"
	@echo "  make logs           - follow local logs"
	@echo "  make build          - build local images"
	@echo "  make ps             - list local containers"
	@echo "  make migrate        - run alembic upgrade head in backend"
	@echo "  make shell-backend  - open a shell in the backend container"
	@echo "  make redis-cli      - open redis-cli (authenticated)"
	@echo ""
	@echo "Prod targets (uses .env.prod):"
	@echo "  make prod-build     - build prod images"
	@echo "  make cert-init      - bootstrap SSL (placeholder -> real LE cert)"
	@echo "  make prod-up        - start the prod stack (detached)"
	@echo "  make prod-down      - stop the prod stack"
	@echo "  make prod-logs      - follow prod logs"
	@echo "  make prod-migrate   - run alembic upgrade head in backend"

# ── Local ─────────────────────────────────────────────────────
up:
	$(LOCAL) up -d

down:
	$(LOCAL) down

logs:
	$(LOCAL) logs -f

build:
	$(LOCAL) build

ps:
	$(LOCAL) ps

migrate:
	$(LOCAL) exec backend alembic upgrade head

shell-backend:
	$(LOCAL) exec backend sh

redis-cli:
	$(LOCAL) exec redis sh -c 'redis-cli -a "$$REDIS_PASSWORD"'

# ── Prod ──────────────────────────────────────────────────────
prod-up:
	$(PROD) up -d

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f

prod-build:
	$(PROD) build

prod-migrate:
	$(PROD) exec backend alembic upgrade head

cert-init:
	bash nginx/scripts/init-ssl.sh
