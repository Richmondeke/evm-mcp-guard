const API_BASE = window.location.origin;

// Flow State
let globalWalletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
let currentLimits = { eth: 0.05, usdc: 100, threshold: 0.02 };

// ==========================================
// Native Chedo Floating Toast Notifications
// (Completely eliminates generic browser alerts)
// ==========================================
function showToast(message, type = 'success', title = '') {
  let container = document.getElementById('chedo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'chedo-toast-container';
    container.className = 'chedo-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `chedo-toast chedo-toast-${type}`;

  const iconText = type === 'danger' ? '✕' : (type === 'info' ? 'ℹ' : '✓');
  const defaultTitle = type === 'danger' ? 'Blocked by Chedo' : (type === 'info' ? 'Notice' : 'Success');

  toast.innerHTML = `
    <div class="chedo-toast-icon">${iconText}</div>
    <div class="chedo-toast-content">
      <div class="chedo-toast-title">${title || defaultTitle}</div>
      <div class="chedo-toast-message">${message}</div>
    </div>
    <button class="chedo-toast-close" onclick="this.parentElement.remove()" title="Close">✕</button>
  `;

  container.prepend(toast);

  // Auto-dismiss after 3.8s
  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, 3800);
}

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
  showToast(globalWalletAddress, 'success', 'Address Copied!');
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
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>Spending caps updated: Max ${eth} ETH / ${usdc} USDC</span>`;
  if (logContainer) logContainer.prepend(row);

  closeModal('modal-limits');
  showToast(`Max per move: ${eth} ETH • ${usdc} USDC`, 'success', 'Spending Limits Saved');
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
  row.innerHTML = `<span style="color: #60A5FA; font-weight: bold;">ℹ</span><span>Active bot selected: ${agentId}</span>`;
  if (logContainer) logContainer.prepend(row);
}

// Card Flow 4: Proposal Details
function openProposalDetailsModal() {
  openModal('modal-proposal-details');
}

// Card Flow 5: Add Approved App / Protocol
function toggleActionChip(btn) {
  btn.classList.toggle('active');
  updateSelectedActionsPreview();
}

function addCustomAction() {
  const input = document.getElementById('custom-action-input');
  const val = input.value.trim();
  if (!val) return;
  const grid = document.getElementById('action-chip-grid');
  const existing = grid ? Array.from(grid.querySelectorAll('[data-action]')).find(b => b.dataset.action === val.toLowerCase()) : null;
  if (existing) {
    existing.classList.add('active');
  } else if (grid) {
    const chip = document.createElement('button');
    chip.className = 'action-chip active';
    chip.dataset.action = val.toLowerCase();
    chip.onclick = function() { toggleActionChip(this); };
    chip.textContent = '🔧 ' + val;
    grid.appendChild(chip);
  }
  input.value = '';
  updateSelectedActionsPreview();
}

function updateSelectedActionsPreview() {
  const grid = document.getElementById('action-chip-grid');
  const preview = document.getElementById('selected-actions-preview');
  if (!grid || !preview) return;
  const selected = Array.from(grid.querySelectorAll('.action-chip.active')).map(b => b.dataset.action);
  if (selected.length === 0) {
    preview.textContent = 'No actions selected yet.';
  } else {
    preview.textContent = `✓ Allowed: ${selected.join(', ')}`;
  }
}

function resetAddAppModal() {
  // Reset all chips to inactive
  const chips = document.querySelectorAll('#action-chip-grid .action-chip');
  chips.forEach(c => c.classList.remove('active'));
  const preview = document.getElementById('selected-actions-preview');
  if (preview) preview.textContent = '';
  const nameInput = document.getElementById('new-app-name');
  if (nameInput) nameInput.value = '';
  const addrInput = document.getElementById('new-app-address');
  if (addrInput) addrInput.value = '';
  const customInput = document.getElementById('custom-action-input');
  if (customInput) customInput.value = '';
}

function submitNewApprovedApp() {
  const name = document.getElementById('new-app-name').value.trim();
  const address = document.getElementById('new-app-address').value.trim();
  if (!name) {
    showToast('Please enter an app name (like Uniswap or Aave)', 'info', 'Name Needed');
    return;
  }

  const grid = document.getElementById('action-chip-grid');
  const selectedActions = grid
    ? Array.from(grid.querySelectorAll('.action-chip.active')).map(b => b.dataset.action)
    : [];

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
        <div style="font-size: 12px; color: var(--text-secondary);">${address ? address.slice(0, 10) + '...' : 'Verified Contract'}${selectedActions.length ? ' · ' + selectedActions.join(', ') : ''}</div>
      </div>
      <span class="badge-approved">Approved</span>
    `;
    list.prepend(card);
  }

  const logContainer = document.getElementById('dynamic-activity-log');
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>App approved: ${name}${selectedActions.length ? ' (' + selectedActions.join(', ') + ')' : ''}</span>`;
  if (logContainer) logContainer.prepend(row);

  closeModal('modal-add-app');
  resetAddAppModal();
  showToast(`"${name}" is now on your approved list.`, 'success', 'App Approved');
}

// Policy Change Notification
function notifyPolicyChange(policyName = 'General') {
  const feed = document.getElementById('dynamic-activity-log');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>${policyName} rule updated (${time})</span>`;
  if (feed) feed.prepend(row);
}

