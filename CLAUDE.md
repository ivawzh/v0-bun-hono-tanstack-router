# Solo Unicorn - Claude Code Instructions

This document provides context and instructions for Claude Code when working on the Solo Unicorn project.

## Project Overview

Solo Unicorn is a comprehensive project management system designed for solo developers and small teams. It integrates with Claude Code to enable AI-assisted development workflows.

## Core Documentation

Please review the following documents for detailed requirements and design specifications:

### Requirements
See [requirements.md](./docs/requirements.md) for complete functional and technical requirements.

### UI/UX Design
See [uiux-design.md](./docs/uiux-design.md) for detailed user interface and experience specifications.

## Key Development Guidelines

1. **Code Style**: Follow existing patterns in the codebase
2. **Testing**: Run tests before committing changes
3. **Documentation**: Update relevant documentation when making significant changes
4. **Security**: Never commit sensitive data or credentials

## Quick Commands

- Development server: `bun run dev` (in apps/server or apps/web)
- Database migrations: `bun run db:push` (in apps/server)
- Run tests: `bun test`

## Integration Points

- **WebSocket Server**: Port 8500 at `/ws/agent`
- **Claude Code UI**: Port 8888
- **Web Application**: Port 8302
- **API Server**: Port 8500

## Environment Variables

Required environment variables are documented in `.env.example` files in each application directory.