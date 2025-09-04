# v0-bun-hono-tanstack-router Template

This document serves as comprehensive instructions for developers working with this template.

## Tech Stack & Architecture

### Core Technologies
- **Runtime**: Bun (v1.x)
- **Backend**: Hono (lightweight web framework)
- **Frontend**: React 19 + TanStack Router
- **Database**: PostgreSQL + Drizzle ORM
- **Type Safety**: TypeScript + oRPC for end-to-end type safety
- **Auth**: OpenAuth (OAuth providers + password auth)
- **Styling**: TailwindCSS v4 + shadcn/ui components
- **Build Tools**: Vite (frontend), tsdown (backend)
- **Deployment**: SST (Serverless Stack)

### Project Structure
```
project-name/
├── apps/
│   ├── web/          # React frontend with TanStack Router
│   └── server/       # Hono backend with oRPC APIs
├── packages/         # Shared packages (if any)
└── sst.config.ts     # SST deployment configuration
```

## Developer Guidelines

### Environment Variables
- **MUST** use `apps/{appName}/env.ts` for environment variables
- **NEVER** use `process.env` directly in application code
- Environment files are staged-based: development, test, alpha, production

### API Communication Patterns
- **Internal APIs** (`/rpc`): Use oRPC for bundled deployments (web + server deploy together)
- **External APIs** (`/api`): Use oRPC + OpenAPI for backward compatibility (CLI, SDK, external services)
- **WebSocket**: Use Monster Realtime for real-time communication
- **Authentication**: Use OpenAuth with Monster Auth integration

### Code Standards
- Use TypeScript throughout the stack
- Prefer composition over inheritance
- Follow existing code patterns and conventions
- Use Drizzle ORM for all database operations
- Implement proper error handling with Result types

### Database Operations
```bash
# Development workflow
bun db:push          # Push schema changes
bun db:studio        # Open database studio
bun db:migrate       # Run migrations (production)
```

### Development Workflow
```bash
# Start development servers
bun dev              # Start both web and server
bun dev:web          # Web only
bun dev:server       # Server only

# Type checking and linting
bun typecheck        # Check all apps
bun lint             # Lint all code
bun lint:fix         # Auto-fix linting issues

# Building
bun build            # Build all apps
```

### Authentication Integration
- Uses OpenAuth client with configurable OAuth providers
- Implements session management via secure cookies
- Auto-creates user records on first login
- Supports both OAuth (Google) and password authentication

### Project Conventions
- Use kebab-case for file/folder names
- Use PascalCase for React components
- Use camelCase for functions and variables
- Prefer explicit imports over barrel exports
- Always handle error cases with proper typing

### Deployment
- **Alpha**: `bun sst:alpha` (staging environment)
- **Production**: `bun sst:prod` (production environment)
- Uses AWS infrastructure via SST v3
- Automatic database migrations on deployment

## File Organization

### Backend (`apps/server/`)
- `src/index.ts` - Application entry point
- `src/routers/` - API route definitions (rpc/, api/, others/)
- `src/lib/` - Shared utilities and configurations
- `src/db/` - Database schema and connection
- `src/services/` - Business logic services

### Frontend (`apps/web/`)
- `src/routes/` - TanStack Router route definitions
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Frontend utilities
- `src/utils/` - oRPC client configuration

## Important Notes

### Security
- Never commit secrets to repository
- Use environment variables for all configuration
- Implement proper CORS policies
- Validate all inputs with Zod schemas

### Performance
- Use React 19 features (Suspense, concurrent rendering)
- Implement proper loading states
- Use TanStack Query for data fetching
- Optimize bundle size with proper tree-shaking

### Monitoring & Debugging
- Use structured logging in backend
- Implement proper error boundaries in React
- Use TypeScript strict mode
- Leverage oRPC's built-in type safety

## Commands Reference

### Root Level
```bash
bun dev              # Start all services
bun build            # Build all apps
bun typecheck        # Type check all apps
bun lint             # Lint all code
```

### Database
```bash
bun db:push          # Push schema to database
bun db:studio        # Open Drizzle Studio
bun db:migrate       # Run migrations
```

### Deployment
```bash
bun sst:alpha        # Deploy to alpha stage
bun sst:prod         # Deploy to production
```

This template provides a modern, type-safe, full-stack foundation for building web applications with excellent developer experience and production-ready architecture.