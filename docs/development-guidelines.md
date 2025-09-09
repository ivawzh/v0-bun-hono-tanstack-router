# Solo Unicorn Development Guidelines

## Overview

This document outlines the development guidelines and best practices for the Solo Unicorn project. It covers coding standards, architectural principles, security practices, and other important considerations for maintaining code quality and consistency across the codebase.

**Note**: This project integrates with external Monster services that are hosted in separate repositories:
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

These services are isolated from Solo Unicorn and must be integrated according to their respective documentation.

## Coding Standards

### TypeScript Guidelines

#### Strict Typing
- Always enable strict typing in `tsconfig.json`
- Use explicit types rather than `any` or implicit inference
- Prefer interfaces over types for object shapes
- Use union types for finite sets of values (e.g., `'todo' | 'doing' | 'review' | 'done'`)
- Avoid type assertions (`as`) unless absolutely necessary
- Use Zod for runtime validation of API inputs

#### Functional Programming
- Prefer pure functions and immutable data structures
- Minimize side effects in functions
- Use `Array.prototype.map`, `filter`, `reduce` instead of loops
- Leverage pattern matching with `ts-pattern` for complex conditional logic
- Use functional composition for code reuse

#### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes, interfaces, and types
- Use UPPER_CASE for constants
- Use descriptive names that clearly indicate purpose
- Prefix boolean variables with `is`, `has`, or `should`
- Prefix asynchronous functions with `fetch` or `load`
- Use verb-noun naming for functions (e.g., `createMission`, `updateProject`)

#### Error Handling
- Always handle promise rejections with `.catch()` or `try/catch`
- Create custom error types for domain-specific errors
- Use discriminated unions for error handling
- Never silently swallow errors
- Provide meaningful error messages to users
- Log errors appropriately without exposing sensitive data
- Use proper ORPCError instances for API errors

#### Module Organization
- Group related functionality in modules
- Export only what is necessary
- Use barrel exports judiciously (prefer explicit imports)
- Prefer named exports over default exports
- Place exported functions at the top of files

### React Guidelines

#### Component Structure
- Use functional components with hooks
- Keep components small and focused
- Prefer composition over inheritance
- Use TypeScript for prop validation
- Extract custom hooks for reusable logic

#### State Management
- Use TanStack Query for server state
- Use React Context sparingly for global UI state
- Lift state up only when necessary for sharing between components
- Use `useReducer` for complex state transitions
- Prefer derived state over duplicated state

#### Performance Optimization
- Use `React.memo` for expensive components
- Use `useMemo` and `useCallback` judiciously
- Implement virtualization for large lists
- Code-split routes and heavy components
- Use proper dependency arrays in hooks

#### Hooks Best Practices
- Follow the rules of hooks (only call at top level, only in React functions)
- Custom hooks should start with `use`
- Keep hooks focused on single responsibility
- Handle cleanup in effects with return functions
- Use exhaustive deps in `useEffect`

### Database Guidelines

#### Schema Design
- Use ULIDs for primary keys (stored as VARCHAR(26))
- Normalize data to reduce duplication
- Index frequently queried columns
- Use foreign key constraints for referential integrity
- Use appropriate data types (TIMESTAMP for dates, BIGINT for GitHub IDs)
- Store GitHub numeric repository ID as canonical identifier

#### Query Optimization
- Use parameterized queries to prevent SQL injection
- Create composite indexes for multi-column queries
- Use `EXPLAIN` to analyze query performance
- Limit result sets with pagination
- Use database functions for complex calculations

#### Migration Practices
- Write migrations as forward-only changes
- Include rollback instructions in comments
- Test migrations in staging before production
- Backup database before running migrations
- Document breaking changes in migration files

### API Design

#### REST Principles
- Use nouns for resources, verbs for actions
- Use plural nouns for collections (e.g., `/missions`)
- Use HTTP status codes correctly
- Version APIs with URL prefix (`/api/v1/`)
- Use consistent naming conventions

#### oRPC Guidelines
- Group related procedures in namespaces
- Use clear, descriptive procedure names
- Validate inputs with Zod schemas
- Handle errors with proper ORPCError instances
- Document all procedures with JSDoc
- Use breaking changes freely for web-server interactions
- Maintain backward compatibility for external API integrations

#### Error Responses
- Use consistent error response format
- Include error codes for programmatic handling
- Provide user-friendly error messages
- Include details for debugging when appropriate
- Log errors appropriately without exposing sensitive data

## Architecture Principles

### Separation of Concerns
- Clearly separate business logic from presentation
- Isolate side effects in services
- Keep components focused on single responsibilities
- Use layers to separate concerns (presentation, business, data)

