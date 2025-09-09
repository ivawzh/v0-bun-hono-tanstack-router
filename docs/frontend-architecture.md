# Solo Unicorn Frontend Architecture

## Overview

This document describes the frontend architecture for Solo Unicorn v3, focusing on the React web application with TanStack Router. The frontend implements a Kanban-based UI for orchestrating AI agents through mission flows, with support for both direct push and PR modes, and public project discovery.

## Architecture Principles

1. **Component-Driven Development**: Build UI from reusable, well-tested components
2. **State Management**: Use TanStack Query for server state, React Context for UI state
3. **Type Safety**: Full TypeScript implementation with strict typing
4. **Performance**: Optimized rendering with memoization and virtualization where needed
5. **Accessibility**: WCAG AA compliance with proper semantics and keyboard navigation
6. **Responsive Design**: Mobile-first approach with adaptive layouts
7. **Real-Time Updates**: WebSocket integration for live collaboration features

## Technology Stack

### Core Frameworks
- **React 19**: UI library with concurrent rendering features
- **TanStack Router**: Type-safe routing with nested layouts
- **TanStack Query**: Server state management with caching and prefetching
- **TypeScript**: Type safety with strict mode

### UI Components
- **shadcn/ui**: Accessible UI components built with Radix UI and Tailwind CSS
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Framer Motion**: Animation library for smooth transitions
- **React Hook Form**: Form validation and management

### Build Tools
- **Vite**: Fast build tool with Hot Module Replacement
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Code formatting standardization

## Folder Structure

```
apps/web/src/
├── components/           # Shared UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and services
├── modules/             # Feature modules
├── routes/              # Route components and configuration
├── styles/              # Global styles and themes
├── types/               # TypeScript type definitions
├── utils/               # Helper functions
├── main.tsx             # Application entry point
├── routeTree.gen.ts     # Generated route tree
└── index.css            # Global CSS imports
```

## Component Architecture

### UI Component Hierarchy

#### Root Components
- `App`: Top-level application component
- `Providers`: Context providers for authentication, theme, etc.
- `Router`: TanStack Router configuration

#### Layout Components
- `Header`: Global application header with navigation
- `Sidebar`: Project navigation and quick access
- `Footer`: Global footer (if needed)

#### Core Components
- `KanbanBoard`: Main Kanban board interface
- `MissionCard`: Individual mission display and interaction
- `MissionModal`: Mission creation and editing interface
- `ProjectDashboard`: Project overview and statistics
- `WorkstationStatus`: Workstation monitoring and management
- `PublicGallery`: Public project discovery interface

### Component Design Patterns

#### Atomic Design
Components are organized using atomic design principles:
- **Atoms**: Basic building blocks (buttons, inputs, badges)
- **Molecules**: Groups of atoms bonded together (form fields, card headers)
- **Organisms**: Groups of molecules forming distinct UI sections (kanban columns)
- **Templates**: Page-level layouts combining organisms
- **Pages**: Specific instances of templates with real content

#### Compound Components
For complex UI patterns, use compound components:
```tsx
<KanbanBoard>
  <KanbanBoard.Column id="todo">
    <KanbanBoard.Card mission={mission} />
  </KanbanBoard.Column>
</KanbanBoard>
```

#### Render Props and Children
Allow customization through render props and children:
```tsx
<MissionCard mission={mission}>
  {(props) => <CustomMissionActions {...props} />}
</MissionCard>
```

## State Management

### Server State (TanStack Query)
- **Caching**: Automatic caching with configurable stale times
- **Prefetching**: Load data before navigation for instant UI
- **Mutations**: Optimistic updates with automatic rollback on failure
- **Infinite Queries**: Pagination for large data sets
- **Query Invalidation**: Automatic refetching when dependent data changes

### UI State (React Context/Reducers)
- **Global UI State**: Theme, notifications, modals
- **Form State**: Complex form management with validation
- **Local Component State**: useState and useReducer for component-specific state

