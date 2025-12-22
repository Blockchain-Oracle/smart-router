# Tool Behaviors Reference

This reference provides **behavioral rule patterns** for CLAUDE.md. Use your intelligence to match tools to user needs - no hardcoded mappings.

## Core Principle

You are an intelligent AI. When running `/smart-router:init`:

1. **Read the registry** - It has descriptions for every tool
2. **Understand what the user is building** - From their description
3. **Match tools to needs** - Based on your understanding, not category lookups

## Fundamentals (Universal)

These are useful for ANY developer. Always include if available:

### Documentation & Research
```markdown
When you don't understand something, encounter an unfamiliar library, or need API documentation:
1. FIRST: Use `[doc-tool]` to search library documentation
2. THEN: Use web search for additional context
YOU MUST do this before guessing. Never assume - always verify.
```

### Memory & Context
```markdown
When context from past sessions would help:
- Search past conversations with `[memory-tool]`
- Reference previous architectural decisions before making new ones
- Store important learnings for future sessions
```

## Behavioral Rule Patterns

Use these patterns when writing rules. Replace `[tool]` with actual tool names from the registry:

### Visual Validation Pattern
```markdown
When making visual/UI changes:
- After changes: Use `[browser-tool]` to take a screenshot and verify
- For responsiveness: Test different viewport sizes
- For debugging: Read browser console
```

### Code Quality Pattern
```markdown
Before completing significant work:
- Use `[review-tool]` to review your changes
- Address issues before marking complete
```

### Testing Pattern
```markdown
When implementing new features:
- Use `[test-tool]` to write tests
- Validate all tests pass before completing
```

### Design/Architecture Pattern
```markdown
When making architectural decisions:
- Use `[architect-tool]` to explore existing patterns
- Follow established conventions in the codebase
```

## Writing Effective Rules

### Good Rules (Behavioral Triggers)
- "When you don't understand a library, FIRST use X to look up docs"
- "After making visual changes, take a screenshot with X to verify"
- "Before completing work, use X to review changes"

### Bad Rules (Just Listing Tools)
- "You have access to X for documentation"
- "Available tools: X, Y, Z"
- "X is installed"

### Why Behavioral Rules Work
The "When X, use Y" pattern creates automatic triggers:
- Claude remembers to use tools at the right time
- Tools get used proactively, not just when explicitly asked
- Workflow becomes natural and consistent

## Quick Reference Table Format

Include at the end of CLAUDE.md:

```markdown
## Quick Reference

| When You Need | Use This |
|---------------|----------|
| Library docs | `[actual-tool-name]` |
| Past conversations | `[actual-tool-name]` |
| Visual verification | `[actual-tool-name]` |
| Code review | `[actual-tool-name]` |
```

Only include rows for tools that are actually installed and relevant.

## Important Notes

1. **Trust your intelligence** - You can figure out which tools are relevant based on descriptions
2. **No hardcoded mappings** - Don't look up "capability: frontend" → specific tools. Read descriptions.
3. **Only installed tools** - Never include a tool that isn't in the registry
4. **Keep it concise** - ~200 lines max. Focus on the most relevant tools.
5. **Real tool names** - Use exact names like `context7`, `@agent episodic-memory:search-conversations`
