#!/bin/bash

# Claude Code Hook: Task Pickup
# This hook is called when Claude Code picks up a task from Solo Unicorn
# It receives task information via environment variables

# Task information from Solo Unicorn
TASK_ID="${TASK_ID}"
TASK_TITLE="${TASK_TITLE}"
TASK_DESCRIPTION="${TASK_DESCRIPTION}"
PROJECT_NAME="${PROJECT_NAME}"
LOCAL_REPO_PATH="${LOCAL_REPO_PATH}"

# Log the task pickup
echo "🦄 Solo Unicorn Task Pickup Hook"
echo "================================"
echo "Task ID: ${TASK_ID}"
echo "Task: ${TASK_TITLE}"
echo "Project: ${PROJECT_NAME}"
echo "Repository: ${LOCAL_REPO_PATH}"
echo ""

# Change to the repository directory
if [ -n "${LOCAL_REPO_PATH}" ] && [ -d "${LOCAL_REPO_PATH}" ]; then
    cd "${LOCAL_REPO_PATH}"
    echo "Changed to repository: $(pwd)"
    
    # Create a feature branch for the task
    BRANCH_NAME="task/${TASK_ID}"
    git checkout -b "${BRANCH_NAME}" 2>/dev/null || git checkout "${BRANCH_NAME}"
    echo "Working on branch: ${BRANCH_NAME}"
    
    # Create a task context file for Claude
    CONTEXT_FILE=".claude/task-context.md"
    mkdir -p .claude
    cat > "${CONTEXT_FILE}" << EOF
# Current Task

## Task ID: ${TASK_ID}
## Title: ${TASK_TITLE}

### Description
${TASK_DESCRIPTION}

### Project
${PROJECT_NAME}

### Instructions
- Work on this task in the current branch: ${BRANCH_NAME}
- Make incremental commits as you progress
- Update task status when complete

### Task picked up at: $(date)
EOF
    
    echo "Task context saved to: ${CONTEXT_FILE}"
else
    echo "Warning: Repository path not found or not specified"
fi

echo ""
echo "Task pickup hook completed successfully"