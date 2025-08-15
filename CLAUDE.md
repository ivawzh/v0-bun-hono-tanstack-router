# Solo Unicorn - Claude Code Instructions

This document provides context and instructions for Claude Code when working on the Solo Unicorn project.

## Project Overview

@docs/overview.md

Solo Unicorn is a comprehensive project management system designed for solo developers and small teams. It integrates with Claude Code to enable AI-assisted development workflows.

## UI/UX Design

@docs/uiux-design.md

## Key Development Guidelines

1. **Code Style**: Follow existing patterns in the codebase
2. **Testing**: Run tests before committing changes
3. **Documentation**: Update relevant documentation when making significant changes
4. **Security**: Never commit sensitive data or credentials

## General Engineering Guidelines

### Code Splitting (Hard Limits)

- **Files**: ~300 lines maximum
- **Action**: Proactively suggest refactoring when approaching these limits

### Package Management Philosophy

- **Prefer native solutions** over third-party libraries when possible
- Only suggest external dependencies if they provide significant value

## Communication Style

- Be direct and actionable in suggestions
- Explain the "why" behind recommendations
- Act as a knowledgeable owner, not just an assistant
- Proactively address potential UX issues
- Keep explanations concise but thorough

## Quick Commands

- Development server: `bun dev` (in apps/server or apps/web). However, I manually keep `bun dev` running in the background. So that please don't run it from your side.
- Database migrations: `bun run db:push` (in apps/server). Migrations are automatically applied when the any migration file is changed. So don't run it from your side.
- Run type checks: `bun typecheck`

## Integration Points

- **WebSocket Server**: Port 8500 at `/ws/agent`
- **Claude Code UI**: UI Port 8303, Server Port 8501
- **Web Application**: Port 8302
- **API Server**: Port 8500

## Environment Variables

Required environment variables are documented in `.env.example` files in each application directory.
