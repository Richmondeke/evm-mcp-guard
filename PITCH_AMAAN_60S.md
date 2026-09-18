# ⚡ 60-Second Executive Pitch to Amaan
**EVM MCP Guard — Autonomous AI Agent Security Layer & Policy Gateway**

---

### [0:00 - 0:12] The Trillion-Dollar Vulnerability
> *"Amaan, autonomous AI agents are rapidly becoming the primary actors trading on DEXs, managing treasuries, and executing smart contracts. But right now, the industry has a lethal design flaw: developers are giving raw private keys to LLMs.*
> 
> *One prompt injection, one corrupted feed, or one hallucination, and the wallet gets completely drained in a single block with zero recourse."*

---

### [0:12 - 0:28] The Solution: EVM MCP Guard
> *"We built **EVM MCP Guard**. It sits directly between any AI agent (Claude, Cursor, bespoke bot) and the EVM blockchain.
> 
> The agent **never gets the private key**. Instead, it proposes actions through standardized MCP tools. Every action must pass 4 deterministic security filters:
> 1. **Agent Identity & Role Quotas** (daily spending caps)
> 2. **Contract & Function Allowlists** (only verified protocols)
> 3. **Pre-flight On-chain Simulation** (detects reverts & gas drain)
> 4. **Explicit Human Approval Switchboard** (1-click authorization)"*

---

### [0:28 - 0:45] Live Interactive Demo
> *"Look at our live control plane running on Base Sepolia right now:
> - Here, an AI trader requests a 5 ETH transfer $\rightarrow$ **INSTANTLY BLOCKED** by the policy engine because it violates the 0.05 ETH spending limit.
> - When the agent proposes a valid 0.005 ETH transfer $\rightarrow$ our engine estimates the exact gas, previews the state diff, places it in the human approval queue, and upon approval, executes on Base with full audit logging."*

---

### [0:45 - 1:00] Tokenization & Retail/Robinhood Expansion
> *"Regarding your question on token launch and retail migration:
> We can launch the **$GUARD** utility & governance token to power agent security staking, slashed insurance pools, and decentralized policy oracle voting. 
> 
> As we scale, our isolated signer architecture plugs directly into **Robinhood Connect** and institutional MPC custody (Fireblocks / Safe), bridging autonomous on-chain agents with compliant retail brokerage ecosystems."*

---

### Quick Links & Proof Points:
- **Interactive UI Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Base Sepolia Explorer**: [sepolia.basescan.org](https://sepolia.basescan.org)
- **Architecture & Codebase**: Production-grade TypeScript, `@modelcontextprotocol/sdk`, ethers.js v6.
