# Solo Unicorn Feature Flows

This directory contains comprehensive documentation of all Solo Unicorn features, covering both user experience flows and system implementation details.

## Purpose

Each feature flow document provides:
- **UX Flow**: How users interact with the feature (step-by-step user journey)
- **System Flow**: Backend processes, database changes, and WebSocket events
- **Sequence Diagrams**: Mermaid diagrams for complex interactions between components
- **Wireframes**: ASCII diagrams when needed for UI clarity

AI agents should pro-actively modify or create documents in this directory when updates are made.

## Structure

Each feature document follows this format:
1. **Overview**: Brief description and purpose
2. **UX Flow**: User interaction steps with UI states
3. **System Flow**: Technical implementation details
4. **Data Models**: Relevant database tables and relationships
5. **API Endpoints**: Related backend routes
6. **WebSocket Events**: Real-time communication patterns
7. **Sequence Diagrams**: Visual flow representations

## Feature Flows Index

We will index, organize, present oneliner introduction for each of the feature flow document.

### Core Platform Features
- [**Authentication & User Management**](./authentication.md) - OAuth login, sessions, user profile
- [**Project Management**](./project-management.md) - Create, configure, and manage projects with memory
- [**Repo Agent Management**](./repo-agents.md) - Setup and configure coding agents for repositories

### Task Management System
- [**Task Lifecycle**](./task-lifecycle.md) - Complete flow from creation through AI execution
- [**Kanban Board**](./kanban-board.md) - 3-column board with drag & drop and real-time updates
- [**Task Management**](./task-management.md) - CRUD operations, priorities, attachments, and ready states
- [**Actor Management**](./actors.md) - Agent personalities and methodologies

### AI Integration
- [**AI Agent Orchestration**](./ai-orchestration.md) - Automatic task pickup and execution coordination
- [**MCP Server Integration**](./mcp-integration.md) - Model Context Protocol for agent communication
- [**Real-time Features**](./realtime-features.md) - WebSocket updates and AI activity indicators

### Supporting Features
- [**File Attachment System**](./attachments.md) - Upload, preview, and storage of task attachments

## Navigation Tips

- Each document is self-contained but references related features
- Sequence diagrams use Mermaid syntax for interactive viewing
- System flows include database schema references for technical understanding
- UX flows focus on user mental models and interaction patterns

## Contributing

When adding new features:
1. Create a new `.md` file following the established format
2. Add entry to this index with one-line description
3. Include both UX and system perspectives
4. Use Mermaid for complex sequence diagrams
5. Reference relevant code files with line numbers when helpful
