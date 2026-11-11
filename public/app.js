// Pharos Multi-Protocol Aggregator — Client Controller

let currentAccount = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initWallet();
  loadProtocols();
  initRoutingForm();
  initPortfolioQuery();
  initActionForm();
  // Auto-calculate initial route
  calculateRoute();
});

// 1. Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.getAttribute('data-tab')}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// 2. Wallet Connection (Non-Custodial Client Web3)
function initWallet() {
  const connectBtn = document.getElementById('connect-wallet-btn');
  const useWalletBtn = document.getElementById('use-my-wallet-btn');

  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      handleAccountsChanged(accounts);
    });
  }

  connectBtn.addEventListener('click', async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        handleAccountsChanged(accounts);
      } catch (err) {
        console.warn('Wallet connection cancelled:', err);
      }
    } else {
      alert('No Web3 wallet extension detected (e.g. MetaMask). You can still query any public Pharos address manually.');
    }
  });

  useWalletBtn.addEventListener('click', () => {
    if (currentAccount) {
      document.getElementById('portfolio-address-input').value = currentAccount;
      queryPositions(currentAccount);
    } else {
      alert('Connect your wallet first or enter an address.');
    }
  });
}

function handleAccountsChanged(accounts) {
  const connectBtn = document.getElementById('connect-wallet-btn');
  if (accounts && accounts.length > 0) {
    currentAccount = accounts[0];
    connectBtn.innerText = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
    document.getElementById('action-wallet').value = currentAccount;
    document.getElementById('portfolio-address-input').value = currentAccount;
  } else {
    currentAccount = null;
    connectBtn.innerText = 'Connect Wallet';
  }
}

// 3. Load Protocol Registry
async function loadProtocols() {
  const grid = document.getElementById('protocols-grid');
  grid.innerHTML = '<div class="text-muted">Loading live protocol venues from Pharos RPC...</div>';

  try {
    const res = await fetch('/api/protocols');
    const data = await res.json();

    if (!data.success || !data.venues) {
      grid.innerHTML = '<div class="alert alert-danger">Failed to load protocol registry.</div>';
      return;
    }

    grid.innerHTML = '';
    data.venues.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'protocol-card';

      const statusBadge =
        v.status === 'ONLINE'
          ? '<span class="badge badge-success">ONLINE</span>'
          : `<span class="badge badge-danger">${v.status}</span>`;

      card.innerHTML = `
        <div class="protocol-header">
          <div>
            <div class="protocol-category">${v.category}</div>
            <div class="protocol-title">${v.name}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="text-sm text-muted">
          Contract: <a href="https://www.pharosscan.xyz/address/${v.contractAddress}" target="_blank" class="footer-link font-mono">${v.contractAddress.slice(0, 8)}...${v.contractAddress.slice(-6)}</a>
        </div>
        <div class="metric-row">
          <span class="metric-label">Target Asset:</span>
          <span class="metric-val">${v.underlyingAsset} → ${v.shareAsset}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Reported TVL:</span>
          <span class="metric-val">${v.metrics.tvlFormatted}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Annual Net APY:</span>
          <span class="metric-val text-emerald">${v.metrics.netApyPercent > 0 ? v.metrics.netApyPercent.toFixed(2) + '%' : '0.0% (Wrapper)'}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Exchange Rate:</span>
          <span class="metric-val">${v.metrics.exchangeRate.toFixed(4)} ${v.underlyingAsset}/${v.shareAsset}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Unbonding Window:</span>
          <span class="metric-val">${v.metrics.unbondingPeriodDays > 0 ? v.metrics.unbondingPeriodDays + ' Days' : '0s (Instant)'}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Risk Profile:</span>
          <span class="metric-val">${v.metrics.riskTier}</span>
        </div>
        <div class="text-sm text-muted mt-2">
          ${v.metrics.riskSummary}
        </div>
      `;
      grid.appendChild(card);
    });

    const refreshBtn = document.getElementById('refresh-protocols-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => loadProtocols();
    }
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

// 4. Intelligent Route Calculation
function initRoutingForm() {
  const form = document.getElementById('routing-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculateRoute();
  });
}