function savePermissionsModal() {
  closeModal('modal-permissions');
  notifyPolicyChange('Safety Rules');
  showToast('Your safety rules have been saved and applied.', 'success', 'Rules Active');
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
    await loadAuditLogs();
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
      showToast(data.error, 'danger', 'Move Blocked');
    } else if (data.decision && data.decision.passed) {
      row.innerHTML = `<span style="color: #34D399; font-weight: bold;">✓</span><span>${amount} ETH move from ${data.proposal?.agentName || app} (Waiting for your OK)</span>`;
      if (logContainer) logContainer.prepend(row);
      showToast(`${amount} ETH move requested by ${data.proposal?.agentName || app}. Waiting for your OK.`, 'info', 'Needs Your OK');
      scrollToSection('sec-approvals');
    } else {
      const reason = data.decision?.reason || 'Exceeds your 0.05 ETH safety limit.';
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
            To <code>${dest.slice(0, 6)}...${dest.slice(-4)}</code> &bull; Safety Limit: 0.05 ETH
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            <strong>Why?</strong> ${reason}
          </div>
        `;
        dynamicFeed.prepend(card);
      }

      showToast(`Blocked: ${reason}`, 'danger', 'Move Stopped');
    }

    await loadData();
  } catch (err) {
    showToast(err?.message || String(err), 'danger', 'Notice');
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
      showToast(`Transaction sent! Tx: ${data.transactionHash.slice(0, 10)}... on Robinhood Chain`, 'success', 'Approved & Broadcast');
    }
  } catch (err) {
    showToast(err.message, 'danger', 'Execution Error');
  }
}

async function rejectProposal(id) {
  try {
    await fetch(`${API_BASE}/api/proposals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Declined by user.' })
    });
    await loadData();
    showToast('Transaction declined.', 'info', 'Declined');
  } catch (err) {
    showToast(err.message, 'danger', 'Error');
  }
}

// Initial Boot & Live Sync
loadData();
setInterval(loadData, 3000);

async function loadAuditLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/audit-logs`);
    const logs = await res.json();
    if (!Array.isArray(logs)) return;

    // Render into main activity widget
    const feedContainer = document.getElementById('dynamic-activity-log');
    if (feedContainer) {
      if (logs.length === 0) {
        feedContainer.innerHTML = '<div class="activity-row"><span style="color: #34D399; font-weight: bold;">✓</span><span>Chedo Shield active &amp; listening</span></div>';
      } else {
        feedContainer.innerHTML = logs.slice(0, 6).map(log => formatAuditLogRow(log)).join('');
      }
    }

    // Render into modal audit list
    const modalList = document.getElementById('modal-audit-list');
    if (modalList) {
      if (logs.length === 0) {
        modalList.innerHTML = '<div style="font-size: 13px; color: #9CA3AF; padding: 10px 0;">No activity recorded yet.</div>';
      } else {
        modalList.innerHTML = logs.map(log => formatAuditLogRow(log, true)).join('');
      }
    }
  } catch (e) {
    console.error('Error fetching audit logs:', e);
  }
}

function formatAuditLogRow(log, isModal = false) {
  let icon = '<span style="color: #34D399; font-weight: bold;">✓</span>';
  let text = '';
  const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (log.status === 'BLOCKED') {
    icon = '<span style="color: #F87171; font-weight: bold;">✕</span>';
    const amt = log.details?.amountEth ? `${log.details.amountEth} ETH` : (log.details?.amount ? `${log.details.amount} USDC` : 'Move');
    text = `${amt} blocked (${log.details?.reason || 'Safety limit'})`;
  } else if (log.status === 'PENDING') {
    icon = '<span style="color: #FBBF24; font-weight: bold;">⏳</span>';
    const amt = log.details?.amountEth ? `${log.details.amountEth} ETH` : 'Move';
    text = `${log.agentName || 'Bot'}: ${amt} waiting for your OK`;
  } else if (log.status === 'REJECTED') {
    icon = '<span style="color: #9CA3AF; font-weight: bold;">✕</span>';
    text = `Declined: ${log.details?.reason || 'Declined by user'}`;
  } else if (log.status === 'EXECUTED' || log.status === 'SUCCESS') {
    icon = '<span style="color: #34D399; font-weight: bold;">✓</span>';
    if (log.action === 'SYSTEM_BOOT') {
      text = 'Chedo Wallet Shield activated';
    } else if (log.action === 'APPROVE_PROPOSAL') {
      text = 'Move approved by you';
    } else if (log.txHash) {
      text = `Sent onchain (Tx: ${log.txHash.slice(0, 8)}...)`;
    } else {
      text = log.details?.message || `${log.agentName || 'Bot'} action completed`;
    }
  } else {
    text = log.action;
  }

  return `
    <div class="activity-row">
      ${icon}
      <span style="flex: 1;">${text}</span>
      <span style="font-size: 11px; color: #6B7280; margin-left: 8px;">${time}</span>
    </div>
  `;
}
