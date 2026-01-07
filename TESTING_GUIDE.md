# Testing Guide

## Servers Running

- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:5173

## Current Status

✅ **Servers:** Both running  
✅ **Connection:** Frontend can reach backend  
⚠️ **Database:** Permissions need to be fixed

## Testing Steps (After Database Fix)

### 1. Register User

**Via Frontend:**
1. Open http://localhost:5173
2. Click "Sign up"
3. Enter email and password
4. Submit

**Via API:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected response:
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "...",
    "email": "test@example.com"
  }
}
```

### 2. Complete Onboarding

1. After registration, you'll be redirected to onboarding
2. Complete all 6 steps:
   - Mental baseline
   - Sleep & energy
   - Time availability
   - Goals
   - Preferred tone
   - Review
3. Click "Create My Plan"

### 3. View Daily Plan

1. After plan generation, you'll see today's tasks
2. Complete tasks by clicking "Complete"
3. Adjust plan with "Minimum Day" or "Standard Day"

### 4. Submit Check-in

1. Use the quick check-in on Daily Plan page
2. Set energy and stress levels
3. Click "Save Check-in"

### 5. View Dashboard

1. Navigate to Dashboard
2. See your progress metrics
3. View mood trends
4. See recent check-ins

## API Testing

### Test Health Endpoint
```bash
curl http://localhost:3001/health
```

### Test Registration (After DB Fix)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test with Auth Token
```bash
TOKEN="your-token-here"
curl -X GET http://localhost:3001/api/plan/current \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Database Permission Errors
- See `DATABASE_PERMISSIONS_FIX.md`
- Grant permissions or use postgres user

### CORS Errors
- Check backend `.env` has `CORS_ORIGIN="http://localhost:5173"`
- Restart backend after changing `.env`

### Connection Refused
- Verify backend is running: `curl http://localhost:3001/health`
- Check port in backend `.env` matches frontend config

### 401 Unauthorized
- Check token in localStorage (browser dev tools)
- Verify JWT_SECRET matches
- Token might be expired

---

**Ready to test once database permissions are fixed!**
