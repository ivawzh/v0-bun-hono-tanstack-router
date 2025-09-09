# Solo Unicorn API Documentation

## Overview

This document provides comprehensive documentation for the Solo Unicorn API, covering both public discovery endpoints and authenticated endpoints for project and mission management. The API follows REST conventions with proper error handling, authentication via Monster Auth, and real-time updates via Monster Realtime.

**Note**: This API integrates with several external Monster services that are hosted in separate repositories:
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

## API Endpoints

### Public Discovery Endpoints

These endpoints are accessible without authentication and provide discovery features for public projects.

#### List Public Projects
```
GET /api/v1/public/projects
```

**Description**: Browse public projects with filtering and pagination.

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `category` (string, optional): Filter by category
- `sort` (string, optional): Sort order (`popular`, `recent`, `stars`, `alphabetical`)
- `search` (string, optional): Search term for project name/description

**Response**:
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "E-commerce Starter Kit",
      "description": "Complete e-commerce solution with React frontend...",
      "slug": "ecommerce-starter-kit",
      "category": "web-development",
      "tags": ["react", "stripe", "ecommerce"],
      "starCount": 142,
      "missionCount": 25,
      "completedMissionCount": 23,
      "workstationCount": 2,
      "lastActiveAt": "2024-01-15T14:30:00Z",
      "owner": {
        "username": "ecommerce_expert",
        "avatar": "https://example.com/avatar.jpg"
      },
      "publicUrl": "https://solounicorn.lol/projects/ecommerce-starter-kit"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 95,
    "itemsPerPage": 20
  }
}
```

#### Search Public Projects
```
GET /api/v1/public/projects/search
```

**Description**: Full-text search across public projects.

**Query Parameters**:
- `q` (string, required): Search query
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "results": [
    {
      "id": "proj_123",
      "name": "E-commerce Starter Kit",
      "description": "Complete e-commerce solution with React frontend...",
      "slug": "ecommerce-starter-kit",
      "category": "web-development",
      "tags": ["react", "stripe", "ecommerce"],
      "starCount": 142,
      "missionCount": 25,
      "completedMissionCount": 23,
      "workstationCount": 2,
      "lastActiveAt": "2024-01-15T14:30:00Z",
      "owner": {
        "username": "ecommerce_expert",
        "avatar": "https://example.com/avatar.jpg"
      },
      "publicUrl": "https://solounicorn.lol/projects/ecommerce-starter-kit",
      "relevanceScore": 0.95
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 42,
    "itemsPerPage": 20
  }
}
```

#### Get Public Project Details
```
GET /api/v1/public/projects/{slug}
```

**Description**: Get detailed information about a specific public project.

**Path Parameters**:
- `slug` (string, required): Project slug

**Response**:
```json
{
  "id": "proj_123",
  "name": "E-commerce Starter Kit",
  "description": "Complete e-commerce solution with React frontend, Node.js backend...",
  "slug": "ecommerce-starter-kit",
  "visibility": "public",
  "category": "web-development",
  "tags": ["react", "stripe", "ecommerce", "nodejs", "postgresql"],
  "featured": true,
  "starCount": 142,
  "missionCount": 25,
  "completedMissionCount": 23,
  "progressPercentage": 92,
  "workstationCount": 2,
  "workstationVisibility": "status_only",
  "lastActiveAt": "2024-01-15T14:30:00Z",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z",
  "owner": {
    "username": "ecommerce_expert",
    "avatar": "https://example.com/avatar.jpg"
  },
  "publicUrl": "https://solounicorn.lol/projects/ecommerce-starter-kit",
  "memory": "# E-commerce Starter Kit

This project provides a complete...",
  "repository": {
    "name": "ecommerce-starter-kit",
    "fullName": "ecommerce-expert/ecommerce-starter-kit",
    "url": "https://github.com/ecommerce-expert/ecommerce-starter-kit",
    "stars": 89,
    "forks": 23
  },
  "permissions": {
    "canReadMissions": true,
    "canWriteMissions": false,
    "canReadWorkstations": false,
    "canExecuteMissions": false,
    "canReadMemory": true,
    "canReadRepository": true
  }
}
```

#### List Public Missions for Project
```
GET /api/v1/public/projects/{slug}/missions
```

**Description**: Get missions for a public project (permission-aware).

**Path Parameters**:
- `slug` (string, required): Project slug

