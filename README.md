# Lost & Found Item Recovery Platform - Backend

Enterprise-grade backend system for managing lost and found items across airports, universities, hotels, and event venues.

## 🚀 Features

- **Multi-role Authentication**: Admin, Staff, Claimant with JWT + OAuth Google
- **Item Lifecycle Management**: AVAILABLE → CLAIMED → RETURNED → DISPOSED
- **Automated Matching Engine**: AI-powered matching between found items and lost reports
- **Claim Verification Workflow**: Strict state machine with proof validation
- **Pickup Scheduling**: Time-slot booking with QR code verification
- **Disposition Management**: Automated handling of unclaimed items
- **Real-time Notifications**: BullMQ + Redis for async email notifications
- **Analytics Dashboard**: Comprehensive metrics and reporting
- **Audit Logging**: Complete activity trail for compliance
- **Public Search Portal**: Privacy-safe item browsing

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 7.0
- Redis >= 7.0
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Local Development

```bash
# Clone repository
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your configuration

# Start MongoDB and Redis locally or use Docker
docker-compose up -d mongodb redis

# Run development server
npm run dev

# Run worker (in separate terminal)
npm run worker
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📁 Project Structure

```
src/
├── modules/
│   ├── user/              # User management
│   ├── session/           # Authentication & JWT
│   ├── item/              # Found items
│   ├── lost-report/       # Lost item reports
│   ├── claim/             # Claim verification
│   ├── match/             # Matching engine
│   ├── storage/           # Storage locations
│   ├── pickup/            # Pickup scheduling
│   ├── disposition/       # Unclaimed item handling
│   ├── notification/      # Email notifications
│   ├── analytics/         # Dashboard metrics
│   └── activity/          # Audit logging
├── common/
│   ├── middlewares/       # Auth, RBAC, validation, etc.
│   ├── errors/            # Custom error classes
│   ├── types/             # TypeScript definitions
│   ├── utils/             # Logger, helpers
│   └── helpers/           # Async handler
├── config/                # Database, Redis, Passport, Email
├── routes/                # Route aggregator
├── app.ts                 # Express app setup
└── server.ts              # Entry point
```

## 🔐 Environment Variables

See `.env.example` for all required configuration:

- **Server**: PORT, NODE_ENV, API_URL, CLIENT_URL
- **Database**: MONGODB_URI
- **Redis**: REDIS_HOST, REDIS_PORT
- **JWT**: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- **OAuth**: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- **Email**: SMTP_HOST, SMTP_USER, SMTP_PASSWORD
- **Retention**: RETENTION_PERIOD_DEFAULT (30 days)

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - OAuth callback

### Users
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile
- `POST /api/users/verify-email` - Verify email
- `POST /api/users/resend-verification` - Resend verification

### Items (Staff/Admin)
- `POST /api/items` - Register found item
- `GET /api/items` - List items (filtered)
- `GET /api/items/:id` - Get item details
- `PATCH /api/items/:id/status` - Update status
- `PATCH /api/items/:id/storage` - Assign storage

### Public Search
- `GET /api/public/items` - Search found items (no auth)

### Lost Reports (Claimant)
- `POST /api/lost-reports` - Submit lost report
- `GET /api/lost-reports` - List my reports
- `GET /api/lost-reports/:id` - Get report details

### Claims
- `POST /api/claims` - File claim
- `GET /api/claims` - List claims
- `POST /api/claims/:id/proof` - Upload proof
- `PATCH /api/claims/:id/verify` - Verify claim (Staff)
- `PATCH /api/claims/:id/reject` - Reject claim (Staff)

### Pickup
- `POST /api/pickups` - Book pickup slot
- `GET /api/pickups/slots` - Available slots
- `POST /api/pickups/:id/complete` - Complete handoff

### Analytics (Admin)
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/category-breakdown` - Category stats
- `GET /api/analytics/trends` - Time-series data

### Activity Logs (Admin/Staff)
- `GET /api/activities` - All activities
- `GET /api/activities/user/:userId` - User activities
- `GET /api/activities/entity/:type/:id` - Entity activities

## 🔒 Security Features

- **JWT Authentication**: Access tokens (15min) + Refresh tokens (7 days)
- **httpOnly Cookies**: Secure token delivery
- **RBAC**: Role-based access control on all routes
- **Rate Limiting**: Configurable per endpoint
- **Input Sanitization**: XSS and NoSQL injection protection
- **Email Verification**: Required before filing claims
- **Password Hashing**: bcrypt with salt rounds
- **Helmet**: Security headers
- **CORS**: Configurable origins

## 📊 Data Models

### User
- Roles: ADMIN, STAFF, CLAIMANT
- Email verification required
- OAuth Google integration
- Password hashing with bcrypt

### Item
- Status: AVAILABLE → CLAIMED → RETURNED → DISPOSED
- Retention period (30/60/90 days)
- Photo storage
- Storage location tracking
- Keyword extraction for matching

### Claim
- State machine: FILED → IDENTITY_PROOF_REQUESTED → VERIFIED → PICKUP_BOOKED → RETURNED
- Proof document storage
- Manual verification required

### Match
- Confidence scoring (0-1)
- Category, keyword, date, location factors
- Ranked suggestions only

## 🔔 Notifications

Async notifications via BullMQ:
- Match found (high confidence)
- Claim status updates
- Retention expiry warnings (7 days before)
- Pickup reminders (24 hours before)
- Email verification

## 📈 Analytics Metrics

- Total items found vs claimed
- Match success rate
- Average recovery time
- Category breakdown
- Pending claims count
- Expiring items (next 7 days)

## 🧪 Testing

```bash
# Run TypeScript compilation
npm run build

# Check for errors
npm run lint

# Format code
npm run format
```

## 🚢 Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure SMTP for emails
4. Set up Google OAuth credentials
5. Enable HTTPS
6. Configure CORS origins
7. Set appropriate retention periods
8. Configure rate limits
9. Set up MongoDB indexes
10. Configure Redis persistence

### Docker Production

```bash
# Build production image
docker build -t lost-and-found-api .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d
```

## 📝 License

MIT

## 🤝 Support

For issues and questions, contact: support@lostandfound.com
