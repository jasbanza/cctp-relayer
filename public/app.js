// CCTP Relayer - Noble to Solana
// Vanilla JS implementation for GitHub Pages hosting

const { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } = solanaWeb3;

// ============ State ============
let phantomWallet = null;
let walletPublicKey = null;
let activeTab = 'receive'; // 'send' | 'receive'
let nobleWalletAddress = null;
let nobleUsdcBalance = 0n;

// ============ DOM Elements ============
const elements = {
    // Config
    sourceChain: document.getElementById('sourceChain'),
    destChain: document.getElementById('destChain'),
    sourceDomainId: document.getElementById('sourceDomainId'),
    destDomainId: document.getElementById('destDomainId'),
    nobleRpc: document.getElementById('nobleRpc'),
    solanaRpc: document.getElementById('solanaRpc'),
    apiBase: document.getElementById('apiBase'),
    attestationApi: document.getElementById('attestationApi'),
    messageTransmitter: document.getElementById('messageTransmitter'),
    tokenMessengerMinter: document.getElementById('tokenMessengerMinter'),
    
    // Transaction
    nobleTxHash: document.getElementById('nobleTxHash'),
    messageBase64: document.getElementById('messageBase64'),
    messageHex: document.getElementById('messageHex'),
    
    // Attestation
    messageHash: document.getElementById('messageHash'),
    attestationStatus: document.getElementById('attestationStatus'),
    attestation: document.getElementById('attestation'),
    viewOnExplorer: document.getElementById('viewOnExplorer'),
    
    // Wallet
    walletStatus: document.getElementById('walletStatus'),
    walletAddress: document.getElementById('walletAddress'),
    solanaTxHash: document.getElementById('solanaTxHash'),
    viewOnSolscan: document.getElementById('viewOnSolscan'),
    
    // Buttons
    fetchTxBtn: document.getElementById('fetchTxBtn'),
    convertToHexBtn: document.getElementById('convertToHexBtn'),
    computeHashBtn: document.getElementById('computeHashBtn'),
    fetchAttestationBtn: document.getElementById('fetchAttestationBtn'),
    connectWalletBtn: document.getElementById('connectWalletBtn'),
    relayBtn: document.getElementById('relayBtn'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    
    // Logs
    logs: document.getElementById('logs'),

    // Send (Noble) tab elements
    nobleWalletStatus: document.getElementById('nobleWalletStatus'),
    nobleWalletAddress: document.getElementById('nobleWalletAddress'),
    nobleUsdcBalance: document.getElementById('nobleUsdcBalance'),
    connectNobleWalletBtn: document.getElementById('connectNobleWalletBtn'),
    sendDestChain: document.getElementById('sendDestChain'),
    sendDestAddress: document.getElementById('sendDestAddress'),
    usePhantomAddressBtn: document.getElementById('usePhantomAddressBtn'),
    sendAmount: document.getElementById('sendAmount'),
    sendAmountMaxBtn: document.getElementById('sendAmountMaxBtn'),
    sendFromNobleBtn: document.getElementById('sendFromNobleBtn'),
    goToReceiveBtn: document.getElementById('goToReceiveBtn'),
};

// Tab buttons and contents
const tabs = {
    send: document.getElementById('tab-send'),
    receive: document.getElementById('tab-receive'),
};

const tabContents = {
    send: document.getElementById('send-tab'),
    receive: document.getElementById('receive-tab'),
};

// Progress steps
const steps = {
    config: document.getElementById('step-config'),
    source: document.getElementById('step-source'),
    attestation: document.getElementById('step-attestation'),
    relay: document.getElementById('step-relay'),
};

// Sections (cards)
const sections = {
    config: document.getElementById('section-config'),
    source: document.getElementById('section-source'),
    attestation: document.getElementById('section-attestation'),
    relay: document.getElementById('section-relay'),
};

// ============ Logging ============
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-${type}">${message}</span>`;
    
    elements.logs.appendChild(entry);
    elements.logs.scrollTop = elements.logs.scrollHeight;
}

function clearLogs() {
    elements.logs.innerHTML = '';
}

// ============ Utility Functions ============
function scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    // If section was collapsed, expand it before scrolling
    el.classList.remove('card-collapsed');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setStepState(stepKey, state) {
    const step = steps[stepKey];
    if (!step) return;

    step.classList.remove('is-active', 'is-done');
    if (state === 'active') step.classList.add('is-active');
    if (state === 'done') step.classList.add('is-done');
}

// Map progress steps to section ids for navigation
const stepToSection = {
    config: 'section-config',
    source: 'section-source',
    attestation: 'section-attestation',
    relay: 'section-relay',
};

// Make progress steps clickable for navigation
Object.entries(steps).forEach(([key, el]) => {
    if (!el) return;
    el.addEventListener('click', () => {
        const sectionId = stepToSection[key];
        if (sectionId) {
            scrollToSection(sectionId);
        }
    });
});