**Query Parameters**:
- `status` (string, optional): Filter by mission status (`completed`, `active`)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "missions": [
    {
      "id": "mission_123",
      "title": "Implement user authentication",
      "description": "Create login page with email/password validation...",
      "priority": 5,
      "list": "done",
      "stage": "code",
      "createdAt": "2024-01-10T09:15:00Z",
      "updatedAt": "2024-01-10T14:30:00Z",
      "completedAt": "2024-01-10T14:30:00Z",
      "githubPr": {
        "number": 23,
        "url": "https://github.com/ecommerce-expert/ecommerce-starter-kit/pull/23",
        "status": "merged"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalItems": 23,
    "itemsPerPage": 20
  }
}
```

#### List Project Categories
```
GET /api/v1/public/categories
```

**Description**: List all project categories with project counts.

**Response**:
```json
{
  "categories": [
    {
      "name": "web-development",
      "displayName": "Web Development",
      "projectCount": 124,
      "featured": true
    },
    {
      "name": "mobile-app",
      "displayName": "Mobile App",
      "projectCount": 87,
      "featured": true
    },
    {
      "name": "ai-ml",
      "displayName": "AI/ML",
      "projectCount": 63,
      "featured": false
    }
  ]
}
```

#### Get Featured Projects
```
GET /api/v1/public/featured
```

**Description**: Get curated list of featured projects.

**Response**:
```json
{
  "featuredProjects": [
    {
      "id": "proj_123",
      "name": "E-commerce Starter Kit",
      "description": "Complete e-commerce solution with React frontend...",
      "slug": "ecommerce-starter-kit",
      "category": "web-development",
      "tags": ["react", "stripe", "ecommerce"],
      "starCount": 142,
      "missionCount": 25,
      "completedMissionCount": 23,
      "workstationCount": 2,
      "lastActiveAt": "2024-01-15T14:30:00Z",
      "owner": {
        "username": "ecommerce_expert",
        "avatar": "https://example.com/avatar.jpg"
      },
      "publicUrl": "https://solounicorn.lol/projects/ecommerce-starter-kit"
    }
  ]
}
```

### Authenticated Endpoints

These endpoints require authentication via Monster Auth tokens.

#### Project Management

##### List User Projects
```
GET /api/v1/projects
```

**Description**: List all projects accessible to the authenticated user.

**Query Parameters**:
- `organizationId` (string, optional): Filter by organization
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "My App",
      "description": "E-commerce application with AI features",
      "slug": "my-app",
      "visibility": "private",
      "organizationId": "org_456",
      "missionCount": 15,
      "workstationCount": 2,
      "status": "active",
      "createdAt": "2023-12-01T10:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 3,
    "itemsPerPage": 20
  }
}
```

##### Create Project
```
POST /api/v1/projects
```

**Description**: Create a new project.

**Authentication**: Required via Monster Auth JWT token

**Request Body**:
```json
{
  "name": "My New Project",
  "description": "Description of my new project",
  "organizationId": "org_456",
  "visibility": "private"
}
```

**Response**:
```json
{
  "id": "proj_789",
  "name": "My New Project",
  "description": "Description of my new project",
  "slug": "my-new-project",
  "visibility": "private",
  "organizationId": "org_456",
  "missionCount": 0,
  "workstationCount": 0,
  "status": "active",
  "createdAt": "2024-01-15T15:00:00Z",
  "updatedAt": "2024-01-15T15:00:00Z"
}
```

##### Get Project Details
```
GET /api/v1/projects/{id}
```

**Description**: Get detailed information about a specific project.

**Path Parameters**:
- `id` (string, required): Project ID

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "id": "proj_123",
  "name": "My App",
  "description": "E-commerce application with AI features",
  "slug": "my-app",
  "visibility": "private",
  "organizationId": "org_456",
  "memory": "# Project Memory

Tech stack and project context...",
  "defaultFlowId": "flow_456",
  "defaultActorId": "actor_789",
  "prModeDefault": "disabled",
  "prRequireReview": true,
  "prAutoMerge": false,
  "prDeleteBranchAfterMerge": true,
  "workstationVisibility": "hidden",
  "missionCount": 15,
  "workstationCount": 2,
  "status": "active",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

##### Update Project
```
PATCH /api/v1/projects/{id}
```

**Description**: Update project details.

**Path Parameters**:
- `id` (string, required): Project ID

**Authentication**: Required via Monster Auth JWT token

**Request Body**:
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "visibility": "public",
  "memory": "Updated project memory"
}
```

**Response**:
```json
{
  "id": "proj_123",
  "name": "Updated Project Name",
  "description": "Updated description",
  "slug": "my-app",
  "visibility": "public",
  "organizationId": "org_456",
  "memory": "Updated project memory",
  "defaultFlowId": "flow_456",
  "defaultActorId": "actor_789",
  "prModeDefault": "disabled",
  "prRequireReview": true,
  "prAutoMerge": false,
  "prDeleteBranchAfterMerge": true,
  "workstationVisibility": "hidden",
  "missionCount": 15,
  "workstationCount": 2,
  "status": "active",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2024-01-15T15:30:00Z"
}
```

##### Archive Project
```
DELETE /api/v1/projects/{id}
```

**Description**: Archive a project (soft delete).

**Path Parameters**:
- `id` (string, required): Project ID

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "id": "proj_123",
  "name": "My App",
  "description": "E-commerce application with AI features",
  "slug": "my-app",
  "visibility": "private",
  "organizationId": "org_456",
  "memory": "# Project Memory

Tech stack and project context...",
  "defaultFlowId": "flow_456",
  "defaultActorId": "actor_789",
  "prModeDefault": "disabled",
  "prRequireReview": true,
  "prAutoMerge": false,
  "prDeleteBranchAfterMerge": true,
  "workstationVisibility": "hidden",
  "missionCount": 15,
  "workstationCount": 2,
  "status": "archived",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2024-01-15T15:30:00Z",
  "archivedAt": "2024-01-15T15:30:00Z"
}
```

