// CCTP Relayer - Noble to Solana
// Vanilla JS implementation for GitHub Pages hosting

const { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } = solanaWeb3;

// ============ State ============
let phantomWallet = null;
let walletPublicKey = null;
let activeTab = 'receive'; // 'send' | 'receive' (Send tab hidden - use Noble Express for burns)
let nobleWalletAddress = null;
let nobleUsdcBalance = 0n;
let currentTheme = 'dark'; // 'dark' | 'light' | '8bit'

// ============ Theme Management ============
function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cctp-relayer-theme', theme);
    
    // Update button active states
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function detectOS() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    // Check for macOS
    if (platform.includes('mac') || userAgent.includes('macintosh')) {
        return 'mac';
    }
    
    // Check for Linux (includes Ubuntu, etc.)
    if (platform.includes('linux') || userAgent.includes('linux')) {
        return 'ubuntu';
    }
    
    // Check for Windows
    if (platform.includes('win') || userAgent.includes('windows')) {
        return 'winxp'; // Default Windows theme
    }
    
    // Default fallback
    return 'dark';
}

function initTheme() {
    // Check localStorage for saved preference
    const savedTheme = localStorage.getItem('cctp-relayer-theme');
    const validThemes = ['dark', 'light', '8bit', 'matrix', 'win95', 'win31', 'winxp', 'mac', 'ubuntu'];
    
    if (savedTheme && validThemes.includes(savedTheme)) {
        setTheme(savedTheme);
    } else {
        // Auto-detect OS and set appropriate theme
        const osTheme = detectOS();
        setTheme(osTheme);
    }
}

