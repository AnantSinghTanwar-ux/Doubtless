# Doubtless - AI-Native Education OS 🎓

Doubtless is an intelligent education platform that analyzes a student's doubt and contextually routes them to the best help: an AI explanation, adaptive practice, or a live session with an expert human teacher.

Built for **The Industry Games 2026, District 03**.

## Features
- **Study Vault (RAG)**: Upload PDFs, chunked and embedded via Gemini for context-aware answers.
- **Intelligent Doubt Router**: Gemini analyzes the doubt, past history, and learning profile to route the student.
- **Step-by-Step Solver**: Evaluate math/logic step-by-step or via image upload (Gemini Vision).
- **Voice Explain (Feynman Mode)**: Explain concepts aloud. AI analyzes speech metrics (filler words, pauses) and gives a Feynman score.
- **AI Viva Mode**: Adaptive oral examination using Web Speech API and Gemini.
- **Teacher Matching**: Algorithm connects students with the best teacher for their specific doubt.
- **Live Sessions**: Real-time chat (Firestore) and Video (Jitsi) for human tutoring.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy the example env file:
```bash
cp .env.example .env.local
```

You need to fill in:
1. `GEMINI_API_KEY`: Get from Google AI Studio.
2. Firebase Configuration variables (see below).

### 3. Firebase Setup (Manual Steps Required)
Since this app uses Firebase Auth and Firestore, you must set up a Firebase project:
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Authentication** (Google Sign-in provider).
3. Enable **Firestore Database**.
4. Register a Web App and copy the config keys to your `.env.local`.

#### Firestore Security Rules
For a production deployment, apply these rules in the Firebase console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} { allow read, write: if request.auth.uid == userId; }
    match /profiles/{userId} { allow read, write: if request.auth.uid == userId; }
    match /vaults/{vaultId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /vaults/{vaultId}/chunks/{chunkId} { allow read, write: if request.auth.uid != null; } // simplified for demo
    match /doubts/{doubtId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /evaluations/{evalId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /voiceSessions/{sessionId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /vivas/{vivaId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /practiceSets/{setId} { allow read, write: if request.auth.uid == resource.data.userId || request.auth.uid == request.resource.data.userId; }
    match /teachers/{teacherId} { allow read: if request.auth != null; allow write: if false; }
    match /sessions/{sessionId} { allow read, write: if request.auth != null; }
    match /sessions/{sessionId}/messages/{messageId} { allow read, write: if request.auth != null; }
    match /knowledgeBase/{kbId} { allow read, write: if request.auth != null; }
  }
}
```

### 4. Seed the Database
Start the dev server:
```bash
npm run dev
```
Navigate to `http://localhost:3000/login` and click the **"🌱 Seed Database (Run Once)"** button to populate the dummy teachers.

### 5. Running the App
- Sign in with Google.
- Choose **Student** to explore the RAG vault, ask doubts, and take vivas.
- Choose **Teacher** to accept session requests.
