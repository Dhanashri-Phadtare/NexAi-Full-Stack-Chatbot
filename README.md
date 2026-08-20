NexAI is a full-stack AI chatbot and productivity web application
built with Python and Flask. It combines conversational AI with user
authentication, persistent chat history, project/workspace organization,
notes, and a modern web interface.

The project was developed as a hands-on application to explore Python
backend development, REST APIs, databases, authentication, JavaScript
frontend development, and Generative AI/LLM integration.

✨ Features

🤖 AI Chat

Conversational AI powered through an external LLM API.

Real-time message exchange between the frontend and Flask backend.

Clean, ChatGPT-inspired chat experience.

User and assistant message handling.

💬 Chat History

Save conversations for later access.

View previous conversations from the history panel.

Automatically organize saved chats.

Create a new chat without losing previous conversations.

📁 Projects / Workspaces

Create projects to organize related conversations.

Associate chats with projects.

View project-specific conversations.

Rename and manage projects.

Separate Chats and Notes workspace views.

📝 Notes

Maintain project-specific notes.

Notes are stored with the project workspace.

Designed for keeping useful information alongside related
conversations.

🔐 Authentication

User registration and login.

Password hashing and secure password verification.

Session-based authentication.

User-specific access to chats and application data.

👤 User Profile & Settings

User profile information.

Profile modal with account details.

Application settings.

Theme and interface customization options.

🗄️ Database

SQLite database for persistent application data.

SQLAlchemy ORM for database interaction.

Stores users, chats, projects, and related information.

🎨 Modern UI

Responsive web interface.

ChatGPT-inspired layout.

Sidebar navigation.

Modern chat interface.

Light/dark interface support.

JavaScript-driven interactive components.

🛠️ Technology Stack

Frontend

HTML5

CSS3

JavaScript

Fetch API

Backend

Python

Flask

Flask-SQLAlchemy

Flask-Login

Flask-Bcrypt

REST API endpoints

Database

SQLite

SQLAlchemy

AI

External LLM API integration

Generative AI / conversational AI

Development Tools

Git

GitHub

Visual Studio Code

🏗️ Project Architecture

NexAI/
│
├── app.py
├── config.py
├── requirements.txt
│
├── routes/
│   └── upload.py
│
├── templates/
│   ├── login.html
│   ├── register.html
│   └── ...
│
├── static/
│   ├── style.css
│   └── script.js
│
├── database/
│   └── ...
│
└── README.md

The exact file structure may change as the project continues to
evolve.

🚀 Getting Started

1. Clone the repository

git clone <YOUR_NEXAI_REPOSITORY_URL>
cd NexAI

2. Create a virtual environment

Windows

python -m venv venv
venv\Scripts\activate

macOS / Linux

python3 -m venv venv
source venv/bin/activate

3. Install dependencies

pip install -r requirements.txt

4. Configure the AI API

Create a .env file in the project root and add your API key:

GROQ_API_KEY=your_api_key_here

Never commit your API key or .env file to GitHub.

Make sure .env is included in .gitignore.

5. Run the application

python app.py

Open the local application in your browser using the address shown by
Flask, commonly:

http://127.0.0.1:5000

🔑 Environment Variables

Variable         Purpose

GROQ_API_KEY   API key used for LLM-powered responses
SECRET_KEY     Flask session/security key

Use environment variables rather than hardcoding secrets in Python
files.

🔒 Security

NexAI includes several basic security practices:

Password hashing instead of storing plain-text passwords.

Authenticated user sessions.

User-specific data access.

API credentials stored through environment variables.

.env excluded from version control.

For production deployment, additional security hardening would be
required.

🧠 What I Learned

This project provided practical experience with:

Building a Python Flask web application from the ground up.

Designing and consuming REST API endpoints.

Integrating an external LLM API.

Working with SQLAlchemy and SQLite.

Implementing authentication and password hashing.

Connecting JavaScript frontend functionality with Flask backend
APIs.

Managing persistent chat data.

Structuring features into reusable application components.

Debugging frontend/backend integration issues.

Using Git and GitHub for project version control.

🔮 Future Improvements

Potential improvements include:

Streaming AI responses.

Improved prompt management.

More advanced conversation memory.

File/document-based AI conversations.

Document summarization and analysis.

Additional AI tools.

Production deployment.

Improved automated testing.

More granular user permissions.

Enhanced project collaboration features.

📌 Project Status

Active Development

NexAI is a learning-focused but functional full-stack AI application.
Features and architecture may continue to evolve as new AI and
productivity capabilities are added.

👩‍💻 Developer

Dhanashri Phadtare

Python & AI Developer | Entry-Level

LinkedIn: https://www.linkedin.com/in/dhanashri-phadtare-77316b414

GitHub: https://github.com/Dhanashri-Phadtare

📄 License

This project is currently intended for learning and portfolio purposes.

A formal open-source license can be added when the project is ready for
public reuse.