#### Mission Management

##### List Project Missions
```
GET /api/v1/projects/{projectId}/missions
```

**Description**: List all missions for a project.

**Path Parameters**:
- `projectId` (string, required): Project ID

**Query Parameters**:
- `list` (string, optional): Filter by list (`todo`, `doing`, `review`, `done`, `loop`)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "missions": [
    {
      "id": "mission_123",
      "projectId": "proj_456",
      "title": "Implement user authentication",
      "description": "Create login page with email/password validation...",
      "spec": "Structured specification for authentication system...",
      "priority": 5,
      "list": "todo",
      "listOrder": 1000.00000,
      "stage": "clarify",
      "flowId": "flow_789",
      "repositoryId": 123456789,
      "targetBranch": "main",
      "actorId": "actor_123",
      "prMode": "auto",
      "isLoop": false,
      "ready": false,
      "agentSessionStatus": "INACTIVE",
      "solution": "",
      "tasks": [],
      "tasksCurrent": 0,
      "dependencyCount": 0,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 8,
    "itemsPerPage": 20
  }
}
```

##### Create Mission
```
POST /api/v1/projects/{projectId}/missions
```

**Description**: Create a new mission.

**Path Parameters**:
- `projectId` (string, required): Project ID

**Authentication**: Required via Monster Auth JWT token

**Request Body**:
```json
{
  "title": "Implement user authentication",
  "description": "Create login page with email/password validation",
  "priority": 5,
  "list": "todo",
  "repositoryId": 123456789,
  "targetBranch": "main",
  "flowId": "flow_789",
  "actorId": "actor_123",
  "prMode": "auto"
}
```

**Response**:
```json
{
  "id": "mission_123",
  "projectId": "proj_456",
  "title": "Implement user authentication",
  "description": "Create login page with email/password validation",
  "spec": "",
  "priority": 5,
  "list": "todo",
  "listOrder": 1000.00000,
  "stage": "clarify",
  "flowId": "flow_789",
  "repositoryId": 123456789,
  "targetBranch": "main",
  "actorId": "actor_123",
  "prMode": "auto",
  "isLoop": false,
  "ready": false,
  "agentSessionStatus": "INACTIVE",
  "solution": "",
  "tasks": [],
  "tasksCurrent": 0,
  "dependencyCount": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

##### Get Mission Details
```
GET /api/v1/missions/{id}
```

**Description**: Get detailed information about a specific mission.

**Path Parameters**:
- `id` (string, required): Mission ID

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "id": "mission_123",
  "projectId": "proj_456",
  "title": "Implement user authentication",
  "description": "Create login page with email/password validation...",
  "spec": "Structured specification for authentication system...",
  "priority": 5,
  "list": "todo",
  "listOrder": 1000.00000,
  "stage": "clarify",
  "flowId": "flow_789",
  "currentFlowTask": 0,
  "requiresReview": false,
  "repositoryId": 123456789,
  "targetBranch": "main",
  "actorId": "actor_123",
  "prMode": "auto",
  "prCreated": false,
  "githubPrNumber": null,
  "githubPrUrl": null,
  "prBranchName": null,
  "prMergeStrategy": "squash",
  "isLoop": false,
  "loopSchedule": null,
  "ready": false,
  "agentSessionStatus": "INACTIVE",
  "agentSessionStatusChangedAt": "2024-01-15T10:30:00Z",
  "codeAgentType": null,
  "codeAgentName": null,
  "lastCodeAgentSessionId": null,
  "solution": "OAuth + JWT tokens...",
  "tasks": [
    {
      "title": "Set up OAuth provider integration"
    },
    {
      "title": "Create JWT token generation/validation"
    }
  ],
  "tasksCurrent": 0,
  "reviewStatus": null,
  "reviewFeedback": null,
  "reviewRequestedAt": null,
  "reviewCompletedAt": null,
  "reviewedByUserId": null,
  "dependencyCount": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T14:45:00Z"
}
```

##### Update Mission
```
PATCH /api/v1/missions/{id}
```

**Description**: Update mission details.

**Path Parameters**:
- `id` (string, required): Mission ID

**Authentication**: Required via Monster Auth JWT token

**Request Body**:
```json
{
  "title": "Updated mission title",
  "description": "Updated mission description",
  "priority": 4,
  "list": "doing"
}
```

**Response**:
```json
{
  "id": "mission_123",
  "projectId": "proj_456",
  "title": "Updated mission title",
  "description": "Updated mission description",
  "spec": "Structured specification for authentication system...",
  "priority": 4,
  "list": "doing",
  "listOrder": 1000.00000,
  "stage": "clarify",
  "flowId": "flow_789",
  "currentFlowTask": 0,
  "requiresReview": false,
  "repositoryId": 123456789,
  "targetBranch": "main",
  "actorId": "actor_123",
  "prMode": "auto",
  "prCreated": false,
  "githubPrNumber": null,
  "githubPrUrl": null,
  "prBranchName": null,
  "prMergeStrategy": "squash",
  "isLoop": false,
  "loopSchedule": null,
  "ready": false,
  "agentSessionStatus": "INACTIVE",
  "agentSessionStatusChangedAt": "2024-01-15T10:30:00Z",
  "codeAgentType": null,
  "codeAgentName": null,
  "lastCodeAgentSessionId": null,
  "solution": "OAuth + JWT tokens...",
  "tasks": [
    {
      "title": "Set up OAuth provider integration"
    },
    {
      "title": "Create JWT token generation/validation"
    }
  ],
  "tasksCurrent": 0,
  "reviewStatus": null,
  "reviewFeedback": null,
  "reviewRequestedAt": null,
  "reviewCompletedAt": null,
  "reviewedByUserId": null,
  "dependencyCount": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T15:00:00Z"
}
```

##### Delete Mission
```
DELETE /api/v1/missions/{id}
```

**Description**: Delete a mission.

**Path Parameters**:
- `id` (string, required): Mission ID

**Authentication**: Required via Monster Auth JWT token

**Response**:
```json
{
  "success": true,
  "message": "Mission deleted successfully"
}
```

##### Reject Mission
```
POST /api/v1/missions/{id}/reject
```

**Description**: Reject a mission with feedback (moves to previous stage).

**Path Parameters**:
- `id` (string, required): Mission ID

**Authentication**: Required via Monster Auth JWT token

**Request Body**:
```json
{
  "feedback": "Please add input validation for the email field"
}
```

**Response**:
```json
{
  "id": "mission_123",
  "projectId": "proj_456",
  "title": "Implement user authentication",
  "description": "Create login page with email/password validation...",
  "spec": "Structured specification for authentication system...",
  "priority": 5,
  "list": "todo",
  "listOrder": 1000.00000,
  "stage": "clarify",
  "flowId": "flow_789",
  "currentFlowTask": 0,
  "requiresReview": false,
  "repositoryId": 123456789,
  "targetBranch": "main",
  "actorId": "actor_123",
  "prMode": "auto",
  "prCreated": false,
  "githubPrNumber": null,
  "githubPrUrl": null,
  "prBranchName": null,
  "prMergeStrategy": "squash",
  "isLoop": false,
  "loopSchedule": null,
  "ready": false,
  "agentSessionStatus": "INACTIVE",
  "agentSessionStatusChangedAt": "2024-01-15T10:30:00Z",
  "codeAgentType": null,
  "codeAgentName": null,
  "lastCodeAgentSessionId": null,
  "solution": "OAuth + JWT tokens...",
  "tasks": [
    {
      "title": "Set up OAuth provider integration"
    },
    {
      "title": "Create JWT token generation/validation"
    }
  ],
  "tasksCurrent": 0,
  "reviewStatus": "rejected",
  "reviewFeedback": "Please add input validation for the email field",
  "reviewRequestedAt": "2024-01-15T15:30:00Z",
  "reviewCompletedAt": "2024-01-15T15:30:00Z",
  "reviewedByUserId": "user_456",
  "dependencyCount": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T15:30:00Z"
}
```

## Authentication

### Token-Based Authentication

All authenticated endpoints require a valid Monster Auth token. Tokens can be provided in two ways:

1. **Web Applications**: Via HTTP-only cookies set during OAuth flow with Monster Auth
2. **API Clients**: Via `Authorization: Bearer {token}` header with Monster Auth JWT tokens

### Token Refresh

Tokens have a limited lifetime and will expire. Clients should implement automatic token refresh:

1. Monitor token expiration times
2. Use refresh tokens to obtain new access tokens via Monster Auth
3. Handle Monster Realtime signals for immediate token refresh
4. Refresh token rotation when provided by Monster Auth

## Error Handling

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource successfully created
- `204 No Content`: Successful request with no response body
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication via Monster Auth
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `422 Unprocessable Entity`: Valid request but semantic errors
- `429 Too Many Requests`: Rate limiting exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Temporary service outage

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "name",
      "message": "Name is required"
    }
  }
}
```