### Single Responsibility Principle
- Each module, class, or function should have one reason to change
- Extract complex logic into smaller, focused units
- Avoid God objects that know too much
- Keep functions short and focused

### Dependency Inversion
- Depend on abstractions, not concretions
- Use dependency injection for loose coupling
- Define interfaces for external dependencies
- Avoid circular dependencies

### Composition Over Inheritance
- Favor composition for code reuse
- Use higher-order functions for cross-cutting concerns
- Prefer functional mixins over class hierarchies
- Extract shared logic into utilities

## Security Practices

### Authentication & Authorization
- Never store passwords in plain text
- Use JWT tokens with proper expiration via Monster Auth
- Validate all inputs to prevent injection attacks
- Implement proper CSRF protection
- Use secure HTTP headers
- Implement rate limiting for authentication endpoints
- Integrate with Monster Auth for OAuth 2.0/OpenID Connect
- Store sensitive tokens in OS keychain (CLI) or HTTP-only cookies (web)

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Sanitize user inputs before displaying
- Implement proper CORS policies
- Use parameterized queries to prevent SQL injection
- Apply principle of least privilege for database access
- Use Monster Auth tokens for all protected API endpoints

### Input Validation
- Validate all user inputs on both client and server
- Use Zod schemas for type-safe validation
- Sanitize user-generated content
- Implement proper file upload validation via Monster Upload
- Use Content Security Policy headers
- Escape output when rendering user content

### Error Handling Security
- Never expose stack traces to users
- Log security-relevant events
- Implement proper error masking
- Avoid information disclosure in error messages
- Use generic error messages for unauthorized access

## Testing Guidelines

### Test Structure
- Follow AAA pattern (Arrange, Act, Assert)
- Use descriptive test names that explain behavior
- Keep tests focused and isolated
- Use beforeEach/afterEach for setup/teardown
- Mock external dependencies including Monster Auth and Monster Realtime

### Test Types
- Unit tests for pure functions and components
- Integration tests for service interactions
- End-to-end tests for critical user flows
- Snapshot tests for UI components (sparingly)
- Performance tests for critical paths
- Security tests for authentication flows

### Test Coverage
- Aim for 80%+ code coverage for critical paths
- Focus on testing behavior rather than implementation
- Test edge cases and error conditions
- Use property-based testing for complex logic
- Regularly review and update tests

## Performance Optimization

### Frontend Performance
- Lazy load non-critical resources
- Optimize images and assets
- Use efficient rendering techniques
- Minimize bundle size
- Implement proper caching strategies
- Use Web Workers for heavy computations

### Backend Performance
- Use connection pooling for database connections
- Implement proper database indexing
- Cache frequently accessed data
- Use streaming for large data transfers
- Optimize database queries
- Implement pagination for large result sets

### Monitoring & Observability
- Implement structured logging
- Use correlation IDs for request tracing
- Monitor key performance metrics
- Set up alerts for system anomalies
- Implement health check endpoints
- Use distributed tracing for complex flows

## Documentation Standards

### Code Documentation
- Use JSDoc for all exported functions and types
- Document complex logic with inline comments
- Keep documentation close to code
- Update documentation when changing code
- Use clear, concise language

### API Documentation
- Document all API endpoints
- Include example requests and responses
- Specify required authentication
- Document error responses
- Keep documentation in sync with implementation

### Architecture Documentation
- Document major architectural decisions
- Explain trade-offs and alternatives considered
- Keep architecture diagrams up to date
- Document system integrations with Monster services
- Record performance and scalability considerations

## Git Workflow

### Branching Strategy
- Use feature branches for development
- Merge to main through pull requests
- Delete branches after merging
- Use descriptive branch names (e.g., `feature/add-mission-creation`)
- Tag releases appropriately

### Commit Messages
- Use conventional commit format
- Write clear, concise subject lines
- Include body for complex changes
- Reference issue numbers when applicable
- Keep commits focused on single changes

### Pull Requests
- Review code before merging
- Include tests for new functionality
- Update documentation as needed
- Squash commits when appropriate
- Use descriptive PR titles and descriptions

## Deployment Practices

### Continuous Integration
- Run tests on every commit
- Perform static analysis and linting
- Build and test in isolated environments
- Automate security scans
- Fail builds on test failures

### Continuous Deployment
- Deploy to staging on every merge
- Use blue-green deployment for production
- Implement rollback procedures
- Monitor deployments for issues
- Automate rollback on failures

### Environment Management
- Use environment-specific configuration
- Never commit secrets to repository
- Use feature flags for gradual rollouts
- Implement proper environment isolation
- Document environment setup procedures

## Integration with External Services

