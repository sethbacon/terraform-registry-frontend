.PHONY: frontend-build frontend-lint e2e-install e2e-run test-compose-up test-compose-down

frontend-build:
	@echo "Building frontend..."
	cd frontend && npm ci && npm run build

frontend-lint:
	@echo "Linting frontend..."
	cd frontend && npm ci && npm run lint

e2e-install:
	@echo "Installing Playwright and browsers..."
	cd e2e && npm ci && npx playwright install --with-deps chromium

e2e-run:
	@echo "Running E2E tests..."
	cd e2e && npm run test

test-compose-up:
	@echo "Starting E2E test environment..."
	docker compose -f deployments/docker-compose.test.yml up -d --build

test-compose-down:
	@echo "Stopping E2E test environment..."
	docker compose -f deployments/docker-compose.test.yml down --volumes
