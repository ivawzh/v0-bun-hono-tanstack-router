# v0-bun-hono-tanstack-router

A modern TypeScript template featuring Bun, Hono, TanStack Router, oRPC, and more for full-stack development.

## 🚀 Quick Start

### Using GitHub Template (Recommended)

1. **Via GitHub UI**: Click "Use this template" button above, or
2. **Via GitHub CLI**:
```bash
gh repo create my-new-project --template ivawzh/v0-bun-hono-tanstack-router --clone
cd my-new-project
```

### Manual Setup
```bash
git clone https://github.com/ivawzh/v0-bun-hono-tanstack-router.git my-project
cd my-project
rm -rf .git
git init
```

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **PWA** - Progressive Web App support

## Getting Started

After creating your project from this template:

1. **Install dependencies**:
```bash
bun install
```

2. **Database Setup**:
   - Set up PostgreSQL database
   - Update `apps/server/.env` with your database connection details
   - Apply schema: `bun db:push`

3. **Run development server**:
```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).





## Project Structure

```
project-name/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, ORPC)
```

## Available Scripts

- `bun dev`: Start all applications in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun typecheck`: Check TypeScript types across all apps
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `cd apps/web && bun generate-pwa-assets`: Generate PWA assets