// Helpers to mark sections as completed / collapsed
function setSectionCompleted(sectionKey, options = {}) {
    const { collapse = false } = options;
    const section = sections[sectionKey];
    if (!section) return;

    section.classList.add('card-completed');
    if (collapse) {
        section.classList.add('card-collapsed');
    }
}

function toggleSectionCollapsed(sectionKey) {
    const section = sections[sectionKey];
    if (!section) return;
    section.classList.toggle('card-collapsed');
}

// Make section headers clickable to expand/collapse
Object.entries(sections).forEach(([key, el]) => {
    if (!el) return;
    const header = el.querySelector('h2');
    if (!header) return;
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
        toggleSectionCollapsed(key);
    });
});

// Make top-level tabs clickable
if (tabs.send) {
    tabs.send.addEventListener('click', () => setActiveTab('send'));
}
if (tabs.receive) {
    tabs.receive.addEventListener('click', () => setActiveTab('receive'));
}

// Byte utilities for browsers (avoid Node Buffer)
const textEncoder = new TextEncoder();

function bytesFromString(str) {
    return textEncoder.encode(str);
}

function u32ToBytesLE(num) {
    const arr = new Uint8Array(4);
    const view = new DataView(arr.buffer);
    view.setUint32(0, num, true);
    return arr;
}

function u64ToBytesLE(big) {
    const arr = new Uint8Array(8);
    const view = new DataView(arr.buffer);
    view.setBigUint64(0, big, true);
    return arr;
}

function concatUint8Arrays(arrays) {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        out.set(a, offset);
        offset += a.length;
    }
    return out;
}

function base64ToHex(base64) {
    const binary = atob(base64);
    let hex = '';
    for (let i = 0; i < binary.length; i++) {
        hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return '0x' + hex;
}

function hexToBytes(hex) {
    hex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Debug function to investigate PDA derivation
function debugPdaDerivation() {
    const messageTransmitterProgramId = new PublicKey('CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd');
    
    // Known working values from successful transaction (nonce 288574)
    // Key finding: on-chain data shows firstNonce = 288001, NOT 288000!
    // CCTP uses 1-indexed buckets: firstNonce = floor((nonce-1)/6400)*6400 + 1
    const knownUsedNonces = '3ewgRKdMT8WjPjExuVuZ9gZ7qDYwquefpwtL1SUkLCxf';
    const sourceDomain = 4;  // Noble
    
    const results = [];
    
    // Helper to try a derivation
    function tryDerivation(name, seeds) {
        try {
            const [pda, bump] = PublicKey.findProgramAddressSync(seeds, messageTransmitterProgramId);
            const match = pda.toString() === knownUsedNonces;
            console.log(`${name}: ${pda.toString()} (bump=${bump}) ${match ? '✅ MATCH!' : ''}`);
            results.push({ name, pda: pda.toString(), bump, match });
            return match;
        } catch (e) {
            console.log(`${name}: ERROR - ${e.message}`);
            return false;
        }
    }
    
    console.log('=== PDA Derivation Investigation ===');
    console.log('Known working PDA:', knownUsedNonces);
    console.log('Program:', messageTransmitterProgramId.toString());
    console.log('');
    
    // Standard LE encoding - with CORRECTED first nonce (288001 not 288000)
    const seed1 = bytesFromString('used_nonces');
    const domainLE = u32ToBytesLE(sourceDomain);
    
    // The BUG was here: using 288000 instead of 288001
    // CCTP buckets are 1-indexed: firstNonce = floor((nonce-1)/6400)*6400 + 1
    const wrongNonce = 288000n;  // What we were using
    const correctNonce = 288001n; // What CCTP actually uses (from on-chain data)
    
    console.log('=== KEY FINDING ===');
    console.log('On-chain firstNonce from account data: 288001');
    console.log('What we were calculating: 288000');
    console.log('CCTP uses 1-indexed buckets!');
    console.log('Formula: firstNonce = floor((nonce-1)/6400)*6400 + 1');
    console.log('');
    
    console.log('Testing with WRONG nonce (288000):');
    tryDerivation('WRONG: [used_nonces, domain_le, 288000_le]', [seed1, domainLE, u64ToBytesLE(wrongNonce)]);
    
    console.log('');
    console.log('Testing with CORRECT nonce (288001):');
    tryDerivation('CORRECT: [used_nonces, domain_le, 288001_le]', [seed1, domainLE, u64ToBytesLE(correctNonce)]);
    
    console.log('');
    console.log('=== Summary ===');
    const matched = results.filter(r => r.match);
    if (matched.length > 0) {
        console.log('✅ FOUND MATCH:', matched[0].name);
        console.log('');
        console.log('FIX: Change bucket calculation from:');
        console.log('  nonceBucket = (nonce / 6400n) * 6400n');
        console.log('To:');
        console.log('  nonceBucket = ((nonce - 1n) / 6400n) * 6400n + 1n');
    } else {
        console.log('No matches found.');
    }
    
    return results;
}

// Expose debug function globally for console testing
window.debugPdaDerivation = debugPdaDerivation;

function getApiBase() {
    if (!elements.apiBase) return '';
    const raw = elements.apiBase.value.trim();
    if (!raw) return '';
    // Strip trailing slashes
    return raw.replace(/\/+$/, '');
}

// ============ Noble (Keplr) Wallet ============
async function connectNobleWallet() {
    try {
        if (!window.keplr || !window.getOfflineSigner) {
            log('Keplr extension not found. Please install Keplr and refresh.', 'error');
            return;
        }

        const chainId = 'noble-1';
        log('Connecting to Keplr (Noble)...', 'info');
        await window.keplr.enable(chainId);

        const offlineSigner = window.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error('No Noble accounts available in Keplr');
        }

        nobleWalletAddress = accounts[0].address;
        elements.nobleWalletAddress.textContent =
            nobleWalletAddress.substring(0, 10) +
            '...' +
            nobleWalletAddress.substring(nobleWalletAddress.length - 8);
        elements.nobleWalletStatus.textContent = 'Connected';
        elements.nobleWalletStatus.className = 'status-badge status-connected';

        log(`Connected Noble wallet: ${nobleWalletAddress}`, 'success');

        // Load Noble USDC balance
        await loadNobleUsdcBalance();
    } catch (error) {
        log(`Failed to connect Keplr (Noble): ${error.message}`, 'error');
    }
}

async function loadNobleUsdcBalance() {
    if (!nobleWalletAddress) return;
    const lcdBase = elements.nobleRpc?.value?.trim();
    if (!lcdBase) {
        log('Noble LCD API URL is empty; cannot load Noble balance.', 'error');
        return;
    }

    const url = `${lcdBase}/cosmos/bank/v1beta1/balances/${nobleWalletAddress}`;
    log('Fetching Noble USDC balance...', 'info');

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const balances = data.balances || [];

        // Noble native USDC denom (uusdc)
        const usdc = balances.find((b) => b.denom === 'uusdc');
        if (!usdc) {
            nobleUsdcBalance = 0n;
        } else {
            nobleUsdcBalance = BigInt(usdc.amount || '0');
        }

        const human = Number(nobleUsdcBalance) / 1_000_000;
        elements.nobleUsdcBalance.value = human.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
        });

        log(`Noble USDC balance: ${human}`, 'info');
        updateSendFromNobleButton();
    } catch (error) {
        log(`Failed to fetch Noble USDC balance: ${error.message}`, 'error');
        elements.nobleUsdcBalance.value = 'Error';
    }
}

