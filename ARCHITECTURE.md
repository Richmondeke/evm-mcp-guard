# Architecture

```text
┌──────────────┐
│ AI Agent     │
└──────┬───────┘
       │ MCP tool call
       ▼
┌──────────────┐
│ MCP Server   │  standardized tools
└──────┬───────┘
       ▼
┌──────────────┐
│ Policy Layer │  limits / allowlists / approvals
└──────┬───────┘
       ▼
┌──────────────┐
│ Wallet       │  isolated signer
└──────┬───────┘
       ▼
┌──────────────┐
│ EVM Network  │
└──────────────┘
```

The MVP deliberately separates proposal from execution. An agent can request an action but cannot execute it until the policy/approval layer authorizes the proposal.
