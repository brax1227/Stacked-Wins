# Firebase Setup Guide

## Quick Start

1. **Create Firebase Project:**
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Name it "stacked-wins" (or your preferred name)
   - Enable Google Analytics (optional)

2. **Enable Services:**
   - **Authentication**: Enable Email/Password sign-in
   - **Firestore Database**: Create database in production mode (we'll add security rules)

3. **Get Credentials:**
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `backend/firebase-service-account.json`
   - **⚠️ Add to .gitignore!**

4. **Get Frontend Config:**
   - Go to Project Settings → General
   - Scroll to "Your apps"
   - Click Web icon (</>) to add web app
   - Copy the Firebase config object

5. **Update Environment Variables:**
   - Backend: Add `FIREBASE_SERVICE_ACCOUNT_PATH` to `.env`
   - Frontend: Add Firebase config to `.env` or create `firebase-config.ts`

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Assessments
    match /assessments/{assessmentId} {
      allow read, write: if request.auth != null;
    }
    
    // Growth plans
    match /growthPlans/{planId} {
      allow read, write: if request.auth != null;
    }
    
    // Tasks
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
    
    // Daily check-ins
    match /checkIns/{checkInId} {
      allow read, write: if request.auth != null;
    }
    
    // Journal entries
    match /journalEntries/{entryId} {
      allow read, write: if request.auth != null;
    }
    
    // Feedback
    match /feedback/{feedbackId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Migration Notes

- **No more Prisma** - Using Firestore directly
- **No more PostgreSQL** - Using Firestore
- **No more JWT** - Using Firebase Auth tokens
- **No more bcrypt** - Firebase handles password hashing