// ============ DOM Elements ============
const elements = {
    // Config
    sourceChain: document.getElementById('sourceChain'),
    destChain: document.getElementById('destChain'),
    sourceDomainId: document.getElementById('sourceDomainId'),
    destDomainId: document.getElementById('destDomainId'),
    nobleRestApi: document.getElementById('nobleRestApi'),
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
    
    // Receive tab - Lookup section
    lookupTxHash: document.getElementById('lookupTxHash'),
    lookupByTxBtn: document.getElementById('lookupByTxBtn'),
    lookupAddress: document.getElementById('lookupAddress'),
    lookupByAddressBtn: document.getElementById('lookupByAddressBtn'),
    lookupResults: document.getElementById('lookupResults'),
    
    // Advanced toggle (Receive tab)
    advancedToggle: document.getElementById('advancedToggle'),
    
    // Advanced toggle (Send tab)
    sendAdvancedToggle: document.getElementById('sendAdvancedToggle'),
    sendAdvancedOptions: document.getElementById('sendAdvancedOptions'),
    sendNobleRestApi: document.getElementById('sendNobleRestApi'),
    
    // Phantom account change notification
    phantomChangedNotice: document.getElementById('phantomChangedNotice'),
    phantomNewAddress: document.getElementById('phantomNewAddress'),
    useUpdatedPhantom: document.getElementById('useUpdatedPhantom'),
    dismissPhantomNotice: document.getElementById('dismissPhantomNotice'),
    
    // Stats counter
    statsCounter: document.getElementById('statsCounter'),
    
    // Progress Modal
    progressModal: document.getElementById('progressModal'),
    progressModalInProgress: document.getElementById('progressModalInProgress'),
    progressModalComplete: document.getElementById('progressModalComplete'),
    modalStep1: document.getElementById('modalStep1'),
    modalStep1Icon: document.getElementById('modalStep1Icon'),
    modalStep1Status: document.getElementById('modalStep1Status'),
    modalStep1Desc: document.getElementById('modalStep1Desc'),
    modalStep1Hash: document.getElementById('modalStep1Hash'),
    modalStep2: document.getElementById('modalStep2'),
    modalStep2Icon: document.getElementById('modalStep2Icon'),
    modalStep2Status: document.getElementById('modalStep2Status'),
    modalStep2Desc: document.getElementById('modalStep2Desc'),
    modalStep2Hash: document.getElementById('modalStep2Hash'),
    modalStep3: document.getElementById('modalStep3'),
    modalStep3Icon: document.getElementById('modalStep3Icon'),
    modalStep3Status: document.getElementById('modalStep3Status'),
    modalStep3Desc: document.getElementById('modalStep3Desc'),
    modalStep3Hash: document.getElementById('modalStep3Hash'),
    modalReceiver: document.getElementById('modalReceiver'),
    modalAmount: document.getElementById('modalAmount'),
    modalFee: document.getElementById('modalFee'),
    modalReceiverComplete: document.getElementById('modalReceiverComplete'),
    modalAmountComplete: document.getElementById('modalAmountComplete'),
    modalFeeComplete: document.getElementById('modalFeeComplete'),
    modalReceipt: document.getElementById('modalReceipt'),
    closeProgressModal: document.getElementById('closeProgressModal'),
    bridgeAgainBtn: document.getElementById('bridgeAgainBtn'),
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

// Convert Solana PublicKey to base64 for CCTP mintRecipient field
function solanaAddressToBase64(solanaAddress) {
    const pubkey = new PublicKey(solanaAddress);
    const bytes = pubkey.toBytes(); // 32 bytes
    // Convert to base64 (browser-compatible)
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Convert base64 to bytes (browser-compatible)
function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Convert bytes to base64 (browser-compatible)
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Debug function to investigate PDA derivation
function debugPdaDerivation() {
    const messageTransmitterProgramId = new PublicKey('CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd');
    
    // Known working values from successful transaction (nonce 288574)
    const knownUsedNonces = '3ewgRKdMT8WjPjExuVuZ9gZ7qDYwquefpwtL1SUkLCxf';
    const sourceDomain = 4;  // Noble
    const nonce = 288574n;
    
    // Correct formula: firstNonce = floor((nonce-1)/6400)*6400 + 1
    const NONCES_PER_ACCOUNT = 6400n;
    const firstNonce = ((nonce - 1n) / NONCES_PER_ACCOUNT) * NONCES_PER_ACCOUNT + 1n;
    
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
    console.log('Nonce:', nonce.toString(), '→ firstNonce:', firstNonce.toString());
    console.log('');
    
    console.log('=== KEY FINDING ===');
    console.log('From CCTP source code (get_nonce_pda.rs):');
    console.log('Seeds use DECIMAL STRINGS, not binary encoding!');
    console.log('  - domain "4" (not 0x04000000)');
    console.log('  - firstNonce "288001" (not 0x0165040000000000)');
    console.log('  - delimiter "" for domains < 11');
    console.log('');
    
    // WRONG: Binary encoding (what we were doing)
    console.log('Testing WRONG approach (binary encoding):');
    tryDerivation('WRONG: binary LE', [
        bytesFromString('used_nonces'),
        u32ToBytesLE(sourceDomain),
        u64ToBytesLE(firstNonce)
    ]);
    
    console.log('');
    console.log('Testing CORRECT approach (string encoding):');
    // CORRECT: String encoding (from CCTP source)
    const delimiter = sourceDomain < 11 ? '' : '-';
    tryDerivation('CORRECT: strings', [
        bytesFromString('used_nonces'),
        bytesFromString(sourceDomain.toString()),  // "4"
        bytesFromString(delimiter),                 // ""
        bytesFromString(firstNonce.toString())      // "288001"
    ]);
    
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
let keplrListenerAdded = false;

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
        
        // Listen for Keplr account changes (only add once)
        if (!keplrListenerAdded) {
            window.addEventListener('keplr_keystorechange', async () => {
                log('Keplr account changed, refreshing...', 'info');
                await connectNobleWallet();
            });
            keplrListenerAdded = true;
        }
    } catch (error) {
        log(`Failed to connect Keplr (Noble): ${error.message}`, 'error');
    }
}

async function loadNobleUsdcBalance() {
    if (!nobleWalletAddress) return;
    const restUrl = getNobleRestUrl();
    if (!restUrl) {
        log('Noble REST API URL is empty; cannot load Noble balance.', 'error');
        return;
    }

    const url = `${restUrl}/cosmos/bank/v1beta1/balances/${nobleWalletAddress}`;
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
    // Deduct the 0.5 USDC fee from max amount
    const maxAmount = nobleUsdcBalance - BigInt(CCTP_FEE_USDC);
    if (maxAmount <= 0n) {
        log(`Insufficient balance. Need at least ${CCTP_FEE_USDC / 1_000_000} USDC for the relay fee.`, 'warning');
        elements.sendAmount.value = '0';
        return;
    }
    const human = Number(maxAmount) / 1_000_000;
    elements.sendAmount.value = human.toString();
    log(`Max amount set to ${human} USDC (after 0.5 USDC fee)`, 'info');
}

async function usePhantomAddressForDestination() {
    if (!elements.sendDestAddress) return;
    
    // If not connected, connect first
    if (!walletPublicKey) {
        log('Connecting Phantom wallet...', 'info');
        await connectWallet();
        // Check if connection succeeded
        if (!walletPublicKey) {
            return; // Connection failed or was cancelled
        }
    }
    
    // Always re-query the current public key from Phantom in case user switched profiles
    // The wallet object's publicKey updates when user switches accounts
    let currentAddress = walletPublicKey;
    if (phantomWallet && phantomWallet.publicKey) {
        currentAddress = phantomWallet.publicKey;
        // Update our cached value if it changed
        if (currentAddress.toString() !== walletPublicKey.toString()) {
            walletPublicKey = currentAddress;
            updatePhantomWalletUI();
            log('Detected Phantom account change, updated address.', 'info');
        }
    }
    
    // Fill the address
    elements.sendDestAddress.value = currentAddress.toString();
    log('Filled destination address from Phantom wallet.', 'success');
    updateSendFromNobleButton();
    updatePhantomButtonText();
}

// Update the Phantom button text based on connection state
function updatePhantomButtonText() {
    if (!elements.usePhantomAddressBtn) return;
    if (walletPublicKey) {
        elements.usePhantomAddressBtn.textContent = 'Use Phantom Address';
    } else {
        elements.usePhantomAddressBtn.textContent = 'Connect & Use Phantom';
    }
}

function updateSendFromNobleButton() {
    if (!elements.sendFromNobleBtn) return;
    const hasWallet = !!nobleWalletAddress;
    const dest = elements.sendDestAddress ? elements.sendDestAddress.value.trim() : '';
    const amtStr = elements.sendAmount ? elements.sendAmount.value.trim() : '';
    const amt = Number(amtStr);
    const validAmt = !Number.isNaN(amt) && amt > 0;
    
    // Check if amount + fee exceeds balance
    let sufficientBalance = true;
    let balanceWarning = '';
    if (validAmt && nobleUsdcBalance > 0n) {
        const amountMicro = BigInt(Math.floor(amt * 1_000_000));
        const totalRequired = amountMicro + BigInt(CCTP_FEE_USDC);
        if (totalRequired > nobleUsdcBalance) {
            sufficientBalance = false;
            const feeUsdc = CCTP_FEE_USDC / 1_000_000;
            const needed = Number(totalRequired) / 1_000_000;
            const have = Number(nobleUsdcBalance) / 1_000_000;
            balanceWarning = `Insufficient: need ${needed.toFixed(2)} USDC (${amt} + ${feeUsdc} fee), have ${have.toFixed(2)}`;
        }
    }
    
    const canSend = hasWallet && dest && validAmt && sufficientBalance;
    elements.sendFromNobleBtn.disabled = !canSend;
    
    // Update button text to show warning
    if (!sufficientBalance && validAmt) {
        elements.sendFromNobleBtn.textContent = 'Insufficient Balance';
        elements.sendFromNobleBtn.title = balanceWarning;
    } else {
        elements.sendFromNobleBtn.textContent = 'Send from Noble (+ 0.5 USDC fee)';
        elements.sendFromNobleBtn.title = '';
    }
}

// Fee configuration - Noble side
const CCTP_FEE_USDC = 500_000; // 0.5 USDC in micro units
const CCTP_FEE_RECIPIENT = 'noble1tstcqvrz296mtv9uz994e6jvq0spe508kgqnxc';

// Fee configuration - Solana relay side
const SOL_FEE_USD = 0.25; // $0.25 fee
const SOL_FEE_RECIPIENT = '6PqaPXavRBTHQhUSdWj7TDzY7V2wTvZECwuEAVswPsqf';
const SOL_FALLBACK_PRICE = 150; // Fallback price if CoinGecko fails

// Fetch current SOL price from CoinGecko
async function getSolPriceUsd() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (!res.ok) throw new Error('CoinGecko API error');
        const data = await res.json();
        const price = data?.solana?.usd;
        if (!price || price <= 0) throw new Error('Invalid price data');
        return price;
    } catch (e) {
        console.warn('Failed to fetch SOL price, using fallback:', e.message);
        return SOL_FALLBACK_PRICE;
    }
}

