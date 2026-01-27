#!/usr/bin/env node

/**
 * Script helper para calcular SPKI pins desde certificados
 * 
 * Uso:
 *   node calculate-pin.js certs/cert-a.pem
 *   node calculate-pin.js certs/cert-a.pem certs/cert-b.pem
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function calculatePinFromCert(certPath) {
  if (!fs.existsSync(certPath)) {
    console.error(`Error: Archivo no encontrado: ${certPath}`);
    return null;
  }

  try {
    // Leer certificado
    const certPem = fs.readFileSync(certPath, 'utf8');

    // Extraer clave pública en formato DER usando OpenSSL
    const publicKeyDER = execSync(
      `openssl x509 -in ${certPath} -pubkey -noout | openssl pkey -pubin -outform DER`,
      { encoding: 'utf8' }
    );

    // Calcular SHA-256
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(publicKeyDER, 'binary'));
    const pin = hash.digest('base64');

    return pin;
  } catch (err) {
    console.error(`Error al procesar ${certPath}:`, err.message);
    return null;
  }
}

// Main
const certFiles = process.argv.slice(2);

if (certFiles.length === 0) {
  console.log('Uso: node calculate-pin.js <cert1.pem> [cert2.pem] ...');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node calculate-pin.js certs/cert-a.pem');
  console.log('  node calculate-pin.js certs/cert-a.pem certs/cert-b.pem certs/cert-c.pem');
  process.exit(0);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║        SPKI Pin Calculator                            ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');

for (const certFile of certFiles) {
  const pin = calculatePinFromCert(certFile);
  if (pin) {
    const label = path.basename(certFile, '.pem').toUpperCase();
    console.log(`${label}: ${pin}`);
  }
}

console.log('');
