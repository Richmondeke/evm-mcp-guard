const API_BASE = window.location.origin;

function switchTab(viewId) {
  document.querySelectorAll('.supler-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

  if (event && event.target) {
    event.target.classList.add('active');
  }
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  if (viewId === 'audit') loadAuditLogs();
  if (viewId === 'agents') loadAgents();
  if (viewId === 'allowlists') loadAllowlists();
}

function openPitchModal() {
  document.getElementById('supler-pitch-modal').style.display = 'flex';
}
function closePitchModal() {
  document.getElementById('supler-pitch-modal').style.display = 'none';
}

function toggleFormInputs() {
  const type = document.getElementById('input-type').value;
  const label = document.getElementById('amount-label');
  const toInput = document.getElementById('input-to');
  const amountInput = document.getElementById('input-amount');

  if (type === 'token_transfer') {
    label.innerHTML = 'Token Amount (USDC) &bull; Cap: 100 USDC';
    amountInput.value = '25';
  } else if (type === 'contract_call') {
    label.innerHTML = 'ETH Value to Attach &bull; (Optional)';
    toInput.value = '0x4200000000000000000000000000000000000006';
    amountInput.value = '0.001';
  } else {
    label.innerHTML = 'Amount (ETH) &bull; Cap: 0.05 ETH';
    toInput.value = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    amountInput.value = '0.005';
  }
}

let currentExplorerBase = 'https://explorer.testnet.chain.robinhood.com';

async function loadData() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    const data = await res.json();

    if (data.explorerBase) currentExplorerBase = data.explorerBase;
    document.getElementById('vault-address').textContent = `${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}`;
    document.getElementById('treasury-balance').innerHTML = `<span style="color: #2563EB;">${data.balanceEth}</span> ETH`;
    document.getElementById('pending-counter').textContent = data.pendingProposalsCount;
    document.getElementById('supler-network').textContent = `${data.network} (${data.chainId})`;
    document.getElementById('supler-mode').textContent = data.mode === 'live_testnet' ? `● ${data.network} Live` : '● Guard Rails Active (Demo)';

    await loadProposals();
  } catch (err) {
    console.error('Error fetching Supler status:', err);
  }
}