function useMaxSendAmount() {
    if (!elements.sendAmount) return;
    if (nobleUsdcBalance <= 0n) {
        log('No Noble USDC balance available for Max.', 'warning');
        return;
    }
    const human = Number(nobleUsdcBalance) / 1_000_000;
    elements.sendAmount.value = human.toString();
}

function usePhantomAddressForDestination() {
    if (!elements.sendDestAddress) return;
    if (!walletPublicKey) {
        log('Connect Phantom first on the Receive tab to use its address.', 'warning');
        return;
    }
    elements.sendDestAddress.value = walletPublicKey.toString();
    log('Filled destination address from connected Phantom wallet.', 'info');
}

function updateSendFromNobleButton() {
    if (!elements.sendFromNobleBtn) return;
    const hasWallet = !!nobleWalletAddress;
    const dest = elements.sendDestAddress ? elements.sendDestAddress.value.trim() : '';
    const amtStr = elements.sendAmount ? elements.sendAmount.value.trim() : '';
    const amt = Number(amtStr);
    const validAmt = !Number.isNaN(amt) && amt > 0;
    elements.sendFromNobleBtn.disabled = !(hasWallet && dest && validAmt);
}

async function sendFromNoble() {
    if (!nobleWalletAddress) {
        log('Connect Keplr (Noble) first.', 'error');
        return;
    }
    if (!elements.sendDestAddress || !elements.sendAmount) {
        log('Destination address and amount are required.', 'error');
        return;
    }

    const destChain = elements.sendDestChain?.value || 'solana';
    const destAddress = elements.sendDestAddress.value.trim();
    const amountStr = elements.sendAmount.value.trim();
    const amount = Number(amountStr);

    if (!destAddress) {
        log('Please enter a destination address for Solana.', 'error');
        return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
        log('Please enter a valid positive USDC amount.', 'error');
        return;
    }

    log('--- Noble send (burn) flow is experimental and not yet broadcasting on-chain. ---', 'warning');
    log(`Noble from: ${nobleWalletAddress}`, 'info');
    log(`Destination: ${destChain} -> ${destAddress}`, 'info');
    log(`Amount: ${amount} USDC`, 'info');
    log(
        'Tx construction & broadcast for the Noble CCTP burn message is not yet implemented. ' +
            'Use Noble CLI or official tooling to originate the burn, then come back to the Receive tab to complete the mint on Solana.',
        'warning'
    );
}