## Rate Limiting

### Limits

- **Anonymous Users**: 100 requests/hour per IP
- **Authenticated Users**: 1,000 requests/hour per user
- **Contributors+**: 5,000 requests/hour for project contributors
- **Burst Limits**: Allow short bursts for legitimate usage patterns

### Headers

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Total requests allowed in window
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when window resets

## Versioning

### URL Versioning

API endpoints are versioned using URL prefixes:

```
/api/v1/projects
```

### Deprecation Policy

- Minimum 6 months notice before removing deprecated endpoints
- Clear migration path documentation
- Warning headers on deprecated endpoints

## CORS Configuration

### Allowed Origins

- Public discovery endpoints: Allow requests from any origin
- Authenticated endpoints: Restrict to known origins

### Credentials

- Support authenticated requests with credentials when appropriate
- Proper OPTIONS request handling for complex requests

## Caching

### CDN Integration

- Cache public project data at edge locations via Cloudflare
- Support ETag and If-Modified-Since headers
- Intelligent cache busting when projects are updated
- Proper Vary headers for permission-aware responses

## Security

### Authentication & Authorization

- **Identity Provider**: Monster Auth (OAuth 2.0/OpenID Connect)
- **Token Storage**: HTTP-only cookies for web, OS keychain for CLI
- **Session Management**: JWT with refresh token rotation via Monster Auth
- **Authorization**: Role-based access control (RBAC) implemented in application layer
- **Multi-Tenancy**: Organization-based isolation