// Calculate SOL fee in lamports
async function getSolFeeInLamports() {
    const solPrice = await getSolPriceUsd();
    const solAmount = SOL_FEE_USD / solPrice;
    const lamports = Math.ceil(solAmount * 1_000_000_000); // Convert to lamports
    log(`Relay fee: $${SOL_FEE_USD} = ${(solAmount).toFixed(6)} SOL (@ $${solPrice.toFixed(2)}/SOL)`, 'info');
    return lamports;
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

    // Validate Solana address
    let mintRecipientBase64;
    try {
        mintRecipientBase64 = solanaAddressToBase64(destAddress);
        log(`Destination (base64): ${mintRecipientBase64}`, 'info');
    } catch (e) {
        log(`Invalid Solana address: ${e.message}`, 'error');
        return;
    }

    // Calculate amounts
    const burnAmountMicro = BigInt(Math.floor(amount * 1_000_000));
    const totalRequired = burnAmountMicro + BigInt(CCTP_FEE_USDC);
    
    if (nobleUsdcBalance < totalRequired) {
        const needed = Number(totalRequired) / 1_000_000;
        const have = Number(nobleUsdcBalance) / 1_000_000;
        log(`Insufficient balance. Need ${needed} USDC (${amount} + 1 fee), have ${have} USDC.`, 'error');
        return;
    }

    log(`Preparing Noble CCTP burn transaction...`, 'info');
    log(`Amount to bridge: ${amount} USDC`, 'info');
    log(`Relay fee: 0.5 USDC`, 'info');
    log(`Total: ${Number(totalRequired) / 1_000_000} USDC`, 'info');

    // Show progress modal
    showProgressModal(destAddress, amount);

    try {
        const chainId = 'noble-1';
        const restUrl = getNobleRestUrl();
        
        // Get signer and account info
        const offlineSigner = window.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        
        // Fetch account info for sequence/account_number
        const accountInfoRes = await fetch(`${restUrl}/cosmos/auth/v1beta1/accounts/${nobleWalletAddress}`);
        const accountInfo = await accountInfoRes.json();
        const accountNumber = accountInfo.account?.account_number || '0';
        const sequence = accountInfo.account?.sequence || '0';
        
        log(`Account number: ${accountNumber}, Sequence: ${sequence}`, 'info');

        // Build amino messages
        const aminoMsgs = [
            {
                type: 'cosmos-sdk/MsgSend',
                value: {
                    from_address: nobleWalletAddress,
                    to_address: CCTP_FEE_RECIPIENT,
                    amount: [{ denom: 'uusdc', amount: CCTP_FEE_USDC.toString() }]
                }
            },
            {
                type: 'circle/DepositForBurn',
                value: {
                    from: nobleWalletAddress,
                    amount: burnAmountMicro.toString(),
                    destination_domain: 5,
                    mint_recipient: mintRecipientBase64,
                    burn_token: 'uusdc'
                }
            }
        ];

        // Build the sign doc
        const signDoc = {
            chain_id: chainId,
            account_number: accountNumber,
            sequence: sequence,
            fee: {
                amount: [{ denom: 'uusdc', amount: '0' }],
                gas: '200000'
            },
            msgs: aminoMsgs,
            memo: 'CCTP Relay via github.com/jasbanza/cctp-relayer'
        };

        log('Requesting signature from Keplr...', 'info');
        
        // Sign with Keplr (Amino)
        const signResponse = await window.keplr.signAmino(chainId, nobleWalletAddress, signDoc);
        
        log('Signature received, broadcasting via Keplr...', 'info');
        
        // Construct the signed Amino transaction
        const signedTx = {
            msg: signResponse.signed.msgs,
            fee: signResponse.signed.fee,
            memo: signResponse.signed.memo,
            signatures: [{
                pub_key: signResponse.signature.pub_key,
                signature: signResponse.signature.signature
            }]
        };
        
        // Encode as StdTx for Keplr
        const stdTx = {
            type: 'cosmos-sdk/StdTx',
            value: signedTx
        };
        
        const txBytes = new TextEncoder().encode(JSON.stringify(stdTx));
        
        let txHash;
        
        try {
            // Keplr's sendTx handles the encoding and broadcasting
            const result = await window.keplr.sendTx(chainId, txBytes, 'sync');
            txHash = Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
            log(`Broadcast successful: ${txHash}`, 'success');
        } catch (keplrErr) {
            log(`Keplr broadcast failed: ${keplrErr.message}`, 'error');
            
            // Noble requires protobuf encoding which browsers can't easily do
            // Direct users to use established services
            log('', 'info');
            log('═══════════════════════════════════════════════════════════', 'info');
            log('Noble requires protobuf transaction encoding.', 'info');
            log('', 'info');
            log('To initiate a CCTP burn, please use one of these services:', 'info');
            log('  • Noble Express: https://express.noble.xyz', 'info');
            log('  • cctp.money: https://cctp.money', 'info');
            log('', 'info');
            log('Then use the RECEIVE tab here to complete the Solana relay.', 'info');
            log('═══════════════════════════════════════════════════════════', 'info');
            
            hideProgressModal();
            return;
        }
        
        if (!txHash) {
            throw new Error('Failed to get transaction hash');
        }
        
        // We already have txHash from above
        if (txHash) {
            log(`Transaction broadcast! Hash: ${txHash}`, 'success');
            
            // Update modal - Step 1 complete
            updateModalStep(1, 'completed', 'Completed', `Burned ${amount} USDC on Noble`, 
                txHash, `https://www.mintscan.io/noble/tx/${txHash}`);
            updateModalStep(2, 'active', 'In Progress', 'Verifying Circle\'s attestation...');
            
            // Auto-fill the receive tab and switch
            if (elements.nobleTxHash) {
                elements.nobleTxHash.value = txHash;
            }
            updateExplorerLinkFromTxHash();
            
            log('Switching to Receive tab to complete the relay...', 'info');
            setActiveTab('receive');
            
            // Wait a moment for the tx to be indexed, then auto-fetch attestation
            setTimeout(async () => {
                log('Waiting for transaction to be indexed...', 'info');
                setTimeout(async () => {
                    await fetchNobleTx();
                    // Auto-fetch attestation after getting tx details
                    setTimeout(async () => {
                        await fetchAttestation();
                    }, 2000);
                }, 5000);
            }, 1000);
            
        } else {
            const errorMsg = result.raw_log || result.tx_response?.raw_log || JSON.stringify(result);
            log(`Broadcast failed: ${errorMsg}`, 'error');
            hideProgressModal();
        }

    } catch (error) {
        log(`Transaction failed: ${error.message}`, 'error');
        console.error('Full error:', error);
        hideProgressModal();
    }
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

// ============ Advanced Toggle ============
function toggleAdvancedOptions(show) {
    const configStep = steps.config;
    const configSection = sections.config;
    
    if (show) {
        // Show config step and section
        if (configStep) configStep.style.display = '';
        if (configSection) configSection.style.display = '';
    } else {
        // Hide config step and section
        if (configStep) configStep.style.display = 'none';
        if (configSection) configSection.style.display = 'none';
    }
}

// Toggle advanced options on Send tab
function toggleSendAdvancedOptions(show) {
    if (elements.sendAdvancedOptions) {
        elements.sendAdvancedOptions.style.display = show ? 'block' : 'none';
    }
}

// Get the Noble REST API URL - use Send tab input when on Send tab, otherwise Receive tab
function getNobleRestUrl() {
    // If on Send tab and sendNobleRestApi has a value, use that
    if (activeTab === 'send' && elements.sendNobleRestApi?.value?.trim()) {
        return elements.sendNobleRestApi.value.trim();
    }
    // Otherwise fall back to Receive tab's config or default
    return elements.nobleRestApi?.value?.trim() || 'https://rest.cosmos.directory/noble';
}

// Get the Noble RPC URL (for broadcasting transactions)
function getNobleRpcUrl() {
    const restUrl = getNobleRestUrl();
    // Convert REST URL to RPC URL for cosmos.directory
    if (restUrl.includes('rest.cosmos.directory')) {
        return restUrl.replace('rest.cosmos.directory', 'rpc.cosmos.directory');
    }
    // For other providers, try common patterns
    return restUrl
        .replace('-api.', '-rpc.')
        .replace('/api', '/rpc')
        .replace('noble-api', 'noble-rpc');
}

// ============ CCTP Lookup ============
const CCTP_LOOKUP_API = 'https://iris-api.circle.com/v1/messages';

async function lookupByTxHash() {
    const txHash = elements.lookupTxHash?.value.trim();
    if (!txHash) {
        log('Please enter a Noble transaction hash', 'warning');
        return;
    }
    
    log(`Looking up transfer for tx: ${txHash.slice(0, 16)}...`, 'info');
    showLookupLoading();
    
    try {
        // Query Circle's CCTP API for the transaction
        const response = await fetch(`${CCTP_LOOKUP_API}?sourceDomain=4&sourceTxHash=${txHash}`);
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
            displayLookupResults(data.messages, 'tx');
        } else {
            showNoResults('No CCTP transfer found for this transaction hash.');
        }
    } catch (error) {
        log(`Lookup failed: ${error.message}`, 'error');
        showNoResults(`Error: ${error.message}. Try pasting the hash directly in Step 1 below.`);
    }
}

