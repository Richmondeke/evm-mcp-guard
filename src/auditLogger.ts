import { AuditLogEntry, RiskLevel } from './types.js';

export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxEntries: number = 1000;

  constructor() {
    // Seed initial event
    this.record({
      agentId: 'system',
      agentName: 'EVM MCP Guard Core',
      action: 'SYSTEM_BOOT',
      status: 'SUCCESS',
      riskLevel: 'LOW',
      details: { message: 'Policy engine, isolated signer, and MCP runtime initialized.' }
    });
  }

  public record(entry: {
    agentId: string;
    agentName: string;
    action: string;
    status: 'SUCCESS' | 'BLOCKED' | 'PENDING' | 'REJECTED' | 'EXECUTED';
    riskLevel: RiskLevel;
    details: Record<string, any>;
    txHash?: string;
  }): AuditLogEntry {
    const item: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.logs.unshift(item); // prepend latest
    if (this.logs.length > this.maxEntries) {
      this.logs.pop();
    }
    return item;
  }

  public getLogs(limit: number = 50): AuditLogEntry[] {
    return this.logs.slice(0, limit);
  }

  public clear() {
    this.logs = [];
  }
}
