import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ethers } from 'ethers';

import { PolicyEngine } from './policyEngine.js';
import { AuditLogger } from './auditLogger.js';
import { TransactionProposal } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rpc = process.env.EVM_RPC_URL || 'https://rpc.testnet.chain.robinhood.com';
const privateKey = process.env.EVM_PRIVATE_KEY;
const chainId = Number(process.env.CHAIN_ID || 46630); // Default: Robinhood Chain Testnet (46630)
const HTTP_PORT = Number(process.env.PORT || 3000);

const networkName = chainId === 46630 ? 'Robinhood Chain Testnet' : chainId === 4663 ? 'Robinhood Chain Mainnet' : chainId === 84532 ? 'Base Sepolia' : 'EVM Network';
const explorerBase = chainId === 46630 ? 'https://explorer.testnet.chain.robinhood.com' : chainId === 4663 ? 'https://explorer.mainnet.chain.robinhood.com' : 'https://sepolia.basescan.org';

const provider = rpc ? new ethers.JsonRpcProvider(rpc, chainId) : null;
const wallet = provider && privateKey ? new ethers.Wallet(privateKey, provider) : null;

const policyEngine = new PolicyEngine();
const auditLogger = new AuditLogger();
const proposals = new Map<string, TransactionProposal>();

const erc20 = new ethers.Interface([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to,uint256 amount) returns (bool)'
]);

function ok(data: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }; }
function err(message: string) { return { isError: true, content: [{ type: 'text' as const, text: message }] }; }
function validAddress(a: string): boolean {
  if (!a || typeof a !== 'string') return false;
  if (/^0x[a-fA-F0-9]{40}$/.test(a.trim())) return true;
  try {
    return ethers.isAddress(a.trim());
  } catch {
    return false;
  }
}

