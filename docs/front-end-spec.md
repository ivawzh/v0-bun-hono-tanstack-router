# Solo Unicorn Front-End Specification

## Overview

This document outlines the UI/UX specification for Solo Unicorn, an AI-centric platform that orchestrates AI agents through Kanban flows. The platform enables both fast iteration (YOLO/direct push) and controlled development (PR mode) workflows, with public project discovery and community collaboration features.

**Note**: This project integrates with external Monster services that are hosted in separate repositories:
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

These services are isolated from Solo Unicorn and must be integrated according to their respective documentation.

## Personas

### 1. Solo Developer
- **Characteristics**: Works alone on personal projects, values speed and simplicity
- **Goals**: Rapidly prototype ideas, leverage AI for implementation, manage projects efficiently
- **Tech Savviness**: High - comfortable with development tools and workflows
- **Primary Use Cases**:
  - Creating missions for AI agents to implement
  - Managing personal projects with Kanban boards
  - Using Direct Push mode for fast iteration

### 2. Small Team Lead
- **Characteristics**: Leads small development teams (2-10 people), responsible for project delivery
- **Goals**: Coordinate team efforts, ensure code quality, balance speed with control
- **Tech Savviness**: High - experienced in team development and project management
- **Primary Use Cases**:
  - Setting up projects with PR mode for code review workflows
  - Managing team members and permissions
  - Overseeing mission progress and quality

### 3. Open Source Contributor
- **Characteristics**: Contributes to public projects, interested in learning and collaboration
- **Goals**: Find interesting projects to contribute to, learn from others, build reputation
- **Tech Savviness**: Medium to High - varies by individual experience
- **Primary Use Cases**:
  - Discovering public projects
  - Requesting access to contribute
  - Creating missions within public projects

### 4. Project Maintainer
- **Characteristics**: Maintains public/open source projects, manages community contributions
- **Goals**: Grow project community, ensure quality contributions, manage project roadmap
- **Tech Savviness**: High - experienced in open source maintenance
- **Primary Use Cases**:
  - Managing project visibility and permissions
  - Reviewing community contributions
  - Curating project templates

## User Flows

### 1. Authentication Flow
1. User visits Solo Unicorn platform
2. User clicks "Sign In" button
3. User is redirected to Monster Auth for authentication
4. User selects authentication method (Google OAuth, email/password)
5. User completes authentication
6. User is redirected back to Solo Unicorn
7. User is presented with organization/project dashboard

### 2. Project Creation Flow
1. User clicks "Create New Project" from dashboard
2. User enters project details (name, description)
3. User selects or registers workstation
4. User links GitHub repositories
5. User configures initial settings (visibility, default flow, etc.)
6. User creates sample "Welcome" mission (optional)
7. User is taken to project Kanban board

### 3. Mission Creation Flow
1. User clicks "Create Mission" button on Kanban board
2. User fills in mission details (title, description, attachments)
3. User selects priority, repository, workstation, agent, and actor
4. User selects flow template and configures stages
5. User adds dependencies (optional)
6. Mission appears in Todo column of Kanban board
7. User marks mission as ready for AI processing

### 4. Mission Execution Flow
1. System identifies ready mission for assignment
2. System matches mission to available workstation and agent
3. System assigns mission to workstation via Monster Realtime
4. Workstation agent begins mission execution
5. Mission status updates in real-time on Kanban board
6. Mission progresses through flow stages (Clarify → Plan → Code)
7. Mission moves to Review column when ready for human review (if configured)
8. Human reviewer approves or rejects mission
9. Approved missions move to Done column
10. Rejected missions return to Doing column for iteration

### 5. Public Project Discovery Flow
1. User visits public project gallery
2. User browses projects by category or uses search
3. User views project details and mission progress
4. User clicks "Request Access" to contribute
5. User fills in contribution request form
6. Project owner reviews and approves request
7. User gains appropriate permissions to contribute

