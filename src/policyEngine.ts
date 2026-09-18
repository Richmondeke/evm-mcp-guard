import { ethers } from 'ethers';
import { AgentIdentity, ContractAllowlistEntry, PolicyConfig, RiskLevel, SimulationResult, TransactionProposal } from './types.js';

export class PolicyEngine {
  private config: PolicyConfig;
  private agents: Map<string, AgentIdentity> = new Map();
  private allowlists: Map<string, ContractAllowlistEntry> = new Map();

  constructor(initialConfig?: Partial<PolicyConfig>) {
    this.config = {
      maxNativeEthPerTx: Number(process.env.MAX_NATIVE_ETH || 0.05),
      maxTokenAmountPerTx: Number(process.env.MAX_TOKEN_AMOUNT || 100),
      requireApproval: process.env.REQUIRE_APPROVAL !== 'false',
      requireSimulation: true,
      contractAllowlist: [],
      allowedRecipients: [],
      blockedRecipients: [
        '0x0000000000000000000000000000000000000000',
        '0x000000000000000000000000000000000000dead'
      ],
      ...initialConfig
    };

    // Default Seed Agents
    this.registerAgent({
      id: 'agent_quant_01',
      name: 'Alpha Trader Bot (Base Sepolia)',
      role: 'trader',
      dailyLimitEth: 0.5,
      dailySpentEth: 0.015,
      allowedActions: ['get_native_balance', 'get_token_balance', 'propose_native_transfer', 'propose_token_transfer'],
      active: true
    });

    this.registerAgent({
      id: 'agent_analyst_01',
      name: 'Portfolio Monitor (Read-Only)',
      role: 'analyst',
      dailyLimitEth: 0,
      dailySpentEth: 0,
      allowedActions: ['wallet_info', 'get_native_balance', 'get_token_balance', 'simulate_transaction'],
      active: true
    });

    this.registerAgent({
      id: 'agent_admin_01',
      name: 'Security Admin / Guardian',
      role: 'admin',
      dailyLimitEth: 10.0,
      dailySpentEth: 0.1,
      allowedActions: ['*'],
      active: true
    });

    // Default Seed Allowlisted Contracts (Base / Base Sepolia)
    this.addAllowlist({
      address: '0x4200000000000000000000000000000000000006',
      name: 'WETH (Wrapped Ether - Base)',
      allowedFunctions: ['deposit', 'withdraw', 'transfer', 'approve'],
      description: 'Canonical Base Wrapped Ether Contract',
      network: 'Base Sepolia / Base'
    });

    this.addAllowlist({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      name: 'USDC (Base Sepolia)',
      allowedFunctions: ['transfer', 'approve'],
      description: 'Official Circle USDC Testnet on Base',
      network: 'Base Sepolia'
    });
  }

  public registerAgent(agent: AgentIdentity) {
    this.agents.set(agent.id, agent);
  }

  public getAgents(): AgentIdentity[] {
    return Array.from(this.agents.values());
  }

  public getAgent(id: string): AgentIdentity | undefined {
    return this.agents.get(id);
  }

  public addAllowlist(entry: ContractAllowlistEntry) {
    this.allowlists.set(entry.address.toLowerCase(), entry);
  }

  public removeAllowlist(address: string) {
    this.allowlists.delete(address.toLowerCase());
  }

  public getAllowlists(): ContractAllowlistEntry[] {
    return Array.from(this.allowlists.values());
  }

  public getConfig(): PolicyConfig {
    return {
      ...this.config,
      contractAllowlist: this.getAllowlists()
    };
  }

