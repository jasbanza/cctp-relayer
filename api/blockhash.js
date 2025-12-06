// Vercel Serverless Function: GET /api/blockhash
// Proxies getLatestBlockhash RPC call to Helius (keeps API key secret)

import { ALLOWED_ORIGINS } from './config.js';

function setCorsHeaders(res, origin) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Origin');
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
  
  // Only allow GET
  if (req.method !== 'GET') {
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
  
  try {
    const rpcResponse = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestBlockhash',
        params: [{ commitment: 'finalized' }],
      }),
    });
    
    const data = await rpcResponse.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    return res.status(200).json({
      blockhash: data.result.value.blockhash,
      lastValidBlockHeight: data.result.value.lastValidBlockHeight,
    });
  } catch (err) {
    console.error('Blockhash fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch blockhash' });
  }
}