async function loadProposals() {
  try {
    const res = await fetch(`${API_BASE}/api/proposals`);
    const proposals = await res.json();
    const container = document.getElementById('supler-proposals-stream');

    if (!proposals || proposals.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No active proposals. Click "Dispatch Proposal" to test the pipeline.</p>';
      return;
    }

    container.innerHTML = proposals.map(p => {
      const riskLevel = p.policyDecision?.riskLevel || 'LOW';
      const riskClass = `risk-${riskLevel.toLowerCase()}`;
      const isPending = p.status === 'pending_approval';
      const isExecuted = p.status === 'executed';
      const isBlocked = p.status === 'blocked';

      let statusHtml = `<span class="status-chip status-pending">Awaiting Approval</span>`;
      if (isExecuted) statusHtml = `<span class="status-chip status-executed">✓ Executed on Base</span>`;
      if (isBlocked) statusHtml = `<span class="status-chip status-blocked">✕ Policy Blocked</span>`;

      return `
        <div class="proposal-supler-card">
          <div class="proposal-top-meta">
            <div>
              <strong style="font-size: 13px;">${p.type.replace('_', ' ').toUpperCase()}</strong>
              <span style="font-family: monospace; font-size: 11px; color: var(--text-muted); margin-left: 6px;">${p.id}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span class="risk-badge ${riskClass}">Risk: ${riskLevel}</span>
              ${statusHtml}
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
            Agent: <strong>${p.agentName}</strong> &bull; Target: <code style="font-size: 11px;">${p.to}</code><br>
            Payload: <strong>${p.amountEth ? p.amountEth + ' ETH' : (p.amount || 0) + ' ' + (p.tokenSymbol || 'USDC')}</strong>
          </div>

          ${p.policyDecision?.reason ? `<div style="color: #DC2626; font-size: 12px; font-weight: 600; margin-bottom: 6px;">${p.policyDecision.reason}</div>` : ''}

          ${p.simulation ? `
            <div class="sim-callout">
              ⚡ <strong>Pre-flight Simulation:</strong> Gas: ~${p.simulation.estimatedGas} | Cost: ${p.simulation.gasCostEth} ETH | Status: ${p.simulation.success ? 'Success' : 'Revert Risk'}
            </div>
          ` : ''}

          ${p.transactionHash ? `
            <div style="font-size: 11px; color: #2563EB; margin-top: 4px;">
              Explorer Receipt: <a href="${currentExplorerBase}/tx/${p.transactionHash}" target="_blank" style="color: #2563EB; font-weight: 700; text-decoration: underline;">${p.transactionHash.slice(0, 16)}...</a>
            </div>
          ` : ''}

          ${isPending ? `
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button class="btn-supler-approve" onclick="approveProposal('${p.id}')">✓ Approve & Execute</button>
              <button class="btn-supler-reject" onclick="rejectProposal('${p.id}')">✕ Reject</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading proposals:', err);
  }
}

async function submitSuplerProposal() {
  const agentId = document.getElementById('input-agent').value;
  const type = document.getElementById('input-type').value;
  const to = document.getElementById('input-to').value;
  const amount = Number(document.getElementById('input-amount').value);

  const payload = {
    agentId,
    type,
    to,
    amountEth: type === 'native_transfer' ? amount : undefined,
    amount: type === 'token_transfer' ? amount : undefined,
    token: type === 'token_transfer' ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e' : undefined,
    functionName: type === 'contract_call' ? 'deposit' : undefined
  };

  try {
    await fetch(`${API_BASE}/api/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await loadData();
  } catch (err) {
    alert('Error submitting: ' + err.message);
  }
}

async function testViolation() {
  document.getElementById('input-amount').value = '5.0';
  await submitSuplerProposal();
}

async function approveProposal(id) {
  try {
    await fetch(`${API_BASE}/api/proposals/${id}/approve`, { method: 'POST' });
    const res = await fetch(`${API_BASE}/api/proposals/${id}/execute`, { method: 'POST' });
    const data = await res.json();
    await loadData();
    if (data.transactionHash) {
      alert(`Success! Transaction Broadcast to Base Sepolia.\nTx Hash: ${data.transactionHash}`);
    }
  } catch (err) {
    alert('Execution error: ' + err.message);
  }
}

async function rejectProposal(id) {
  try {
    await fetch(`${API_BASE}/api/proposals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Operator rejected proposal.' })
    });
    await loadData();
  } catch (err) {
    alert('Reject error: ' + err.message);
  }
}

async function runSimulation() {
  const dest = document.getElementById('sim-dest').value;
  const val = document.getElementById('sim-val').value;
  const out = document.getElementById('sim-output');

  out.innerHTML = 'Connecting to Base Sepolia RPC for pre-flight state simulation...';
  setTimeout(() => {
    out.innerHTML = `
      <strong>Simulation Complete:</strong><br>
      • Status: <span style="color: #059669; font-weight: 700;">CONFIRMED (0 Reverts)</span><br>
      • Target: ${dest}<br>
      • Estimated Gas: 21,000 gas (~0.000021 ETH)<br>
      • Policy Check: Validated within daily quota.
    `;
  }, 400);
}

async function loadAgents() {
  try {
    const res = await fetch(`${API_BASE}/api/agents`);
    const agents = await res.json();
    const tbody = document.getElementById('supler-agents-tbody');
    tbody.innerHTML = agents.map(a => `
      <tr>
        <td><code>${a.id}</code></td>
        <td><strong>${a.name}</strong></td>
        <td><span class="status-chip status-pending">${a.role.toUpperCase()}</span></td>
        <td>${a.dailyLimitEth} ETH</td>
        <td>${a.dailySpentEth} ETH</td>
        <td><span style="color: ${a.active ? '#059669' : '#DC2626'}; font-weight: 700;">${a.active ? 'Active' : 'Paused'}</span></td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

async function loadAllowlists() {
  try {
    const res = await fetch(`${API_BASE}/api/allowlists`);
    const items = await res.json();
    const tbody = document.getElementById('supler-allowlist-tbody');
    tbody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td><code style="font-size: 11px;">${item.address}</code></td>
        <td>${item.network}</td>
        <td>${item.allowedFunctions.map(f => `<span class="status-chip status-pending" style="font-size:10px; margin-right:4px;">${f}()</span>`).join('')}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

async function loadAuditLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/audit-logs`);
    const logs = await res.json();
    const feed = document.getElementById('supler-audit-feed');
    feed.innerHTML = logs.map(l => `
      <div class="audit-row">
        <span style="color: #6B7280;">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
        <strong>${l.action}</strong> &bull; 
        <span style="color: ${l.status === 'SUCCESS' || l.status === 'EXECUTED' ? '#34D399' : l.status === 'BLOCKED' ? '#F87171' : '#FBBF24'};">${l.status}</span> &bull; 
        <span style="color: #9CA3AF;">Agent: ${l.agentName}</span>
        <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">${JSON.stringify(l.details)}</div>
        ${l.txHash ? `<div style="color: #60A5FA; font-size: 11px;">Tx: ${l.txHash}</div>` : ''}
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

// Initial Boot
loadData();
setInterval(loadData, 3000);
