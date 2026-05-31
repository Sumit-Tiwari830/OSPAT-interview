# 🚀 OSPAT — Online Smart Programming Assessment & Interview Platform

<div align="center">

<h3>💻 Real-Time Technical Interview Platform</h3>

<p>
Conduct technical interviews with live coding, video communication,
real-time collaboration, and automated code evaluation.
</p>

![React](https://img.shields.io/badge/React-19-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green)
![Clerk](https://img.shields.io/badge/Auth-Clerk-purple)
![Stream](https://img.shields.io/badge/Video-Stream-red)


</div>

---

## 🌟 Overview

OSPAT (Online Smart Programming Assessment & Interview Platform) is a production-ready SaaS application built to simulate real-world technical interviews.

The platform combines:

* 🎥 Live Video Interviews
* 💻 Online Coding Environment
* ⚡ Secure Code Execution
* 💬 Real-Time Communication
* 📊 Analytics Dashboard
* 🔐 Authentication & Access Control

into one seamless interview experience.

---

## ✨ Key Features

### 🎯 Interview Experience

* 🎥 1-on-1 Video Interview Rooms
* 🎙️ Mic Toggle
* 📷 Camera Toggle
* 🖥️ Screen Sharing
* 🎬 Session Recording
* 🔒 Room Locking (Maximum 2 Participants)

### 💻 Coding Environment

* 🧑‍💻 VSCode-Powered Monaco Editor
* ⚡ Secure Code Execution
* 🧪 Automated Test Case Evaluation
* 🎯 Success / Failure Feedback
* 🎉 Confetti Celebration on Success
* 🔔 Failure Notifications
* 📚 Practice Problems Mode

### 🔄 Real-Time Collaboration

* 💬 Real-Time Chat Messaging
* ⚡ Live Session Updates
* 🎯 Host-Controlled Problem Assignment
* 🔄 Instant Synchronization

### 📈 Dashboard & Monitoring

* 📊 Live Statistics Dashboard
* 📈 Session Monitoring
* 🏆 Interview Tracking
* 📋 Performance Insights

### 🔐 Authentication & Security

* 🔒 Authentication via Clerk
* 👤 User Profiles
* 🛡️ Protected Routes
* 🔑 Secure API Access

### ⚙️ Backend Features

* 📦 REST API with Node.js & Express
* 🧠 Background Jobs using Inngest
* ⚡ TanStack Query Caching
* 🚀 Optimized Async Processing

### 🛠 Developer Experience

* 🤖 CodeRabbit PR Reviews
* 🌿 GitHub Flow Workflow
* 🔀 Pull Requests & Code Reviews
* 🚀 Production Deployment on Sevalla

---

## 🏗️ System Architecture

```text
Frontend (React + Vite)
          │
          ▼
Backend API (Node.js + Express)
          │
 ┌────────┼────────┐
 ▼        ▼        ▼

MongoDB  Clerk   Stream

          │
          ▼

 Inngest Background Jobs

          │
          ▼

 Secure Code Execution Engine
```

---

## 🛠 Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* DaisyUI
* TanStack Query
* Monaco Editor
* Clerk SDK
* Stream Video SDK

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Inngest

### DevOps & Tools

* Git
* GitHub
* CodeRabbit
* Sevalla

---

## 📁 Project Structure

```text
ospat
│
├── backend
│   ├── src
│   ├── .env
│   ├── package.json
│   └── package-lock.json
│
├── frontend
│   ├── public
│   ├── src
│   │   ├── api
│   │   ├── assets
│   │   ├── components
│   │   ├── data
│   │   ├── hooks
│   │   ├── lib
│   │   ├── pages
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── package-lock.json
│
└── README.md
```

---

## 🚀 Getting Started

### Clone Repository

```bash
git clone https://github.com/your-username/ospat.git

cd ospat
```

---

## 🔑 Environment Variables

### Backend (/backend/.env)

```env
PORT=3000
NODE_ENV=development

DB_URL=your_mongodb_connection_url

INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

CLIENT_URL=http://localhost:5173
```

### Frontend (/frontend/.env)

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

VITE_API_URL=http://localhost:3000/api

VITE_STREAM_API_KEY=your_stream_api_key
```

---

## ▶️ Run Backend

```bash
cd backend

npm install

npm run dev
```

---

## ▶️ Run Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## 📸 Screenshots

Add screenshots inside:

```text
screenshots/
├── home.png
├── dashboard.png
├── editor.png
└── interview-room.png
```

Then include:

```md
![Home](./screenshots/home.png)

![Interview Room](./screenshots/interview-room.png)

![Editor](./screenshots/editor.png)

![Dashboard](./screenshots/dashboard.png)
```

---

## 🛣️ Future Enhancements

* 🐳 Docker Support
* ⚙️ CI/CD Pipeline
* 🤝 Collaborative Coding
* 📹 Interview Replay System
* 🧠 AI Interview Feedback
* 📊 Advanced Analytics Dashboard
* 🌍 Multi-Participant Rooms

---

## 👨‍💻 Author

### Sumit Tiwari

Full Stack Developer | React | Node.js | MongoDB

Passionate about building scalable applications, developer tools, and real-time collaboration platforms.

---

<div align="center">

⭐ If you found this project useful, please consider giving it a star.

🚀 OSPAT — Making Technical Interviews Smarter

</div>