async function calculateRoute() {
  const asset = document.getElementById('route-asset').value;
  const amount = document.getElementById('route-amount').value;
  const priority = document.getElementById('route-priority').value;
  const container = document.getElementById('route-result-container');

  container.innerHTML = '<div class="text-muted text-center" style="padding:2rem;">Calculating optimal venue on Pharos Pacific Mainnet...</div>';

  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset, amount, priority }),
    });

    const json = await res.json();
    if (!json.success || !json.decision) {
      container.innerHTML = `<div class="alert alert-danger">${json.error || 'Routing failed'}</div>`;
      return;
    }

    const d = json.decision;
    const v = d.selectedVenue;

    if (!v) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <strong>No Eligible Route:</strong> ${d.selectionSummary}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="alert alert-success">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.15rem;">Selected: ${v.name}</h3>
          <span class="badge badge-success">${v.metrics.netApyPercent > 0 ? v.metrics.netApyPercent.toFixed(2) + '% APY' : '1:1 Parity'}</span>
        </div>
        <p style="margin-top:0.5rem; font-size:0.875rem;">${d.selectionSummary}</p>
      </div>

      <div class="mt-4">
        <h4 style="font-size:0.875rem; text-transform:uppercase; color:var(--text-secondary); margin-bottom:0.5rem;">Why This Venue Was Selected</h4>
        <ul style="padding-left:1.25rem; font-size:0.875rem; line-height:1.6;">
          ${d.detailedReasoning.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>

      <div class="mt-4">
        <h4 style="font-size:0.875rem; text-transform:uppercase; color:var(--accent-warning); margin-bottom:0.5rem;">Relevant Trade-Offs</h4>
        <ul style="padding-left:1.25rem; font-size:0.875rem; line-height:1.6; color:#fed7aa;">
          ${d.tradeOffs.map((t) => `<li>${t}</li>`).join('')}
        </ul>
      </div>

      <div class="mt-4" style="border-top:1px solid var(--border-color); padding-top:0.75rem; display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
        <span>Observed: ${new Date(d.dataProvenance.observationTime).toLocaleTimeString()}</span>
        <span>RPC: Pharos Pacific Mainnet (1672)</span>
      </div>
    `;

    // Render Evaluation Matrix Table
    const tableBody = document.getElementById('evaluation-table-body');
    tableBody.innerHTML = '';

    d.evaluations.forEach((evalItem) => {
      const row = document.createElement('tr');
      const statusBadge = evalItem.isEligible
        ? '<span class="badge badge-success">Eligible</span>'
        : '<span class="badge badge-danger">Excluded</span>';

      const lockupText = evalItem.unbondingDays > 0 ? `${evalItem.unbondingDays.toFixed(1)} Days` : '0 Days (Instant)';

      const factors = evalItem.isEligible
        ? `<span class="text-emerald">${evalItem.pros.join('; ')}</span>`
        : `<span class="text-danger">${evalItem.exclusionReason}</span>`;

      row.innerHTML = `
        <td><strong>${evalItem.venueName}</strong></td>
        <td>${statusBadge}</td>
        <td><strong class="${evalItem.score > 0 ? 'text-emerald' : 'text-muted'}">${evalItem.score.toFixed(1)}</strong></td>
        <td>${evalItem.apyPercent > 0 ? evalItem.apyPercent.toFixed(2) + '%' : '0.0%'}</td>
        <td>${lockupText}</td>
        <td>${evalItem.tvlFormatted}</td>
        <td style="max-width:320px;">${factors}</td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

// 5. Portfolio Position Inspector
function initPortfolioQuery() {
  const btn = document.getElementById('query-positions-btn');
  btn.addEventListener('click', () => {
    const address = document.getElementById('portfolio-address-input').value.trim();
    if (!address || !address.startsWith('0x')) {
      alert('Please enter a valid 0x address.');
      return;
    }
    queryPositions(address);
  });
}

async function queryPositions(address) {
  const tableBody = document.getElementById('positions-table-body');
  tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Querying live contract balances...</td></tr>';

  try {
    const res = await fetch(`/api/positions?address=${address}`);
    const data = await res.json();

    if (!data.success || !data.positions) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center alert-danger">${data.error || 'Query failed'}</td></tr>`;
      return;
    }

    tableBody.innerHTML = '';
    data.positions.forEach((pos) => {
      const row = document.createElement('tr');
      const statusText = pos.canWithdrawImmediately
        ? '<span class="badge badge-success">Instant Unwrapping</span>'
        : '<span class="badge badge-outline">Subject to Unbonding</span>';

      row.innerHTML = `
        <td><strong>${pos.protocolName}</strong></td>
        <td>${pos.assetSymbol}</td>
        <td><a href="https://www.pharosscan.xyz/address/${pos.contractAddress}" target="_blank" class="footer-link font-mono">${pos.contractAddress.slice(0, 8)}...${pos.contractAddress.slice(-6)}</a></td>
        <td><strong>${pos.formattedBalance}</strong></td>
        <td>${pos.underlyingValueFormatted}</td>
        <td>${statusText}</td>
        <td><span class="badge badge-outline">${pos.dataFreshness}</span></td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center alert-danger">Error: ${err.message}</td></tr>`;
  }
}

// 6. Transaction Preparation Workspace
function initActionForm() {
  const form = document.getElementById('action-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const protocolId = document.getElementById('action-protocol').value;
    const operation = document.getElementById('action-type').value;
    const amount = document.getElementById('action-amount').value;
    const userAddress = document.getElementById('action-wallet').value.trim();

    const previewContainer = document.getElementById('tx-preview-container');
    previewContainer.innerHTML = '<div class="text-muted text-center" style="padding:2rem;">Validating parameters and compiling calldata...</div>';

    try {
      const res = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId, operation, amount, userAddress }),
      });

      const json = await res.json();
      if (!json.success || !json.transaction) {
        previewContainer.innerHTML = `<div class="alert alert-danger">${json.error || 'Failed to prepare transaction'}</div>`;
        return;
      }

      const tx = json.transaction;
      renderTransactionPreview(tx);
    } catch (err) {
      previewContainer.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  });
}

