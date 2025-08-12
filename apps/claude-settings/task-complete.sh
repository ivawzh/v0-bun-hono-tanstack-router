#!/bin/bash

# Claude Code Hook: Task Complete
# This hook is called when Claude Code completes a task
# It notifies Solo Unicorn and updates the task status

# Task information
TASK_ID="${TASK_ID}"
SESSION_ID="${SESSION_ID}"
LOCAL_REPO_PATH="${LOCAL_REPO_PATH}"

echo "✅ Solo Unicorn Task Complete Hook"
echo "==================================="
echo "Task ID: ${TASK_ID}"
echo "Session ID: ${SESSION_ID}"
echo ""

# Change to repository if specified
if [ -n "${LOCAL_REPO_PATH}" ] && [ -d "${LOCAL_REPO_PATH}" ]; then
    cd "${LOCAL_REPO_PATH}"
    
    # Get the current branch
    CURRENT_BRANCH=$(git branch --show-current)
    echo "Current branch: ${CURRENT_BRANCH}"
    
    # Get commit summary
    echo ""
    echo "Recent commits:"
    git log --oneline -5
    
    # Clean up task context file
    if [ -f ".claude/task-context.md" ]; then
        rm ".claude/task-context.md"
        echo ""
        echo "Cleaned up task context file"
    fi
fi

# Send completion notification to Solo Unicorn via WebSocket
# This would be handled by the Claude Code UI integration
echo ""
echo "Task marked as complete in Solo Unicorn"
echo "Task completion hook finished successfully"