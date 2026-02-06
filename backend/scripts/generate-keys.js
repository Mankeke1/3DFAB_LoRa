/**
 * RSA Keypair Generator for JWT RS256
 * 
 * This script generates a 2048-bit RSA keypair for use with JWT RS256 algorithm.
 * The keys are stored in backend/keys/ directory.
 * 
 * Usage: npm run generate-keys
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate RSA keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// Create keys directory if it doesn't exist
const keysDir = path.join(__dirname, '../keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

// Write keys to files
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 }); // Read/write owner only
fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

console.log('✅ RSA keypair generated successfully:');
console.log(`   - Private key: ${privateKeyPath}`);
console.log(`   - Public key:  ${publicKeyPath}`);
console.log('\n⚠️  IMPORTANT: These keys should NOT be committed to git.');
console.log('   The keys/ directory is already in .gitignore.');
console.log('\n📝 For production, generate new keys on the server and store securely.');
