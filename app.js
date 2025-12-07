// CCTP Relayer - Noble to Solana
// Vanilla JS implementation for GitHub Pages hosting

const { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } = solanaWeb3;

// ============ State ============
let phantomWallet = null;
let walletPublicKey = null;

// ============ DOM Elements ============
const elements = {
    // Config
    sourceChain: document.getElementById('sourceChain'),
    destChain: document.getElementById('destChain'),
    sourceDomainId: document.getElementById('sourceDomainId'),
    destDomainId: document.getElementById('destDomainId'),
    nobleRpc: document.getElementById('nobleRpc'),
    solanaRpc: document.getElementById('solanaRpc'),
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
        
        log(`Source domain: ${sourceDomain}`, 'info');
        log(`Nonce value: ${nonceValue}`, 'info');
        
        // Derive PDAs
        // MessageTransmitter state PDA
        const [messageTransmitterState] = PublicKey.findProgramAddressSync(
            [bytesFromString('message_transmitter')],
            messageTransmitterProgramId
        );
        
        // Authority PDA for TokenMessengerMinter
        const [authorityPda] = PublicKey.findProgramAddressSync(
            [bytesFromString('message_transmitter_authority'), tokenMessengerMinterProgramId.toBuffer()],
            messageTransmitterProgramId
        );
        
        // Used nonces PDA (V1): "used_nonces" + message_transmitter_state + remote_domain (u32 LE) + bucket_index (u64 LE)
        // Each UsedNonces account tracks a bucket of nonces for a remote domain.
        // bucket_index = nonce / 6400 (integer division)
        const sourceDomainBuffer = u32ToBytesLE(sourceDomain);
        const bucketIndex = nonceValue / 6400n;
        const bucketIndexBuffer = u64ToBytesLE(bucketIndex);

        log(`Bucket index (nonce / 6400): ${bucketIndex}`, 'info');
        log(`Source domain buffer: ${bytesToHex(sourceDomainBuffer)}`, 'info');
        log(`Bucket index buffer: ${bytesToHex(bucketIndexBuffer)}`, 'info');
        log(`MessageTransmitter state: ${messageTransmitterState.toString()}`, 'info');
        
        const [usedNonces] = PublicKey.findProgramAddressSync(
            [
                bytesFromString('used_nonces'),
                messageTransmitterState.toBuffer(),
                sourceDomainBuffer,
                bucketIndexBuffer,
            ],
            messageTransmitterProgramId
        );
        
        log(`Used nonces PDA: ${usedNonces.toString()}`, 'info');
        
        // TokenMessenger state PDA
        const [tokenMessenger] = PublicKey.findProgramAddressSync(
            [bytesFromString('token_messenger')],
            tokenMessengerMinterProgramId
        );
        
        // RemoteTokenMessenger PDA for source domain
        const [remoteTokenMessenger] = PublicKey.findProgramAddressSync(
            [bytesFromString('remote_token_messenger'), sourceDomainBuffer],
            tokenMessengerMinterProgramId
        );
        
        // TokenMinter state PDA
        const [tokenMinter] = PublicKey.findProgramAddressSync(
            [bytesFromString('token_minter')],
            tokenMessengerMinterProgramId
        );
        
        // Extract mint recipient from message body
        // Body starts at offset 116 (4+4+4+8+32+32+32)
        // Body format: version(4) + burnToken(32) + mintRecipient(32) + amount(32) + messageSender(32)
        const bodyOffset = 116;
        const mintRecipient = new PublicKey(messageBytes.slice(bodyOffset + 4 + 32, bodyOffset + 4 + 32 + 32));
        
        log(`Mint recipient: ${mintRecipient.toString()}`, 'info');
        
        // Local token (USDC on Solana) - we need to derive from remote token
        // For Noble USDC -> Solana USDC, we need the token pair PDA
        const remoteTokenBytes = messageBytes.slice(bodyOffset + 4, bodyOffset + 4 + 32);
        
        const [localToken] = PublicKey.findProgramAddressSync(
            [bytesFromString('local_token'), sourceDomainBuffer, remoteTokenBytes],
            tokenMessengerMinterProgramId
        );
        
        // USDC Mint on Solana (mainnet)
        const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        
        // Token pair PDA
        const [tokenPair] = PublicKey.findProgramAddressSync(
            [bytesFromString('token_pair'), sourceDomainBuffer, remoteTokenBytes],
            tokenMessengerMinterProgramId
        );
        
        // Custody token account (TokenMinter's token account)
        const [custodyToken] = PublicKey.findProgramAddressSync(
            [bytesFromString('custody'), usdcMint.toBuffer()],
            tokenMessengerMinterProgramId
        );
        
        // Token program
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        
        // Event authority PDA for anchor events
        const [eventAuthority] = PublicKey.findProgramAddressSync(
            [bytesFromString('__event_authority')],
            tokenMessengerMinterProgramId
        );
        
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
        const accounts = [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },      // payer
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },     // caller
            { pubkey: authorityPda, isSigner: false, isWritable: false },       // authority_pda
            { pubkey: messageTransmitterState, isSigner: false, isWritable: false }, // message_transmitter
            { pubkey: usedNonces, isSigner: false, isWritable: true },          // used_nonces
            { pubkey: tokenMessengerMinterProgramId, isSigner: false, isWritable: false }, // receiver (TokenMessengerMinter)
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            // Additional accounts for TokenMessengerMinter.handle_receive_message
            { pubkey: tokenMessenger, isSigner: false, isWritable: false },     // token_messenger
            { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false }, // remote_token_messenger
            { pubkey: tokenMinter, isSigner: false, isWritable: false },        // token_minter
            { pubkey: localToken, isSigner: false, isWritable: true },          // local_token
            { pubkey: tokenPair, isSigner: false, isWritable: false },          // token_pair
            { pubkey: mintRecipient, isSigner: false, isWritable: true },       // mint_recipient (token account)
            { pubkey: custodyToken, isSigner: false, isWritable: true },        // custody_token
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // token_program
            { pubkey: eventAuthority, isSigner: false, isWritable: false },     // event_authority
            { pubkey: tokenMessengerMinterProgramId, isSigner: false, isWritable: false }, // program (for events)
        ];
        
        const instruction = new TransactionInstruction({
            keys: accounts,
            programId: messageTransmitterProgramId,
            data: instructionData,
        });
        
        const transaction = new Transaction().add(instruction);
        
        // Get recent blockhash - try proxy first, fall back to direct RPC
        let blockhash, lastValidBlockHeight;
        try {
            log('Fetching blockhash via proxy...', 'info');
            const blockhashRes = await fetch('/api/blockhash');
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
            log('Sending transaction via proxy...', 'info');
            const relayRes = await fetch('/api/relay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTransaction: base64Tx }),
            });
            if (relayRes.ok) {
                const data = await relayRes.json();
                signature = data.signature;
            } else {
                const errData = await relayRes.json().catch(() => ({}));
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
        
        // Wait for confirmation (use direct RPC - reads are less restricted)
        log('Waiting for confirmation...', 'info');
        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        });
        
        if (confirmation.value.err) {
            log(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`, 'error');
        } else {
            log('Transaction confirmed! USDC should be minted.', 'success');
            setStepState('relay', 'done');
            setSectionCompleted('relay', { collapse: true });
        }
        
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

