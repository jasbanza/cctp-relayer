# CCTP Relayer - Noble to Solana

A simple web UI to manually relay USDC transfers from Noble (Cosmos) to Solana using Circle's Cross-Chain Transfer Protocol (CCTP).

## Features

- Fetch Noble transaction details and extract CCTP message
- Convert message from Base64 to Hex
- Compute keccak256 message hash
- Fetch attestation from Circle's API
- Connect Phantom wallet
- Build and send `receiveMessage` transaction on Solana
- All fields are editable for power users
- External tool links for manual fallback

## Usage

### Option 1: Full Flow

1. Enter your Noble transaction hash
2. Click "Fetch TX" to retrieve the message data
3. The message will auto-convert to hex and compute the hash
4. Click "Fetch" to get the attestation from Circle
5. Connect your Phantom wallet
6. Click "Relay to Solana"

### Option 2: Manual Entry

If you already have any intermediate values (message hash, attestation, etc.), you can paste them directly into the corresponding fields.

## Hosting

This is a static site with no build step. To host:

### GitHub Pages

1. Push this folder to a GitHub repository
2. Go to Settings > Pages
3. Select the branch and folder
4. Your site will be live at `https://yourusername.github.io/repo-name`

### Local Testing

Simply open `index.html` in a browser, or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve
```

## Configuration

All configuration values can be edited in the UI:

| Field | Default | Description |
|-------|---------|-------------|
| Noble LCD API | `https://noble-api.polkachu.com` | Noble REST API endpoint |
| Solana RPC | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| Circle Attestation API | `https://iris-api.circle.com/v1/attestations` | Circle's attestation service |
| MessageTransmitter | `CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd` | Solana CCTP program |
| TokenMessengerMinter | `CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3` | Solana CCTP program |

## Domain IDs

| Chain | Domain ID |
|-------|-----------|
| Ethereum | 0 |
| Avalanche | 1 |
| OP Mainnet | 2 |
| Arbitrum | 3 |
| Noble | 4 |
| Solana | 5 |
| Base | 6 |
| Polygon PoS | 7 |

## Manual Fallback Tools

If any step in the UI fails, you can use these external tools:

### Step 3: Source Transaction
- [Mintscan Noble Explorer](https://www.mintscan.io/noble) - View Noble transactions
- [Noble LCD API](https://noble-api.polkachu.com/cosmos/tx/v1beta1/txs/) - Query transactions directly
- [Base64 to Hex Converter](https://base64.guru/converter/decode/hex) - Convert message encoding

### Step 4: Attestation
- [Keccak256 Hash Tool](https://emn178.github.io/online-tools/keccak_256.html) - Compute message hash (use hex input)
- [Circle Attestation API](https://iris-api.circle.com/v1/attestations/) - Fetch attestation directly
- [Message Format Docs](https://developers.circle.com/cctp/message-format) - Understand CCTP message structure

### Step 5: Relay
- [Phantom Wallet](https://phantom.app/) - Solana wallet
- [Solscan Explorer](https://solscan.io/) - View Solana transactions
- [CCTP Solana Contracts](https://github.com/circlefin/solana-cctp-contracts) - Source code reference

## Troubleshooting

### CORS Issues

If the Circle attestation API fails due to CORS, you can:
1. Manually fetch the attestation: `curl https://iris-api.circle.com/v1/attestations/{hash}`
2. Paste the attestation value directly into the UI

### Transaction Simulation Failed

Check that:
- The attestation status is "complete"
- The message hasn't already been relayed (nonce already used)
- Your wallet has enough SOL for transaction fees

### Message Not Found in Transaction

The transaction may use a different event format. Check the browser console for the raw transaction events and manually extract the message.

## Technical Details

### Message Format

CCTP messages follow this structure:
- Header: version (4) + sourceDomain (4) + destDomain (4) + nonce (8) + sender (32) + recipient (32) + destCaller (32)
- Body: version (4) + burnToken (32) + mintRecipient (32) + amount (32) + messageSender (32)

### Attestation

The attestation is Circle's signature over the keccak256 hash of the message bytes. It proves the message was legitimately sent on the source chain.

## References

- [CCTP Overview](https://developers.circle.com/cctp/overview)
- [CCTP Supported Domains](https://developers.circle.com/cctp/supported-domains)
- [CCTP Solana Programs](https://developers.circle.com/cctp/solana-programs)
- [Noble CCTP Module](https://developers.circle.com/cctp/noble-cosmos-module)
- [CCTP API Reference](https://developers.circle.com/cctp/api-reference)

## License

MIT
