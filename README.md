# MediSense: AI Telehealth Assistant

MediSense is a prototype for an AI smart telehealth platform that helps patients describe symptoms, gives doctors a faster triage summary, and stores consultation activity like a MongoDB-backed healthcare record.

## What It Does

- Patient symptom intake with name, age, language, and free-text symptom description.
- NLP-style symptom extraction from natural language.
- Disease/risk suggestion cards based on detected symptoms.
- Consultation booking that adds the patient to the doctor queue.
- Doctor dashboard with urgency levels.
- Prescription note composer for doctor advice.
- Clinical timeline that represents patient history, AI predictions, and saved doctor notes.
- Health chatbot for basic safety-focused guidance.
- Browser local storage for saved consultation cases.

## Tech Concept

This prototype is built with HTML, CSS, and JavaScript so it can run instantly in a browser.

For a full version, the same product can be expanded into:

- Frontend: React for doctor dashboard, Flutter for patient mobile app.
- Backend: FastAPI or Flask.
- AI/ML: Python, scikit-learn, spaCy, transformers.
- Database: MongoDB for patient history, chat logs, prescriptions, and AI reports.

## How To Run Frontend Only

Open `index.html` in a browser.

No installation or server is required for the frontend-only prototype. It will save demo consultations in browser local storage.

## How To Run With Backend

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn backend.main:app --reload
```

Then open `index.html` in a browser. The frontend will save consultations, prescriptions, and chat logs through `http://localhost:8000`.

## Database Collections

The FastAPI backend stores MongoDB-style collections:

- `patients`
- `consultations`
- `symptom_reports`
- `chat_logs`
- `prescriptions`

If `MONGODB_URI` is set, the backend uses MongoDB. Without MongoDB, it automatically falls back to `backend/medisense-db.json` so the demo still works.

## Deployment to Render

### Option 1: Automated Multi-Service Deployment

1. **Connect your GitHub repository** to Render
2. **Create a new Blueprint** from your repository
3. **Render will automatically detect** the `render.yaml` configuration
4. **Set environment variables** in Render dashboard:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `MONGODB_DATABASE`: medisense
   - `SECRET_KEY`: A secure random string

### Option 2: Manual Service Creation

#### Backend API Service:
- **Service Type**: Web Service
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `MONGODB_URI`: Your MongoDB Atlas connection string
  - `MONGODB_DATABASE`: medisense
  - `SECRET_KEY`: A secure random string

#### Frontend Static Site:
- **Service Type**: Static Site
- **Build Command**: Leave empty (no build needed)
- **Publish Directory**: `.` (root directory)
- **Add rewrite rule**: `/api/(.*)` → `https://YOUR_BACKEND_URL.onrender.com/api/$1`

### MongoDB Setup

1. **Create a MongoDB Atlas account** at mongodb.com
2. **Create a free cluster**
3. **Get your connection string** from Atlas dashboard
4. **Whitelist Render's IP** (0.0.0.0/0) in Network Access

### Environment Variables

Set these in your Render service settings:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=medisense
SECRET_KEY=your-super-secure-random-key-here
```

### Testing Deployment

After deployment:
- **Frontend**: `https://medisense-frontend.onrender.com`
- **Backend API**: `https://medisense-api.onrender.com`
- **API Docs**: `https://medisense-api.onrender.com/docs`
