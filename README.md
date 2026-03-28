# Bella Vista - AI SMS Reply Bot Sandbox

An AI-powered SMS reply bot sandbox for **Bella Vista**, an upscale Italian restaurant. Guests interact with the bot via a simulated text conversation to manage reservations, log dietary preferences, and more. The bot understands natural language, takes real actions against the database, and provides a conversation summary at the end of each session.

## Design Rationale

### Tech Stack

I chose a stack that balances simplicity with technical depth:

- **Next.js 14 (App Router) + TypeScript** -- A single framework handles both the frontend UI and backend API routes, keeping the architecture lean for a time-constrained build. TypeScript ensures type safety across the full stack.
- **PostgreSQL (Neon)** -- I chose Postgres over lighter alternatives like SQLite to demonstrate real relational data modeling with foreign keys, joins, and proper schema design. Neon's serverless Postgres allowed me to get a production-ready database running in minutes without managing infrastructure.
- **Prisma ORM** -- Rather than writing raw SQL or using a higher-level abstraction like Supabase, I used Prisma to demonstrate backend data modeling skills -- explicit schema definitions, migrations, seed scripts, and typed queries. This shows a deeper understanding of the data layer compared to using a BaaS.
- **Vercel** -- The natural deployment target for Next.js. Zero-config deployments with automatic preview environments.
- **Claude API (Anthropic)** -- I used Claude's tool-use capability to power the bot's action system. The bot receives tool definitions (bookReservation, modifyReservation, cancelReservation, addGuestNote) and decides when to call them based on conversation context. This is a cleaner architecture than regex-based intent matching -- the LLM handles ambiguity naturally.

### Architecture Decisions

**Tool-use over prompt engineering**: The bot's action system is built on Claude's native tool calling. Each action is defined as a structured tool with an input schema. When a guest says "move my reservation to Saturday," Claude determines which tool to call, with what parameters, and the backend executes it via Prisma. This separation of intent recognition (Claude) from action execution (Prisma) keeps the system predictable and testable.

**Stateless API with client-side history**: The chat API is stateless -- the frontend sends the full conversation history with each request. This avoids server-side session management and makes the API simple to reason about. The full Anthropic-format message array (including tool_use/tool_result blocks) is preserved between turns so Claude maintains context across multi-step interactions.

**Conversation persistence**: I extended the provided schema with a `Conversation` table that stores the full message history, actions taken, and auto-generated summary for each guest session. Conversations are auto-saved after each bot reply and updated with a summary when the session ends. This allows guests to resume previous conversations and gives the restaurant a record of all interactions.

**Restaurant as a first-class entity**: I added a `Restaurant` table as a lookup with hours of operation (`opensAt`, `closesAt`). The bot enforces these hours at both the prompt level (system instructions) and the tool level (hard validation in the booking function). This prevents overbooking outside operating hours even if the LLM hallucinates.

**Guest-aware prompting**: The system prompt includes the guest's full profile (dietary restrictions, seating preferences, VIP status), their reservation history, all table availability data, and restaurant hours. Explicit policies instruct the bot to acknowledge special occasions, proactively suggest preferred seating, mention dietary needs, and never overbook.

### Frontend

The UI follows TryNearby's existing design language -- warm orange accent palette, Fraunces + Outfit typography, rounded cards with soft borders, and decorative gradient blurs. The chat interface is iMessage-inspired with proper dark mode support via CSS custom properties and `prefers-color-scheme`. The layout is fully responsive with a slide-up action panel on mobile.

### What I Would Do With More Time

- **Self-hosted Postgres on AWS (RDS/Aurora)** for full control over the database infrastructure -- connection pooling, read replicas, automated backups, and VPC networking.
- **CI/CD pipeline with Buildkite or CircleCI** to run the test suite on every push, enforce linting, and handle staged deployments (preview -> staging -> production).
- **Streaming responses** for a more responsive chat UX -- the bot would start typing as Claude generates tokens rather than waiting for the full response.
- **Multi-restaurant support** -- the `Restaurant` table is already in place; the next step would be scoping all queries by restaurant ID and adding a restaurant selector.
- **Rate limiting and error retry** on the Claude API calls.
- **E2E tests with Playwright** covering the full user flow from guest selection through conversation summary.
- **Webhook integration** to connect with real SMS providers (Twilio) for production use.

## Setup

### Prerequisites

- Node.js 18+
- A Neon Postgres database (or any Postgres instance)
- An Anthropic API key

### Environment Variables

Copy `.env.local.example` to `.env` and fill in:

```
DATABASE_URL="your-postgres-connection-string"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
ANTHROPIC_API_KEY="sk-ant-..."
```

### Install and Run

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

### Run Tests

```bash
npm test
```

25 integration tests covering all 4 bot actions (book, modify, cancel, add note), hours-of-operation enforcement, error handling, and conversation summary generation.

## Database Schema

- **Restaurant** -- Lookup table with name, address, hours of operation
- **Guest** -- Guest profiles with dietary restrictions and preferences
- **RestaurantTable** -- Table inventory with capacity and location
- **Reservation** -- Bookings linking guests to tables with status tracking
- **Conversation** -- Persisted chat history with messages, actions, and summaries