### Data Protection

- **Encryption**: TLS in transit, encryption at rest for sensitive data
- **Secrets Management**: OS keychain integration, environment variables
- **Input Validation**: Strict validation on all API inputs
- **SQL Injection**: Parameterized queries via Drizzle ORM
- **XSS Prevention**: Sanitization of user-generated content

### API Security

- **Rate Limiting**: Per-endpoint and per-user rate limits
- **CORS**: Proper configuration for web app and third-party access
- **Authentication**: Required for all protected endpoints via Monster Auth
- **Authorization**: Checked at application layer for all operations
- **Audit Logging**: Comprehensive logging of security-relevant events

## Pagination

### Standard Pagination

All list endpoints support pagination with the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default varies by endpoint, max: 100)

### Pagination Response

```json
{
  "items": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 95,
    "itemsPerPage": 20
  }
}
```

## Filtering and Sorting

### Standard Filters

Most list endpoints support filtering with query parameters:

- Field-specific filters (e.g., `status=active`)
- Range filters (e.g., `createdAfter=2024-01-01`)
- Boolean filters (e.g., `featured=true`)

### Sorting

Endpoints that support sorting use the `sort` query parameter:

- Ascending: `sort=fieldName`
- Descending: `sort=-fieldName`
- Multiple fields: `sort=field1,-field2`

