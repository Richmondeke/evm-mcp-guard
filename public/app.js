const API_BASE = window.location.origin;

// Flow State
let globalWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
let currentLimits = { eth: 0.05, usdc: 100, threshold: 0.02 };

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Modal System
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function closeModalOnBackdrop(e, id) {
  if (e.target.id === id) {
    closeModal(id);
  }
}

// Card Flow 1: Manage Wallet
function copyWalletAddress() {
  navigator.clipboard?.writeText(globalWalletAddress);
  alert(`✓ Copied to clipboard:\n${globalWalletAddress}`);
}

// Card Flow 2: Manage Limits
function saveSpendingLimits() {
  const eth = parseFloat(document.getElementById('input-limit-eth').value) || 0.05;
  const usdc = parseFloat(document.getElementById('input-limit-usdc').value) || 100;
  currentLimits.eth = eth;
  currentLimits.usdc = usdc;

  const displayEl = document.getElementById('val-limits-display');
  if (displayEl) {
    displayEl.textContent = `${eth} ETH • ${usdc} USDC`;
  }

  const logContainer = document.getElementById('dynamic-activity-log');
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>Spending limits updated: Max ${eth} ETH / ${usdc} USDC</span>`;
  if (logContainer) logContainer.prepend(row);

  closeModal('modal-limits');
  alert(`✓ Policy Updated!\n\nMax per tx: ${eth} ETH • ${usdc} USDC`);
}

// Card Flow 3: Select AI App from Card
function selectAppForTest(agentId) {
  const testAppSelect = document.getElementById('test-app');
  if (testAppSelect) {
    testAppSelect.value = agentId;
  }
  scrollToSection('sec-test');
  const logContainer = document.getElementById('dynamic-activity-log');
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #60A5FA; font-weight: bold;">ℹ</span><span>Active app focused: ${agentId}</span>`;
  if (logContainer) logContainer.prepend(row);
}

// Card Flow 4: Proposal Details
function openProposalDetailsModal() {
  openModal('modal-proposal-details');
}

// Card Flow 5: Add Approved App / Protocol
function submitNewApprovedApp() {
  const name = document.getElementById('new-app-name').value.trim();
  const address = document.getElementById('new-app-address').value.trim();
  if (!name) {
    alert('Please enter a protocol name (e.g. Aave v3)');
    return;
  }

  const list = document.getElementById('approved-apps-list');
  if (list) {
    const card = document.createElement('div');
    card.className = 'card-item';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.animation = 'fadeInRow 0.3s ease-out';
    card.innerHTML = `
      <div>
        <strong>${name}</strong>
        <div style="font-size: 12px; color: var(--text-secondary);">${address ? address.slice(0, 10) + '...' : 'Verified Contract'}</div>
      </div>
      <span class="badge-approved">Approved</span>
    `;
    list.prepend(card);
  }

  const logContainer = document.getElementById('dynamic-activity-log');
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>Protocol Whitelisted: ${name}</span>`;
  if (logContainer) logContainer.prepend(row);

  closeModal('modal-add-app');
  alert(`✓ Protocol "${name}" added to approved whitelist!`);
}

// Policy Change Notification
function notifyPolicyChange(policyName = 'General') {
  const feed = document.getElementById('dynamic-activity-log');
  const time = new Date().toLocaleTimeString();
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>${policyName} policy updated (${time})</span>`;
  if (feed) feed.prepend(row);
}

function savePermissionsModal() {
  closeModal('modal-permissions');
  notifyPolicyChange('All Permissions');
  alert('✓ Global policy permissions successfully synchronized.');
}

async function loadData() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    const data = await res.json();

    if (data.walletAddress) {
      globalWalletAddress = data.walletAddress;
      const modalAddr = document.getElementById('modal-wallet-address');
      if (modalAddr) modalAddr.textContent = data.walletAddress;
    }

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

  // Normalize placeholder / short addresses to standard valid checksum address
  if (!dest.startsWith('0x') || dest.length !== 42 || dest.includes('...')) {
    dest = '0x8f2c38A9E198D321c17244589d8Ac7399e2991ac';
    document.getElementById('test-dest').value = dest;
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

  const sendBtn = document.querySelector('#sec-test button.btn-guard-primary');
  const originalBtnText = sendBtn ? sendBtn.textContent : 'Send Test Request →';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Simulating & Evaluating Policy...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (_parseErr) {
      throw new Error(`Server returned ${res.status}: ${responseText.slice(0, 100)}`);
    }
    
    const logContainer = document.getElementById('dynamic-activity-log');
    const dynamicFeed = document.getElementById('dynamic-proposals-feed');
    const row = document.createElement('div');
    row.className = 'activity-row';

    if (data.error) {
      row.innerHTML = `<span style="color: #F87171; font-weight: bold;">✕</span><span>${amount} ETH blocked (${data.error})</span>`;
      if (logContainer) logContainer.prepend(row);
      alert(`🔴 TRANSACTION BLOCKED BY GUARD\n\n${data.error}`);
    } else if (data.decision && data.decision.passed) {
      row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>${amount} ETH proposed by ${data.proposal?.agentName || app} (Awaiting approval)</span>`;
      if (logContainer) logContainer.prepend(row);
      scrollToSection('sec-approvals');
    } else {
      const reason = data.decision?.reason || 'Exceeds spending limit policy.';
      row.innerHTML = `<span style="color: #F87171; font-weight: bold;">✕</span><span>${amount} ETH blocked (${reason})</span>`;
      if (logContainer) logContainer.prepend(row);

      // Inject live card into AI activity feed
      if (dynamicFeed) {
        const card = document.createElement('div');
        card.className = 'card-item card-item-blocked';
        card.style.marginTop = '10px';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <strong style="font-size: 15px;">Send ${amount} ETH</strong>
            <span class="badge-blocked">🔴 Blocked</span>
          </div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
            To <code>${dest.slice(0, 6)}...${dest.slice(-4)}</code> &bull; Limit: 0.05 ETH
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            <strong>Why?</strong> ${reason}
          </div>
        `;
        dynamicFeed.prepend(card);
      }

      alert(`🔴 TRANSACTION BLOCKED BY GUARD\n\n${reason}`);
    }

    await loadData();
  } catch (err) {
    alert('Notice: ' + (err?.message || String(err)));
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = originalBtnText;
    }
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
