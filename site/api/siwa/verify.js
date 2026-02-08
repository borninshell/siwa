const nacl = require('tweetnacl');
const bs58 = require('bs58');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, signature, publicKey } = req.body;

    if (!message || !signature || !publicKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: message, signature, publicKey' 
      });
    }

    // Decode base58 signature and public key
    let sigBytes;
    let pubKeyBytes;

    try {
      sigBytes = bs58.decode(signature);
      pubKeyBytes = bs58.decode(publicKey);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base58 encoding' });
    }

    // Verify signature length
    if (sigBytes.length !== 64) {
      return res.status(400).json({ error: 'Invalid signature length' });
    }

    // Verify public key length
    if (pubKeyBytes.length !== 32) {
      return res.status(400).json({ error: 'Invalid public key length' });
    }

    // Encode message as Uint8Array
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature
    const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);

    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid signature' 
      });
    }

    // Parse message to extract address
    const addressMatch = message.match(/^[^\n]+\n([1-9A-HJ-NP-Za-km-z]{32,44})/);
    const address = addressMatch ? addressMatch[1] : publicKey;

    // Verify the public key matches the address in the message
    if (address !== publicKey) {
      return res.status(401).json({
        success: false,
        error: 'Public key does not match address in message'
      });
    }

    // Generate session token
    const sessionToken = Buffer.from(
      JSON.stringify({
        address,
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      })
    ).toString('base64');

    res.status(200).json({
      success: true,
      address,
      sessionToken
    });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