### 6. PR Mode Workflow
1. User creates mission with PR mode enabled
2. AI agent executes mission in feature branch
3. System creates GitHub PR when mission moves to Review
4. Human reviewer examines PR on GitHub
5. Reviewer approves or requests changes on GitHub
6. If approved, PR is merged and mission moves to Done
7. If changes requested, user rejects mission in Solo Unicorn with feedback
8. System instructs AI agent to read GitHub PR comments via `gh` and iterate
9. Process repeats until PR is approved and merged

## Information Architecture

### Main Navigation
- **Dashboard**: Organization overview with projects and workstations
- **Projects**: List of projects with quick access
- **Public Gallery**: Browse public projects
- **Community**: User's community involvement (contributing, starred projects)
- **Settings**: User and organization settings

### Project-Level Navigation
- **Kanban Board**: Mission management interface
- **Project Settings**: Configuration and management
- **Workstations**: Workstation status and management
- **Members**: Team management
- **Repositories**: Linked repository management
- **Flows**: Custom flow templates
- **Actors**: AI agent personas

### Public Project Navigation
- **Overview**: Project description and key metrics
- **Missions**: Permission-aware mission browsing
- **Contributors**: Community members and activity
- **Analytics**: Project statistics and engagement metrics
- **Contribute**: Access request and contribution tools

## UI Components

### Core Components

#### 1. Kanban Board
- **Layout**: Four columns (Todo, Doing, Review, Done)
- **Todo Column**: Split sections for Normal/Loop missions
- **Mobile Support**: Horizontal scrolling with snap points
- **Interactions**: Drag-and-drop mission reordering
- **Real-time Updates**: WebSocket-powered live updates via Monster Realtime

#### 2. Mission Cards
- **Visual Hierarchy**: Clear priority indicators (emoji+number format)
- **Status Badges**: Stage badges (Clarify, Plan, Code) and process indicators
- **PR Integration**: PR status badges and links when in PR mode
- **Quick Actions**: Dropdown menu for View/Edit, Reset, Delete

#### 3. Mission Modal
- **Tabbed Interface**: Base, Flow, Clarify, Plan, Review, Dependencies, Settings
- **Context-Aware**: Tabs and content adapt based on mission state
- **Rich Editing**: File attachments with drag-and-drop upload
- **Real-time Status**: Live mission status and progress indicators

#### 4. Project Creation Wizard
- **Step-by-Step**: Three-step process (Project Details, Workstation Setup, Repository Configuration)
- **Validation**: Real-time validation with clear error messaging
- **Smart Defaults**: Pre-filled options when only one choice exists

#### 5. Organization Dashboard
- **Project Overview**: Visual project cards with mission counts and workstation status
- **Workstation Management**: Status indicators and quick actions
- **Team Members**: Member list with roles and activity indicators

### Public Components

#### 1. Public Project Gallery
- **Search & Filter**: Category browsing, tag filtering, full-text search
- **Project Cards**: Visual previews with key metrics (stars, progress, activity)
- **Sorting Options**: Popularity, recent activity, stars, creation date

#### 2. Public Project View
- **Permission-Aware**: UI adapts based on user's access level
- **Project Overview**: Description, tags, repository links, progress visualization
- **Mission Browser**: Read-only Kanban view for public missions
- **Contribution Flow**: Access request system with role selection

#### 3. Community Dashboard
- **Personal Activity**: User's contributions, starred projects, template usage
- **Quick Access**: Favorite projects and recent activity
- **Community Stats**: Impact metrics (missions contributed, stars received)

## Design System

See full theme at [Monster Theme](/monster-wiki/theme/monster-theme.md).

### Dark/Light Mode
- **Theme Switching**: User-controlled toggle in header
- **System Preference**: Respects OS-level theme preference by default
- **Consistent Styling**: All components adapt to both color schemes

## Accessibility