async function lookupByAddress() {
    const address = elements.lookupAddress?.value.trim();
    if (!address) {
        log('Please enter a Solana address', 'warning');
        return;
    }
    
    log(`Searching pending transfers for: ${address.slice(0, 8)}...`, 'info');
    showLookupLoading();
    
    try {
        // Query Circle's CCTP API for pending messages to this address
        // Note: Circle API uses 32-byte mint recipient, need to convert Solana address
        const response = await fetch(`${CCTP_LOOKUP_API}?destinationDomain=5&status=pending`);
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
            // Filter for messages going to this address (if the API returns all pending)
            // The API might already filter, but we double-check
            const relevantMessages = data.messages.filter(msg => {
                // Try to match the mint recipient (base64 encoded Solana address)
                try {
                    const mintRecipient = msg.message?.mintRecipient;
                    if (mintRecipient) {
                        const decoded = atob(mintRecipient);
                        // Compare with Solana address bytes
                        return decoded.includes(address) || mintRecipient === address;
                    }
                } catch (e) {
                    // Ignore decode errors
                }
                return false;
            });
            
            if (relevantMessages.length > 0) {
                displayLookupResults(relevantMessages, 'address');
            } else if (data.messages.length > 0) {
                // Show all pending if we can't filter
                displayLookupResults(data.messages.slice(0, 10), 'address');
                log('Showing recent pending transfers. Click one to auto-fill.', 'info');
            } else {
                showNoResults('No pending transfers found.');
            }
        } else {
            showNoResults('No pending CCTP transfers found for this address.');
        }
    } catch (error) {
        log(`Lookup failed: ${error.message}`, 'error');
        showNoResults(`Error: ${error.message}`);
    }
}

