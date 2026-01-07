# Disabled Features

Features that are implemented but currently disabled, and can be enabled if needed.

## AI Coach Chat

**Status:** ✅ Implemented, ❌ Disabled  
**Reason:** High AI API costs - only enable if users request it  
**Location:**
- Backend: `backend/src/services/coachService.js`
- Backend: `backend/src/controllers/coachController.js`
- Backend: `backend/src/routes/coachRoutes.js`
- Frontend: `web/src/pages/CoachChatPage.tsx`
- Frontend: `web/src/services/coachService.ts`

### To Enable:

**Backend:**
1. Uncomment in `backend/src/index.js`:
```javascript
import coachRoutes from './routes/coachRoutes.js';
app.use('/api/coach', coachRoutes);
```

**Frontend:**
1. Uncomment route in `web/src/App.tsx`
2. Uncomment nav item in `web/src/components/Layout.tsx`
3. Ensure `OPENAI_API_KEY` is set in backend `.env`

### Cost Considerations:

- Uses GPT-4 Turbo
- ~500 tokens per response
- Estimated cost: ~$0.01-0.02 per message
- With 100 active users, 1 message/day each = ~$30-60/month

### Alternative:

Consider using a cheaper model (GPT-3.5) or implementing rate limiting per user (e.g., 10 messages/day free, then paid).

---

**Last Updated:** 2024
