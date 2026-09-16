# Testing Guide

## Overview

This project includes comprehensive tests at multiple levels:

- **Backend Unit Tests** - Pure function/service tests with mocked dependencies
- **Backend Integration Tests** - Full API endpoint tests with real database
- **Frontend Unit Tests** - Component and hook tests with React Testing Library
- **E2E Tests** - Full user flow tests with Playwright

---

## Backend Tests

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/unit/test_security.py -v

# Run with markers
pytest -m unit          # Unit tests only
pytest -m integration   # Integration tests only
pytest -m "not slow"    # Skip slow tests

# Debug mode
pytest -xvs tests/unit/test_security.py::TestPasswordHashing::test_hash_password_returns_hash
```

### Test Structure

```
backend/tests/
├── conftest.py              # Shared fixtures and test config
├── unit/                    # Unit tests
│   ├── test_security.py     # Security utilities (JWT, passwords, NIT/CC)
│   └── test_pos_service.py  # POS service logic
├── integration/             # Integration tests
│   └── test_routes.py       # API endpoint tests
└── fixtures/                # Test data factories
```

### Key Fixtures (conftest.py)

- `admin_user`, `manager_user`, `cashier_user` - Pre-configured users
- `admin_token`, `cashier_token` - JWT tokens for auth
- `product_simple`, `product_composite` - Product fixtures
- `ingredient`, `recipe` - Restaurant fixtures
- `modifier_group`, `modifiers` - Modifier fixtures
- `sale`, `sale_with_modifiers` - POS fixtures
- `auth_headers`, `cashier_headers` - Auth headers for requests

---

## Frontend Tests

### Running Tests

```bash
cd frontend

# Unit tests
npm test                    # Run all unit tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage report
npm test -- --ui           # Visual UI

# E2E tests
npm run test:e2e           # Run Playwright tests
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e -- --project=chromium  # Specific browser
```

### Test Structure

```
frontend/src/
├── test/
│   └── setup.ts           # Vitest global setup
├── features/
│   ├── auth/__tests__/    # Auth tests
│   ├── pos/__tests__/     # POS component tests
│   └── shared/__tests__/  # Shared utility tests
└── e2e/
    ├── pos.e2e.test.ts    # Playwright E2E tests
    ├── global-setup.ts    # Playwright global setup
    ├── global-teardown.ts # Playwright teardown
    └── playwright.config.ts
```

### Running Specific Tests

```bash
# Run specific test file
npm test -- src/shared/__tests__/utils.test.ts

# Run with filter
npm test -- -t "formatCOP"

# Update snapshots
npm test -- -u
```

---

## E2E Tests (Playwright)

### Prerequisites

```bash
# Install Playwright browsers
npx playwright install

# Install system dependencies (Linux)
npx playwright install-deps
```

### Running E2E Tests

```bash
# Full E2E suite
npm run test:e2e

# With UI
npm run test:e2e:ui

# Specific project
npm run test:e2e -- --project=chromium

# Debug mode
npm run test:e2e -- --debug

# Headed mode (see browser)
npm run test:e2e -- --headed
```

### Test Organization

```typescript
// pos.e2e.test.ts
test.describe('POS System E2E Tests', () => {
  test.describe('Authentication', () => {
    test('should login successfully', async ({ page }) => { ... })
  })

  test.describe('POS - Grocery Store', () => { ... })
  test.describe('POS - Restaurant', () => { ... })
  test.describe('Offline Mode', () => { ... })
  test.describe('Inventory Management', () => { ... })
  test.describe('Reports', () => { ... })
  test.describe('FDE (Factura Electrónica)', () => { ... })
  test.describe('Settings', () => { ... })
  test.describe('User Management', () => { ... })
  test.describe('Responsive Design', () => { ... })
  test.describe('Accessibility', () => { ... })
  test.describe('Performance', () => { ... })
})
```

---

## CI/CD Pipeline

The tests run automatically on:
- Pull requests
- Pushes to main/develop
- Scheduled runs

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

```yaml
jobs:
  lint:        # Lint & typecheck
  test-backend:   # Backend tests with MariaDB
  test-frontend:  # Frontend unit tests
  test-e2e:       # Playwright E2E tests
  build:          # Docker image build
  security:       # Trivy + TruffleHog scans
  deploy-staging: # Deploy to staging
  deploy-prod:    # Deploy to production (manual)
```

---

## Test Data Management

### Backend Fixtures

```python
# Using fixtures in tests
@pytest.mark.asyncio
async def test_create_sale(self, db_session, cashier_user, product_simple):
    pos_service = POSService(db_session)
    sale_data = SaleCreate(...)
    response = await pos_service.create_sale(sale_data, cashier_user.id, 1)
    assert response.sale is not None
```

### Frontend Mocking

```typescript
// Mock hooks
vi.mock('@/features/pos/hooks/useCart', () => ({
  useCart: () => ({ cart: [], addToCart: vi.fn(), ... })
})

// Mock API
vi.mock('@/shared/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() }
})
```

---

## Test Coverage Goals

| Layer | Target | Current |
|-------|--------|---------|
| Backend Unit | 80%+ | TBD |
| Backend Integration | 70%+ | TBD |
| Frontend Unit | 70%+ | TBD |
| E2E Critical Paths | 100% | TBD |

---

## Debugging Tests

### Backend

```bash
# Verbose output
pytest -xvs tests/unit/test_security.py

# Drop into debugger on failure
pytest --pdb tests/unit/test_security.py

# Print SQL queries
pytest --sqlalchemy-echo tests/integration/
```

### Frontend

```bash
# Debug with browser
npm test -- --inspect-brk

# Visual debugging
npm test -- --ui
```

### Playwright

```bash
# Debug mode
npx playwright test --debug

# Headed mode
npx playwright test --headed

# Trace viewer
npx playwright show-trace trace.zip
```

---

## Test Best Practices

### Backend

1. **Use fixtures** for test data - don't hardcode
2. **Test one thing per test** - single responsibility
2. **Use async/await** properly with pytest-asyncio
4. **Mock external services** (PAC, email, etc.)
5. **Test both success and failure cases**

### Frontend

1. **Test behavior, not implementation**
2. **Use RTL queries** (getByRole, getByLabelText)
3. **Mock at the boundary** (API, hooks, context)
4. **Test user interactions** not component internals
5. **Keep tests fast** - avoid render-heavy tests

### E2E

1. **Test user journeys** not individual features
2. **Use data-testid** for stable selectors
3. **Handle async properly** with waitFor
4. **Clean up test data** in teardown
5. **Run in parallel** where possible

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase timeout, check for hanging promises |
| DB connection fails | Check Docker services: `docker compose ps` |
| Port conflicts | Check ports 80, 443, 3306, 5173, 8000 |
| Flaky tests | Add retries, check for race conditions |
| Memory leaks | Check for unclosed connections |

### Useful Commands

```bash
# Reset test database
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head

# View test logs
docker compose logs -f backend

# Run single test with output
pytest tests/unit/test_security.py::TestPasswordHashing::test_hash_password_returns_hash -xvs

# Run with specific Python
python -m pytest tests/unit/test_security.py
```