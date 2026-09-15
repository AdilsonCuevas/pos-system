# POS System - Makefile
# Common development and deployment commands

.PHONY: help up down restart logs build test lint migrate backup restore health clean dev

# Default target
help:
	@echo "POS System - Available Commands"
	@echo ""
	@echo "Deployment:"
	@echo "  make up              Start all services (docker compose up -d)"
	@echo "  make down            Stop all services (docker compose down)"
	@echo "  make restart         Restart all services"
	@echo "  make build           Build all images"
	@echo "  make deploy          Run full deployment script (Linux/macOS)"
	@echo "  make deploy-win      Run full deployment script (Windows)"
	@echo ""
	@echo "Database:"
	@echo "  make migrate         Run Alembic migrations"
	@echo "  make migrate-create  Create new migration (usage: make migrate-create MSG='add field')"
	@echo "  make db-shell        Open MariaDB shell"
	@echo "  make backup          Run backup script"
	@echo "  make restore         Run restore script (interactive)"
	@echo "  make verify-backup   Verify latest backup integrity"
	@echo ""
	@echo "Development:"
	@echo "  make dev             Start frontend dev server (hot reload)"
	@echo "  make backend-dev     Start backend with auto-reload"
	@echo "  make logs            Follow all service logs"
	@echo "  make logs-backend    Follow backend logs"
	@echo "  make logs-frontend   Follow frontend logs"
	@echo "  make logs-caddy      Follow Caddy logs"
	@echo "  make health          Run health checks"
	@echo ""
	@echo "Testing:"
	@echo "  make test            Run all tests"
	@echo "  make test-backend    Run backend tests"
	@echo "  make test-frontend   Run frontend tests"
	@echo "  make test-e2e        Run E2E tests (Playwright)"
	@echo "  make lint            Run linters"
	@echo "  make typecheck       Run type checking"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean           Remove all containers, volumes, and build cache"
	@echo "  make clean-volumes   Remove only data volumes (DANGEROUS)"
	@echo "  make pull            Pull latest base images"
	@echo ""

# Deployment
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build --no-cache

deploy:
	./scripts/deploy.sh

deploy-win:
	powershell -ExecutionPolicy Bypass -File ./scripts/deploy.ps1

# Database
migrate:
	docker compose run --rm backend alembic upgrade head

migrate-create:
	@if [ -z "$(MSG)" ]; then echo "Usage: make migrate-create MSG='description'"; exit 1; fi
	docker compose run --rm backend alembic revision --autogenerate -m "$(MSG)"

db-shell:
	docker exec -it pos-mariadb mysql -u root -p"$${DB_ROOT_PASSWORD}" pos_db

backup:
	./scripts/backup.sh

restore:
	./scripts/restore.sh

verify-backup:
	./scripts/verify-backup.sh

# Development
dev:
	cd frontend && npm run dev

backend-dev:
	docker compose up -d mariadb caddy
	docker compose run --rm --service-ports backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

logs-caddy:
	docker compose logs -f caddy

health:
	./scripts/health-check.sh

# Testing
test: test-backend test-frontend

test-backend:
	docker compose run --rm backend pytest -v --tb=short

test-frontend:
	cd frontend && npm run test

test-e2e:
	cd frontend && npm run test:e2e

lint:
	docker compose run --rm backend ruff check .
	cd frontend && npm run lint

typecheck:
	docker compose run --rm backend mypy app/
	cd frontend && npm run typecheck

# Maintenance
clean:
	docker compose down -v --rmi all --remove-orphans
	docker system prune -f

clean-volumes:
	@echo "⚠️  This will DELETE all data (database, uploads, certificates)!"
	@read -p "Type 'DELETE' to confirm: " confirm; \
	if [ "$$confirm" = "DELETE" ]; then \
		docker compose down -v; \
		docker volume rm pos-system_mariadb_data pos-system_caddy_data pos-system_caddy_config pos-system_backend_uploads pos-system_frontend_dist 2>/dev/null || true; \
		echo "Volumes removed"; \
	else \
		echo "Cancelled"; \
	fi

pull:
	docker compose pull

# Generate OpenAPI spec
openapi:
	docker compose run --rm backend python -c "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" > openapi.json

# Generate frontend types from OpenAPI
generate-types:
	cd frontend && npm run generate:api

# Install CA certificate (Linux/macOS)
install-ca:
	./scripts/install-ca.sh

# Verify deployment
verify:
	./scripts/health-check.sh
	@echo ""
	@echo "If all checks pass, access POS at:"
	@echo "  https://pos.local"
	@echo "  https://$${LAN_IP:-<your-lan-ip>}"

# Quick start for new developers
quickstart: deploy health verify
	@echo ""
	@echo "🎉 Quickstart complete!"
	@echo "Next steps:"
	@echo "  1. Install CA from https://$${LAN_IP:-<your-lan-ip>}/ca-cert"
	@echo "  2. Open https://pos.local"
	@echo "  3. Register first admin user"