/**
 * SIWA Demo Client
 * 
 * Demonstrates how an agent authenticates with a SIWA-enabled service.
 * 
 * Run with: npx tsx examples/demo-client/index.ts
 */

import { Keypair } from '@solana/web3.js';
import { 
  createMessage, 
  serializeMessage, 
  parseMessage,
  generateNonce 
} from '@siwa/core';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

/**
 * Sign a message with a Solana keypair
 */
function signMessage(message: string, keypair: Keypair): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return bs58.encode(signature);
}

async function main() {
  console.log('🤖 SIWA Demo Client\n');
  
  // Generate a new agent keypair (or load from file)
  const keypair = Keypair.generate();
  const pubkey = keypair.publicKey.toBase58();
  
  console.log(`Agent Public Key: ${pubkey}\n`);
  
  try {
    // Step 1: Request challenge
    console.log('📨 Step 1: Requesting challenge...');
    const challengeRes = await fetch(
      `${SERVER_URL}/siwa/challenge?pubkey=${pubkey}`
    );
    
    if (!challengeRes.ok) {
      throw new Error(`Challenge request failed: ${await challengeRes.text()}`);
    }
    
    const challenge = await challengeRes.json();
    console.log('Challenge received:');
    console.log(`  ID: ${challenge.challengeId}`);
    console.log(`  Expires: ${challenge.expiresAt}`);
    console.log('\nMessage to sign:');
    console.log('---');
    console.log(challenge.message);
    console.log('---\n');
    
    // Step 2: Sign the message
    console.log('✍️  Step 2: Signing message...');
    const signature = signMessage(challenge.message, keypair);
    console.log(`Signature: ${signature.slice(0, 20)}...${signature.slice(-10)}\n`);
    
    // Step 3: Verify and get session
    console.log('🔐 Step 3: Verifying signature...');
    const verifyRes = await fetch(`${SERVER_URL}/siwa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: challenge.message,
        pubkey,
        signature,
      }),
    });
    
    if (!verifyRes.ok) {
      throw new Error(`Verification failed: ${await verifyRes.text()}`);
    }
    
    const session = await verifyRes.json();
    console.log('Session created:');
    console.log(`  Token: ${session.token.slice(0, 20)}...`);
    console.log(`  Expires: ${session.expiresAt}`);
    console.log(`  Scopes: ${session.scopes?.join(', ') || 'none'}\n`);
    
    // Step 4: Access protected endpoint
    console.log('🔓 Step 4: Accessing protected endpoint...');
    const meRes = await fetch(`${SERVER_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    
    if (!meRes.ok) {
      throw new Error(`Protected endpoint failed: ${await meRes.text()}`);
    }
    
    const meData = await meRes.json();
    console.log('Response from /api/me:');
    console.log(JSON.stringify(meData, null, 2));
    
    console.log('\n✅ SIWA authentication successful!');
    
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