function showLookupLoading() {
    if (!elements.lookupResults) return;
    elements.lookupResults.style.display = 'block';
    elements.lookupResults.innerHTML = '<div class="lookup-loading">Searching...</div>';
}

function showNoResults(message) {
    if (!elements.lookupResults) return;
    elements.lookupResults.style.display = 'block';
    elements.lookupResults.innerHTML = `<div class="lookup-no-results">${message}</div>`;
}

function displayLookupResults(messages, searchType) {
    if (!elements.lookupResults) return;
    elements.lookupResults.style.display = 'block';
    
    const resultsHtml = messages.map((msg, i) => {
        const txHash = msg.sourceTxHash || msg.source?.txHash || 'Unknown';
        const status = msg.status || 'unknown';
        const amount = msg.message?.amount ? (parseInt(msg.message.amount) / 1_000_000).toFixed(2) : '?';
        const statusClass = status === 'pending_confirmations' || status === 'pending' ? 'pending' : 
                           status === 'complete' ? 'ready' : '';
        const statusLabel = status === 'complete' ? 'Ready to relay' : 
                           status === 'pending_confirmations' ? 'Awaiting attestation' : status;
        
        return `
            <div class="lookup-result-item" onclick="selectLookupResult('${txHash}', ${JSON.stringify(msg).replace(/'/g, "\\'")})">
                <div class="tx-hash">${txHash.slice(0, 20)}...${txHash.slice(-8)}</div>
                <div class="tx-details">
                    ${amount} USDC 
                    <span class="tx-status ${statusClass}">${statusLabel}</span>
                </div>
            </div>
        `;
    }).join('');
    
    elements.lookupResults.innerHTML = `
        <h4>Found ${messages.length} transfer${messages.length > 1 ? 's' : ''}</h4>
        ${resultsHtml}
    `;
}

// Called when user clicks a lookup result
function selectLookupResult(txHash, msgData) {
    // Fill the Noble tx hash field
    if (elements.nobleTxHash) {
        elements.nobleTxHash.value = txHash;
        elements.nobleTxHash.classList.add('field-computed');
        updateExplorerLinkFromTxHash();
    }
    
    // If we have message data, try to pre-fill
    if (msgData) {
        // If attestation is complete, we might have the attestation
        if (msgData.attestation && elements.attestation) {
            elements.attestation.value = msgData.attestation;
            elements.attestation.classList.add('field-computed');
        }
        
        // Try to extract message hex
        if (msgData.message && elements.messageHex) {
            // The API might return the message in different formats
            const messageBytes = msgData.messageBytes || msgData.message;
            if (typeof messageBytes === 'string' && messageBytes.startsWith('0x')) {
                elements.messageHex.value = messageBytes;
                elements.messageHex.classList.add('field-computed');
            }
        }
    }
    
    // Hide lookup results and scroll to source section
    if (elements.lookupResults) {
        elements.lookupResults.style.display = 'none';
    }
    
    // Clear the lookup inputs
    if (elements.lookupTxHash) elements.lookupTxHash.value = '';
    if (elements.lookupAddress) elements.lookupAddress.value = '';
    
    log(`Selected transfer: ${txHash.slice(0, 16)}... Click "Fetch TX" to load details.`, 'success');
    scrollToSection('section-source');
    
    // Auto-trigger fetch
    fetchNobleTx();
}

// Make it globally accessible for onclick
window.selectLookupResult = selectLookupResult;

