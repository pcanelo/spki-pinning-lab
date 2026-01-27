#!/bin/bash

# Script para generar CA local y certificados para el laboratorio de SPKI Pinning
# Uso: bash generate-certs.sh

set -e

CERTS_DIR="../certs"
DAYS_VALID=365

echo "=========================================="
echo "SPKI Pinning Lab - Generador de Certificados"
echo "=========================================="
echo ""

# Crear directorio si no existe
mkdir -p "$CERTS_DIR"

# ============================================
# PASO 1: Generar CA local (Root CA)
# ============================================
echo "[1/7] Generando CA local (Root CA)..."
echo ""

# Generar clave privada de la CA
openssl genrsa -out "$CERTS_DIR/ca-key.pem" 2048 2>/dev/null
echo "✓ Clave privada de CA generada: ca-key.pem"

# Generar certificado autofirmado de la CA
openssl req -new -x509 -days $DAYS_VALID -key "$CERTS_DIR/ca-key.pem" \
  -out "$CERTS_DIR/ca-cert.pem" \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=SPKI-Lab-Root-CA" 2>/dev/null
echo "✓ Certificado de CA generado: ca-cert.pem"
echo ""

# ============================================
# PASO 2: Generar Certificado A (Key A / Cert A)
# ============================================
echo "[2/7] Generando Certificado A (Key A / Cert A)..."
echo ""

# Generar clave privada A
openssl genrsa -out "$CERTS_DIR/key-a.pem" 2048 2>/dev/null
echo "✓ Clave privada A generada: key-a.pem"

# Generar CSR (Certificate Signing Request) para A
openssl req -new -key "$CERTS_DIR/key-a.pem" \
  -out "$CERTS_DIR/cert-a.csr" \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost" 2>/dev/null
echo "✓ CSR para A generado: cert-a.csr"

# Firmar CSR con la CA
openssl x509 -req -days $DAYS_VALID \
  -in "$CERTS_DIR/cert-a.csr" \
  -CA "$CERTS_DIR/ca-cert.pem" \
  -CAkey "$CERTS_DIR/ca-key.pem" \
  -CAcreateserial \
  -out "$CERTS_DIR/cert-a.pem" \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1") 2>/dev/null
echo "✓ Certificado A firmado por CA: cert-a.pem"
echo ""

# ============================================
# PASO 3: Generar Certificado B (Key B / Cert B)
# ============================================
echo "[3/7] Generando Certificado B (Key B / Cert B)..."
echo ""

# Generar clave privada B
openssl genrsa -out "$CERTS_DIR/key-b.pem" 2048 2>/dev/null
echo "✓ Clave privada B generada: key-b.pem"

# Generar CSR para B
openssl req -new -key "$CERTS_DIR/key-b.pem" \
  -out "$CERTS_DIR/cert-b.csr" \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost" 2>/dev/null
echo "✓ CSR para B generado: cert-b.csr"

# Firmar CSR con la CA
openssl x509 -req -days $DAYS_VALID \
  -in "$CERTS_DIR/cert-b.csr" \
  -CA "$CERTS_DIR/ca-cert.pem" \
  -CAkey "$CERTS_DIR/ca-key.pem" \
  -CAcreateserial \
  -out "$CERTS_DIR/cert-b.pem" \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1") 2>/dev/null
echo "✓ Certificado B firmado por CA: cert-b.pem"
echo ""

# ============================================
# PASO 4: Generar Certificado C (Key C / Cert C) - Para demo MITM
# ============================================
echo "[4/7] Generando Certificado C (Key C / Cert C) - Para demo MITM..."
echo ""

# Generar clave privada C
openssl genrsa -out "$CERTS_DIR/key-c.pem" 2048 2>/dev/null
echo "✓ Clave privada C generada: key-c.pem"

# Generar CSR para C
openssl req -new -key "$CERTS_DIR/key-c.pem" \
  -out "$CERTS_DIR/cert-c.csr" \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost" 2>/dev/null
echo "✓ CSR para C generado: cert-c.csr"

# Firmar CSR con la CA
openssl x509 -req -days $DAYS_VALID \
  -in "$CERTS_DIR/cert-c.csr" \
  -CA "$CERTS_DIR/ca-cert.pem" \
  -CAkey "$CERTS_DIR/ca-key.pem" \
  -CAcreateserial \
  -out "$CERTS_DIR/cert-c.pem" \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1") 2>/dev/null
echo "✓ Certificado C firmado por CA: cert-c.pem"
echo ""

# ============================================
# PASO 5: Extraer claves públicas y calcular SPKIs
# ============================================
echo "[5/7] Extrayendo claves públicas y calculando SPKIs..."
echo ""

# Función para extraer SPKI y calcular pin
calculate_pin() {
  local cert_file=$1
  local pin_name=$2
  
  # Extraer la clave pública en formato DER
  openssl x509 -in "$cert_file" -pubkey -noout | \
    openssl pkey -pubin -outform DER | \
    openssl dgst -sha256 -binary | \
    openssl enc -base64
}

# Calcular pins
PIN_A=$(calculate_pin "$CERTS_DIR/cert-a.pem" "A")
PIN_B=$(calculate_pin "$CERTS_DIR/cert-b.pem" "B")
PIN_C=$(calculate_pin "$CERTS_DIR/cert-c.pem" "C")

echo "✓ SPKI Pin A (SHA-256, base64): $PIN_A"
echo "✓ SPKI Pin B (SHA-256, base64): $PIN_B"
echo "✓ SPKI Pin C (SHA-256, base64): $PIN_C"
echo ""

# ============================================
# PASO 6: Guardar pins en archivo de configuración
# ============================================
echo "[6/7] Guardando pins en archivo de configuración..."
echo ""

cat > "$CERTS_DIR/pins.json" << EOF
{
  "pinA": "$PIN_A",
  "pinB": "$PIN_B",
  "pinC": "$PIN_C",
  "description": "SPKI Pins para el laboratorio de SPKI Pinning",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "✓ Archivo de pins generado: pins.json"
echo ""

# ============================================
# PASO 7: Mostrar información de certificados
# ============================================
echo "[7/7] Información de certificados generados..."
echo ""

for cert in a b c; do
  echo "--- Certificado $cert ---"
  openssl x509 -in "$CERTS_DIR/cert-${cert}.pem" -text -noout | grep -E "Subject:|Issuer:|Not Before|Not After|Public-Key:" | head -5
  echo ""
done

# ============================================
# Resumen final
# ============================================
echo "=========================================="
echo "✓ Generación completada exitosamente"
echo "=========================================="
echo ""
echo "Archivos generados en $CERTS_DIR:"
echo "  - ca-key.pem, ca-cert.pem (CA local)"
echo "  - key-a.pem, cert-a.pem (Certificado A)"
echo "  - key-b.pem, cert-b.pem (Certificado B)"
echo "  - key-c.pem, cert-c.pem (Certificado C - MITM demo)"
echo "  - pins.json (SPKIs calculados)"
echo ""
echo "Para usar estos certificados:"
echo "  - Servidor: node server.js --cert a (o b, o c)"
echo "  - Cliente: node client.js --pins a,b (o solo a, etc.)"
echo ""