### WCAG AA Compliance
- **Color Contrast**: Minimum 4.5:1 contrast ratio for text
- **Keyboard Navigation**: Full keyboard operability for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Visible focus indicators for interactive elements

### Inclusive Design
- **Text Scaling**: Support for user-defined text scaling
- **Motion Reduction**: Reduced motion options for animations
- **Alternative Text**: Descriptive alt text for all informative images

## Mobile-First Design

### Responsive Breakpoints
- **Mobile**: Up to 768px
- **Tablet**: 769px to 1024px
- **Desktop**: 1025px and above

### Mobile Optimizations
- **Touch Targets**: Minimum 44px touch targets for interactive elements
- **Horizontal Scrolling**: Kanban board with snap points
- **Full-Screen Modals**: Mission creation and editing optimized for small screens
- **Thumb-Friendly**: Key actions positioned for easy thumb reach

## Performance Considerations

### Loading States
- **Skeleton Screens**: For content loading
- **Progress Indicators**: For long-running operations
- **Optimistic Updates**: For immediate UI feedback

### Offline Capabilities
- **Service Worker**: Basic offline support for critical assets
- **Local Storage**: Cache important UI state
- **Network Awareness**: Visual indicators for connectivity status

## Technical Implementation

### Framework & Libraries
- **React 19**: Core UI framework
- **TanStack Router**: Client-side routing
- **TanStack Query**: Server state management
- **shadcn/ui**: Component library with Tailwind CSS
- **Tailwind CSS**: Utility-first styling approach
- **Framer Motion**: Animation library for smooth transitions
- **React Hook Form**: Form validation and management

### State Management
- **Component State**: useState and useReducer for local component state
- **Server State**: TanStack Query for API data management
- **Global State**: Context API for application-level state
- **Real-Time State**: WebSocket connection state via Monster Realtime

### Data Fetching
- **oRPC**: Internal API communication
- **REST API**: External integrations
- **WebSocket**: Real-time updates via Monster Realtime
- **File Uploads**: Direct uploads via Monster Upload service

### Authentication Integration
- **Monster Auth**: OAuth 2.0/OpenID Connect integration
- **Token Management**: HTTP-only cookies for web app
- **Session Handling**: Automatic token refresh via Monster Auth
- **User Context**: Global authentication state management

### Real-Time Communication
- **Monster Realtime**: WebSocket connection for live updates
- **Presence Tracking**: Workstation status and availability
- **Mission Updates**: Real-time mission status changes
- **Collaboration**: Multi-user presence indicators

## PWA Features

### Installation
- **Install Prompt**: Browser install prompt for desktop and mobile
- **Manifest File**: Proper web app manifest for home screen installation
- **App Icons**: Multiple sizes for various devices

### Offline Support
- **Caching Strategy**: Cache-first for static assets, network-first for API
- **Offline Indicators**: Visual feedback when offline
- **Queued Actions**: Local queuing of actions to sync when online

### Push Notifications
- **Mission Updates**: Real-time notifications for mission status changes
- **Review Requests**: Notifications for pending reviews
- **Community Activity**: Updates on starred projects and contributions

## Security Considerations

### Client-Side Security
- **Input Sanitization**: Sanitize user-generated content before display
- **XSS Prevention**: Proper escaping of dynamic content
- **CSRF Protection**: Anti-CSRF tokens for state-changing operations
- **Secure Storage**: Use secure storage for sensitive data

### Authentication Integration
- **Token Management**: Secure handling of authentication tokens via Monster Auth
- **Session Management**: Proper session handling and timeouts
- **Permission Checking**: Client-side permission validation with server-side enforcement
- **Role-Based Access**: Conditional rendering based on user roles

### Data Protection
- **Encryption**: TLS in transit for all communications
- **Sensitive Data**: Avoid storing sensitive data in client-side storage
- **File Uploads**: Secure file upload handling via Monster Upload
- **Privacy**: Respect user privacy and data protection regulations

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

