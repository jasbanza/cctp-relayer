// Vercel Serverless Function: POST /api/relay
// Proxies sendTransaction RPC call to Helius (keeps API key secret)

import { ALLOWED_ORIGINS } from './config.js';

function setCorsHeaders(res, origin) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Origin');
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Check origin
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  const heliusUrl = process.env.HELIUS_RPC_URL;
  if (!heliusUrl) {
    console.error('HELIUS_RPC_URL not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  
  const { signedTransaction } = req.body || {};
  
  if (!signedTransaction) {
    return res.status(400).json({ error: 'Missing signedTransaction in request body' });
  }
  
  try {
    // Send the transaction
    const sendResponse = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: [
          signedTransaction,
          {
            encoding: 'base64',
            skipPreflight: false,
            preflightCommitment: 'finalized',
          },
        ],
      }),
    });
    
    const sendData = await sendResponse.json();
    
    if (sendData.error) {
      return res.status(400).json({ 
        error: sendData.error.message,
        details: sendData.error 
      });
    }
    
    const signature = sendData.result;
    
    return res.status(200).json({
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    });
  } catch (err) {
    console.error('Relay error:', err);
    return res.status(500).json({ error: 'Failed to relay transaction' });
  }
}

