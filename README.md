# 🛡️ Chedo (EVM Guard)

**The Autonomous AI Agent Security Layer & Policy Gateway for EVM Blockchains.**

[![Network: Robinhood Chain Testnet](https://img.shields.io/badge/Network-Robinhood%20Chain%20(46630)-green)](https://explorer.testnet.robinhood.com)
[![MCP Version: 1.18+](https://img.shields.io/badge/MCP-1.18%2B-cyan)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 💡 What is Chedo?

Giving an autonomous AI agent (Claude, Cursor, custom bot) a raw private key is financial catastrophe waiting to happen. A single prompt injection, corrupted oracle feed, or LLM hallucination can drain a treasury in a single block.

**Chedo** solves this by establishing a deterministic, policy-enforced boundary between AI agents and on-chain EVM wallets.

```text
┌──────────────────────────┐
│ AI Agent (Claude/Cursor) │
└─────────────┬────────────┘
              │ 1. Proposes Action (MCP Tool Call)
              ▼
┌──────────────────────────┐
│   EVM MCP Guard Engine   │
│ ──────────────────────── │
│ • Spending Limit Check   │ ──► [Auto-Block Violations]
│ • Contract Allowlist     │ ──► [Verify Protocols]
│ • Pre-Flight Simulation  │ ──► [Estimate Gas / Reverts]
│ • Agent RBAC & Quotas    │ ──► [Daily Ceilings]
└─────────────┬────────────┘
              │ 2. Validated Proposal
              ▼
┌──────────────────────────┐
│ Human Approval Board     │ ──► [1-Click Authorization UI]
└─────────────┬────────────┘
              │ 3. Explicit Signed Release
              ▼
┌──────────────────────────┐
│ Isolated EVM Signer      │ ──► [Broadcast to Base Sepolia]
└──────────────────────────┘
```

---

## 🚀 Key Features

- **🛡️ Deterministic Policy Engine**: Enforces strict per-transaction limits (`MAX_NATIVE_ETH`, `MAX_TOKEN_AMOUNT`) and per-agent daily quotas.
- **📜 Verified Contract & Function Allowlists**: Disallows unapproved contract interactions; restricts execution to specific verified function signatures (e.g. WETH deposit, Uniswap swap).
- **🔬 Pre-Flight Transaction Simulation**: Runs `eth_call` and `eth_estimateGas` to predict state changes and revert risks before transactions reach human reviewers.
- **📋 Human-in-the-Loop Approval UI**: Modern dark-mode web switchboard for reviewing, simulating, approving, and rejecting proposals in real time.
- **🤖 Multi-Agent RBAC**: Assign granular identities (`agent_id`) and roles (`analyst`, `trader`, `admin`) to different autonomous agents.
- **📊 Immutable Audit Log**: Complete chronological record of agent requests, policy blocks, gas metrics, and BaseScan transaction links.
- **🔌 Multi-Client MCP Support**: Standard stdio & HTTP/SSE interfaces for Claude Desktop, Cursor IDE, and custom agent frameworks.

---

## ⚡ Quick Start

### 1. Installation
```bash
git clone <repo-url>
cd evm-mcp
npm install
```

### 2. Launch Local Dashboard & API
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Run Automated End-to-End Verification Test
```bash
npm run demo
```

---

## ⛓️ Real Base Sepolia Testnet Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
2. Configure your testnet parameters:
```env
EVM_RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
EVM_PRIVATE_KEY=your_dedicated_testnet_private_key_here
MAX_NATIVE_ETH=0.05
MAX_TOKEN_AMOUNT=100
REQUIRE_APPROVAL=true
```
*(Never use a mainnet key or commit `.env`)*

---

## 🔌 Connecting to Claude Desktop / Cursor

Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "evm-mcp-guard": {
      "command": "node",
      "args": ["/absolute/path/to/evm-mcp/dist/src/server.js"],
      "env": {
        "EVM_RPC_URL": "https://sepolia.base.org",
        "CHAIN_ID": "84532",
        "RUN_STDIO": "true"
      }
    }
  }
}
```

---

## 📚 MCP Tools Reference

| Tool Name | Description |
| :--- | :--- |
| `wallet_info` | Inspect configured signer address, network ID, and policy limits. |
| `get_native_balance` | Read native ETH balance on Base Sepolia. |
| `get_token_balance` | Read ERC-20 token balances, symbol, and decimals. |
| `simulate_transaction` | Perform pre-flight simulation and gas estimation. |
| `propose_native_transfer` | Create a guarded native ETH transfer proposal. |
| `propose_token_transfer` | Create a guarded ERC-20 token transfer proposal. |
| `propose_contract_call` | Propose interaction with allowlisted smart contracts. |
| `approve_transaction` | Explicitly authorize a pending proposal. |
| `reject_transaction` | Reject a proposal and record rejection in audit trail. |
| `execute_transaction` | Broadcast authorized proposal to the EVM network. |
| `get_audit_log` | Stream immutable security audit events. |
| `get_policy_rules` | Query active spending caps and allowlists. |

---

## 📄 Strategy Documents
- **[60-Second Investor Pitch](PITCH_AMAAN_60S.md)**
- **[Token Launch & Robinhood Migration Strategy](TOKEN_AND_EXCHANGE_STRATEGY.md)**
- **[System Architecture](ARCHITECTURE.md)**
