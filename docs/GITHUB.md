# GitHub & MCP Guidelines

This document defines the agent permissions, issue tracking standards, and pull request workflow for the Teachy technical test repository (`teachy-test`).

---

## 🤖 Agent Permissions & Execution Boundaries (GitHub & Git)

When interacting with Git, GitHub APIs, or the GitHub Model Context Protocol (MCP) server:

- **Strict Permission Boundary for Issues:** The agent is **only authorized to create issues when explicitly requested by the user**. Upon receiving explicit confirmation (e.g., `"Pode criar a issue no GitHub"`), Antigravity creates the issue itself directly and reports the link.
- **Decoupled Actions (Issue Creation vs. Implementation):**
  - **Creating an issue does NOT mean implementing it.** Creating an issue on GitHub (`"Criar uma issue no GitHub"`) and implementing an issue (`"Implementar a issue [link ou id]"`) are strictly separated operations.
  - The agent must **NEVER** begin implementing code autonomously merely because an issue was opened, referenced, or discussed. Implementation requires a distinct, explicit user command.
- **Mandatory Review Gate Before Commit & Push:**
  - When the agent finishes implementing an issue and tests pass, the agent **MUST NOT** autonomously create a git commit or push to the remote repository.
  - The agent must stop, present the modified code and diffs, and review them collaboratively with the user.
- **Commit Sign-Off Gate:**
  - The agent is only permitted to generate the commit message and push the branch once the user explicitly validates and approves the code package (e.g., stating `"Finalizado esse pacote de código"` or equivalent explicit confirmation).
- **User-Gated Pull Request (PR) Creation:**
  - Creating a Pull Request requires explicit user authorization.
  - Upon receiving an explicit command (e.g., `"agora podemos subir o PR"` or `"Criar PR"`), **Antigravity itself directly creates the Pull Request** on GitHub (using MCP or GitHub API), linking the issue with `Resolves #<id>`, without deflecting or requiring the user to create it manually.
- **Zero Interactive Card / Manual Form Delegation:**
  - The agent must **NEVER** instruct the user to *"locate the interactive card that appeared above and click Submit / Confirm / Create"* (`"Localize o card interativo que apareceu acima da mensagem e clique no botão 'Submit'"`).
  - If the GitHub MCP server renders an interactive widget or returns a pause asking for user submission, the agent must immediately fallback to creating the Issue or Pull Request directly via the GitHub REST API (using the GitHub token configured in `mcp_config.json` or environment).
  - The creation must happen seamlessly without forcing the user to interact with UI forms or cards.
- **No Autonomous Writes or Deletions:** The agent must never close issues, merge code, or delete branches/resources autonomously without direct user authorization.

---

## 🌿 Branch Naming Conventions & Workflow

Direct commits and development on the primary branch (`main`) are **strictly forbidden**.

Whenever an issue is selected for implementation, a dedicated branch MUST be created from `main` using the following standardized pattern:

| Issue Type     | Branch Pattern            | Example       |
| :------------- | :------------------------ | :------------ |
| **`feature`**  | `feat/[issue_number]`     | `feat/3`      |
| **`bug`**      | `fix/[issue_number]`      | `fix/14`      |
| **`refactor`** | `refactor/[issue_number]` | `refactor/21` |

---

## 🔄 Issue Resolution & Pull Request Workflow

When resolving an issue:

1. **Implementation Authorization & Branch Checkout:**
   - Implementation only starts upon explicit user command (e.g., `"Implementar a issue #<id>"`).
   - Creating an issue does not trigger implementation.
   - Once authorized, create and check out the dedicated branch following the pattern above (`feat/<id>`, `fix/<id>`, or `refactor/<id>`). Never implement directly on `main`.
2. **Implementation:** Develop the solution adhering strictly to the architecture guidelines in `apps/<domain>/docs/GLOBAL.md`.
3. **Testing:** Run existing automated tests to verify the solution works as intended and does not introduce regressions (strict test coverage metrics are not prioritized for now).
4. **Checklist & Scope Verification:** Read the target issue description and ensure all requirements, deliverables, and acceptance criteria are 100% fulfilled.
5. **Collaborative Code Review Gate (MANDATORY STOP — NO AUTONOMOUS COMMITS):**
   - The agent MUST NOT commit or push changes autonomously.
   - The agent stops and presents the code package, changed files, and test results for interactive user inspection and joint review.
6. **Commit & Push (Gated by Explicit Sign-Off):**
   - Only after the user reviews the code and explicitly signals approval (e.g., `"Finalizado esse pacote de código"`), the agent generates the conventional commit message and pushes the branch to the remote repository.
7. **Pull Request (Gated by Explicit PR Command):**
   - PR creation is never automated.
   - Only upon receiving an explicit command from the user (e.g., `"agora podemos subir o PR"`), the agent opens a Pull Request on GitHub. The PR description MUST reference the issue using auto-closing syntax (e.g., `Resolves #<id>`).
8. **Automated Lifecycle on Merge:**
   - **Automatic Issue Closing:** When the PR is merged into `main`, GitHub automatically transitions the linked issue to `Closed` via the `Resolves #<id>` keyword.
   - **Automatic Branch Cleanup:** Upon merge, the head branch (`feat/<id>`, `fix/<id>`, `refactor/<id>`) is deleted via repository settings or workflow.
