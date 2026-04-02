# CCTP Relayer - Noble to Solana & EVM

> **Note:** This tool uses **CCTP V1 (Legacy)**. Circle is [deprecating V1](https://developers.circle.com/cctp/migration-from-v1-to-v2) in favour of CCTP V2, with phase-out beginning July 2026. V1 remains fully functional until then, but a migration to V2 will be needed in the future.

A community-built tool for **recovering and sending USDC transfers from Noble (Cosmos)** using Circle's Cross-Chain Transfer Protocol (CCTP V1). Supports relaying to **Solana** and all major **EVM chains**: Ethereum, Avalanche, OP Mainnet, Arbitrum, Base, and Polygon PoS.

[Buy me a coffee](https://buymeacoffee.com/jasbanza)

This is an independent, community-built tool and is **not affiliated with or endorsed by Circle, Solana, Phantom, MetaMask, or any other referenced project.**

## Live deployments

- **Vercel**: [https://cctp-relayer.vercel.app/](https://cctp-relayer.vercel.app/)
- **GitHub Pages**: [https://jasbanza.github.io/cctp-relayer/](https://jasbanza.github.io/cctp-relayer/)

## Features

- **Recover transfers**: Fetch Noble transaction details, extract the CCTP message, and relay to the destination chain
- **Send USDC**: Burn USDC on Noble and prepare a CCTP transfer to any supported destination
- **Lookup pending transfers**: Search for in-flight transfers by destination address
- **Multi-chain support**: Relay to Solana (Phantom) or any EVM chain (MetaMask / injected wallet)
- **Auto-detection**: Destination chain is detected automatically from the CCTP message
- Compute keccak256 message hash and fetch Circle attestation
- All fields are editable for power users
- External tool links for manual fallback

## Usage

### Recover a Transfer

1. Enter your Noble transaction hash
2. Click "Fetch TX" to retrieve the message data (the tool will auto-convert to hex, compute the hash, and fetch the attestation)
3. Wait until the attestation status shows `complete`
4. The destination chain is detected automatically — connect the appropriate wallet:
   - **Solana**: Connect Phantom wallet, then click "Relay to Solana"
   - **EVM chains**: Connect MetaMask (or any injected wallet), then click "Relay to [Chain]"

### Send USDC from Noble

1. Connect your Keplr wallet
2. Select the destination chain and enter the recipient address
3. Enter the amount and send

### Lookup Pending Transfers

Enter a destination address (Solana or EVM) to search for in-flight CCTP transfers waiting to be relayed.

### Manual Entry

If you already have any intermediate values (message hash, attestation, etc.), you can paste them directly into the corresponding fields.

## Project Structure

```
cctp-relayer/
├── api/                    # Vercel serverless functions
│   ├── blockhash.js        # GET /api/blockhash (proxies Solana RPC)
│   ├── config.js           # Allowed origins config
│   └── relay.js            # POST /api/relay (proxies Solana RPC)
├── public/                 # Static website files
│   ├── app.js              # Main application logic (all chains)
│   ├── index.html
│   └── styles.css
├── .github/workflows/      # CI/CD
│   └── deploy-gh-pages.yml # Auto-deploy to GitHub Pages
├── .gitignore
├── package.json
└── README.md
```

## Hosting

### Vercel (Recommended)

The API proxy keeps your Helius RPC key secret while allowing CORS from your domains.

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add environment variable:
   - `HELIUS_RPC_URL` = `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
4. Deploy

**To update allowed origins**, edit `api/config.js` and redeploy.

### Local Testing

```bash
yarn install
yarn dev
```

Note: The `/api/*` proxy won't work locally (falls back to direct RPC).

### GitHub Pages (Static only)

If you don't need the RPC proxy, you can host just the `public/` folder on GitHub Pages. The app will fall back to the direct Solana RPC configured in the UI.

## Configuration

All configuration values can be edited in the UI:

| Field | Default | Description |
|-------|---------|-------------|
| Noble LCD API | `https://noble-api.polkachu.com` | Noble REST API endpoint |
| Solana RPC | `https://rpc.ankr.com/solana` | Solana RPC endpoint (fallback) |
| Circle Attestation API | `https://iris-api.circle.com/v1/attestations` | Circle's attestation service |
| MessageTransmitter | `CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd` | Solana CCTP program |
| TokenMessengerMinter | `CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3` | Solana CCTP program |

EVM chain contract addresses (MessageTransmitter, TokenMessenger) are auto-configured based on the selected destination chain.

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

### Source Transaction
- [Mintscan Noble Explorer](https://www.mintscan.io/noble) - View Noble transactions
- [Noble LCD API](https://noble-api.polkachu.com/cosmos/tx/v1beta1/txs/) - Query transactions directly
- [Base64 to Hex Converter](https://base64.guru/converter/decode/hex) - Convert message encoding

### Attestation
- [Keccak256 Hash Tool](https://emn178.github.io/online-tools/keccak_256.html) - Compute message hash (use hex input)
- [Circle Attestation API](https://iris-api.circle.com/v1/attestations/) - Fetch attestation directly
- [Message Format Docs](https://developers.circle.com/cctp/message-format) - Understand CCTP message structure

### Relay
- [Phantom Wallet](https://phantom.app/) - Solana wallet
- [MetaMask](https://metamask.io/) - EVM wallet
- [Solscan Explorer](https://solscan.io/) - View Solana transactions
- [Etherscan](https://etherscan.io/), [Basescan](https://basescan.org/), [Arbiscan](https://arbiscan.io/) - View EVM transactions
- [CCTP Solana Contracts](https://github.com/circlefin/solana-cctp-contracts) - Solana source code reference
- [EVM CCTP Contracts](https://learn.circle.com/cctp/v1/evm-smart-contracts) - EVM contract addresses

## Troubleshooting

### CORS Issues

If the Circle attestation API fails due to CORS, you can:
1. Manually fetch the attestation: `curl https://iris-api.circle.com/v1/attestations/{hash}`
2. Paste the attestation value directly into the UI

### Transaction Simulation Failed

Check that:
- The attestation status is "complete"
- The message hasn't already been relayed (nonce already used)
- Your wallet has enough native tokens for gas (SOL for Solana, ETH for Ethereum/Base/Arbitrum/OP, MATIC for Polygon, AVAX for Avalanche)
- For EVM relays, your wallet is connected to the correct network (the app will prompt to switch)

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