// ============ Tab Switching ============
function setActiveTab(nextTab) {
    if (nextTab !== 'send' && nextTab !== 'receive') return;
    activeTab = nextTab;

    Object.entries(tabs).forEach(([key, btn]) => {
        if (!btn) return;
        if (key === nextTab) {
            btn.classList.add('tab-button-active');
        } else {
            btn.classList.remove('tab-button-active');
        }
    });

    Object.entries(tabContents).forEach(([key, el]) => {
        if (!el) return;
        if (key === nextTab) {
            el.classList.add('tab-content-active');
        } else {
            el.classList.remove('tab-content-active');
        }
    });
}

// Update global CCTP explorer link from Noble tx hash
function updateExplorerLinkFromTxHash() {
    if (!elements.viewOnExplorer || !elements.nobleTxHash) return;
    const txHash = elements.nobleTxHash.value.trim();
    const hint = document.getElementById('explorerHint');

    if (txHash) {
        elements.viewOnExplorer.href = `https://usdc.range.org/transactions?s=${encodeURIComponent(txHash)}`;
        elements.viewOnExplorer.style.display = 'inline-flex';
        if (hint) hint.style.display = 'none';
    } else {
        elements.viewOnExplorer.style.display = 'none';
        elements.viewOnExplorer.href = '#';
        if (hint) hint.style.display = 'inline';
    }
}

// ============ Noble Transaction Fetching ============
async function fetchNobleTx() {
    const txHash = elements.nobleTxHash.value.trim();
    if (!txHash) {
        log('Please enter a Noble transaction hash', 'error');
        return;
    }
    
    const rpcUrl = elements.nobleRpc.value.trim();
    const url = `${rpcUrl}/cosmos/tx/v1beta1/txs/${txHash}`;
    
    log(`Fetching transaction from Noble...`, 'info');
    // Update explorer link immediately from the provided tx hash
    updateExplorerLinkFromTxHash();
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        log('Transaction fetched successfully', 'success');
        
        // Find MessageSent event
        const events = data.tx_response?.events || [];
        let messageBase64 = null;
        
        for (const event of events) {
            if (event.type === 'circle.cctp.v1.MessageSent') {
                for (const attr of event.attributes) {
                    // Attributes may be base64 encoded
                    let key = attr.key;
                    let value = attr.value;
                    
                    // Try to decode if it looks like base64
                    try {
                        if (!key.includes('message')) {
                            key = atob(key);
                        }
                    } catch (e) {}
                    
                    if (key === 'message') {
                        // Value might be base64 encoded or have quotes
                        try {
                            // Remove quotes if present
                            value = value.replace(/^"|"$/g, '');
                            // Try decoding if it's double-encoded
                            if (!value.includes('/') && !value.includes('+')) {
                                value = atob(value);
                            }
                        } catch (e) {}
                        messageBase64 = value;
                        break;
                    }
                }
            }
        }
        
        if (messageBase64) {
            elements.messageBase64.value = messageBase64;
            elements.messageBase64.classList.add('field-computed');
            log('Found MessageSent event with message data', 'success');
            
            // Auto-convert to hex
            convertToHex();

            // Update progress and guide user to attestation step
            setStepState('source', 'done');
            setSectionCompleted('source', { collapse: true });
            setStepState('attestation', 'active');
            log('Next step: fetch attestation (Step 3).', 'info');
            scrollToSection('section-attestation');
        } else {
            log('MessageSent event not found in transaction. Check events manually.', 'warning');
            console.log('Transaction events:', events);
        }
        
    } catch (error) {
        log(`Error fetching transaction: ${error.message}`, 'error');
        console.error(error);
    }
}

// ============ Message Processing ============
function convertToHex() {
    const base64 = elements.messageBase64.value.trim();
    if (!base64) {
        log('Please enter base64 message first', 'error');
        return;
    }
    
    try {
        const hex = base64ToHex(base64);
        elements.messageHex.value = hex;
        elements.messageHex.classList.add('field-computed');
        log('Converted message to hex', 'success');
        
        // Auto-compute hash
        computeHash();
    } catch (error) {
        log(`Error converting to hex: ${error.message}`, 'error');
    }
}

