# Lost & Found Item Recovery Platform - Backend

> **Developed by: Taniya Kamboj**

![Status](https://img.shields.io/badge/Status-Production-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18.0-green)
![Express](https://img.shields.io/badge/Express-4.18-gray)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)

## 📖 Description

A full-stack system for organizations, transit authorities, or public venues to catalog lost items, allow owners to file claims, and manage the verification and return process with location-based matching.

This repository contains the **Backend** API, built with Node.js, Express, and MongoDB.

- **Frontend Repository:** [https://github.com/taniyakamboj15/LostAndFound-frontend.git](https://github.com/taniyakamboj15/LostAndFound-frontend.git)
- **Backend Repository:** [https://github.com/taniyakamboj15/LostAndFound-backend.git](https://github.com/taniyakamboj15/LostAndFound-backend.git)

## 🎯 Use Cases

- **Airports and Transit Authorities**: Managing passenger lost belongings.
- **Universities and Large Campuses**: Centralizing lost-and-found operations.
- **Hotels and Event Venues**: Handling guest forgotten items.

## ✨ Features

- **Robust Authentication**: Secure JWT-based auth (Admin, Staff, Claimant) + Google OAuth.
- **Item Lifecycle Management**: Tracks items from `AVAILABLE` → `CLAIMED` → `RETURNED` → `DISPOSED`.
- **Automated Matching Engine**: Intelligent matching of Lost Reports to Found Items using keyword analysis and fuzzy logic.
- **Claim Verification System**: State machine for handling claims, proof submission, and staff approval/rejection.
- **Item Storage Management**: Shelf/Bin tracking with capacity management.
- **Pickup Scheduling**: Slot-based booking system for item retrieval.
- **Disposition Workflows**: Automated handling for unclaimed items (Donate/Auction/Dispose).
- **Advanced Analytics**: Metrics for recovery rates, category trends, and staff performance.
- **Notification Service**: Asynchronous email notifications via BullMQ + Redis.
- **Security**: RBAC (Role-Based Access Control), Rate Limiting, Input Sanitization.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Caching/Queue**: Redis
- **Authentication**: Passport.js (JWT, Google Strategy)
- **Validation**: Joi / Zod
- **Logging**: Winston

## 📁 Project Structure

```bash
src/
├── modules/        # Domain-driven feature modules (Item, User, Claim, etc.)
├── common/         # Shared middlewares, types, and helpers
├── config/         # Configuration (DB, Redis, Email)
├── routes/         # API routes
└── server.ts       # Application entry point
```

## 🚀 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/taniyakamboj15/LostAndFound-backend.git
    cd LostAndFound-backend
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file based on `.env.example`:
    ```env
    PORT=5000
    MONGODB_URI=mongodb://localhost:27017/lostandfound
    JWT_SECRET=your_secret_key
    REDIS_HOST=localhost
    REDIS_PORT=6379
    # ... other config variables
    ```

4.  **Start Services**
    Ensure MongoDB and Redis are running (e.g., via Docker):
    ```bash
    docker-compose up -d
    ```

5.  **Run Server**
    ```bash
    npm run dev
    ```

## 🔑 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/auth/login` | User login |
| **GET** | `/api/items` | List found items |
| **POST** | `/api/claims` | File a new claim |
| **POST** | `/api/lost-reports` | Submit a lost item report |
| **GET** | `/api/analytics/dashboard` | Admin dashboard stats |

*(See full API documentation in the codebase)*

## 🤝 Contribution

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

This project is licensed under the MIT License .
