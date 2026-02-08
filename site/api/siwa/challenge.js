const { randomBytes } = require('crypto');

// In-memory nonce store (for demo purposes)
const nonceStore = new Map();

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing address parameter' });
  }

  // Validate Solana address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana address format' });
  }

  // Generate nonce
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store nonce
  nonceStore.set(nonce, { address, expiresAt });

  // Create SIWA message
  const domain = 'siwa-landing-black.vercel.app';
  const uri = `https://${domain}`;
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(expiresAt).toISOString();

  const message = `${domain} wants you to sign in with your Solana account:
${address}

Sign in to SIWA Demo

URI: ${uri}
Version: 1
Chain ID: mainnet
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;

  res.status(200).json({
    message,
    nonce,
    expiresAt: expirationTime
  });
};

module.exports.nonceStore = nonceStore;