function computeHash() {
    let hex = elements.messageHex.value.trim();
    if (!hex) {
        log('Please enter hex message first', 'error');
        return;
    }

    // Remove all whitespace/newlines the user may have pasted
    hex = hex.replace(/\s+/g, '');

    // Normalise: ensure 0x prefix exactly once
    if (hex.startsWith('0x') || hex.startsWith('0X')) {
        // leave as-is but standardise to lowercase 0x
        hex = '0x' + hex.slice(2);
    } else {
        hex = '0x' + hex;
    }
    
    try {
        // ethers.js happily accepts a hex string with 0x prefix
        const hash = ethers.utils.keccak256(hex);
        elements.messageHash.value = hash;
        elements.messageHash.classList.add('field-computed');
        log(`Computed message hash: ${hash.substring(0, 20)}...`, 'success');
        // Automatically fetch attestation after computing hash
        // so user doesn't have to click an extra button.
        fetchAttestation();
    } catch (error) {
        log(`Error computing hash: ${error.message}`, 'error');
    }
}

// ============ Attestation ============
async function fetchAttestation() {
    const hash = elements.messageHash.value.trim();
    if (!hash) {
        log('Please compute or enter message hash first', 'error');
        return;
    }
    
    const apiUrl = elements.attestationApi.value.trim();
    const url = `${apiUrl}/${hash}`;
    
    log(`Fetching attestation from Circle...`, 'info');
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        elements.attestationStatus.value = data.status;
        
        if (data.status === 'complete') {
            elements.attestation.value = data.attestation;
            elements.attestation.classList.add('field-computed');
            elements.attestationStatus.classList.add('field-computed');
            log('Attestation complete!', 'success');
            updateRelayButton();

            // Progress: attestation done, move to relay step
            setStepState('attestation', 'done');
            setSectionCompleted('attestation', { collapse: true });
            setStepState('relay', 'active');
            log('Next step: connect Phantom and relay on Solana (Step 4).', 'info');
            scrollToSection('section-relay');
        } else {
            log(`Attestation status: ${data.status}. Try again later.`, 'warning');
        }
        
    } catch (error) {
        log(`Error fetching attestation: ${error.message}`, 'error');
        
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            log('CORS issue detected. Try manually fetching from the API and paste the attestation.', 'warning');
        }
    }
}

// ============ Phantom Wallet ============
async function connectWallet() {
    try {
        if (!window.solana || !window.solana.isPhantom) {
            window.open('https://phantom.app/', '_blank');
            log('Phantom wallet not found. Please install it.', 'error');
            return;
        }
        
        phantomWallet = window.solana;
        
        log('Connecting to Phantom...', 'info');
        const response = await phantomWallet.connect();
        walletPublicKey = response.publicKey;
        
        elements.walletStatus.textContent = 'Connected';
        elements.walletStatus.className = 'status-badge status-connected';
        elements.walletAddress.textContent = walletPublicKey.toString().substring(0, 8) + '...' + walletPublicKey.toString().slice(-8);
        elements.connectWalletBtn.textContent = 'Disconnect';
        
        log(`Connected: ${walletPublicKey.toString()}`, 'success');
        updateRelayButton();

        // Ensure relay step is highlighted when wallet is ready
        setStepState('relay', 'active');
        
    } catch (error) {
        log(`Wallet connection failed: ${error.message}`, 'error');
    }
}

function disconnectWallet() {
    if (phantomWallet) {
        phantomWallet.disconnect();
    }
    phantomWallet = null;
    walletPublicKey = null;
    
    elements.walletStatus.textContent = 'Disconnected';
    elements.walletStatus.className = 'status-badge status-disconnected';
    elements.walletAddress.textContent = '';
    elements.connectWalletBtn.textContent = 'Connect Phantom';
    
    log('Wallet disconnected', 'info');
    updateRelayButton();
}

function toggleWallet() {
    if (walletPublicKey) {
        disconnectWallet();
    } else {
        connectWallet();
    }
}

// ============ Relay Transaction ============
function updateRelayButton() {
    const hasAttestation = elements.attestation.value.trim().length > 0;
    const hasMessage = elements.messageHex.value.trim().length > 0;
    const hasWallet = walletPublicKey !== null;
    
    elements.relayBtn.disabled = !(hasAttestation && hasMessage && hasWallet);
}

