# AI Coding Session Summary — Bella Vista SMS Reply Bot

## Session Overview
Built a full-stack AI SMS reply bot sandbox for a restaurant reservation system in a single session using Claude Code as an AI coding assistant. The project went from an empty scaffold to a deployed, tested application.

## Workflow Progression

### 1. Pre-Hackathon Setup
- Configured Google OAuth alongside existing GitHub OAuth for authentication
- Resolved provider account linking issue with `allowDangerousEmailAccountLinking`
- Set up Anthropic API key for Claude tool-use integration

### 2. Planning & Architecture (Collaborative)
- Reviewed the hackathon PDF prompt together and discussed design decisions before writing code
- Chose Claude API with native tool calling over regex-based intent matching
- Decided on a guest picker UI (vs. bot-identifies-guest) for demo clarity
- Planned a stateless API architecture with client-side conversation history
- Used plan mode to formalize the approach before implementation

### 3. Database & Schema Design
- Extended Prisma schema with Guest, RestaurantTable, Reservation models using the provided seed data
- Later added Restaurant table (with hours of operation) and Conversation table (for chat persistence)
- All models linked with proper foreign keys and relations

### 4. Backend — Tool-Use System
- Defined 4 Claude tools: `bookReservation`, `modifyReservation`, `cancelReservation`, `addGuestNote`
- Each tool executes real Prisma queries against the database
- Implemented a tool-use loop in the chat API route — Claude calls a tool, the server executes it, sends the result back, and Claude generates a final response
- Added preferred seating support (bot passes `preferredLocation` based on guest notes)
- Added operating hours validation — bookings outside 11:00–23:00 are rejected at the tool level

### 5. System Prompt Engineering
- Built a detailed system prompt with 6 policy sections:
  - Guest personalization (acknowledge VIP status, special occasions, seating preferences)
  - Dietary awareness (always mention restrictions, auto-log new ones)
  - Overbooking prevention (full table availability context in the prompt)
  - Hours of operation enforcement
  - Date assumptions (default to current year)
  - Conversation style guidelines
- The prompt includes live data: guest profile, reservation history, all table bookings, and restaurant hours

### 6. Frontend — Chat UI
- Built an iMessage-inspired chat interface with SMS-style bubbles
- Right sidebar shows actions triggered (with color-coded badges) and conversation summary
- Mobile-responsive with a slide-up action panel
- Guest picker screen with past conversation history
- Dark/light mode support via CSS custom properties and `prefers-color-scheme`
- Styled to match TryNearby's design system (Fraunces + Outfit fonts, warm orange palette, rounded cards with gradient accents)

### 7. Conversation Persistence
- Auto-saves conversations to the database after each bot reply
- Loads previous conversation when re-selecting a guest
- Saves summary and actions when ending a session
- Past conversations visible on the guest picker with timestamps and summaries

### 8. Testing — 25 Integration Tests
- All tests hit the real Neon database (no mocks)
- **bookReservation (7 tests):** table assignment, capacity, notes, overbooking, hours validation
- **modifyReservation (7 tests):** date/time/party changes, table reassignment, hours validation
- **cancelReservation (3 tests):** status change, soft delete, not-found handling
- **addGuestNote (5 tests):** dietary, preferences, append behavior, empty state
- **Conversation summary (1 test):** Claude API generates meaningful summary
- **Error handling (1 test):** unknown tool rejection

### 9. Debugging & Iteration
- Fixed conversation history corruption (tool_use/tool_result blocks lost between turns)
- Fixed stale Prisma client after schema changes (regenerate + restart)
- Fixed type coercion issues (Claude passing numeric IDs as strings)
- Fixed duplicate `addGuestNote` calls with improved tool descriptions
- Filtered failed action badges from the UI

### 10. Deployment
- Deployed to Vercel via GitHub repo
- Database hosted on Neon (persistent across deploys)
- Re-seeded database for clean demo state

## Tech Stack
- Next.js 14 (App Router) + TypeScript
- Prisma ORM + Neon Serverless Postgres
- Claude API (Sonnet) with tool calling
- Tailwind CSS + Fraunces/Outfit fonts
- Vitest for integration testing
- Vercel for deployment

## How AI Was Used
Claude Code served as a pair programmer throughout the session. Key patterns:
- **Planning before coding**: Used plan mode to explore the codebase and design the architecture before writing any code
- **Parallel exploration**: Launched subagents to explore the codebase while designing the implementation
- **Iterative debugging**: When errors occurred, checked server logs, diagnosed root causes, and applied targeted fixes rather than rewriting
- **Design extraction**: Fetched TryNearby's production CSS/JS to extract their exact color palette, fonts, and UI patterns
- **Test-driven verification**: Wrote integration tests that hit the real database, then used them to verify fixes
