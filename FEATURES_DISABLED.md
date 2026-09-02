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
3. Ensure `ANTHROPIC_API_KEY` is set in backend `.env`

### Cost Considerations:

- Uses Claude Opus 5 (`claude-opus-5`)
- ~500 tokens per response
- Rough cost per message at $5/MTok in, $25/MTok out: well under $0.05 with a
  short context; the context builder sends baseline, plan and recent check-ins,
  so measure before assuming.
- Prompt caching would cut the repeated system-prompt cost substantially if
  this is ever enabled at volume.

### Alternative:

Rate limit per user (e.g. 10 messages/day free, then paid) before reaching for
a smaller model. If cost is still the blocker, lower `output_config.effort`
before changing model — see `src/services/splitAssistService.js` for the
per-route effort pattern.

---

**Last Updated:** 2024