async function relayToSolana() {
    if (!walletPublicKey) {
        log('Please connect wallet first', 'error');
        return;
    }
    
    const messageHex = elements.messageHex.value.trim();
    const attestationHex = elements.attestation.value.trim();
    
    if (!messageHex || !attestationHex) {
        log('Message and attestation are required', 'error');
        return;
    }
    
    log('Building Solana transaction...', 'info');
    
    try {
        const connection = new Connection(elements.solanaRpc.value.trim());
        const messageTransmitterProgramId = new PublicKey(elements.messageTransmitter.value.trim());
        const tokenMessengerMinterProgramId = new PublicKey(elements.tokenMessengerMinter.value.trim());
        
        const messageBytes = hexToBytes(messageHex);
        const attestationBytes = hexToBytes(attestationHex);
        
        // Parse message to extract nonce and source domain
        // Message format: version(4) + sourceDomain(4) + destDomain(4) + nonce(8) + sender(32) + recipient(32) + destCaller(32) + body(...)
        // Create explicit copies for safe DataView access
        const sourceDomainBytes = new Uint8Array(messageBytes.slice(4, 8));
        const nonceBytes = new Uint8Array(messageBytes.slice(12, 20));
        
        const sourceDomain = new DataView(sourceDomainBytes.buffer).getUint32(0, false); // big endian in message
        const nonceValue = new DataView(nonceBytes.buffer).getBigUint64(0, false); // big endian in message
        
        log(`Source domain: ${sourceDomain} (Noble=4, expected for Noble→Solana)`, 'info');
        log(`Nonce value: ${nonceValue}`, 'info');
        log(`Message bytes (first 120): ${bytesToHex(messageBytes.slice(0, 120))}`, 'info');
        
        // ============ STATIC PDAs for Noble (domain 4) → Solana ============
        // These are hardcoded from a known working transaction to avoid PDA derivation issues.
        // Only usedNonces changes per nonce bucket; mintRecipient comes from the message.
        
        // MessageTransmitter state (seeds: ["message_transmitter"])
        const messageTransmitterState = new PublicKey('BWrwSWjbikT3H7qHAkUEbLmwDQoB4ZDJ4wcSEhSPTZCu');
        
        // Authority PDA (seeds: ["message_transmitter_authority", tokenMessengerMinterProgramId])
        const authorityPda = new PublicKey('CFtn7PC5NsaFAuG65LwvhcGVD2MiqSpMJ7yvpyhsgJwW');
        
        // TokenMessenger state (seeds: ["token_messenger"])
        const tokenMessenger = new PublicKey('Afgq3BHEfCE7d78D2XE9Bfyu2ieDqvE24xX8KDwreBms');
        
        // RemoteTokenMessenger for Noble domain 4 (seeds: ["remote_token_messenger", domain4_le])
        const remoteTokenMessenger = new PublicKey('3LQBc39CVMtAMN84LP38LeFUdrVWrRkrsi8gBuPW1dER');
        
        // TokenMinter state (seeds: ["token_minter"])
        const tokenMinter = new PublicKey('DBD8hAwLDRQkTsu6EqviaYNGKPnsAMmQonxf7AH8ZcFY');
        
        // LocalToken for Noble USDC (seeds: ["local_token", domain4_le, nobleUsdcToken])
        const localToken = new PublicKey('72bvEFk2Usi2uYc1SnaTNhBcQPc6tiJWXr9oKk7rkd4C');
        
        // TokenPair for Noble USDC (seeds: ["token_pair", domain4_le, nobleUsdcToken])
        const tokenPair = new PublicKey('aCBB8tbji72cPuLLfB9KRBntwk1bejXY51Tx23eAFUi');
        
        // Custody token account (seeds: ["custody", usdcMint])
        const custodyToken = new PublicKey('FSxJ85FXVsXSr51SeWf9ciJWTcRnqKFSmBgRDeL3KyWw');
        
        // Event authority for MessageTransmitter (seeds: ["__event_authority"])
        const eventAuthority = new PublicKey('6mH8scevHQJsyyp1qxu8kyAapHuzEE67mtjFDJZjSbQW');
        
        // Event authority for TokenMessengerMinter (seeds: ["__event_authority"])
        const tokenMessengerMinterEventAuthority = new PublicKey('CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9');
        
        // ============ DYNAMIC: UsedNonces depends on nonce bucket ============
        // CCTP uses 1-indexed buckets! Formula: firstNonce = floor((nonce-1)/6400)*6400 + 1
        // This was discovered by inspecting on-chain account data which showed firstNonce=288001
        const NONCES_PER_ACCOUNT = 6400n;
        const firstNonce = ((nonceValue - 1n) / NONCES_PER_ACCOUNT) * NONCES_PER_ACCOUNT + 1n;
        
        // Derive usedNonces PDA dynamically (now works correctly with 1-indexed buckets!)
        const sourceDomainBuffer = u32ToBytesLE(sourceDomain);
        const firstNonceBuffer = u64ToBytesLE(firstNonce);
        const [usedNonces] = PublicKey.findProgramAddressSync(
            [bytesFromString('used_nonces'), sourceDomainBuffer, firstNonceBuffer],
            messageTransmitterProgramId
        );
        log(`Nonce ${nonceValue} → firstNonce bucket ${firstNonce}`, 'info');
        log(`usedNonces (derived): ${usedNonces.toString()}`, 'info');
        log(`authorityPda: ${authorityPda.toString()}`, 'info');
        
        // Extract mint recipient from message body
        // Body starts at offset 116 (4+4+4+8+32+32+32)
        // Body format: version(4) + burnToken(32) + mintRecipient(32) + amount(32) + messageSender(32)
        const bodyOffset = 116;
        const mintRecipient = new PublicKey(messageBytes.slice(bodyOffset + 4 + 32, bodyOffset + 4 + 32 + 32));
        
        log(`Mint recipient: ${mintRecipient.toString()}`, 'info');
        
        // Token program
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        
        // Build the receiveMessage instruction
        // Discriminator for receive_message in MessageTransmitter
        const RECEIVE_MESSAGE_DISCRIMINATOR = Uint8Array.from([38, 144, 127, 225, 31, 225, 238, 25]);
        
        // Instruction data: discriminator + message (Vec<u8>) + attestation (Vec<u8>)
        // In Borsh/Anchor, Vec<u8> is serialized as: u32 length (LE) + bytes
        const messageLenBuffer = u32ToBytesLE(messageBytes.length);
        const attestationLenBuffer = u32ToBytesLE(attestationBytes.length);
        
        const instructionData = concatUint8Arrays([
            RECEIVE_MESSAGE_DISCRIMINATOR,
            messageLenBuffer,
            messageBytes,
            attestationLenBuffer,
            attestationBytes
        ]);
        
        // Build accounts for receiveMessage instruction
        // This calls into TokenMessengerMinter via CPI
        // NOTE: Account ordering is critical to satisfy Anchor's account constraints.
        // Full MessageTransmitter.ReceiveMessageContext<'info> (including #[event_cpi]) fields:
        //   payer, caller, authority_pda, message_transmitter, used_nonces, receiver,
        //   system_program, event_authority, program
        // Everything after those is forwarded as remaining_accounts to TokenMessengerMinter.handle_receive_message.
        const accounts = [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },      // payer
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },     // caller
            { pubkey: authorityPda, isSigner: false, isWritable: false },       // authority_pda
            { pubkey: messageTransmitterState, isSigner: false, isWritable: false }, // message_transmitter
            { pubkey: usedNonces, isSigner: false, isWritable: true },          // used_nonces
            { pubkey: tokenMessengerMinterProgramId, isSigner: false, isWritable: false }, // receiver (TokenMessengerMinter)
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            { pubkey: eventAuthority, isSigner: false, isWritable: false },     // event_authority for MessageTransmitter events
            { pubkey: messageTransmitterProgramId, isSigner: false, isWritable: false }, // program (MessageTransmitter)
            // Remaining accounts forwarded to TokenMessengerMinter.handle_receive_message
            { pubkey: tokenMessenger, isSigner: false, isWritable: false },     // token_messenger
            { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false }, // remote_token_messenger
            { pubkey: tokenMinter, isSigner: false, isWritable: false },        // token_minter
            { pubkey: localToken, isSigner: false, isWritable: true },          // local_token
            { pubkey: tokenPair, isSigner: false, isWritable: false },          // token_pair
            { pubkey: mintRecipient, isSigner: false, isWritable: true },       // recipient_token_account
            { pubkey: custodyToken, isSigner: false, isWritable: true },        // custody_token_account
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // token_program
            // TokenMessengerMinter's event_cpi accounts (required for Anchor event emission via CPI)
            { pubkey: tokenMessengerMinterEventAuthority, isSigner: false, isWritable: false }, // event_authority for TokenMessengerMinter
            { pubkey: tokenMessengerMinterProgramId, isSigner: false, isWritable: false },      // program (TokenMessengerMinter)
        ];
        
        const instruction = new TransactionInstruction({
            keys: accounts,
            programId: messageTransmitterProgramId,
            data: instructionData,
        });
        
        // SPL Memo Program for adding a distinct app identifier
        const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
        const memoText = `CCTP Relay via github.com/jasbanza/cctp-relayer | Noble→Solana | nonce:${nonceValue}`;
        const memoInstruction = new TransactionInstruction({
            keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: bytesFromString(memoText),
        });
        
        const transaction = new Transaction().add(instruction).add(memoInstruction);
        log(`Adding memo: "${memoText}"`, 'info');
        
        // Get recent blockhash - try proxy first, fall back to direct RPC
        let blockhash, lastValidBlockHeight;
        try {
            const apiBase = getApiBase();
            const blockhashUrl = apiBase ? `${apiBase}/api/blockhash` : '/api/blockhash';
            log(`Fetching blockhash via proxy (${blockhashUrl})...`, 'info');
            const blockhashRes = await fetch(blockhashUrl);
            if (blockhashRes.ok) {
                const data = await blockhashRes.json();
                blockhash = data.blockhash;
                lastValidBlockHeight = data.lastValidBlockHeight;
            } else {
                throw new Error('Proxy returned error');
            }
        } catch (proxyErr) {
            log('Proxy unavailable, using direct RPC...', 'info');
            const result = await connection.getLatestBlockhash();
            blockhash = result.blockhash;
            lastValidBlockHeight = result.lastValidBlockHeight;
        }
        
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = walletPublicKey;
        
        log('Requesting signature from Phantom...', 'info');
        
        // Sign transaction with Phantom
        const signedTx = await phantomWallet.signTransaction(transaction);
        const serializedTx = signedTx.serialize();
        const base64Tx = btoa(String.fromCharCode(...serializedTx));
        
        // Send transaction - try proxy first, fall back to direct RPC
        let signature;
        try {
            const apiBase = getApiBase();
            const relayUrl = apiBase ? `${apiBase}/api/relay` : '/api/relay';
            log(`Sending transaction via proxy (${relayUrl})...`, 'info');
            const relayRes = await fetch(relayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTransaction: base64Tx }),
            });
            if (relayRes.ok) {
                const data = await relayRes.json();
                signature = data.signature;
            } else {
                const errData = await relayRes.json().catch(() => ({}));

                // Handle known CCTP errors explicitly
                if (errData && errData.code === 'INVALID_DESTINATION_CALLER') {
                    log(
                        errData.error ||
                            'This CCTP message restricts who can relay it (non-zero destination_caller). Only the original caller wallet can complete this relay.',
                        'error'
                    );
                    log(
                        'Tip: Use a Noble transaction where destination_caller is zero, or connect the original caller wallet.',
                        'info'
                    );
                    return;
                }

                throw new Error(errData.error || 'Proxy relay failed');
            }
        } catch (proxyErr) {
            log(`Proxy unavailable (${proxyErr.message}), using direct RPC...`, 'info');
            signature = await connection.sendRawTransaction(serializedTx);
        }
        
        log(`Transaction sent: ${signature}`, 'success');
        elements.solanaTxHash.value = signature;
        elements.viewOnSolscan.href = `https://solscan.io/tx/${signature}`;
        elements.viewOnSolscan.style.display = 'inline-flex';
        
        // Transaction was submitted successfully - show success and let user verify on Solscan
        // Note: Direct RPC confirmation often fails due to rate limits/API restrictions
        log('Transaction submitted! Check Solscan for confirmation status.', 'success');
        log(`View on Solscan: https://solscan.io/tx/${signature}`, 'info');
        setStepState('relay', 'done');
        setSectionCompleted('relay', { collapse: true });
        
    } catch (error) {
        log(`Relay failed: ${error.message}`, 'error');
        console.error('Full error:', error);
        
        if (error.logs) {
            log('Program logs:', 'info');
            error.logs.forEach(l => log(l, 'info'));
        }
    }
}

