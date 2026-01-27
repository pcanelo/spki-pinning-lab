#!/usr/bin/env node

/**
 * Cliente HTTPS con validación SPKI Pinning
 * 
 * Uso:
 *   node client.js --pins a                    (valida solo Pin A)
 *   node client.js --pins a,b                  (valida Pin A o Pin B)
 *   node client.js --pins a --url https://localhost:3000/health
 *   node client.js --pins a --cert-file certs/ca-cert.pem
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parsear argumentos
const args = process.argv.slice(2);
let pins = ['a'];           // default
let url = 'https://localhost:3000/health';  // default
let caFile = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pins' && i + 1 < args.length) {
    pins = args[i + 1].split(',').map(p => p.trim().toLowerCase());
  }
  if (args[i] === '--url' && i + 1 < args.length) {
    url = args[i + 1];
  }
  if (args[i] === '--cert-file' && i + 1 < args.length) {
    caFile = args[i + 1];
  }
  if (args[i] === '--verbose' || args[i] === '-v') {
    verbose = true;
  }
}

// Cargar pins desde archivo de configuración
const certsDir = path.join(__dirname, '..', 'certs');
const pinsFilePath = path.join(certsDir, 'pins.json');

let expectedPins = {};
if (fs.existsSync(pinsFilePath)) {
  try {
    const pinsData = JSON.parse(fs.readFileSync(pinsFilePath, 'utf8'));
    expectedPins = {
      a: pinsData.pinA,
      b: pinsData.pinB,
      c: pinsData.pinC
    };
    if (verbose) {
      console.log('[DEBUG] Pins cargados desde pins.json');
    }
  } catch (err) {
    console.error('Error al cargar pins.json:', err.message);
    process.exit(1);
  }
} else {
  console.error('Error: pins.json no encontrado');
  console.error(`Asegúrate de ejecutar: bash scripts/generate-certs.sh`);
  process.exit(1);
}

// Validar que los pins solicitados existan
for (const pin of pins) {
  if (!expectedPins[pin]) {
    console.error(`Error: Pin '${pin}' no encontrado en pins.json`);
    process.exit(1);
  }
}

// Cargar CA local si se proporciona
let caOptions = {
  rejectUnauthorized: false  // Inicialmente sin validación de CA
};

if (caFile && fs.existsSync(caFile)) {
  try {
    const ca = fs.readFileSync(caFile, 'utf8');
    caOptions = {
      ca: ca,
      rejectUnauthorized: true
    };
    if (verbose) {
      console.log(`[DEBUG] CA cargada desde: ${caFile}`);
    }
  } catch (err) {
    console.error('Error al cargar CA:', err.message);
    process.exit(1);
  }
}

/**
 * Función para extraer SPKI del certificado del servidor
 * y calcular su hash SHA-256 en base64
 */
function calculateSPKIPin(certificate) {
  try {
    // Obtener la clave pública en formato DER
    const publicKeyDER = crypto.createPublicKey({
      key: certificate.pubkey,
      format: 'der',
      type: 'spki'
    }).export({ format: 'der', type: 'spki' });

    // Calcular SHA-256 del SPKI
    const hash = crypto.createHash('sha256');
    hash.update(publicKeyDER);
    const pin = hash.digest('base64');

    return pin;
  } catch (err) {
    console.error('Error al calcular SPKI pin:', err.message);
    return null;
  }
}

/**
 * Función para validar el pin contra la lista de pins permitidos
 */
function validatePin(calculatedPin, allowedPins) {
  const allowedPinValues = allowedPins.map(p => expectedPins[p]);
  
  if (allowedPinValues.includes(calculatedPin)) {
    return true;
  }
  return false;
}

/**
 * Realizar request HTTPS con validación SPKI
 */
function makeRequest() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     SPKI Pinning Lab - Cliente HTTPS                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`URL: ${url}`);
  console.log(`Pins permitidos: ${pins.join(', ').toUpperCase()}`);
  console.log('');
  console.log('Iniciando request...');
  console.log('');

  https.get(url, caOptions, (res) => {
    // Obtener certificado del servidor
    const serverCert = res.socket.getPeerCertificate(false);
    
    if (!serverCert || !serverCert.pubkey) {
      console.error('❌ Error: No se pudo obtener el certificado del servidor');
      process.exit(1);
    }

    // Información del certificado
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('INFORMACIÓN DEL CERTIFICADO DEL SERVIDOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (serverCert.subject) {
      console.log(`Subject: ${JSON.stringify(serverCert.subject)}`);
    }
    if (serverCert.issuer) {
      console.log(`Issuer: ${JSON.stringify(serverCert.issuer)}`);
    }
    if (serverCert.valid_from) {
      console.log(`Valid From: ${serverCert.valid_from}`);
    }
    if (serverCert.valid_to) {
      console.log(`Valid To: ${serverCert.valid_to}`);
    }
    
    console.log('');

    // Validación TLS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VALIDACIÓN TLS (Handshake)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Handshake TLS exitoso');
    console.log(`✓ Protocolo: ${res.socket.tlsVersion}`);
    console.log(`✓ Cipher: ${res.socket.getCipher().name}`);
    console.log('');

    // Calcular SPKI pin
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VALIDACIÓN SPKI PINNING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const calculatedPin = calculateSPKIPin(serverCert);
    
    if (!calculatedPin) {
      console.error('❌ Error: No se pudo calcular el SPKI pin');
      process.exit(1);
    }

    console.log(`Pin calculado: ${calculatedPin}`);
    console.log('');
    console.log('Pins permitidos:');
    for (const pin of pins) {
      const pinValue = expectedPins[pin];
      const match = pinValue === calculatedPin ? '✓' : '✗';
      console.log(`  ${match} Pin ${pin.toUpperCase()}: ${pinValue}`);
    }
    console.log('');

    // Validar pin
    const pinValid = validatePin(calculatedPin, pins);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESULTADO FINAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (pinValid) {
      console.log('✓ ÉXITO: SPKI pin válido');
      console.log('✓ El certificado es de confianza y está pineado correctamente');
    } else {
      console.log('❌ FALLO: SPKI pin NO coincide');
      console.log('❌ El certificado es válido por TLS, pero NO está pineado');
      console.log('❌ Posible ataque MITM o certificado no autorizado');
    }
    console.log('');

    // Leer respuesta
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('RESPUESTA DEL SERVIDOR');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(data);
      console.log('');

      // Salir con código apropiado
      process.exit(pinValid ? 0 : 1);
    });

  }).on('error', (err) => {
    console.error('❌ Error en la request:');
    console.error(`   ${err.message}`);
    console.error('');
    
    if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.error('Nota: El certificado no está firmado por la CA local.');
      console.error('Usa: node client.js --pins a --cert-file certs/ca-cert.pem');
    }
    
    process.exit(1);
  });
}

// Ejecutar
makeRequest();
