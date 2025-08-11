import { test, expect } from '@playwright/test';

const AGENT_AUTH_TOKEN = 'test-agent-token';
const API_BASE = 'http://localhost:8500';

test.describe('Agent Gateway', () => {
  test('should reject requests without auth token', async ({ request }) => {
    const response = await request.post(`${API_BASE}/agent/register`, {
      data: {
        agentId: 'test-agent',
        capabilities: ['code', 'test']
      }
    });
    
    expect(response.status()).toBe(401);
  });

  test('should register agent with valid token', async ({ request }) => {
    const response = await request.post(`${API_BASE}/agent/register`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        agentId: 'test-agent',
        name: 'Test Agent',
        capabilities: ['code', 'test'],
        runtime: 'node'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('sessionId');
  });

  test('should claim a task', async ({ request }) => {
    // First register the agent
    const registerResponse = await request.post(`${API_BASE}/agent/register`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        agentId: 'test-agent-claim',
        name: 'Test Agent Claim',
        capabilities: ['code']
      }
    });
    
    const { sessionId } = await registerResponse.json();
    
    // Claim a task
    const claimResponse = await request.post(`${API_BASE}/agent/tasks/claim`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        sessionId,
        filters: {
          stage: 'dev',
          status: 'todo'
        }
      }
    });
    
    if (claimResponse.ok()) {
      const task = await claimResponse.json();
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('description');
    } else {
      // No tasks available is also valid
      expect(claimResponse.status()).toBe(404);
    }
  });

  test('should report task progress', async ({ request }) => {
    // Register agent
    const registerResponse = await request.post(`${API_BASE}/agent/register`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        agentId: 'test-agent-progress',
        name: 'Test Agent Progress'
      }
    });
    
    const { sessionId } = await registerResponse.json();
    
    // Report progress
    const progressResponse = await request.post(`${API_BASE}/agent/sessions/${sessionId}/progress`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        taskId: 'test-task-id',
        progress: 50,
        message: 'Halfway through implementation',
        artifacts: [
          {
            type: 'code',
            path: 'src/test.ts',
            content: 'console.log("test");'
          }
        ]
      }
    });
    
    expect(progressResponse.ok()).toBeTruthy();
  });

  test('should complete a task', async ({ request }) => {
    // Register agent
    const registerResponse = await request.post(`${API_BASE}/agent/register`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        agentId: 'test-agent-complete',
        name: 'Test Agent Complete'
      }
    });
    
    const { sessionId } = await registerResponse.json();
    
    // Complete task
    const completeResponse = await request.post(`${API_BASE}/agent/sessions/${sessionId}/complete`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        taskId: 'test-task-id',
        result: 'Task completed successfully',
        artifacts: [
          {
            type: 'code',
            path: 'src/feature.ts',
            content: 'export function feature() { return true; }'
          },
          {
            type: 'test',
            path: 'src/feature.test.ts',
            content: 'test("feature", () => { expect(feature()).toBe(true); });'
          }
        ]
      }
    });
    
    expect(completeResponse.ok()).toBeTruthy();
  });

  test('should handle agent questions', async ({ request }) => {
    // Register agent
    const registerResponse = await request.post(`${API_BASE}/agent/register`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        agentId: 'test-agent-question',
        name: 'Test Agent Question'
      }
    });
    
    const { sessionId } = await registerResponse.json();
    
    // Ask a question
    const questionResponse = await request.post(`${API_BASE}/agent/sessions/${sessionId}/question`, {
      headers: {
        'Authorization': `Bearer ${AGENT_AUTH_TOKEN}`
      },
      data: {
        taskId: 'test-task-id',
        question: 'Should I use TypeScript or JavaScript for this feature?',
        context: {
          currentFile: 'src/index.ts'
        }
      }
    });
    
    expect(questionResponse.ok()).toBeTruthy();
    const data = await questionResponse.json();
    expect(data).toHaveProperty('questionId');
  });
});