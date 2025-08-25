🩺 MediBot: AI-Powered Medical Diagnostic Assistant

MediBot is an AI-driven web application that helps users explore potential diseases based on reported symptoms. It combines a 1D Convolutional Neural Network (CNN) for prediction with an LLM-powered chatbot for interactive, educational health consultations.

⚠️ Disclaimer: MediBot is not a substitute for professional medical advice. Always consult a healthcare provider for real diagnoses or treatment.


📑 Table of Contents

✨ Features

🛠️ Architecture

⚡ Installation

🚀 Usage

🧩 Technologies Used

📂 Project Structure

🤝 Contributing

📜 License

🙏 Acknowledgements

✨ Features

🔍 Symptom-Based Disease Prediction
Select from 337+ symptoms with a searchable, drag-and-drop interface. A trained 1D-CNN model predicts possible diseases with confidence scores.

🤖 Interactive AI Chat
Post-prediction, consult a Gemini-powered LLM (via LangChain) for explanations, treatment suggestions, and health tips in clear, empathetic language.

🔐 User Authentication & Profile Management
Secure JWT-based authentication (with refresh tokens). Update profile info and manage login sessions safely.

💬 Chat History Persistence
Conversations stored in SQLite, accessible via a sidebar for easy navigation.

⚙️ System Health Monitoring
Includes backend health-check endpoint to verify service status.

🚫 Rate Limiting (Optional)
Prevents abuse on chat/prediction endpoints.

🛠️ Architecture

MediBot uses a client–server architecture:

Backend (FastAPI)

Auth: JWT tokens, password hashing (bcrypt).

Prediction: TensorFlow/Keras 1D-CNN trained on symptom-disease dataset.

Chat: Integrated LLM (Google Generative AI via LangChain).

Database: SQLite (users, chat logs, tokens).

Frontend (React + TypeScript)

UI: Built with React 18, TailwindCSS, and shadcn/ui components.

Navigation: React Router.

Features: Symptom selector, prediction dashboard, chat interface, sidebar history, authentication pages.

Data Flow:

User selects symptoms → sends to backend.

Backend runs CNN prediction → creates chat session.

LLM manages ongoing chat.

Frontend displays results + stored history.

⚡ Installation
Prerequisites

Python 3.12+

Node.js 18+

Git

Backend Setup
git clone https://github.com/Umaraftab174/medibot.git
cd medibot

# Create venv
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables in `.env`
SECRET_KEY=your-secret-key
GOOGLE_API_KEY=your-google-genai-key

# Run server
uvicorn main:app --reload

Frontend Setup
cd ../frontend

# Install dependencies
npm install

# Run dev server
npm run dev


Frontend → http://localhost:5173

Backend → http://localhost:8000

🚀 Usage

Signup/Login → Create an account.

Select Symptoms → Drag and drop from searchable list.

Predict Disease → Submit and receive predictions with confidence scores.

Chat with AI → Ask health-related questions about predictions.

Review History → Access prior chats via sidebar.

Manage Profile → Update personal info securely.

🧩 Technologies Used

Backend:

FastAPI, TensorFlow, LangChain, SQLite, PyJWT, bcrypt

Frontend:

React (TypeScript), TailwindCSS, shadcn/ui, React Router, Axios, Lucide Icons

Other:

Pandas (data handling), Uvicorn (ASGI server)

📂 Project Structure
medibot/
├── backend/
│   ├── chat.py
│   ├── db.py
│   ├── main.py
│   ├── schema.py
│   ├── utils.py
│   ├── dataset/
│   │   ├── disease_mapping.csv
│   │   └── symptoms.csv
│   ├── models/
│   │   └── cnn_model.h5
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   ├── ChatInterface.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── SymptomSelector.tsx
│   │   │   └── layout/
│   │   │       └── Header.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.tsx
│   │   ├── pages/
│   │   │   ├── Account.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Index.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── NotFound.tsx
│   │   │   └── Signup.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── .gitignore
└── README.md

🤝 Contributing

Contributions are welcome!

Fork the repo

Create a branch:

git checkout -b feature/your-feature


Commit changes:

git commit -m "Add your feature"


Push and open a Pull Request

Please follow coding guidelines and add tests where needed.

🙏 Acknowledgements

Inspired by AI in healthcare research.
