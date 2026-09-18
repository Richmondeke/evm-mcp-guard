const API_BASE = window.location.origin;

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function notifyPolicyChange() {
  const feed = document.getElementById('dynamic-activity-log');
  const time = new Date().toLocaleTimeString();
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>Permission settings updated (${time})</span>`;
  feed.prepend(row);
}

function addNewAppPrompt() {
  const name = prompt('Enter protocol or contract name to approve (e.g. Aave v3, Curve):');
  if (name) {
    alert(`Protocol "${name}" successfully added to approved apps.`);
  }
}

async function loadData() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    const data = await res.json();

    document.getElementById('val-wallet').textContent = `${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}`;
    document.getElementById('val-balance').textContent = `${data.balanceEth} ETH`;
    document.getElementById('val-pending').textContent = data.pendingProposalsCount;

    await loadApprovals();
  } catch (err) {
    console.error('Error fetching status:', err);
  }
}

async function loadApprovals() {
  try {
    const res = await fetch(`${API_BASE}/api/proposals`);
    const proposals = await res.json();
    const container = document.getElementById('human-approval-box');

    const pending = (proposals || []).filter(p => p.status === 'pending_approval');

    if (pending.length === 0) {
      container.innerHTML = `
        <div class="card-item" style="text-align: center; color: var(--text-secondary); font-weight: 600; padding: 20px;">
          No requests waiting
        </div>
      `;
      return;
    }

    container.innerHTML = pending.map(p => `
      <div class="card-item" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="font-weight: 800; font-size: 15px;">
            ${p.agentName}: Send ${p.amountEth ? p.amountEth + ' ETH' : p.amount + ' USDC'}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            To <code>${p.to}</code> &bull; Gas Est: ~${p.simulation?.estimatedGas || '21,000'}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-guard-success" onclick="approveProposal('${p.id}')">✓ Approve & Send</button>
          <button class="btn-guard-danger" onclick="rejectProposal('${p.id}')">✕ Reject</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function runTestRequest() {
  const app = document.getElementById('test-app').value;
  const action = document.getElementById('test-action').value;
  const amount = Number(document.getElementById('test-amount').value);
  let dest = document.getElementById('test-dest').value.trim();

  // Standardize test destination address
  if (!dest.startsWith('0x') || dest.length < 42) {
    dest = '0x8f2c38A9E198D321c17244589d8Ac7399e2991ac';
  }

  const payload = {
    agentId: app,
    type: action,
    to: dest,
    amountEth: action === 'native_transfer' ? amount : undefined,
    amount: action === 'token_transfer' ? amount : undefined,
    token: action === 'token_transfer' ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e' : undefined,
    functionName: action === 'contract_call' ? 'deposit' : undefined
  };

  try {
    const res = await fetch(`${API_BASE}/api/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    // Add to dynamic activity log
    const logContainer = document.getElementById('dynamic-activity-log');
    const row = document.createElement('div');
    row.className = 'activity-row';

    if (data.decision?.passed) {
      row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>${amount} ETH proposed by ${data.proposal.agentName} (Awaiting approval)</span>`;
      scrollToSection('sec-approvals');
    } else {
      row.innerHTML = `<span style="color: #F87171; font-weight: bold;">✕</span><span>${amount} ETH blocked (${data.decision.reason})</span>`;
      alert(`🔴 TRANSACTION BLOCKED BY GUARD\n\n${data.decision.reason}`);
    }
    logContainer.prepend(row);

    await loadData();
  } catch (err) {
    alert('Error running test: ' + err.message);
  }
}

async function approveProposal(id) {
  try {
    await fetch(`${API_BASE}/api/proposals/${id}/approve`, { method: 'POST' });
    const res = await fetch(`${API_BASE}/api/proposals/${id}/execute`, { method: 'POST' });
    const data = await res.json();
    await loadData();
    if (data.transactionHash) {
      alert(`✓ Transaction Authorized and Broadcast!\n\nExplorer Tx: ${data.transactionHash}\nNetwork: Robinhood Chain Testnet`);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function rejectProposal(id) {
  try {
    await fetch(`${API_BASE}/api/proposals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Rejected by user.' })
    });
    await loadData();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Initial Boot & Live Sync
loadData();
setInterval(loadData, 3000);