### Real-Time State
- **WebSocket Integration**: Live updates for mission status and collaboration
- **Presence Tracking**: Show active users and their current activities
- **Conflict Resolution**: Handle concurrent edits gracefully

## Routing (TanStack Router)

### Route Structure
```
├── /                       # Dashboard/landing page
├── /projects/
│   ├── /                   # Project list
│   ├── /:projectId/         # Project detail
│   │   ├── /               # Kanban board
│   │   ├── /settings       # Project settings
│   │   ├── /workstations   # Workstation management
│   │   └── /members        # Team management
│   └── /create             # Project creation wizard
├── /public/
│   ├── /                   # Public project gallery
│   ├── /:projectSlug/      # Public project detail
│   └── /categories/       # Category browsing
└── /profile/               # User profile and settings
```

### Route Features
- **Nested Routes**: Inherit layouts and data from parent routes
- **Route Matching**: Type-safe route parameters and search parameters
- **Preloading**: Prefetch data and components for instant navigation
- **Code Splitting**: Automatic code splitting by route

## Data Fetching

### API Integration
- **oRPC Client**: Internal API communication with type safety
- **REST Client**: External API integration with proper error handling
- **WebSocket Client**: Real-time communication for live updates

### Error Handling
- **Global Error Boundaries**: Catch and display unexpected errors
- **Query Error Handling**: Automatic retry with exponential backoff
- **User-Friendly Messages**: Clear error messages with recovery options
- **Offline Support**: Graceful degradation when offline

### Loading States
- **Skeleton Screens**: Content placeholders during loading
- **Progress Indicators**: Visual feedback for long-running operations
- **Optimistic Updates**: Immediate UI feedback with background sync

## Styling Architecture

### Tailwind CSS Configuration
- **Design Tokens**: Consistent spacing, colors, and typography
- **Component Variants**: Predefined style combinations for common patterns
- **Dark Mode**: Automatic dark/light theme switching
- **Responsive Breakpoints**: Mobile-first responsive design

### Theme System

See full theme at [Monster Theme](/monster-wiki/theme/monster-theme.md).

- **CSS Variables**: Runtime theme switching
- **Semantic Colors**: Meaningful color names instead of hex values
- **Typography Scale**: Consistent text sizing and hierarchy
- **Spacing System**: Modular spacing scale for consistent layouts

## Performance Optimization

### Rendering Optimization
- **Memoization**: React.memo for expensive components
- **Virtualization**: Windowing for large lists (mission cards)
- **Code Splitting**: Dynamic imports for route-based code splitting
- **Bundle Analysis**: Regular analysis to eliminate dead code

### Network Optimization
- **HTTP Caching**: Proper cache headers for static assets
- **Image Optimization**: Responsive images with multiple resolutions
- **Prefetching**: Load critical resources in advance
- **Compression**: Gzip/Brotli compression for all assets

### Bundle Size Management
- **Tree Shaking**: Eliminate unused code from bundles
- **Code Splitting**: Split bundles by feature and route
- **Dynamic Imports**: Load code on demand
- **Dependency Auditing**: Regular review of dependencies

## Accessibility Implementation

### Semantic HTML
- **Proper Element Usage**: Use correct HTML elements for content
- **ARIA Attributes**: Add accessibility information where needed
- **Keyboard Navigation**: Full keyboard operability
- **Focus Management**: Visible focus indicators and logical focus order

### Screen Reader Support
- **Landmark Regions**: Define page regions with ARIA landmarks
- **Live Regions**: Announce dynamic content changes
- **Label Association**: Properly associate form controls with labels
- **Alternative Text**: Descriptive alt text for images

### Keyboard Navigation
- **Skip Links**: Navigate directly to main content
- **Focus Trapping**: Contain focus within modals and dialogs
- **Keyboard Shortcuts**: Implement common keyboard shortcuts
- **Roving Tabindex**: Manage focus within composite widgets

## Internationalization