// ============ Event Listeners ============
elements.fetchTxBtn.addEventListener('click', fetchNobleTx);
elements.convertToHexBtn.addEventListener('click', convertToHex);
elements.computeHashBtn.addEventListener('click', computeHash);
elements.fetchAttestationBtn.addEventListener('click', fetchAttestation);
elements.connectWalletBtn.addEventListener('click', toggleWallet);
elements.relayBtn.addEventListener('click', relayToSolana);
elements.clearLogsBtn.addEventListener('click', clearLogs);

// Noble send tab
if (elements.connectNobleWalletBtn) {
    elements.connectNobleWalletBtn.addEventListener('click', connectNobleWallet);
}
if (elements.sendAmountMaxBtn) {
    elements.sendAmountMaxBtn.addEventListener('click', useMaxSendAmount);
}
if (elements.usePhantomAddressBtn) {
    elements.usePhantomAddressBtn.addEventListener('click', usePhantomAddressForDestination);
}
if (elements.sendFromNobleBtn) {
    elements.sendFromNobleBtn.addEventListener('click', sendFromNoble);
}

// Keep Noble send button state in sync as user types
if (elements.sendDestAddress) {
    elements.sendDestAddress.addEventListener('input', updateSendFromNobleButton);
}
if (elements.sendAmount) {
    elements.sendAmount.addEventListener('input', updateSendFromNobleButton);
}

