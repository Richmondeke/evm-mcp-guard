export type AgentRole = 'analyst' | 'trader' | 'admin' | 'automated_bot';

export interface AgentIdentity {
  id: string;
  name: string;
  role: AgentRole;
  dailyLimitEth: number;
  dailySpentEth: number;
  allowedActions: string[];
  allowedContracts?: string[];
  active: boolean;
}

export interface ContractAllowlistEntry {
  address: string;
  name: string;
  allowedFunctions: string[]; // e.g. ["transfer", "swapExactTokensForTokens"] or ["*"]
  description?: string;
  network: string;
}

export interface PolicyConfig {
  maxNativeEthPerTx: number;
  maxTokenAmountPerTx: number;
  requireApproval: boolean;
  requireSimulation: boolean;
  contractAllowlist: ContractAllowlistEntry[];
  allowedRecipients: string[];
  blockedRecipients: string[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SimulationResult {
  simulated: boolean;
  success: boolean;
  estimatedGas: string;
  gasCostEth: string;
  riskLevel: RiskLevel;
  warnings: string[];
  revertReason?: string;
  stateChanges?: {
    fromBalanceBefore?: string;
    fromBalanceAfter?: string;
    toBalanceBefore?: string;
    toBalanceAfter?: string;
  };
}

export interface TransactionProposal {
  id: string;
  agentId: string;
  agentName: string;
  type: 'native_transfer' | 'token_transfer' | 'contract_call';
  to: string;
  amountEth?: number;
  token?: string;
  tokenSymbol?: string;
  amount?: number;
  calldata?: string;
  functionName?: string;
  chainId: number;
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'blocked';
  policyDecision: {
    passed: boolean;
    reason?: string;
    riskLevel: RiskLevel;
  };
  simulation?: SimulationResult;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  executedAt?: string;
  transactionHash?: string;
  blockNumber?: number;
  rejectionReason?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  status: 'SUCCESS' | 'BLOCKED' | 'PENDING' | 'REJECTED' | 'EXECUTED';
  riskLevel: RiskLevel;
  details: Record<string, any>;
  txHash?: string;
}