function renderTransactionPreview(tx) {
  const container = document.getElementById('tx-preview-container');

  const approvalBlock = tx.approvalTransaction
    ? `
      <div class="alert alert-warning mt-4">
        <strong>Prior Approval Required:</strong> Faroo stPROS requires an initial ERC-20 approval on WPROS.
        <div class="code-box mt-2">${tx.approvalTransaction.data}</div>
      </div>
    `
    : '';

  container.innerHTML = `
    <div class="alert alert-info">
      <strong>Action Prepared:</strong> ${tx.description}
      <div style="font-size:0.75rem; margin-top:0.25rem;">Status: <span class="badge badge-warning">Awaiting User Signature</span></div>
    </div>

    <div class="metric-row mt-2">
      <span class="metric-label">Destination Contract:</span>
      <span class="metric-val font-mono">${tx.to}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Target Network:</span>
      <span class="metric-val">Pharos Pacific Mainnet (Chain ID: ${tx.chainId})</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Native Value (Wei):</span>
      <span class="metric-val font-mono">${tx.value}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Function Signature:</span>
      <span class="metric-val font-mono">${tx.functionSignature}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Gas Limit:</span>
      <span class="metric-val">${parseInt(tx.gasLimit, 16).toLocaleString()} units</span>
    </div>

    <div class="mt-4">
      <label style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary); font-weight:600;">Compiled EVM Calldata Payload</label>
      <div class="code-box">${tx.data}</div>
    </div>

    ${approvalBlock}

    <div class="mt-4" style="display:flex; gap:0.5rem;">
      <button class="btn btn-primary" onclick="window.sendToWallet('${tx.to}', '${tx.value}', '${tx.data}')">
        Review & Send to Wallet
      </button>
      <a href="${tx.contractExplorerUrl}" target="_blank" class="btn btn-secondary">
        View Contract on PharosScan
      </a>
    </div>
  `;
}

window.sendToWallet = async (to, value, data) => {
  if (!window.ethereum) {
    alert('Please install a Web3 wallet (such as MetaMask) to sign this transaction non-custodially.');
    return;
  }
  try {
    const from = currentAccount || (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0];
    await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from,
          to,
          value,
          data,
        },
      ],
    });
  } catch (err) {
    console.log('Wallet rejected or closed prompt:', err);
  }
};

// 7. Fault Simulation Sandbox (Requirement 4)
window.runFaultSimulation = async (mode) => {
  const container = document.getElementById('fault-results-container');
  container.innerHTML = '<div class="text-muted">Injecting fault and probing resilience...</div>';

  const fault = mode === 'CLEAR' ? '' : mode;
  try {
    const res = await fetch(`/api/fault-test?target=faroo-stpros&fault=${fault}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="alert alert-success">
        <strong>${data.testDescription}</strong>
        <p style="margin-top:0.25rem;">${data.conclusion}</p>
      </div>

      <div class="grid-2col mt-4">
        <div class="card">
          <h4>Degraded Protocol Observation</h4>
          <div class="metric-row mt-2">
            <span class="metric-label">Target:</span>
            <span class="metric-val">${data.degradedVenueStatus.name}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Status:</span>
            <span class="metric-val text-danger"><strong>${data.degradedVenueStatus.status}</strong></span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Injected Error:</span>
            <span class="metric-val font-mono" style="font-size:0.75rem;">${data.degradedVenueStatus.errorMessage}</span>
          </div>
        </div>

        <div class="card">
          <h4>Failover Routing Outcome</h4>
          <div class="metric-row mt-2">
            <span class="metric-label">Surviving Venues:</span>
            <span class="metric-val text-emerald">${data.survivingVenuesCount} Online</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Failover Selection:</span>
            <span class="metric-val text-emerald"><strong>${data.failoverRoutingDecision.selectedVenue}</strong></span>
          </div>
          <p class="text-sm text-muted mt-2">${data.failoverRoutingDecision.selectionSummary}</p>
        </div>
      </div>
    `;

    // Also reload protocols to show degraded status
    loadProtocols();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
};