### Monster Auth Integration
- **SDK Usage**: Use official Monster Auth SDK for authentication flows
- **Token Handling**: Properly handle JWT tokens and refresh logic via Monster Auth
- **Session Management**: Implement session management using Monster Auth capabilities
- **OAuth Flows**: Implement standard OAuth 2.0 flows with Monster Auth
- **Error Handling**: Handle authentication errors gracefully with user-friendly messages
- **Secure Storage**: Store tokens in HTTP-only cookies (web) or OS keychain (CLI)

### Monster Realtime Integration
- **WebSocket Connections**: Use Monster Realtime WebSocket connections for real-time communication
- **Channel Management**: Properly join and leave channels via Monster Realtime
- **Message Handling**: Implement proper message handling for real-time updates
- **Presence Tracking**: Use Monster Realtime presence features for workstation status
- **Reconnection Logic**: Implement proper reconnection logic with Monster Realtime
- **Error Handling**: Handle WebSocket errors gracefully with user-friendly messages

### Monster Upload Integration
- **File Uploads**: Use Monster Upload service for secure file uploads
- **Signed URLs**: Request signed URLs from Monster Upload for direct uploads
- **Metadata Management**: Store file metadata in Solo Unicorn database
- **Access Control**: Implement proper access control for uploaded files
- **Error Handling**: Handle upload errors gracefully with retry logic

### GitHub Integration
- **API Usage**: Use official GitHub API for repository operations
- **Webhook Handling**: Implement proper webhook validation and processing
- **PR Automation**: Use GitHub CLI (`gh`) for PR comment reading
- **Rate Limiting**: Respect GitHub API rate limits with proper backoff
- **Error Handling**: Handle GitHub API errors gracefully with user-friendly messages

## Accessibility

### WCAG Compliance
- Follow WCAG 2.1 AA guidelines
- Use semantic HTML elements
- Provide alternative text for images
- Ensure sufficient color contrast
- Implement keyboard navigation

### Screen Reader Support
- Use proper heading hierarchy
- Label form controls appropriately
- Provide ARIA attributes when needed
- Test with screen readers
- Implement skip navigation links

### Keyboard Navigation
- Ensure all interactive elements are keyboard accessible
- Provide visible focus indicators
- Implement logical tab order
- Support common keyboard shortcuts
- Test without mouse

## Internationalization

### Localization Support
- Externalize all user-facing strings
- Support multiple languages
- Consider text expansion in layouts
- Use proper date/time formatting
- Handle right-to-left languages

### Cultural Considerations
- Format numbers according to locale
- Respect cultural differences in design
- Consider religious and political sensitivities
- Support different calendar systems
- Handle regional variations appropriately

## Mobile-First Design

### Responsive Design
- Use mobile-first approach in CSS
- Implement proper media queries for different breakpoints
- Test on various device sizes
- Optimize touch targets for mobile interaction
- Implement horizontal scrolling for Kanban boards on mobile

### Performance on Mobile
- Optimize bundle size for mobile networks
- Implement proper caching strategies
- Use lazy loading for non-critical resources
- Optimize images for mobile devices
- Minimize network requests

## Error Handling and User Experience

### Error Messages
- Provide clear, actionable error messages
- Include recovery suggestions when possible
- Use appropriate error severity levels
- Log errors for debugging without exposing sensitive data
- Handle errors gracefully without crashing the application

### Progress Indicators
- Show loading states for asynchronous operations
- Use skeleton screens for content loading
- Implement proper progress bars for long operations
- Provide estimated completion times when possible
- Use optimistic updates for immediate UI feedback

## Monitoring and Observability

### Logging
- Use structured logging with consistent formats
- Include correlation IDs for request tracing
- Log important events at appropriate levels
- Avoid logging sensitive information
- Implement proper log rotation and retention

### Metrics
- Track key performance indicators
- Monitor system health and resource usage
- Implement custom metrics for business logic
- Use appropriate aggregation and sampling
- Set up alerts for critical metrics

### Tracing
- Implement distributed tracing for request flows
- Use correlation IDs to track requests across services
- Trace important operations and workflows
- Monitor latency and error rates
- Use tracing for debugging complex issues

## Conclusion

These guidelines are intended to ensure consistent, maintainable, and secure code across the Solo Unicorn project. They should be followed by all developers contributing to the project, with exceptions only when justified and documented.

Regular reviews of these guidelines should be conducted to ensure they remain relevant as the project evolves and new technologies emerge.

The guidelines emphasize integration with external Monster services (Auth, Realtime, Upload) which provide enterprise-grade authentication, real-time communication, and file storage capabilities. Developers should familiarize themselves with these services and follow their recommended integration patterns.

By following these guidelines, development teams can build a robust, scalable, and secure platform that delivers on the product vision while maintaining flexibility for future enhancements.