### Real-Time Testing
- **WebSocket Integration**: Test Monster Realtime connection and message handling
- **Presence Updates**: Verify workstation status updates
- **Collaboration Features**: Test multi-user scenarios
- **Error Handling**: Test connection failures and reconnection logic

## Monitoring and Analytics

### Client-Side Monitoring
- **Error Tracking**: Automatic error reporting and grouping
- **Performance Monitoring**: Track key performance metrics
- **User Analytics**: Understand user behavior and engagement
- **Real User Monitoring**: Monitor actual user experience

### Analytics Implementation
- **Event Tracking**: Track key user actions and flows
- **Conversion Tracking**: Measure successful completion of key workflows
- **Performance Metrics**: Monitor page load times and interaction responsiveness
- **Feature Usage**: Track adoption of new features

## Integration with External Services

### Monster Auth Integration (External Service)

#### Authentication Flow
1. **Web Authentication**:
   - Redirect user to Monster Auth OAuth endpoint
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens via Monster Auth
   - Store tokens in secure HTTP-only cookies

2. **CLI Authentication**:
   - Start local HTTP server on ephemeral port
   - Open browser to Monster Auth authorization URL
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens via Monster Auth
   - Store tokens in OS keychain

#### Token Management
- **JWT Validation**: Verify token signatures and claims via Monster Auth
- **Refresh Logic**: Automatic token refresh before expiration via Monster Auth
- **Revocation**: Clean token cleanup on logout
- **Scope Validation**: Ensure minimum required permissions via Monster Auth

### Monster Realtime Integration (External Service)

#### WebSocket Connection
- **Protocol**: WSS with automatic reconnection via Monster Realtime
- **Authentication**: JWT token in connection parameters via Monster Auth
- **Channel Structure** (managed by Monster Realtime):
  - `workstation:{id}` - Direct workstation communication
  - `project:{id}:workstations` - Project-wide workstation updates
  - `mission:{id}` - Mission-specific coordination

#### Presence System
- **Status Updates**: Periodic presence broadcasts via Monster Realtime
- **Metadata**: Workstation status, agent availability, active projects via Monster Realtime
- **Member Keys**: Unique identifiers for presence tracking via Monster Realtime
- **Channel Routing**: Efficient message delivery to relevant parties via Monster Realtime

### Monster Upload Integration (External Service)

#### File Management
- **Upload Flow**:
  - Request upload URL from Solo Unicorn API
  - API requests signed upload URL from Monster Upload service
  - Client uploads directly to Monster Upload via signed URL
  - Monster Upload notifies Solo Unicorn of successful upload
  - Solo Unicorn stores file metadata in database

#### Security
- **Signed URLs**: Temporary signed URLs for direct uploads to Monster Upload
- **Access Control**: File access controlled by Solo Unicorn permissions
- **Content Validation**: MIME type and size validation
- **Malware Scanning**: Integration with Monster Upload malware scanning (if enabled)

## Future Considerations

### Enhanced Collaboration
- **Real-time Co-editing**: Simultaneous mission editing
- **Presence Indicators**: Show when others are viewing/working on missions
- **Commenting System**: Inline comments on missions and code

### Advanced Analytics
- **Developer Insights**: Personal productivity metrics
- **Project Analytics**: Team performance and velocity tracking
- **AI Performance**: Agent effectiveness and iteration metrics

### Extended Customization
- **Custom Themes**: User-defined color schemes
- **Layout Customization**: Adjustable Kanban board layouts
- **Workflow Templates**: Community-shared flow templates

## Conclusion

This frontend specification provides a comprehensive blueprint for implementing Solo Unicorn's web application with a focus on usability, performance, and security. The specification emphasizes the integration with external Monster services (Auth, Realtime, Upload) while maintaining a modern, accessible, and responsive user interface that delivers on the product vision.