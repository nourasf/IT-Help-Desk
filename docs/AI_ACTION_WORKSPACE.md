# SupportHub AI Action Workspace

## Goal

SupportHub AI is more than a chatbot. It can recognize role-appropriate operational requests and open an interactive workspace beside the conversation without replacing the existing SupportHub pages.

The feature is inspired by the artifact/action pattern used in the PSY project, but SupportHub keeps its own React/.NET architecture and uses local Ollama instead of an external AI API.

## Design principles

- Keep the existing SupportHub lavender/white visual identity.
- Never require an external AI API key.
- Use the installed local Ollama model for normal conversational assistance.
- Treat UI actions as server-approved artifacts, never as arbitrary model commands.
- Reuse existing SupportHub endpoints for real data and mutations.
- Keep destructive or privileged actions behind normal application permissions and user confirmation.
- Do not replace the existing Create User, Create Ticket, Tickets, Reports, or dashboard pages. The artifact layer is an additional interaction surface.

## Response contract

`POST /api/ai/chat` can return a normal reply plus an optional artifact:

```json
{
  "reply": "I've opened the Create User form.",
  "role": "Admin",
  "conversationId": 12,
  "title": "Add a new employee",
  "artifact": {
    "type": "create_user",
    "title": "Create User",
    "initialData": {
      "role": "Employee"
    }
  }
}
```

If no supported action is detected, `artifact` is `null` and the message is handled by Ollama normally.

## Role-aware actions

### Admin

- `create_user` — embedded Create User form
- `user_list` — user directory
- `ticket_list` — ticket explorer
- `reports` — report workspace launcher

### Manager

- `assignment_center` — unassigned queue with agent workload and assignment controls
- `ticket_list` — filtered ticket explorer, including critical/open/resolved/closed requests
- `reports` — report workspace launcher

### IT Support Agent

- `agent_available_tickets` — available/unassigned ticket queue
- `agent_my_tickets` — active assigned ticket list

### Employee

- `create_ticket` — embedded ticket form with AI category/priority suggestion
- `my_tickets` — employee ticket list

## Permission model

Artifact detection happens on the backend using the authenticated JWT role. The frontend never decides which privileged action a role is allowed to receive.

Examples:

- An Employee cannot receive `create_user` from the backend.
- Only Admin users can use `/api/users`.
- Manager assignment continues to use the existing protected ticket assignment endpoint.
- Existing route/controller authorization remains the source of truth.

## Frontend architecture

- `pages/ai/AiAssistant.jsx`
  - owns chat/history state
  - receives artifacts from the backend
  - opens/closes the action workspace
  - exposes role-specific quick-action prompts

- `components/ai/AiArtifactPanel.jsx`
  - renders the matching interactive artifact
  - reuses existing SupportHub API helpers
  - contains embedded Create User/Create Ticket/list/assignment views

- `styles/ai/AiArtifacts.css`
  - adds the split-panel layout and artifact styling
  - intentionally follows the existing SupportHub design instead of copying PSY styling

## Interaction layout

Default chat:

```text
History | SupportHub information | Chat
```

When an artifact opens:

```text
History | Chat | Interactive action workspace
```

On smaller screens, the workspace stacks below the chat instead of forcing a cramped three-column layout.

## Safety and confirmation

The assistant may open forms, filtered lists, ticket details, assignment controls, and reports. It should not silently perform destructive actions such as deleting users, deleting tickets, closing tickets, or changing permissions.

Creating users, creating tickets, and assigning tickets still require explicit button submission in the visible UI.

## Ollama

SupportHub continues to use `qwen3:4b` through the local Ollama server. No OpenAI API key or other external LLM credential is used by this feature.

The current action resolver uses reliable server-side intent matching for known SupportHub actions. General questions still go through Ollama. This avoids depending on unpredictable model-generated commands while preserving natural conversational assistance.

## Future polish

Potential next improvements after visual testing:

- persist artifact metadata with chat history so reopening a conversation can restore its last action workspace
- add ticket-number extraction and a `ticket_details` artifact
- allow AI to prefill Create Ticket subject/category/priority more aggressively
- add confirmation artifacts for selected workflow actions
- move repeated embedded form logic into shared form components used by both normal pages and AI artifacts