  public updateConfig(newConfig: Partial<PolicyConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public evaluateProposal(params: {
    agentId: string;
    type: 'native_transfer' | 'token_transfer' | 'contract_call';
    to: string;
    amountEth?: number;
    amountToken?: number;
    token?: string;
    functionName?: string;
  }): { passed: boolean; reason?: string; riskLevel: RiskLevel } {
    const { agentId, type, to, amountEth, amountToken, token, functionName } = params;
    const targetAddr = to.toLowerCase();

    // 1. Check Agent Identity
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { passed: false, reason: `UNREGISTERED_AGENT: Agent ID '${agentId}' is not authorized.`, riskLevel: 'HIGH' };
    }
    if (!agent.active) {
      return { passed: false, reason: `DEACTIVATED_AGENT: Agent '${agent.name}' is currently paused.`, riskLevel: 'HIGH' };
    }

    // Role check
    if (agent.role === 'analyst' && type !== 'contract_call') {
      return { passed: false, reason: `RBAC_VIOLATION: Role 'analyst' does not have proposal permissions.`, riskLevel: 'HIGH' };
    }

    // 2. Blocklist Check
    if (this.config.blockedRecipients.map(a => a.toLowerCase()).includes(targetAddr)) {
      return { passed: false, reason: `SECURITY_ALERT: Recipient ${to} is in the global blocklist.`, riskLevel: 'CRITICAL' };
    }

    // 3. Amount & Limits Check
    let risk: RiskLevel = 'LOW';
    if (type === 'native_transfer') {
      const amount = amountEth || 0;
      if (amount <= 0) return { passed: false, reason: 'INVALID_AMOUNT: Amount must be > 0.', riskLevel: 'LOW' };
      if (amount > this.config.maxNativeEthPerTx) {
        return { passed: false, reason: `POLICY_LIMIT_EXCEEDED: ${amount} ETH exceeds tx limit of ${this.config.maxNativeEthPerTx} ETH.`, riskLevel: 'HIGH' };
      }
      if (agent.dailySpentEth + amount > agent.dailyLimitEth) {
        return { passed: false, reason: `DAILY_QUOTA_EXCEEDED: Exceeds agent daily allowance (${agent.dailyLimitEth} ETH).`, riskLevel: 'HIGH' };
      }
      if (amount > 0.01) risk = 'MEDIUM';
    }

    if (type === 'token_transfer') {
      const amount = amountToken || 0;
      if (amount <= 0) return { passed: false, reason: 'INVALID_AMOUNT: Token amount must be > 0.', riskLevel: 'LOW' };
      if (amount > this.config.maxTokenAmountPerTx) {
        return { passed: false, reason: `POLICY_LIMIT_EXCEEDED: Amount ${amount} exceeds token tx limit of ${this.config.maxTokenAmountPerTx}.`, riskLevel: 'HIGH' };
      }
      risk = 'MEDIUM';
    }

    if (type === 'contract_call') {
      const allowlistEntry = this.allowlists.get(targetAddr);
      if (!allowlistEntry) {
        return { passed: false, reason: `CONTRACT_NOT_ALLOWLISTED: Address ${to} is not in verified contract allowlist.`, riskLevel: 'HIGH' };
      }
      if (functionName && !allowlistEntry.allowedFunctions.includes('*') && !allowlistEntry.allowedFunctions.includes(functionName)) {
        return { passed: false, reason: `FUNCTION_NOT_PERMITTED: Function '${functionName}' is not allowed on contract ${allowlistEntry.name}.`, riskLevel: 'HIGH' };
      }
      risk = 'MEDIUM';
    }

    return { passed: true, riskLevel: risk };
  }

  public async simulateTransaction(
    provider: ethers.JsonRpcProvider | null,
    walletAddress: string | null,
    proposal: Partial<TransactionProposal>
  ): Promise<SimulationResult> {
    // If connected to real provider, run eth_estimateGas and eth_call simulation
    if (provider && walletAddress && proposal.to && ethers.isAddress(proposal.to)) {
      try {
        const gasEstimate = await provider.estimateGas({
          from: walletAddress,
          to: proposal.to,
          value: proposal.amountEth ? ethers.parseEther(String(proposal.amountEth)) : undefined,
          data: proposal.calldata || '0x'
        });
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || 100000000n;
        const totalGasCostWei = gasEstimate * gasPrice;
        const gasCostEth = ethers.formatEther(totalGasCostWei);

        return {
          simulated: true,
          success: true,
          estimatedGas: gasEstimate.toString(),
          gasCostEth: Number(gasCostEth).toFixed(6),
          riskLevel: proposal.policyDecision?.riskLevel || 'LOW',
          warnings: Number(gasCostEth) > 0.005 ? ['High gas price alert'] : [],
          stateChanges: {
            fromBalanceBefore: 'Active Testnet Signer',
            toBalanceBefore: 'Verified Base Sepolia Target'
          }
        };
      } catch (err: any) {
        return {
          simulated: true,
          success: false,
          estimatedGas: '0',
          gasCostEth: '0',
          riskLevel: 'HIGH',
          warnings: ['Transaction reverted during pre-flight on-chain simulation.'],
          revertReason: err?.reason || err?.message || 'Execution reverted'
        };
      }
    }

    // Default High-Fidelity Simulation Mode (No wallet/RPC required)
    const mockGas = proposal.type === 'contract_call' ? '65230' : proposal.type === 'token_transfer' ? '48120' : '21000';
    const mockCost = (Number(mockGas) * 0.000000001).toFixed(6);

    return {
      simulated: true,
      success: true,
      estimatedGas: mockGas,
      gasCostEth: mockCost,
      riskLevel: proposal.policyDecision?.riskLevel || 'LOW',
      warnings: [],
      stateChanges: {
        fromBalanceBefore: '100.0000 ETH',
        fromBalanceAfter: `${(100 - (proposal.amountEth || 0) - Number(mockCost)).toFixed(4)} ETH`,
        toBalanceBefore: '0.0000 ETH',
        toBalanceAfter: `${(proposal.amountEth || 0).toFixed(4)} ETH`
      }
    };
  }
}
