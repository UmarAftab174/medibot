# 🩺 MediBot: AI-Powered Medical Diagnostic Assistant

#### MediBot is an AI-driven web application that helps users explore potential diseases based on reported symptoms. It combines a 1D Convolutional Neural Network (CNN) for prediction with an LLM-powered chatbot for interactive, educational health consultations.

## *✨ Features*

- 🔍 Symptom-Based Disease Prediction
- Select from 337+ symptoms with a searchable, drag-and-drop interface. A trained 1D-CNN model predicts possible diseases with confidence scores.
- 🤖 Interactive AI Chat
Post-prediction, consult a Gemini-powered LLM (via LangChain) for explanations, treatment suggestions, and health tips in clear, empathetic language.
- 🔐 User Authentication & Profile Management
Secure JWT-based authentication (with refresh tokens). Update profile info and manage login sessions safely.
- 💬 Chat History Persistence
Conversations are stored in SQLite and are accessible via a sidebar for easy navigation.
- ⚙️ System Health Monitoring
Includes backend health-check endpoint to verify service status.

## *🛠️ Architecture*

***MediBot uses a client–server architecture:***

***Backend (FastAPI)***
- Auth: JWT tokens, password hashing (bcrypt).
- Prediction: TensorFlow 1D-CNN trained on symptom-disease dataset.
- Chat: Integrated LLM (Google Generative AI via LangChain).
- Database: SQLite (users, chat logs, tokens).

***Frontend (React + TypeScript)***
- UI: Built with React 18, TailwindCSS, and shadcn/ui components.
- Navigation: React Router.
- Features: Symptom selector, prediction dashboard, chat interface, sidebar history, and authentication pages.

## *Data Flow*

- User selects symptoms → sends to backend.
- Backend runs CNN prediction → creates chat session.
- LLM manages ongoing chat.
- Frontend displays results + stored history.

***⚡ Installation***
- Prerequisites
- Python 3.12+
- Node.js 18+
- Git

***Backend Setup***
# Clone repo and move into folder
######       
    git clone https://github.com/Umaraftab174/medibot.git

##
<tab><tab>code/cd medibot

# Create virtual environment
##
<tab><tab>code/python -m venv venv

# Activate venv

##
<tab><tab>code/source venv/bin/activate
##
<tab><tab>code/venv\Scripts\activate

# Install dependencies

##
<tab><tab>code/pip install -r requirements.txt

# Create .env file and add the following:

##
<tab><tab>code/SECRET_KEY=your-secret-key

##
<tab><tab>code/GOOGLE_API_KEY=your-google-genai-key

# Run server

##
<tab><tab>code/uvicorn main:app --reload

***Frontend Setup***
# Move to frontend folder

##
<tab><tab>code/cd ./frontend

# Install dependencies

##
<tab><tab>code/npm install

# Run dev server

##
<tab><tab>code/npm run dev


Frontend → http://localhost:8080

Backend → http://localhost:8000

***🧩 Technologies Used***

Backend:

FastAPI, TensorFlow, LangChain, SQLite, PyJWT, bcrypt

Frontend:

React (TypeScript), TailwindCSS, shadcn/ui, React Router, Axios, Lucide Icons


## *🤝 Contributing*

*Contributions are welcome!*

- Fork the repo
- Create a branch:
  # git checkout -b feature/your-feature
- Commit changes:
  # git commit -m "Add your feature"
- Push and open a Pull Request
- Please follow coding guidelines and add tests where needed.

### *Inspired by AI in healthcare research.*
