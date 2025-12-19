#!/usr/bin/env python3
"""
Smart Router Early Reminder Hook
=================================

This UserPromptSubmit hook reminds Claude to check Smart Router BEFORE
making tool decisions. It fires early when you submit task-related prompts.

Hook Event: UserPromptSubmit
Input: JSON via stdin with 'user_prompt' field
Output: Reminder text printed to stdout (added to Claude's context)

Installation: Automatically configured by /smart-router:configure
"""

import json
import sys
import os
from pathlib import Path

# Task-related keyword PHRASES that should trigger Smart Router check
# Using multi-word phrases to reduce false positives (avoid matching "code", "help me", etc. alone)
TASK_TRIGGERS = [
    # Development task phrases (more specific than single words)
    'write tests', 'run tests', 'add tests', 'generate tests',
    'code review', 'review code', 'review this code', 'review my code',
    'debug this', 'fix this bug', 'fix the error', 'troubleshoot',
    'build the', 'build this', 'implement this', 'implement a',
    'create a new', 'develop a', 'refactor this', 'refactor the',
    # Analysis task phrases
    'analyze this', 'analyze the', 'check this', 'verify this',
    'validate the', 'investigate this', 'explore the',
    # Planning task phrases
    'plan the', 'architect this', 'design the', 'structure the',
    # Game dev specific (more specific)
    'game development', 'unity project', 'unreal engine', 'godot project',
    # Brainstorming (specific phrases)
    'brainstorm', 'think through', 'help me design', 'help me plan',
]

# Single words that only trigger when appearing as clear task indicators
TASK_KEYWORDS_STRICT = [
    'brainstorm', 'troubleshoot', 'refactor', 'debug',
]


def load_registry():
    """Load the Smart Router agent registry if it exists.

    Returns:
        dict | None: Parsed registry JSON, or None if not found or invalid.
    """
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
    registry_path = Path(project_dir) / '.claude' / '.cache' / 'agent-registry.json'

    if not registry_path.exists():
        return None

    try:
        with open(registry_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Smart Router: Registry corrupted: {e}", file=sys.stderr)
        return None
    except PermissionError as e:
        print(f"Smart Router: Cannot read registry (permission denied): {e}", file=sys.stderr)
        return None
    except IOError as e:
        print(f"Smart Router: Cannot read registry: {e}", file=sys.stderr)
        return None


def load_settings():
    """Load Smart Router settings if they exist.

    Returns:
        str | None: YAML frontmatter content, or None if not found or invalid.
    """
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
    settings_path = Path(project_dir) / '.claude' / 'smart-router.local.md'

    if not settings_path.exists():
        return None

    try:
        with open(settings_path, 'r') as f:
            content = f.read()
            # Parse YAML frontmatter (simplified)
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    return parts[1].strip()
    except PermissionError as e:
        print(f"Smart Router: Cannot read settings (permission denied): {e}", file=sys.stderr)
    except IOError as e:
        print(f"Smart Router: Cannot read settings: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Smart Router: Error loading settings: {e}", file=sys.stderr)

    return None


def is_task_prompt(prompt):
    """Check if prompt contains task-related phrases or keywords.

    Uses multi-word phrases to reduce false positives.
    Single words only match if they're in the strict keyword list.

    Args:
        prompt: The user's input prompt

    Returns:
        bool: True if this appears to be a task-related prompt
    """
    prompt_lower = prompt.lower()

    # Check multi-word phrases first (more reliable)
    for phrase in TASK_TRIGGERS:
        if phrase in prompt_lower:
            return True

    # Check strict single-word keywords
    # These are words that almost always indicate a task
    words = prompt_lower.split()
    for keyword in TASK_KEYWORDS_STRICT:
        if keyword in words:
            return True

    return False


def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # UserPromptSubmit hook uses 'user_prompt' field (not 'prompt')
        user_prompt = input_data.get('user_prompt', '')

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

        print(reminder.strip())
        sys.exit(0)

    except json.JSONDecodeError as e:
        # Invalid JSON input - log and exit cleanly
        print(f"Smart Router: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(0)
    except KeyboardInterrupt:
        # User interrupted - exit cleanly
        sys.exit(0)
    except Exception as e:
        # Unexpected error - log prominently but don't break Claude's workflow
        print(f"Smart Router hook error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(0)


if __name__ == '__main__':
    main()