// ==========================================
// 1. MCP SERVER SETUP
// ==========================================
export const mcpServer = new Server({ name: 'evm-mcp-guard', version: '0.2.0' }, { capabilities: { tools: {} } });

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'wallet_info', description: 'Get connected isolated wallet address, network details, and policy parameters.', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_native_balance', description: 'Read native EVM balance for an address or signer on Base Sepolia.', inputSchema: { type: 'object', properties: { address: { type: 'string' } } } },
    { name: 'get_token_balance', description: 'Read ERC-20 token balance, symbol, and decimals.', inputSchema: { type: 'object', required: ['token', 'address'], properties: { token: { type: 'string' }, address: { type: 'string' } } } },
    { name: 'simulate_transaction', description: 'Simulate transaction execution, estimate gas, and preview state diffs before submitting proposal.', inputSchema: { type: 'object', required: ['to'], properties: { to: { type: 'string' }, amountEth: { type: 'number' }, calldata: { type: 'string' } } } },
    { name: 'propose_native_transfer', description: 'Create a policy-checked native ETH transfer proposal. Held for explicit approval.', inputSchema: { type: 'object', required: ['to', 'amountEth'], properties: { agentId: { type: 'string', description: 'Identifier of the requesting agent' }, to: { type: 'string' }, amountEth: { type: 'number' } } } },
    { name: 'propose_token_transfer', description: 'Create a policy-checked ERC-20 token transfer proposal. Held for explicit approval.', inputSchema: { type: 'object', required: ['token', 'to', 'amount'], properties: { agentId: { type: 'string' }, token: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } } } },
    { name: 'propose_contract_call', description: 'Create a guarded contract call checked against function & contract allowlists.', inputSchema: { type: 'object', required: ['contractAddress', 'functionName'], properties: { agentId: { type: 'string' }, contractAddress: { type: 'string' }, functionName: { type: 'string' }, calldata: { type: 'string' }, valueEth: { type: 'number' } } } },
    { name: 'approve_transaction', description: 'Explicitly authorize and approve a pending transaction proposal.', inputSchema: { type: 'object', required: ['proposal_id'], properties: { proposal_id: { type: 'string' } } } },
    { name: 'reject_transaction', description: 'Reject a pending proposal and prevent execution.', inputSchema: { type: 'object', required: ['proposal_id'], properties: { proposal_id: { type: 'string' }, reason: { type: 'string' } } } },
    { name: 'execute_transaction', description: 'Execute an approved proposal on-chain through isolated signer.', inputSchema: { type: 'object', required: ['proposal_id'], properties: { proposal_id: { type: 'string' } } } },
    { name: 'get_audit_log', description: 'Query immutable security audit log of agent actions and policy interventions.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'get_policy_rules', description: 'Inspect active spending limits, contract allowlists, and agent RBAC profiles.', inputSchema: { type: 'object', properties: {} } }
  ]
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async req => {
  const a = (req.params.arguments as any) || {};
  const agentId = a.agentId || 'agent_quant_01';
  const agent = policyEngine.getAgent(agentId) || { name: agentId, id: agentId };

  try {
    switch (req.params.name) {
      case 'wallet_info': {
        const info = {
          mode: wallet ? 'live_testnet' : 'demo_simulation',
          configured: !!wallet,
          address: wallet?.address ?? '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          network: networkName,
          chainId,
          rpc: rpc ? 'Connected' : 'Mock Simulator',
          policies: policyEngine.getConfig()
        };
        return ok(info);
      }

      case 'get_native_balance': {
        if (!provider) {
          return ok({ mode: 'demo_simulation', network: `${networkName} (${chainId})`, address: a.address || wallet?.address || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', balanceEth: '1.4580', symbol: 'ETH' });
        }
        const address = a.address || wallet?.address;
        if (!address || !validAddress(address)) return err('Invalid Ethereum address format');
        const balWei = await provider.getBalance(address);
        return ok({ network: networkName, address, balanceEth: ethers.formatEther(balWei), symbol: 'ETH' });
      }

      case 'get_token_balance': {
        if (!validAddress(a.token) || !validAddress(a.address)) return err('Invalid token or recipient address format');
        if (!provider) {
          return ok({ mode: 'demo_simulation', token: a.token, address: a.address, balance: '2500.00', symbol: 'USDC', decimals: 6 });
        }
        const c = new ethers.Contract(a.token, erc20, provider);
        const [raw, dec, sym] = await Promise.all([c.balanceOf(a.address), c.decimals(), c.symbol()]);
        return ok({ token: a.token, address: a.address, balance: ethers.formatUnits(raw, dec), symbol: sym, decimals: Number(dec) });
      }

      case 'simulate_transaction': {
        if (!validAddress(a.to)) return err('Invalid target address');
        const sim = await policyEngine.simulateTransaction(provider, wallet?.address || null, {
          to: a.to,
          amountEth: a.amountEth || 0,
          calldata: a.calldata || '0x'
        });
        return ok(sim);
      }

      case 'propose_native_transfer': {
        if (!validAddress(a.to) || typeof a.amountEth !== 'number' || a.amountEth <= 0) {
          return err('Invalid recipient address or amountEth must be > 0');
        }

        const decision = policyEngine.evaluateProposal({
          agentId,
          type: 'native_transfer',
          to: a.to,
          amountEth: a.amountEth
        });

        const sim = await policyEngine.simulateTransaction(provider, wallet?.address || null, {
          to: a.to,
          amountEth: a.amountEth
        });

        const id = 'prop_' + ethers.id(JSON.stringify(a) + Date.now()).slice(2, 18);
        const proposal: TransactionProposal = {
          id,
          agentId,
          agentName: agent.name,
          type: 'native_transfer',
          to: a.to,
          amountEth: a.amountEth,
          chainId,
          status: decision.passed ? 'pending_approval' : 'blocked',
          policyDecision: decision,
          simulation: sim,
          createdAt: new Date().toISOString()
        };

        proposals.set(id, proposal);

        auditLogger.record({
          agentId,
          agentName: agent.name,
          action: 'PROPOSE_NATIVE_TRANSFER',
          status: decision.passed ? 'PENDING' : 'BLOCKED',
          riskLevel: decision.riskLevel,
          details: { to: a.to, amountEth: a.amountEth, reason: decision.reason }
        });

        if (!decision.passed) {
          return err(`POLICY_BLOCKED: ${decision.reason}`);
        }

        return ok({
          proposal_id: id,
          status: 'awaiting_human_approval',
          proposal
        });
      }

      case 'propose_token_transfer': {
        if (!validAddress(a.token) || !validAddress(a.to) || typeof a.amount !== 'number' || a.amount <= 0) {
          return err('Invalid token, recipient, or amount must be > 0');
        }

        const decision = policyEngine.evaluateProposal({
          agentId,
          type: 'token_transfer',
          to: a.to,
          amountToken: a.amount,
          token: a.token
        });

        const id = 'prop_' + ethers.id(JSON.stringify(a) + Date.now()).slice(2, 18);
        const proposal: TransactionProposal = {
          id,
          agentId,
          agentName: agent.name,
          type: 'token_transfer',
          token: a.token,
          tokenSymbol: 'USDC',
          to: a.to,
          amount: a.amount,
          chainId,
          status: decision.passed ? 'pending_approval' : 'blocked',
          policyDecision: decision,
          createdAt: new Date().toISOString()
        };

        proposals.set(id, proposal);

        auditLogger.record({
          agentId,
          agentName: agent.name,
          action: 'PROPOSE_TOKEN_TRANSFER',
          status: decision.passed ? 'PENDING' : 'BLOCKED',
          riskLevel: decision.riskLevel,
          details: { token: a.token, to: a.to, amount: a.amount, reason: decision.reason }
        });

        if (!decision.passed) {
          return err(`POLICY_BLOCKED: ${decision.reason}`);
        }

        return ok({
          proposal_id: id,
          status: 'awaiting_human_approval',
          proposal
        });
      }

      case 'propose_contract_call': {
        if (!validAddress(a.contractAddress)) return err('Invalid contract address');
        const decision = policyEngine.evaluateProposal({
          agentId,
          type: 'contract_call',
          to: a.contractAddress,
          functionName: a.functionName
        });

        const id = 'prop_' + ethers.id(JSON.stringify(a) + Date.now()).slice(2, 18);
        const proposal: TransactionProposal = {
          id,
          agentId,
          agentName: agent.name,
          type: 'contract_call',
          to: a.contractAddress,
          functionName: a.functionName,
          calldata: a.calldata || '0x',
          amountEth: a.valueEth || 0,
          chainId,
          status: decision.passed ? 'pending_approval' : 'blocked',
          policyDecision: decision,
          createdAt: new Date().toISOString()
        };

        proposals.set(id, proposal);

        auditLogger.record({
          agentId,
          agentName: agent.name,
          action: 'PROPOSE_CONTRACT_CALL',
          status: decision.passed ? 'PENDING' : 'BLOCKED',
          riskLevel: decision.riskLevel,
          details: { contract: a.contractAddress, function: a.functionName, reason: decision.reason }
        });

        if (!decision.passed) {
          return err(`POLICY_BLOCKED: ${decision.reason}`);
        }

        return ok({
          proposal_id: id,
          status: 'awaiting_human_approval',
          proposal
        });
      }

      case 'approve_transaction': {
        const p = proposals.get(a.proposal_id);
        if (!p) return err(`Unknown proposal ID: ${a.proposal_id}`);
        p.status = 'approved';
        p.approvedAt = new Date().toISOString();

        auditLogger.record({
          agentId: 'human_operator',
          agentName: 'Security Operator',
          action: 'APPROVE_PROPOSAL',
          status: 'SUCCESS',
          riskLevel: p.policyDecision.riskLevel,
          details: { proposal_id: a.proposal_id, type: p.type, to: p.to }
        });

        return ok({ proposal_id: a.proposal_id, status: 'approved', proposal: p });
      }

      case 'reject_transaction': {
        const p = proposals.get(a.proposal_id);
        if (!p) return err(`Unknown proposal ID: ${a.proposal_id}`);
        p.status = 'rejected';
        p.rejectedAt = new Date().toISOString();
        p.rejectionReason = a.reason || 'Manually rejected by operator.';

        auditLogger.record({
          agentId: 'human_operator',
          agentName: 'Security Operator',
          action: 'REJECT_PROPOSAL',
          status: 'REJECTED',
          riskLevel: 'LOW',
          details: { proposal_id: a.proposal_id, reason: p.rejectionReason }
        });

        return ok({ proposal_id: a.proposal_id, status: 'rejected', proposal: p });
      }

      case 'execute_transaction': {
        const p = proposals.get(a.proposal_id);
        if (!p) return err(`Unknown proposal ID: ${a.proposal_id}`);
        if (p.status !== 'approved') {
          auditLogger.record({
            agentId,
            agentName: agent.name,
            action: 'UNAUTHORIZED_EXECUTION_ATTEMPT',
            status: 'BLOCKED',
            riskLevel: 'HIGH',
            details: { proposal_id: a.proposal_id, currentStatus: p.status }
          });
          return err('APPROVAL_REQUIRED: Proposal has not been explicitly authorized.');
        }

        if (!wallet) {
          // High-fidelity simulation mode
          const simulatedHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
          p.status = 'executed';
          p.executedAt = new Date().toISOString();
          p.transactionHash = simulatedHash;
          p.blockNumber = 18492042;

          auditLogger.record({
            agentId,
            agentName: agent.name,
            action: 'EXECUTE_TRANSACTION_SIMULATED',
            status: 'EXECUTED',
            riskLevel: 'LOW',
            txHash: simulatedHash,
            details: { proposal_id: p.id, type: p.type, mode: 'demo_simulation' }
          });

          return ok({
            mode: 'demo_simulation',
            status: 'confirmed',
            transactionHash: simulatedHash,
            explorerUrl: `${explorerBase}/tx/${simulatedHash}`,
            proposal: p
          });
        }

        // Live Real Network Execution
        let tx: any;
        if (p.type === 'native_transfer') {
          tx = await wallet.sendTransaction({
            to: p.to,
            value: ethers.parseEther(String(p.amountEth))
          });
        } else if (p.type === 'token_transfer') {
          const c = new ethers.Contract(p.token!, erc20, wallet);
          const dec = await c.decimals();
          tx = await c.transfer(p.to, ethers.parseUnits(String(p.amount), dec));
        } else {
          tx = await wallet.sendTransaction({
            to: p.to,
            data: p.calldata,
            value: p.amountEth ? ethers.parseEther(String(p.amountEth)) : 0
          });
        }

        const receipt = await tx.wait();
        p.status = 'executed';
        p.executedAt = new Date().toISOString();
        p.transactionHash = receipt.hash;
        p.blockNumber = receipt.blockNumber;

        auditLogger.record({
          agentId,
          agentName: agent.name,
          action: 'EXECUTE_TRANSACTION_ONCHAIN',
          status: 'EXECUTED',
          riskLevel: 'LOW',
          txHash: receipt.hash,
          details: { proposal_id: p.id, blockNumber: receipt.blockNumber, to: p.to }
        });

        return ok({
          status: 'confirmed',
          network: networkName,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          explorerUrl: `${explorerBase}/tx/${receipt.hash}`,
          proposal: p
        });
      }

      case 'get_audit_log': {
        return ok(auditLogger.getLogs(a.limit || 50));
      }

      case 'get_policy_rules': {
        return ok({
          policy: policyEngine.getConfig(),
          agents: policyEngine.getAgents(),
          allowlists: policyEngine.getAllowlists()
        });
      }

      default:
        return err(`Unknown tool: ${req.params.name}`);
    }
  } catch (e: any) {
    return err(e?.message || String(e));
  }
});

// ==========================================
// 2. EXPRESS HTTP API & WEB DASHBOARD BACKEND
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../demo-web')));

app.get('/api/status', async (_req, res) => {
  res.json({
    name: 'Supler EVM Guard',
    version: '0.2.0',
    mode: wallet ? 'live_testnet' : 'demo_simulation',
    network: networkName,
    chainId,
    explorerBase,
    walletAddress: wallet?.address ?? '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    balanceEth: wallet && provider ? ethers.formatEther(await provider.getBalance(wallet.address)) : '1.4580',
    pendingProposalsCount: Array.from(proposals.values()).filter(p => p.status === 'pending_approval').length,
    totalProposalsCount: proposals.size,
    policy: policyEngine.getConfig()
  });
});

app.get('/api/proposals', (_req, res) => {
  res.json(Array.from(proposals.values()).reverse());
});

app.post('/api/proposals', async (req, res) => {
  const { agentId = 'agent_quant_01', type, to, amountEth, token, amount, functionName } = req.body;
  if (!validAddress(to)) {
    return res.status(400).json({ error: 'Invalid recipient or contract address.' });
  }

  const decision = policyEngine.evaluateProposal({
    agentId,
    type,
    to,
    amountEth: Number(amountEth),
    amountToken: Number(amount),
    token,
    functionName
  });

  const sim = await policyEngine.simulateTransaction(provider, wallet?.address || null, {
    to,
    amountEth: Number(amountEth) || 0
  });

  const agent = policyEngine.getAgent(agentId) || { name: agentId, id: agentId };
  const id = 'prop_' + ethers.id(JSON.stringify(req.body) + Date.now()).slice(2, 18);
  const proposal: TransactionProposal = {
    id,
    agentId,
    agentName: agent.name,
    type,
    to,
    amountEth: amountEth ? Number(amountEth) : undefined,
    token,
    tokenSymbol: token ? 'USDC' : undefined,
    amount: amount ? Number(amount) : undefined,
    functionName,
    chainId,
    status: decision.passed ? 'pending_approval' : 'blocked',
    policyDecision: decision,
    simulation: sim,
    createdAt: new Date().toISOString()
  };

  proposals.set(id, proposal);

  auditLogger.record({
    agentId,
    agentName: agent.name,
    action: `PROPOSE_${type.toUpperCase()}`,
    status: decision.passed ? 'PENDING' : 'BLOCKED',
    riskLevel: decision.riskLevel,
    details: { to, amountEth, amount, token, reason: decision.reason }
  });

  res.json({ proposal, decision });
});

app.post('/api/proposals/:id/approve', (req, res) => {
  const p = proposals.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposal not found' });
  p.status = 'approved';
  p.approvedAt = new Date().toISOString();

  auditLogger.record({
    agentId: 'human_operator',
    agentName: 'Security Operator',
    action: 'APPROVE_PROPOSAL',
    status: 'SUCCESS',
    riskLevel: p.policyDecision.riskLevel,
    details: { proposal_id: p.id, type: p.type, to: p.to }
  });

  res.json({ success: true, proposal: p });
});

app.post('/api/proposals/:id/reject', (req, res) => {
  const p = proposals.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposal not found' });
  p.status = 'rejected';
  p.rejectedAt = new Date().toISOString();
  p.rejectionReason = req.body.reason || 'Manually rejected by human security officer.';

  auditLogger.record({
    agentId: 'human_operator',
    agentName: 'Security Operator',
    action: 'REJECT_PROPOSAL',
    status: 'REJECTED',
    riskLevel: 'LOW',
    details: { proposal_id: p.id, reason: p.rejectionReason }
  });

  res.json({ success: true, proposal: p });
});

app.post('/api/proposals/:id/execute', async (req, res) => {
  const p = proposals.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposal not found' });
  if (p.status !== 'approved') {
    return res.status(403).json({ error: 'APPROVAL_REQUIRED: Proposal is not approved.' });
  }

  if (!wallet) {
    const simulatedHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    p.status = 'executed';
    p.executedAt = new Date().toISOString();
    p.transactionHash = simulatedHash;
    p.blockNumber = 18492042;

    auditLogger.record({
      agentId: p.agentId,
      agentName: p.agentName,
      action: 'EXECUTE_TRANSACTION_SIMULATED',
      status: 'EXECUTED',
      riskLevel: 'LOW',
      txHash: simulatedHash,
      details: { proposal_id: p.id, type: p.type }
    });

    return res.json({ success: true, mode: 'demo_simulation', transactionHash: simulatedHash, proposal: p });
  }

  try {
    let tx: any;
    if (p.type === 'native_transfer') {
      tx = await wallet.sendTransaction({ to: p.to, value: ethers.parseEther(String(p.amountEth)) });
    } else if (p.type === 'token_transfer') {
      const c = new ethers.Contract(p.token!, erc20, wallet);
      const dec = await c.decimals();
      tx = await c.transfer(p.to, ethers.parseUnits(String(p.amount), dec));
    }
    const receipt = await tx.wait();
    p.status = 'executed';
    p.executedAt = new Date().toISOString();
    p.transactionHash = receipt.hash;
    p.blockNumber = receipt.blockNumber;

    auditLogger.record({
      agentId: p.agentId,
      agentName: p.agentName,
      action: 'EXECUTE_TRANSACTION_ONCHAIN',
      status: 'EXECUTED',
      riskLevel: 'LOW',
      txHash: receipt.hash,
      details: { proposal_id: p.id, blockNumber: receipt.blockNumber }
    });

    res.json({ success: true, mode: 'live_testnet', transactionHash: receipt.hash, blockNumber: receipt.blockNumber, proposal: p });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Execution failed' });
  }
});

app.get('/api/agents', (_req, res) => res.json(policyEngine.getAgents()));
app.get('/api/allowlists', (_req, res) => res.json(policyEngine.getAllowlists()));
app.get('/api/audit-logs', (_req, res) => res.json(auditLogger.getLogs(100)));

// Start HTTP Server safely
if (process.env.RUN_STDIO !== 'true') {
  const serverInstance = app.listen(HTTP_PORT, () => {
    console.log(`[Supler EVM Guard] Web Dashboard & API active at: http://localhost:${HTTP_PORT}`);
  });
  serverInstance.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Supler EVM Guard] Port ${HTTP_PORT} is already in use; continuing in MCP Stdio mode.`);
    } else {
      console.error('[Supler EVM Guard] HTTP error:', err);
    }
  });
}

// Start MCP stdio transport if running in stdio CLI mode or piped
if (process.env.RUN_STDIO === 'true' || !process.stdin.isTTY) {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

