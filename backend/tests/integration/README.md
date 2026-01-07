# Integration Tests

These tests verify that the code works with a **real database**, just like in production.

## Setup

1. **Test Database**: Uses the same database as development (or configure separate test DB)
2. **Real Prisma Client**: No mocks - tests actual database operations
3. **Real Authentication**: Tests actual JWT token generation and validation
4. **Real Data**: Creates and cleans up actual database records

## Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific integration test
npm test -- tests/integration/auth.integration.test.js
```

## What These Tests Verify

✅ **Database Operations**
- Data is actually saved to database
- Queries return correct data
- Updates work correctly
- Foreign keys and constraints work

✅ **Authentication**
- Real password hashing (bcrypt)
- Real JWT token generation
- Token validation works
- Password verification works

✅ **Business Logic**
- Assessments create baselines
- Progress metrics calculate correctly
- Task completions link to check-ins
- All relationships work

✅ **Production Readiness**
- No mocks = tests real code paths
- Catches database schema issues
- Verifies Prisma queries work
- Ensures data integrity

## Test Structure

Each test:
1. Sets up test data
2. Runs the actual endpoint
3. Verifies database state
4. Cleans up test data

## Environment

These tests use:
- Real PostgreSQL database
- Real Prisma client
- Real bcrypt hashing
- Real JWT tokens

This ensures the code will work **exactly as it does in production**.