if (elements.goToReceiveBtn) {
    elements.goToReceiveBtn.addEventListener('click', () => {
        setActiveTab('receive');
        scrollToSection('section-source');
    });
}

// Update relay button when fields change
elements.messageHex.addEventListener('input', () => {
    elements.messageHex.classList.remove('field-computed');
    updateRelayButton();
});
elements.attestation.addEventListener('input', () => {
    elements.attestation.classList.remove('field-computed');
    elements.attestationStatus.classList.remove('field-computed');
    updateRelayButton();
});
elements.messageBase64.addEventListener('input', () => {
    elements.messageBase64.classList.remove('field-computed');
});

// Update explorer link live when the Noble tx hash changes
elements.nobleTxHash.addEventListener('input', updateExplorerLinkFromTxHash);

// Auto-connect if Phantom is already connected
if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
    connectWallet();
}

// Initial progress state and startup log
// Treat configuration (with sane defaults) as "done" and guide user to Step 2.
setStepState('config', 'done');
setSectionCompleted('config', { collapse: true });
setStepState('source', 'active');
// Collapse only future steps until current one is completed
if (sections.attestation) sections.attestation.classList.add('card-collapsed');
if (sections.relay) sections.relay.classList.add('card-collapsed');
log('CCTP Relayer initialized. Paste Noble tx hash to begin (Step 2).', 'info');