// ============ Noble Transaction Fetching ============
async function fetchNobleTx() {
    const txHash = elements.nobleTxHash.value.trim();
    if (!txHash) {
        log('Please enter a Noble transaction hash', 'error');
        return;
    }
    
    const restUrl = getNobleRestUrl();
    const url = `${restUrl}/cosmos/tx/v1beta1/txs/${txHash}`;
    
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

            // Update progress modal - Step 2 complete
            const shortAttestation = data.attestation ? data.attestation.substring(0, 10) + '...' + data.attestation.slice(-8) : '';
            updateModalStep(2, 'completed', 'Completed', 'Circle attestation verified',
                hash, `https://iris-api-sandbox.circle.com/attestations/${hash}`);
            updateModalStep(3, 'active', 'In Progress', 'Ready to mint on Solana...');

            // Progress: attestation done, move to relay step
            setStepState('attestation', 'done');
            setSectionCompleted('attestation', { collapse: true });
            setStepState('relay', 'active');
            log('Next step: connect Phantom and relay on Solana (Step 4).', 'info');
            scrollToSection('section-relay');
            
            // Auto-relay if Phantom is connected
            if (phantomWallet && phantomWallet.isConnected) {
                log('Phantom is connected, auto-relaying to Solana...', 'info');
                setTimeout(relayToSolana, 1500);
            }
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
// Update Phantom wallet UI on Receive tab and Send tab button
function updatePhantomWalletUI() {
    const connected = !!walletPublicKey;
    const shortAddr = connected 
        ? walletPublicKey.toString().substring(0, 8) + '...' + walletPublicKey.toString().slice(-8)
        : '';
    
    // Receive tab
    if (elements.walletStatus) {
        elements.walletStatus.textContent = connected ? 'Connected' : 'Disconnected';
        elements.walletStatus.className = connected ? 'status-badge status-connected' : 'status-badge status-disconnected';
    }
    if (elements.walletAddress) {
        elements.walletAddress.textContent = shortAddr;
    }
    if (elements.connectWalletBtn) {
        elements.connectWalletBtn.textContent = connected ? 'Disconnect' : 'Connect Phantom';
    }
    
    // Send tab - update the "Use Phantom Address" button text
    updatePhantomButtonText();
}

async function connectWallet() {
    try {
        if (!window.solana || !window.solana.isPhantom) {
            window.open('https://phantom.app/', '_blank');
            log('Phantom wallet not found. Please install it.', 'error');
            return;
        }
        
        phantomWallet = window.solana;
        
        // Listen for account changes (user switching profiles in Phantom)
        phantomWallet.on('accountChanged', (newPublicKey) => {
            if (newPublicKey) {
                // Show notification instead of auto-updating
                showPhantomChangeNotice(newPublicKey);
            } else {
                // User disconnected from within Phantom
                disconnectWallet();
            }
        });
        
        log('Connecting to Phantom...', 'info');
        const response = await phantomWallet.connect();
        walletPublicKey = response.publicKey;
        
        updatePhantomWalletUI();
        log(`Connected: ${walletPublicKey.toString()}`, 'success');
        updateRelayButton();

        // Ensure relay step is highlighted when wallet is ready
        setStepState('relay', 'active');
        
    } catch (error) {
        log(`Wallet connection failed: ${error.message}`, 'error');
    }
}

function toggleWallet() {
    if (walletPublicKey) {
        disconnectWallet();
    } else {
        connectWallet();
    }
}

function disconnectWallet() {
    if (phantomWallet) {
        phantomWallet.disconnect();
    }
    phantomWallet = null;
    walletPublicKey = null;
    
    updatePhantomWalletUI();
    log('Wallet disconnected', 'info');
    updateRelayButton();
}

// ============ Phantom Account Change Notification ============
let pendingPhantomAddress = null;

function showPhantomChangeNotice(newPublicKey) {
    pendingPhantomAddress = newPublicKey;
    const shortAddr = newPublicKey.toString().substring(0, 6) + '...' + newPublicKey.toString().slice(-4);
    
    if (elements.phantomNewAddress) {
        elements.phantomNewAddress.textContent = shortAddr;
    }
    if (elements.phantomChangedNotice) {
        elements.phantomChangedNotice.style.display = 'flex';
    }
    log(`Phantom profile changed to: ${newPublicKey.toString()}`, 'info');
}

function acceptPhantomChange() {
    if (pendingPhantomAddress) {
        walletPublicKey = pendingPhantomAddress;
        updatePhantomWalletUI();
        log(`Switched to Phantom address: ${walletPublicKey.toString()}`, 'success');
        updateRelayButton();
    }
    hidePhantomChangeNotice();
}

function hidePhantomChangeNotice() {
    pendingPhantomAddress = null;
    if (elements.phantomChangedNotice) {
        elements.phantomChangedNotice.style.display = 'none';
    }
}

// ============ Confetti Animation ============
function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
                    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', 
                    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const shapes = ['circle', 'square', 'triangle'];
    
    // Create 100 confetti particles
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        confetti.className = `confetti ${shape}`;
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        if (shape === 'triangle') {
            confetti.style.setProperty('--confetti-color', color);
            confetti.style.borderBottomColor = color;
        } else {
            confetti.style.background = color;
        }
        
        // Random position and animation delay
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        container.appendChild(confetti);
    }
    
    // Remove container after animation
    setTimeout(() => {
        container.remove();
    }, 5000);
}

// ============ Stats Counter ============
function loadStats() {
    try {
        const stats = JSON.parse(localStorage.getItem('cctp-relayer-stats')) || { totalRelayed: 0, relayCount: 0 };
        displayStats(stats);
        return stats;
    } catch (e) {
        return { totalRelayed: 0, relayCount: 0 };
    }
}

function saveStats(stats) {
    localStorage.setItem('cctp-relayer-stats', JSON.stringify(stats));
    displayStats(stats);
}

function displayStats(stats) {
    if (elements.statsCounter && stats.totalRelayed > 0) {
        const formatted = stats.totalRelayed.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        elements.statsCounter.textContent = `${formatted} USDC relayed`;
    }
}

function updateStats(amountUsdc) {
    const stats = loadStats();
    stats.totalRelayed = (stats.totalRelayed || 0) + amountUsdc;
    stats.relayCount = (stats.relayCount || 0) + 1;
    saveStats(stats);
}

// ============ Progress Modal ============
let modalTransferData = {
    receiver: '',
    amount: 0,
    nobleTxHash: '',
    attestationHash: '',
    solanaTxHash: ''
};

