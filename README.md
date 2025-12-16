# Pocat.io - AI Video Clipper API

Backend API untuk platform video clipper AI yang memungkinkan users untuk mengubah video panjang menjadi clips pendek yang engaging, mirip seperti OpusClip atau Vizard AI.

## 🎬 Features

- **AI Video Analysis** - Analisis konten video untuk highlight detection
- **Auto Transcription** - Speech-to-text dengan AI
- **Smart Clipping** - Generate clips berdasarkan engagement potential
- **Subtitle Generation** - Auto-generate subtitle untuk clips
- **Multi-format Export** - Support berbagai format output
- **Turso Database** - SQLite-compatible database dengan edge replication
- **Authentication** - Access tokens untuk API security

## 🚀 Tech Stack

- **AdonisJS 6** - Modern Node.js framework
- **Turso Database** - Edge SQLite database
- **TypeScript** - Full type safety
- **AI Integration** - Ready for OpenAI, AWS services
- **Cloud Storage** - S3-compatible storage integration

## 📦 Installation

```bash
# Clone atau download project
cd pocat.io

# Install dependencies dengan pnpm
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env dan tambahkan Turso credentials:
# DATABASE_URL=your_turso_database_url
# DATABASE_AUTH_TOKEN=your_turso_auth_token
```

## 🗄️ Database Setup

```bash
# Run migrations ke Turso database
pnpm exec node ace migrate:turso

# Test koneksi Turso
pnpm exec node ace test:turso
```

## 🏃‍♂️ Running the Application

```bash
# Development mode
pnpm run dev

# Production build
pnpm run build
cd build
pnpm i --prod
node bin/server.js
```

## 📚 API Endpoints

### Base URL: `http://localhost:3333`

### Test Endpoints
- `GET /` - API information dan available endpoints
- `GET /test-turso` - Test Turso database connection
- `POST /create-table` - Create test table

### Users API
- `GET /users` - Get all users
- `POST /users` - Create new user
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Example Usage

#### Create User
```bash
curl -X POST http://localhost:3333/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Get All Users
```bash
curl http://localhost:3333/users
```

#### Get User by ID
```bash
curl http://localhost:3333/users/1
```

#### Update User
```bash
curl -X PUT http://localhost:3333/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "email": "john.updated@example.com"
  }'
```

#### Delete User
```bash
curl -X DELETE http://localhost:3333/users/1
```

## 🏗️ Project Structure

```
hello-world/
├── app/
│   ├── controllers/
│   │   ├── tests_controller.ts      # Test endpoints
│   │   └── users_controller.ts      # Users CRUD API
│   └── services/
│       └── turso_service.ts         # Turso database service
├── commands/
│   ├── migrate_turso.ts             # Turso migration command
│   └── test_turso.ts                # Turso connection test
├── config/
│   └── database.ts                  # Database configuration
├── start/
│   └── routes.ts                    # API routes definition
└── .env                             # Environment variables
```

## 🔧 Custom Turso Service

Project ini menggunakan custom service untuk integrasi langsung dengan Turso:

```typescript
// app/services/turso_service.ts
import { createClient } from '@libsql/client'

class TursoService {
  async execute(sql: string, params?: any[]) {
    return await this.client.execute({
      sql,
      args: params || [],
    })
  }
  
  async batch(statements: Array<{ sql: string; args?: any[] }>) {
    return await this.client.batch(statements)
  }
}
```

## 🛠️ Available Commands

```bash
# Test Turso connection
pnpm exec node ace test:turso

# Run Turso migrations
pnpm exec node ace migrate:turso

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Format code
pnpm run format
```

## 🌟 Key Benefits

1. **Edge Database** - Turso menyediakan SQLite database dengan replikasi global
2. **Low Latency** - Database edge locations untuk performa optimal
3. **Scalable** - Auto-scaling berdasarkan usage
4. **Cost Effective** - Pay per request model
5. **Developer Friendly** - SQLite syntax yang familiar

## 📝 Environment Variables

```env
# Server Configuration
TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=your_app_key
NODE_ENV=development

# Turso Database
DATABASE_URL=libsql://your-database-url
DATABASE_AUTH_TOKEN=your_auth_token
```

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.
