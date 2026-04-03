# MongoDB + Prisma Setup Guide

Step-by-step guide to set up Roost with MongoDB and Prisma ORM. This option gives you a fully local database with no external dependencies.

---

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local) or a MongoDB Atlas account (cloud)
- npm or yarn

---

## Step 1: Set Up MongoDB

### Option A: Local MongoDB

#### Install MongoDB

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu/Debian:**
```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Windows:**
- Download from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
- Run the installer, choose "Complete" setup
- MongoDB will run as a Windows service

**Docker:**
```bash
docker run -d --name roost-mongo \
  -p 27017:27017 \
  -v roost-mongo-data:/data/db \
  -e MONGO_INITDB_DATABASE=roost \
  mongo:7
```

#### Verify MongoDB is Running

```bash
# Connect to MongoDB shell
mongosh

# You should see the MongoDB shell prompt
# Type 'exit' to leave
```

Your connection URL is: `mongodb://localhost:27017/roost`

### Option B: MongoDB Atlas (Cloud)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free account
3. Click **Build a Database** > **Free tier (M0)**
4. Choose your cloud provider and region
5. Create a database user:
   - Username: `roost`
   - Password: generate a strong password
6. Add your IP to the whitelist:
   - **Network Access** > **Add IP Address**
   - For development: `0.0.0.0/0` (allow all)
   - For production: add your server's IP only
7. Click **Connect** > **Drivers** > Copy the connection string

Your connection URL looks like: `mongodb+srv://roost:password@cluster0.xxxxx.mongodb.net/roost`

---

## Step 2: Install Prisma Dependencies

```bash
# In the project root
npm install prisma @prisma/client

# In the server directory
cd server
npm install @prisma/client jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
cd ..
```

---

## Step 3: Configure Environment Variables

### Frontend (.env.local)

```env
# Database Provider — MUST be "mongodb"
VITE_DB_PROVIDER=mongodb

# MongoDB connection (used by Prisma on the frontend build — not exposed to browser)
VITE_DATABASE_URL=mongodb://localhost:27017/roost

# App
VITE_APP_NAME="Your Community Name"
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000

# Storage (optional)
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-bucket
```

### Backend (server/.env)

```env
NODE_ENV=development
PORT=3000

# Database
DB_PROVIDER=mongodb
DATABASE_URL=mongodb://localhost:27017/roost

# JWT Authentication (REQUIRED for MongoDB — no Supabase Auth)
JWT_SECRET=your-super-secret-key-at-least-32-characters-long

# CORS
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# SMTP (for password resets, notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=Your Community
```

**Important:** The `JWT_SECRET` is used for signing authentication tokens. Generate a strong one:

```bash
openssl rand -base64 32
```

---

## Step 4: Push Schema to MongoDB

The Prisma schema at `prisma/schema.prisma` defines all 40+ collections (tables). Push it to MongoDB:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to MongoDB (creates collections and indexes)
npx prisma db push
```

You should see output like:
```
🚀  Your database is now in sync with your Prisma schema.
✔ Generated Prisma Client
```

---

## Step 5: Verify the Schema

```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

This opens a web interface at `http://localhost:5555` where you can browse all collections.

You should see collections like:
- `profiles`
- `groups`
- `group_members`
- `posts`
- `comments`
- `reactions`
- `messages`
- `notifications`
- ... and 30+ more

---

## Step 6: Start the Application

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Backend
cd server && npm run dev
```

Or both at once:

```bash
npm run dev:all
```

Visit `http://localhost:5173` and create your first account.

---

## Step 7: Create an Admin User

Since MongoDB doesn't have Supabase's dashboard, promote a user via Prisma Studio or mongosh:

### Via Prisma Studio

1. Run `npx prisma studio`
2. Open the `profiles` collection
3. Find your user
4. Change `role` from `user` to `superadmin`
5. Save

### Via mongosh

```bash
mongosh roost

db.profiles.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "superadmin" } }
)
```

---

## Key Differences from Supabase

| Feature | Supabase | MongoDB + Prisma |
|---------|----------|------------------|
| **Auth** | Supabase Auth (built-in) | JWT tokens (custom) |
| **Realtime** | PostgreSQL Changes (built-in) | Not yet (polling fallback) |
| **Row-Level Security** | Database-level RLS policies | Application-level checks |
| **Stored Procedures** | PostgreSQL functions | Application code |
| **Admin Dashboard** | Supabase Dashboard | Prisma Studio |

### What Works Differently

1. **Authentication**: Uses JWT tokens stored in `localStorage` instead of Supabase sessions. The backend handles signup/login at `/api/auth/*` endpoints.

2. **Realtime Updates**: Currently uses polling instead of live subscriptions. Posts, comments, and messages will refresh on interval. WebSocket support via MongoDB Change Streams is planned.

3. **Access Control**: Instead of PostgreSQL RLS policies, access checks happen in the MongoDB adapter's application code.

---

## Prisma Schema Updates

If you need to modify the database schema:

```bash
# Edit prisma/schema.prisma

# Push changes to MongoDB
npx prisma db push

# Regenerate the Prisma Client
npx prisma generate
```

---

## Backup & Restore

### Backup

```bash
# Full database dump
mongodump --db roost --out ./backups/$(date +%Y%m%d)

# Single collection
mongodump --db roost --collection profiles --out ./backups/
```

### Restore

```bash
mongorestore --db roost ./backups/20240101/roost/
```

### MongoDB Atlas Backups

Atlas provides automatic daily backups on paid tiers. For M0 (free tier), use `mongodump` manually.

---

## Troubleshooting

### "Can't reach database server"
- Check MongoDB is running: `mongosh` or `docker ps`
- Verify your `DATABASE_URL` is correct
- For Atlas: check IP whitelist and credentials

### "Prisma schema validation error"
```bash
npx prisma validate
# Fix any schema issues, then:
npx prisma generate
```

### "JWT_SECRET not set"
- The server won't start without a `JWT_SECRET` in `server/.env`
- Generate one: `openssl rand -base64 32`

### "Authentication failed"
- Check that the auth routes are registered in the Express server
- Verify `JWT_SECRET` is the same across server restarts
- Clear `roost_auth_token` from browser localStorage and try again

### Slow queries
- Run `npx prisma db push` again to ensure indexes are created
- Check MongoDB logs: `mongosh` then `db.currentOp()`

---

## Next Steps

- [Deploy with Docker (VPS)](./docker-vps.md)
- [Deploy to Vercel](./vercel.md)
- [Deploy with Netlify](./netlify.md)
