# Zlingo - Gamified Vocabulary Learning Platform

## Overview

Zlingo is a gamified vocabulary learning web application designed for telecom operator employees. The platform helps employees learn industry-specific terminology through interactive quizzes, flashcards, and competitive features like leaderboards and badges. Built with a modern React frontend and Express.js backend, it uses PostgreSQL for data persistence and OpenAI integration for AI-powered quiz features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom Zain-inspired color palette (primary red #ED1C24, secondary green #00A859)
- **Animations**: Framer Motion for page transitions and interactive animations
- **Special Effects**: Canvas Confetti for celebration animations

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with Zod schema validation
- **Authentication**: Passport.js with Local Strategy, session-based auth using express-session
- **Password Security**: Scrypt hashing with timing-safe comparison
- **Real-time**: Socket.io server integration for future live duels

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### Key Data Models
- **Users**: Authentication, department affiliation, points, streaks, admin status
- **Terms**: Vocabulary with term, definition, example, and department categorization
- **Quizzes**: Quiz history tracking with type, score, and timestamps
- **Badges**: Achievement system with conditions for earning
- **UserBadges**: Junction table for user-badge relationships
- **UserLearnedTerms**: Tracks which terms each user has learned (prevents repetition in daily content)
- **Conversations/Messages**: Chat history for AI integrations

### Application Features
- Department-based vocabulary organization (Finance, HR, Engineering, Marketing, Sales, etc.)
- Multiple quiz modes: AI Duel, Daily Mix, and planned Live Battle
- Flashcard learning with swipeable cards
- Leaderboard with seasonal rankings
- Badge/achievement system with streak tracking
- User profiles with progress visualization

### Code Organization
```
client/src/           # React frontend
  components/         # Reusable UI components
  pages/              # Route page components
  hooks/              # Custom React hooks (auth, terms, quizzes, gamification)
  lib/                # Utilities and query client
server/               # Express backend
  routes.ts           # API route handlers
  auth.ts             # Authentication setup
  storage.ts          # Database access layer
  replit_integrations/# AI integration utilities (audio, chat, image, batch)
shared/               # Shared code between client and server
  schema.ts           # Drizzle database schema
  routes.ts           # API route definitions with Zod schemas
```

### Build System
- Development: `tsx` for TypeScript execution
- Production: esbuild for server bundling, Vite for client bundling
- Output: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### AI Services
- **OpenAI API**: Used for AI-powered quiz generation and duels
  - Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Supports text chat, image generation, and voice processing

### Authentication
- **Passport.js**: Authentication middleware with Local Strategy
- **express-session**: Session management with PostgreSQL store

### Real-time Communication
- **Socket.io**: WebSocket server for future real-time duel functionality

### Third-party UI Services
- **DiceBear Avatars**: Avatar generation via API (`https://api.dicebear.com/7.x/avataaars/svg`)
- **Google Fonts**: Outfit and Inter font families

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (defaults to "zlingo_secret")
- `GOOGLE_API_KEY`: Google Gemini API key for daily vocabulary generation
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key for AI features
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI API base URL