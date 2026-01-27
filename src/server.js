#!/usr/bin/env node

/**
 * Servidor HTTPS para laboratorio de SPKI Pinning
 * 
 * Uso:
 *   node server.js --cert a        (inicia con Cert A)
 *   node server.js --cert b        (inicia con Cert B)
 *   node server.js --cert c        (inicia con Cert C - MITM demo)
 *   node server.js --cert a --port 3001  (puerto personalizado)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Parsear argumentos
const args = process.argv.slice(2);
let certChoice = 'a';  // default
let port = 3000;       // default

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cert' && i + 1 < args.length) {
    certChoice = args[i + 1].toLowerCase();
  }
  if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1], 10);
  }
}

// Validar elección de certificado
if (!['a', 'b', 'c'].includes(certChoice)) {
  console.error('Error: --cert debe ser a, b o c');
  process.exit(1);
}

// Rutas de certificados
const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, `key-${certChoice}.pem`);
const certPath = path.join(certsDir, `cert-${certChoice}.pem`);

// Verificar que los archivos existan
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(`Error: Certificados no encontrados en ${certsDir}`);
  console.error(`Asegúrate de ejecutar: bash scripts/generate-certs.sh`);
  process.exit(1);
}

// Cargar certificado y clave
const key = fs.readFileSync(keyPath, 'utf8');
const cert = fs.readFileSync(certPath, 'utf8');

// Opciones HTTPS
const options = {
  key: key,
  cert: cert,
  // Configuración de TLS 1.2+
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
};

// Crear servidor HTTPS
const server = https.createServer(options, (req, res) => {
  // Headers CORS básicos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Logging de request
  const timestamp = new Date().toISOString();
  const tlsVersion = req.socket.tlsVersion;
  const cipher = req.socket.getCipher().name;
  
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  console.log(`  TLS: ${tlsVersion}, Cipher: ${cipher}`);

  // Rutas
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      certificate: `cert-${certChoice}`,
      timestamp: new Date().toISOString(),
      tlsVersion: tlsVersion,
      message: `Servidor ejecutándose con Certificado ${certChoice.toUpperCase()}`
    }, null, 2));
  } 
  else if (req.url === '/cert-info') {
    // Endpoint que devuelve información del certificado actual
    const cert = req.socket.getPeerCertificate(false);
    res.writeHead(200);
    res.end(JSON.stringify({
      certificate: `cert-${certChoice}`,
      subject: req.socket.getPeerCertificate(false)?.subject || 'N/A',
      issuer: req.socket.getPeerCertificate(false)?.issuer || 'N/A',
      timestamp: new Date().toISOString()
    }, null, 2));
  }
  else if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      message: 'SPKI Pinning Lab Server',
      certificate: `cert-${certChoice}`,
      endpoints: [
        '/health - Estado del servidor',
        '/ping - Ping simple',
        '/cert-info - Información del certificado',
        '/api/test - Endpoint de prueba'
      ],
      timestamp: new Date().toISOString()
    }, null, 2));
  }
  else if (req.url === '/api/test') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: 'API test endpoint',
      certificate: `cert-${certChoice}`,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Ruta ${req.url} no existe`,
      availableEndpoints: ['/health', '/ping', '/cert-info', '/api/test', '/']
    }, null, 2));
  }
});

// Manejo de errores
server.on('error', (err) => {
  console.error('Error del servidor:', err);
  process.exit(1);
});

// Iniciar servidor
server.listen(port, 'localhost', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        SPKI Pinning Lab - Servidor HTTPS               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Servidor iniciado en https://localhost:${port}`);
  console.log(`✓ Certificado en uso: cert-${certChoice.toUpperCase()}`);
  console.log(`✓ TLS: ${options.minVersion} - ${options.maxVersion}`);
  console.log('');
  console.log('Endpoints disponibles:');
  console.log(`  GET https://localhost:${port}/health`);
  console.log(`  GET https://localhost:${port}/ping`);
  console.log(`  GET https://localhost:${port}/cert-info`);
  console.log(`  GET https://localhost:${port}/api/test`);
  console.log('');
  console.log('Presiona Ctrl+C para detener el servidor');
  console.log('');
});

// Manejo de señales
process.on('SIGINT', () => {
  console.log('\n\nServidor detenido.');
  process.exit(0);
});