function showProgressModal(receiver, amount) {
    modalTransferData = {
        receiver: receiver,
        amount: amount,
        nobleTxHash: '',
        attestationHash: '',
        solanaTxHash: ''
    };
    
    // Reset modal to initial state
    if (elements.progressModalInProgress) elements.progressModalInProgress.style.display = 'block';
    if (elements.progressModalComplete) elements.progressModalComplete.style.display = 'none';
    
    // Set transfer details
    const shortReceiver = receiver.substring(0, 6) + '...' + receiver.slice(-6);
    if (elements.modalReceiver) elements.modalReceiver.textContent = shortReceiver;
    if (elements.modalAmount) {
        elements.modalAmount.innerHTML = `${amount.toLocaleString()} <span class="usdc-icon">💲</span>`;
    }
    
    // Reset steps to initial state
    updateModalStep(1, 'active', 'In Progress', 'Burning USDC on Noble...');
    updateModalStep(2, 'pending', 'Waiting', 'Waiting for Noble transaction...');
    updateModalStep(3, 'pending', 'Waiting', 'Waiting for attestation...');
    
    // Show modal
    if (elements.progressModal) elements.progressModal.style.display = 'flex';
}

function updateModalStep(stepNum, status, statusText, description, hash, hashUrl) {
    const stepEl = elements[`modalStep${stepNum}`];
    const iconEl = elements[`modalStep${stepNum}Icon`];
    const statusEl = elements[`modalStep${stepNum}Status`];
    const descEl = elements[`modalStep${stepNum}Desc`];
    const hashEl = elements[`modalStep${stepNum}Hash`];
    
    if (!stepEl) return;
    
    // Update step classes
    stepEl.classList.remove('active', 'completed', 'pending');
    if (status === 'active') stepEl.classList.add('active');
    if (status === 'completed') stepEl.classList.add('completed');
    
    // Update icon
    if (iconEl) {
        if (status === 'active') {
            iconEl.innerHTML = '<span class="spinner"></span>';
        } else if (status === 'completed') {
            iconEl.innerHTML = '<span class="step-complete">✓</span>';
        } else {
            iconEl.innerHTML = '<span class="step-pending">○</span>';
        }
    }
    
    // Update status text
    if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.classList.remove('completed', 'in-progress');
        if (status === 'completed') statusEl.classList.add('completed');
        if (status === 'active') statusEl.classList.add('in-progress');
    }
    
    // Update description
    if (descEl) descEl.textContent = description;
    
    // Update hash link
    if (hashEl) {
        if (hash && hashUrl) {
            const shortHash = hash.substring(0, 8) + '...' + hash.slice(-6);
            hashEl.textContent = shortHash;
            hashEl.href = hashUrl;
            hashEl.style.display = 'inline-block';
        } else {
            hashEl.style.display = 'none';
        }
    }
}

function showModalComplete(solanaTxHash) {
    modalTransferData.solanaTxHash = solanaTxHash;
    
    // Update complete state details
    const shortReceiver = modalTransferData.receiver.substring(0, 6) + '...' + modalTransferData.receiver.slice(-6);
    if (elements.modalReceiverComplete) elements.modalReceiverComplete.textContent = shortReceiver;
    if (elements.modalAmountComplete) {
        elements.modalAmountComplete.innerHTML = `${modalTransferData.amount.toLocaleString()} <span class="usdc-icon">💲</span>`;
    }
    
    // Set receipt link
    if (elements.modalReceipt) {
        const shortTx = solanaTxHash.substring(0, 8) + '...' + solanaTxHash.slice(-8);
        elements.modalReceipt.textContent = shortTx;
        elements.modalReceipt.href = `https://solscan.io/tx/${solanaTxHash}`;
    }
    
    // Switch to complete state
    if (elements.progressModalInProgress) elements.progressModalInProgress.style.display = 'none';
    if (elements.progressModalComplete) elements.progressModalComplete.style.display = 'block';
}

