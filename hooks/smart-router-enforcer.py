#!/usr/bin/env python3
"""
Smart Router Early Reminder Hook
=================================

This UserPromptSubmit hook reminds Claude to check Smart Router BEFORE
making tool decisions. It fires early when you submit task-related prompts.

Hook Event: UserPromptSubmit
Action: Inject reminder into context (training mode)

Input: JSON via stdin with user's prompt
Output: Reminder text added to Claude's context

Installation: Automatically configured by /smart-router:configure
"""

import json
import sys
import os
from pathlib import Path

# Task-related keywords that should trigger Smart Router check
TASK_KEYWORDS = [
    # Development tasks
    'test', 'testing', 'brainstorm', 'review', 'debug', 'build', 'design',
    'implement', 'create', 'develop', 'code', 'refactor', 'fix',
    # Analysis tasks
    'analyze', 'check', 'verify', 'validate', 'investigate', 'explore',
    # Planning tasks
    'plan', 'architect', 'structure', 'organize',
    # Game dev specific
    'game', 'unity', 'unreal', 'godot',
    # Tool requests
    'help me', 'need to', 'want to', 'how do i', 'show me',
]


def load_registry():
    """Load the Smart Router agent registry if it exists."""
    try:
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        registry_path = Path(project_dir) / '.claude' / '.cache' / 'agent-registry.json'

        if registry_path.exists():
            with open(registry_path, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return None


def load_settings():
    """Load Smart Router settings if they exist."""
    try:
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        settings_path = Path(project_dir) / '.claude' / 'smart-router.local.md'

        if settings_path.exists():
            with open(settings_path, 'r') as f:
                content = f.read()
                # Parse YAML frontmatter (simplified)
                if content.startswith('---'):
                    parts = content.split('---', 2)
                    if len(parts) >= 3:
                        return parts[1].strip()
    except Exception:
        pass
    return None


def is_task_prompt(prompt):
    """Check if prompt contains task-related keywords."""
    prompt_lower = prompt.lower()
    return any(keyword in prompt_lower for keyword in TASK_KEYWORDS)


def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # UserPromptSubmit hook receives the user's prompt
        user_prompt = input_data.get('prompt', '')

        if not user_prompt:
            sys.exit(0)  # No prompt, exit silently

        # Check if this is a task-related prompt
        if not is_task_prompt(user_prompt):
            sys.exit(0)  # Not a task, exit silently (no spam!)

        # Check if registry exists
        registry = load_registry()
        if not registry:
            sys.exit(0)  # No registry = Smart Router not set up

        # Build the early reminder message
        capabilities = registry.get('capabilities', {})
        total_tools = sum(len(tools) for tools in capabilities.values())
        total_caps = len(capabilities)

        # Output plain text that gets added to Claude's context
        reminder = f"""
🎯 **Smart Router Early Reminder**

Before I start working on this task, let me check Smart Router first.

**Why check Smart Router:**
- Registry has {total_caps} capabilities and {total_tools} tools available
- I might not know about all your installed tools
- Smart Router can show me the best options for this task

**I should:**
1. Use the 'smart-router' skill to see available tools
2. Let it rank options based on context and your preferences
3. Then proceed with the best tool

Let me check Smart Router first...
"""

        # For UserPromptSubmit, output goes to stdout and is added to context
        print(reminder.strip())
        sys.exit(0)

    except Exception as e:
        # On any error, exit silently
        # Don't break Claude's workflow due to hook errors
        sys.exit(0)


if __name__ == '__main__':
    main()
