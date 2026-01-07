# Test Suite

## Running Tests

```bash
npm test
```

## Test Structure

Tests are organized by feature:
- `auth.test.js` - Authentication endpoints
- `assessment.test.js` - Assessment endpoints
- `tasks.test.js` - Task management endpoints
- `journal.test.js` - Journaling endpoints
- `feedback.test.js` - Feedback endpoints

## Test Setup

- Uses Jest with ES modules support
- Mocks Prisma client for database operations
- Mocks authentication middleware
- Uses Supertest for HTTP endpoint testing

## Coverage

Tests cover:
- ✅ Successful operations
- ✅ Validation errors
- ✅ Authentication/authorization
- ✅ Edge cases
- ✅ Error handling

## Adding New Tests

1. Create test file in `tests/` directory
2. Import necessary mocks from `setup.js`
3. Mock auth middleware if needed
4. Test both success and error cases