function hideProgressModal() {
    if (elements.progressModal) elements.progressModal.style.display = 'none';
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
    
    // Show modal if not already showing (for manual relay)
    const modalVisible = elements.progressModal && elements.progressModal.style.display === 'flex';
    if (!modalVisible) {
        // For manual relay, show a simplified modal starting at step 3
        const destAddress = elements.solanaDestAddress?.value?.trim() || walletPublicKey.toBase58();
        showProgressModal(destAddress, 0);
        updateModalStep(1, 'completed', 'Completed', 'Noble burn transaction (external)');
        updateModalStep(2, 'completed', 'Completed', 'Circle attestation verified');
    }
    updateModalStep(3, 'active', 'In Progress', 'Minting USDC on Solana...');
    
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
        // CCTP uses 1-indexed buckets: firstNonce = floor((nonce-1)/6400)*6400 + 1
        // CRITICAL: Seeds use DECIMAL STRINGS, not binary encoding!
        // Source: https://github.com/circlefin/solana-cctp-contracts/blob/master/programs/message-transmitter/src/instructions/get_nonce_pda.rs
        const NONCES_PER_ACCOUNT = 6400n;
        const firstNonce = ((nonceValue - 1n) / NONCES_PER_ACCOUNT) * NONCES_PER_ACCOUNT + 1n;
        
        // Seeds: ["used_nonces", domain_as_string, delimiter, firstNonce_as_string]
        // For domains < 11, delimiter is empty
        const domainString = sourceDomain.toString();  // "4" not binary bytes
        const firstNonceString = firstNonce.toString();  // "288001" not binary bytes
        const delimiter = sourceDomain < 11 ? '' : '-';
        
        const [usedNonces] = PublicKey.findProgramAddressSync(
            [
                bytesFromString('used_nonces'),
                bytesFromString(domainString),
                bytesFromString(delimiter),
                bytesFromString(firstNonceString)
            ],
            messageTransmitterProgramId
        );
        log(`Nonce ${nonceValue} → firstNonce bucket ${firstNonce}`, 'info');
        log(`usedNonces seeds: ["used_nonces", "${domainString}", "${delimiter}", "${firstNonceString}"]`, 'info');
        log(`usedNonces (derived): ${usedNonces.toString()}`, 'info');
        log(`authorityPda: ${authorityPda.toString()}`, 'info');
        
        // Extract mint recipient and amount from message body
        // Body starts at offset 116 (4+4+4+8+32+32+32)
        // Body format: version(4) + burnToken(32) + mintRecipient(32) + amount(32) + messageSender(32)
        const bodyOffset = 116;
        const mintRecipient = new PublicKey(messageBytes.slice(bodyOffset + 4 + 32, bodyOffset + 4 + 32 + 32));
        
        // Extract amount (32 bytes at bodyOffset + 4 + 32 + 32, big-endian u256 but typically fits in 8 bytes)
        // USDC has 6 decimals, so amount is in micro-USDC
        const amountBytes = messageBytes.slice(bodyOffset + 4 + 32 + 32, bodyOffset + 4 + 32 + 32 + 32);
        // Use last 8 bytes for the amount (BigInt, big-endian)
        const amountBigInt = new DataView(new Uint8Array(amountBytes.slice(24, 32)).buffer).getBigUint64(0, false);
        const relayAmountUsdc = Number(amountBigInt) / 1_000_000;
        
        log(`Mint recipient: ${mintRecipient.toString()}`, 'info');
        log(`Relay amount: ${relayAmountUsdc} USDC`, 'info');
        
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
        
        // Calculate and add relay fee ($0.25 worth of SOL)
        const feeInLamports = await getSolFeeInLamports();
        const feeRecipient = new PublicKey(SOL_FEE_RECIPIENT);
        const feeInstruction = SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: feeRecipient,
            lamports: feeInLamports,
        });
        
        const transaction = new Transaction()
            .add(instruction)       // CCTP receiveMessage
            .add(memoInstruction)   // memo
            .add(feeInstruction);   // $0.25 SOL relay fee
        
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
                            'This CCTP message has a destination_caller restriction. Only the designated wallet can complete this relay.',
                        'error'
                    );
                    log(
                        'Tip: Connect the wallet specified as destination_caller (often the receiver\'s wallet or a specific relayer).',
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
        
        // Update progress modal - Step 3 complete
        updateModalStep(3, 'completed', 'Completed', `Minted ${relayAmountUsdc} USDC on Solana`,
            signature, `https://solscan.io/tx/${signature}`);
        
        // Show completion state in modal
        showModalComplete(signature);
        
        // Update stats counter
        if (relayAmountUsdc > 0) {
            updateStats(relayAmountUsdc);
        }
        
        // Celebrate with confetti!
        showConfetti();
        setStepState('relay', 'done');
        setSectionCompleted('relay', { collapse: true });
        
    } catch (error) {
        log(`Relay failed: ${error.message}`, 'error');
        console.error('Full error:', error);
        
        if (error.logs) {
            log('Program logs:', 'info');
            error.logs.forEach(l => log(l, 'info'));
        }
        
        // Update modal to show error state
        updateModalStep(3, 'pending', 'Failed', 'Relay transaction failed. Check logs for details.');
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

// Phantom account change notification buttons
if (elements.useUpdatedPhantom) {
    elements.useUpdatedPhantom.addEventListener('click', acceptPhantomChange);
}
if (elements.dismissPhantomNotice) {
    elements.dismissPhantomNotice.addEventListener('click', hidePhantomChangeNotice);
}

// Progress modal buttons
if (elements.closeProgressModal) {
    elements.closeProgressModal.addEventListener('click', hideProgressModal);
}
if (elements.bridgeAgainBtn) {
    elements.bridgeAgainBtn.addEventListener('click', () => {
        hideProgressModal();
        setActiveTab('send');
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

// Advanced toggle (Receive tab)
if (elements.advancedToggle) {
    elements.advancedToggle.addEventListener('change', (e) => {
        toggleAdvancedOptions(e.target.checked);
    });
}

// Advanced toggle (Send tab)
if (elements.sendAdvancedToggle) {
    elements.sendAdvancedToggle.addEventListener('change', (e) => {
        toggleSendAdvancedOptions(e.target.checked);
    });
}

// Lookup buttons
if (elements.lookupByTxBtn) {
    elements.lookupByTxBtn.addEventListener('click', lookupByTxHash);
}
if (elements.lookupByAddressBtn) {
    elements.lookupByAddressBtn.addEventListener('click', lookupByAddress);
}

// Allow Enter key to trigger lookup
if (elements.lookupTxHash) {
    elements.lookupTxHash.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') lookupByTxHash();
    });
}
if (elements.lookupAddress) {
    elements.lookupAddress.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') lookupByAddress();
    });
}

// Theme toggle buttons
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
    });
});

// ============ Konami Code Easter Egg ============
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
                    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            // Easter egg triggered!
            log('🎮 KONAMI CODE ACTIVATED! 🎮', 'success');
            showConfetti();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

// Initialize theme from localStorage
initTheme();

// Load stats counter
loadStats();

// Auto-connect if Phantom is already connected
if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
    connectWallet();
}

// Initial progress state and startup log
// Config is hidden by default (advanced), start from Source step
toggleAdvancedOptions(false); // Ensure config is hidden initially
setStepState('source', 'active');
// Collapse only future steps until current one is completed
if (sections.attestation) sections.attestation.classList.add('card-collapsed');
if (sections.relay) sections.relay.classList.add('card-collapsed');

// Initialize button states
updatePhantomButtonText();

log('CCTP Relayer initialized. Use the lookup above or paste a Noble tx hash to begin.', 'info');

