# Commit Guidelines

When using the `/commit` command, follow these strict rules:

## ❌ NEVER DO:
- Do NOT add yourself as co-author
- Do NOT include "Co-Authored-By: Claude" or similar
- Do NOT commit files that start with "CLAUDE" (CLAUDE.md, etc.)
- Do NOT execute commit without explicit user authorization
- Do NOT use generated commit messages from Claude Code

## ✅ ALWAYS DO:
- Write commit messages in English only
- Use maximum one sentence for commit message
- Follow conventional commits format: `type: description`
- Ask for explicit confirmation before committing
- Check git status before committing

## Examples of Good Commits:
- `feat: add contract preview functionality`
- `fix: resolve PDF worker version mismatch`
- `refactor: update document upload system`
- `docs: update deployment guide`

## Process:
1. Show `git status` to user
2. Ask user for commit message
3. Wait for explicit "yes/proceed/commit" confirmation
4. Execute commit WITHOUT co-author tags
5. Confirm commit was successful

## Files to Exclude:
- CLAUDE.md
- Any file starting with "CLAUDE"
- Temporary files
- Build artifacts
- Node modules (already in .gitignore)