### Localization Strategy
- **String Externalization**: Extract all user-facing strings
- **Pluralization**: Handle plural forms in different languages
- **Date/Time Formatting**: Locale-aware date and time formatting
- **Number Formatting**: Locale-aware number and currency formatting

### RTL Support
- **Layout Mirroring**: Automatically mirror layouts for RTL languages
- **Text Direction**: Proper text direction handling
- **Component Adaptation**: Adapt components for RTL languages

## Testing Strategy

### Component Testing
- **Unit Tests**: Test individual components with Jest and React Testing Library
- **Integration Tests**: Test component interactions and workflows
- **Snapshot Tests**: Verify UI consistency (selectively)
- **Accessibility Tests**: Automated accessibility testing with axe-core

### End-to-End Testing
- **User Flows**: Test complete user journeys with Cypress or Playwright
- **Cross-Browser Testing**: Verify compatibility across browsers
- **Performance Testing**: Measure and optimize performance metrics
- **Accessibility Testing**: Manual accessibility audits

### Test Organization
```
apps/web/src/
├── __tests__/           # Unit and integration tests
├── __e2e__/             # End-to-end tests
├── __mocks__/           # Mock data and services
└── __snapshots__/       # Jest snapshots
```

## Security Considerations

### Client-Side Security
- **Input Sanitization**: Sanitize user-generated content before display
- **XSS Prevention**: Proper escaping of dynamic content
- **CSRF Protection**: Anti-CSRF tokens for state-changing operations
- **Secure Storage**: Use secure storage for sensitive data

### Authentication Integration
- **Token Management**: Secure handling of authentication tokens
- **Session Management**: Proper session handling and timeouts
- **Permission Checking**: Client-side permission validation with server-side enforcement
- **Role-Based Access**: Conditional rendering based on user roles

## Deployment Architecture

### Build Process
- **Vite Build**: Optimized production builds with code splitting
- **Asset Optimization**: Minification and compression of assets
- **Environment Variables**: Proper handling of environment-specific configuration
- **Static Analysis**: Linting and type checking in build pipeline

### Hosting Strategy
- **CDN Distribution**: Global distribution of static assets
- **Edge Caching**: Cache assets at edge locations
- **Compression**: Automatic compression of assets
- **HTTP/2**: Modern HTTP protocol for improved performance

### Monitoring and Analytics
- **Error Tracking**: Automatic error reporting and grouping
- **Performance Monitoring**: Track key performance metrics
- **User Analytics**: Understand user behavior and engagement
- **Real User Monitoring**: Monitor actual user experience

## Mobile Responsiveness

### Responsive Design Patterns
- **Mobile-First**: Design for mobile first, enhance for larger screens
- **Flexible Grids**: Use CSS Grid and Flexbox for flexible layouts
- **Media Queries**: Adapt layouts for different screen sizes
- **Touch Optimization**: Touch-friendly targets and interactions

### Mobile-Specific Features
- **Native Integration**: Progressive Web App features for app-like experience
- **Offline Support**: Work offline with service workers
- **Push Notifications**: Real-time notifications for mission updates
- **Device APIs**: Integration with device features when available

## Future Extensibility

### Plugin Architecture
- **UI Extensions**: Allow third-party UI components
- **Workflow Extensions**: Extend mission flows with custom stages
- **Integration Points**: Connect with external tools and services
- **Theme Extensions**: Custom themes and branding options

### API Evolution
- **Backward Compatibility**: Maintain compatibility with existing integrations
- **Versioning Strategy**: Clear versioning and deprecation policies
- **Extensibility Points**: Well-defined extension points in the API
- **Developer Experience**: Excellent documentation and SDKs

## Conclusion

This frontend architecture provides a solid foundation for implementing Solo Unicorn v3's web application. The component-driven approach with TanStack Router and Query ensures a maintainable, performant, and scalable application that meets all the requirements outlined in the PRD. The architecture emphasizes accessibility, internationalization, and security while maintaining excellent developer experience and user experience.