## WebSockets

### Real-Time Updates

WebSocket connections are available for real-time updates via Monster Realtime:

- **Endpoint**: `/ws/v1` via Monster Realtime service
- **Authentication**: JWT token in connection parameters via Monster Auth
- **Channels**: 
  - `workstation:{id}` - Direct workstation communication
  - `project:{id}:workstations` - Project-wide workstation updates
  - `mission:{id}` - Mission-specific coordination

### Message Format

```json
{
  "type": "mission:update",
  "payload": {
    "missionId": "mission_123",
    "status": "doing"
  }
}
```

## Integration with External Services

### Monster Auth Integration (External Service)

Monster Auth is an external authentication service that provides OAuth 2.0/OpenID Connect authentication for Solo Unicorn. It is hosted in a separate repository and must be integrated according to its documentation.

#### Authentication Flow
1. **Web Auth (default)**:
   - Start local HTTP server on a random ephemeral port (auto-selected; no user configuration in MVP)
   - Open browser to `https://auth.monstermake.limited/authorize?client_id=solo-unicorn-cli&redirect_uri=http://localhost:{port}&response_type=code`
   - User completes Monster Auth OAuth flow
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens via Monster Auth
   - Store tokens in OS keychain

2. **Personal Access Token**:
   - Validate token format (pat_xxxxx)
   - Exchange token for workstation credentials via Monster Auth
   - Store credentials securely

3. **Organization API Key**:
   - Validate token format (org_key_xxxxx)
   - Organization-level service account authentication via Monster Auth
   - Ideal for automated deployments and CI/CD

#### Token Management
- **JWT Validation**: Verify token signatures and claims via Monster Auth
- **Refresh Logic**: Automatic token refresh before expiration via Monster Auth
- **Revocation**: Clean token cleanup on logout
- **Scope Validation**: Ensure minimum required permissions via Monster Auth

### Monster Realtime Integration (External Service)

Monster Realtime is an external WebSocket gateway that enables real-time communication for Solo Unicorn. It is hosted in a separate repository and must be integrated according to its documentation.

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

Monster Upload is an external file upload service that provides GitHub-style drag-and-drop file upload experience with S3 backend storage. It is hosted in a separate repository and must be integrated according to its documentation.

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

## Examples

### JavaScript Client Example

```javascript
// Get public projects
async function getPublicProjects() {
  const response = await fetch('/api/v1/public/projects');
  const data = await response.json();
  return data.projects;
}

// Create a new project
async function createProject(projectData) {
  const response = await fetch('/api/v1/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}` // Monster Auth token
    },
    body: JSON.stringify(projectData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to create project');
  }
  
  return await response.json();
}

// WebSocket connection for real-time updates via Monster Realtime
function connectToRealtime(workstationId) {
  // Connect to Monster Realtime service
  const socket = new WebSocket(`wss://realtime.monstermake.limited/ws/v1?token=${getToken()}`);
  
  socket.onopen = () => {
    // Join workstation channel
    socket.send(JSON.stringify({
      type: 'channel:join',
      channel: `workstation:${workstationId}`
    }));
  };
  
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    // Handle real-time updates
    handleRealtimeUpdate(message);
  };
}
```

### Python Client Example

```python
import requests
import websocket
import json

class SoloUnicornClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',  # Monster Auth token
            'Content-Type': 'application/json'
        }
    
    def get_public_projects(self):
        response = requests.get(f'{self.base_url}/api/v1/public/projects')
        response.raise_for_status()
        return response.json()
    
    def create_project(self, project_data):
        response = requests.post(
            f'{self.base_url}/api/v1/projects',
            headers=self.headers,
            json=project_data
        )
        response.raise_for_status()
        return response.json()

# Usage
client = SoloUnicornClient('https://api.solounicorn.lol', 'your_monster_auth_token_here')
projects = client.get_public_projects()
```

## Conclusion

This API documentation provides a comprehensive reference for integrating with Solo Unicorn. The API is designed with REST principles, proper error handling, security measures, and performance considerations in mind. Public discovery endpoints allow anyone to browse projects, while authenticated endpoints provide full project and mission management capabilities.

The API integrates with external Monster services (Auth, Realtime, Upload) to provide enterprise-grade authentication, real-time communication, and file storage capabilities while allowing Solo Unicorn to focus on its core mission orchestration functionality.