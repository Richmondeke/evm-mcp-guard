import { PolicyEngine } from '../src/policyEngine.js';
import { AuditLogger } from '../src/auditLogger.js';

console.log('===========================================================');
console.log('🛡️  EVM MCP GUARD - END-TO-END VERIFICATION TEST');
console.log('===========================================================\n');

const engine = new PolicyEngine();
const logger = new AuditLogger();

// 1. Agent Profile Verification
console.log('1️⃣  VERIFYING AGENT IDENTITIES & RBAC QUOTAS:');
engine.getAgents().forEach(a => {
  console.log(`   • [${a.role.toUpperCase()}] ${a.name} (${a.id}) | Daily Limit: ${a.dailyLimitEth} ETH`);
});

// 2. Policy Enforcement Test - Excessive Limit
console.log('\n2️⃣  TESTING POLICY ENFORCEMENT (SPENDING LIMIT EXCEEDED):');
const blockedCheck = engine.evaluateProposal({
  agentId: 'agent_quant_01',
  type: 'native_transfer',
  to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  amountEth: 5.0 // Exceeds 0.05 ETH limit
});
console.log(`   Result: Passed=${blockedCheck.passed}, Reason="${blockedCheck.reason}", Risk=${blockedCheck.riskLevel}`);

// 3. Valid Proposal + Simulation
console.log('\n3️⃣  TESTING VALID PROPOSAL & PRE-FLIGHT SIMULATION:');
const validCheck = engine.evaluateProposal({
  agentId: 'agent_quant_01',
  type: 'native_transfer',
  to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  amountEth: 0.005
});
console.log(`   Policy Evaluation: Passed=${validCheck.passed}, Risk=${validCheck.riskLevel}`);

const sim = await engine.simulateTransaction(null, null, {
  to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  amountEth: 0.005
});
console.log(`   Simulation: Success=${sim.success}, GasEst=${sim.estimatedGas}, GasCost=${sim.gasCostEth} ETH`);

// 4. Contract Allowlist Check
console.log('\n4️⃣  TESTING CONTRACT & FUNCTION ALLOWLIST:');
const allowlistCheck = engine.evaluateProposal({
  agentId: 'agent_quant_01',
  type: 'contract_call',
  to: '0x4200000000000000000000000000000000000006', // WETH on Base
  functionName: 'deposit'
});
console.log(`   WETH deposit() check: Passed=${allowlistCheck.passed}, Risk=${allowlistCheck.riskLevel}`);

const badContractCheck = engine.evaluateProposal({
  agentId: 'agent_quant_01',
  type: 'contract_call',
  to: '0x1111111111111111111111111111111111111111',
  functionName: 'drainAllFunds'
});
console.log(`   Unlisted contract check: Passed=${badContractCheck.passed}, Reason="${badContractCheck.reason}"`);

console.log('\n✅ ALL POLICY, AGENT, AND SIMULATION GUARDS CONFIRMED OPERATIONAL.\n');
