# Frontend-Backend Connection Guide

## ✅ Connection Setup Complete

The frontend is now connected to the backend API.

### Configuration

**API Base URL:**
- Default: `http://localhost:3001/api`
- Configurable via `VITE_API_URL` in `.env`
- Vite proxy configured for development

**Recommended local dev (`web/.env`):**
- `VITE_API_URL=/api` (uses Vite proxy; simplest)
- Or `VITE_API_URL=http://localhost:3001` (the client will auto-append `/api`)

**Ports:**
- Backend: `3001` (configured in backend `.env`)
- Frontend: `5173` (Vite dev server)
- Proxy: Frontend `/api` → Backend `http://localhost:3001/api`

### API Services Connected

1. **Authentication** (`authService.ts`)
   - ✅ `POST /api/auth/register`
   - ✅ `POST /api/auth/login`

2. **Assessment** (`planService.ts`)
   - ✅ `POST /api/assessment`
   - ✅ `GET /api/assessment`

3. **Plan** (`planService.ts`)
   - ✅ `POST /api/plan/generate`
   - ✅ `GET /api/plan/current`

4. **Tasks** (`planService.ts`)
   - ✅ `GET /api/tasks/today`
   - ✅ `POST /api/tasks/complete`
   - ✅ `PUT /api/tasks/adjust`

5. **Check-ins** (`planService.ts`)
   - ✅ `POST /api/checkin`
   - ✅ `GET /api/checkin/history`

6. **Progress** (`planService.ts`)
   - ✅ `GET /api/progress/dashboard`
   - ✅ `GET /api/progress/metrics`

7. **Journal** (`journalService.ts`)
   - ✅ `POST /api/journal`
   - ✅ `GET /api/journal`
   - ✅ `GET /api/journal/:id`
   - ✅ `PUT /api/journal/:id`
   - ✅ `DELETE /api/journal/:id`

8. **Feedback** (`feedbackService.ts`)
   - ✅ `POST /api/feedback`
   - ✅ `GET /api/feedback`

### Error Handling

- ✅ Axios interceptors for auth errors (401 → redirect to login)
- ✅ Error states in all pages
- ✅ Loading states
- ✅ Retry logic (1 retry on failure)
- ✅ User-friendly error messages

### Authentication Flow

1. User registers/logs in
2. Token stored in `localStorage`
3. Token automatically added to all API requests
4. On 401 error, token cleared and user redirected to login

### Testing the Connection

1. **Start backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start frontend:**
   ```bash
   cd web
   npm run dev
   ```

3. **Test health endpoint:**
   - Open browser console
   - Run: `fetch('http://localhost:3001/api/health').then(r => r.json()).then(console.log)`
   - Should return: `{ status: 'ok', timestamp: '...' }`

4. **Test full flow:**
   - Register new user
   - Complete onboarding
   - View daily plan
   - Complete tasks
   - View dashboard

### Common Issues

**CORS Errors:**
- Check `CORS_ORIGIN` in backend `.env` includes `http://localhost:5173`
- Restart backend after changing `.env`

**401 Unauthorized:**
- Check token is in `localStorage`
- Verify `JWT_SECRET` matches between frontend token and backend validation
- Token might be expired (default: 7 days)

**Connection Refused:**
- Verify backend is running on port 3001
- Check `PORT` in backend `.env`
- Check firewall/network settings

**404 Not Found:**
- Verify route paths match exactly
- Check backend routes are registered in `index.js`
- Check API base URL is correct

### Next Steps

1. ✅ API services connected
2. ✅ Error handling added
3. ⏳ Test full user flow
4. ⏳ Fix any data type mismatches
5. ⏳ Add loading skeletons
6. ⏳ Test on mobile devices

---

**Status:** ✅ Connected and Ready for Testing
