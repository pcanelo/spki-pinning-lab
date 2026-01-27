# Referencia de Comandos OpenSSL

## Índice

1. [Generar CA Local](#generar-ca-local)
2. [Generar Certificados](#generar-certificados)
3. [Calcular SPKI Pins](#calcular-spki-pins)
4. [Inspeccionar Certificados](#inspeccionar-certificados)
5. [Validar Certificados](#validar-certificados)
6. [Convertir Formatos](#convertir-formatos)
7. [Troubleshooting](#troubleshooting)

---

## Generar CA Local

### 1. Generar Clave Privada de la CA

```bash
openssl genrsa -out certs/ca-key.pem 2048
```

**Parámetros:**
- `genrsa` - Generar clave RSA
- `-out certs/ca-key.pem` - Archivo de salida
- `2048` - Tamaño de clave (2048 bits = 256 bytes)

**Salida esperada:**
```
Generating RSA private key, 2048 bit long modulus (2 primes)
.....+++
.....+++
```

### 2. Generar Certificado Autofirmado de la CA

```bash
openssl req -new -x509 -days 365 -key certs/ca-key.pem \
  -out certs/ca-cert.pem \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=SPKI-Lab-Root-CA"
```

**Parámetros:**
- `req` - Crear solicitud de certificado o certificado autofirmado
- `-new` - Nueva solicitud
- `-x509` - Crear certificado autofirmado (no CSR)
- `-days 365` - Válido por 365 días
- `-key certs/ca-key.pem` - Usar esta clave privada
- `-out certs/ca-cert.pem` - Archivo de salida
- `-subj "..."` - Sujeto del certificado (sin prompt interactivo)

**Campos del sujeto:**
- `C` - Country (código ISO de 2 letras)
- `ST` - State/Province
- `L` - Locality/City
- `O` - Organization
- `CN` - Common Name (nombre del certificado)

---

## Generar Certificados

### Proceso Completo para un Certificado

#### Paso 1: Generar Clave Privada

```bash
openssl genrsa -out certs/key-a.pem 2048
```

#### Paso 2: Generar CSR (Certificate Signing Request)

```bash
openssl req -new -key certs/key-a.pem \
  -out certs/cert-a.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost"
```

**Parámetros:**
- `req` - Crear solicitud de certificado
- `-new` - Nueva solicitud
- `-key certs/key-a.pem` - Usar esta clave privada
- `-out certs/cert-a.csr` - Archivo de salida (CSR)
- `-subj "..."` - Sujeto del certificado

#### Paso 3: Firmar CSR con la CA

```bash
openssl x509 -req -days 365 \
  -in certs/cert-a.csr \
  -CA certs/ca-cert.pem \
  -CAkey certs/ca-key.pem \
  -CAcreateserial \
  -out certs/cert-a.pem \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")
```

**Parámetros:**
- `x509` - Certificado X.509
- `-req` - Procesar CSR
- `-days 365` - Válido por 365 días
- `-in certs/cert-a.csr` - CSR de entrada
- `-CA certs/ca-cert.pem` - Certificado de CA
- `-CAkey certs/ca-key.pem` - Clave privada de CA
- `-CAcreateserial` - Crear archivo de serie si no existe
- `-out certs/cert-a.pem` - Certificado de salida
- `-extfile <(...)` - Extensiones del certificado (SAN)

**Nota sobre SAN (Subject Alternative Name):**
```bash
# SAN es importante para HTTPS con localhost
-extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")
```

### Script Completo para Generar 3 Certificados

```bash
#!/bin/bash

CERTS_DIR="certs"
DAYS=365

# Crear directorio
mkdir -p $CERTS_DIR

# CA
openssl genrsa -out $CERTS_DIR/ca-key.pem 2048
openssl req -new -x509 -days $DAYS -key $CERTS_DIR/ca-key.pem \
  -out $CERTS_DIR/ca-cert.pem \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=SPKI-Lab-Root-CA"

# Certificado A
openssl genrsa -out $CERTS_DIR/key-a.pem 2048
openssl req -new -key $CERTS_DIR/key-a.pem -out $CERTS_DIR/cert-a.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost"
openssl x509 -req -days $DAYS -in $CERTS_DIR/cert-a.csr \
  -CA $CERTS_DIR/ca-cert.pem -CAkey $CERTS_DIR/ca-key.pem -CAcreateserial \
  -out $CERTS_DIR/cert-a.pem \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")

# Certificado B
openssl genrsa -out $CERTS_DIR/key-b.pem 2048
openssl req -new -key $CERTS_DIR/key-b.pem -out $CERTS_DIR/cert-b.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost"
openssl x509 -req -days $DAYS -in $CERTS_DIR/cert-b.csr \
  -CA $CERTS_DIR/ca-cert.pem -CAkey $CERTS_DIR/ca-key.pem -CAcreateserial \
  -out $CERTS_DIR/cert-b.pem \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")

# Certificado C (MITM demo)
openssl genrsa -out $CERTS_DIR/key-c.pem 2048
openssl req -new -key $CERTS_DIR/key-c.pem -out $CERTS_DIR/cert-c.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost"
openssl x509 -req -days $DAYS -in $CERTS_DIR/cert-c.csr \
  -CA $CERTS_DIR/ca-cert.pem -CAkey $CERTS_DIR/ca-key.pem -CAcreateserial \
  -out $CERTS_DIR/cert-c.pem \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")

echo "✓ Certificados generados en $CERTS_DIR/"
```

---

## Calcular SPKI Pins

### Método 1: OpenSSL (Línea de Comandos)

```bash
openssl x509 -in certs/cert-a.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

**Desglose:**
1. `openssl x509 -in certs/cert-a.pem -pubkey -noout` - Extraer clave pública en PEM
2. `openssl pkey -pubin -outform DER` - Convertir a formato DER
3. `openssl dgst -sha256 -binary` - Calcular SHA-256 en binario
4. `openssl enc -base64` - Codificar a base64

**Salida esperada:**
```
aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
```

### Método 2: Función Bash

```bash
calculate_pin() {
  local cert_file=$1
  openssl x509 -in "$cert_file" -pubkey -noout | \
    openssl pkey -pubin -outform DER | \
    openssl dgst -sha256 -binary | \
    openssl enc -base64
}

# Uso
PIN_A=$(calculate_pin "certs/cert-a.pem")
PIN_B=$(calculate_pin "certs/cert-b.pem")
PIN_C=$(calculate_pin "certs/cert-c.pem")

echo "Pin A: $PIN_A"
echo "Pin B: $PIN_B"
echo "Pin C: $PIN_C"
```

### Método 3: Node.js

```javascript
const crypto = require('crypto');
const { execSync } = require('child_process');

function calculatePin(certPath) {
  const publicKeyDER = execSync(
    `openssl x509 -in ${certPath} -pubkey -noout | openssl pkey -pubin -outform DER`,
    { encoding: 'utf8' }
  );
  
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(publicKeyDER, 'binary'));
  return hash.digest('base64');
}

const pinA = calculatePin('certs/cert-a.pem');
console.log('Pin A:', pinA);
```

### Calcular Múltiples Pins a la Vez

```bash
#!/bin/bash

for cert in certs/cert-*.pem; do
  name=$(basename "$cert" .pem | tr '[:lower:]' '[:upper:]')
  pin=$(openssl x509 -in "$cert" -pubkey -noout | \
    openssl pkey -pubin -outform DER | \
    openssl dgst -sha256 -binary | \
    openssl enc -base64)
  echo "$name: $pin"
done
```

---

## Inspeccionar Certificados

### Ver Información Completa

```bash
openssl x509 -in certs/cert-a.pem -text -noout
```

**Salida:**
```
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            ...
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C = UY, ST = Montevideo, L = Montevideo, O = SPKI Lab, CN = SPKI-Lab-Root-CA
        Validity
            Not Before: Jan 26 12:00:00 2024 GMT
            Not After : Jan 26 12:00:00 2025 GMT
        Subject: C = UY, ST = Montevideo, L = Montevideo, O = SPKI Lab, CN = localhost
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                RSA Public Key: (2048 bit)
                    Modulus (2048 bit):
                        ...
                    Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Subject Alternative Name:
                DNS:localhost, IP Address:127.0.0.1
```

### Ver Solo Subject

```bash
openssl x509 -in certs/cert-a.pem -subject -noout
```

**Salida:**
```
subject=C = UY, ST = Montevideo, L = Montevideo, O = SPKI Lab, CN = localhost
```

### Ver Solo Issuer

```bash
openssl x509 -in certs/cert-a.pem -issuer -noout
```

**Salida:**
```
issuer=C = UY, ST = Montevideo, L = Montevideo, O = SPKI Lab, CN = SPKI-Lab-Root-CA
```

### Ver Fechas de Validez

```bash
openssl x509 -in certs/cert-a.pem -noout -dates
```

**Salida:**
```
notBefore=Jan 26 12:00:00 2024 GMT
notAfter=Jan 26 12:00:00 2025 GMT
```

### Ver Clave Pública

```bash
openssl x509 -in certs/cert-a.pem -pubkey -noout
```

**Salida:**
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
...
-----END PUBLIC KEY-----
```

### Ver Serial Number

```bash
openssl x509 -in certs/cert-a.pem -serial -noout
```

**Salida:**
```
serial=1A2B3C4D5E6F7G8H
```

### Ver Información de Firma

```bash
openssl x509 -in certs/cert-a.pem -text -noout | grep -A 2 "Signature Algorithm"
```

### Comparar Dos Certificados

```bash
# Extraer fingerprint (huella digital)
openssl x509 -in certs/cert-a.pem -noout -fingerprint -sha256
openssl x509 -in certs/cert-b.pem -noout -fingerprint -sha256

# Si son iguales, tienen la misma clave pública
```

---

## Validar Certificados

### Validar Firma de Certificado

```bash
openssl verify -CAfile certs/ca-cert.pem certs/cert-a.pem
```

**Salida esperada:**
```
certs/cert-a.pem: OK
```

### Validar Cadena de Certificados

```bash
openssl verify -CAfile certs/ca-cert.pem \
  -untrusted certs/cert-a.pem \
  certs/cert-a.pem
```

### Validar Certificado contra CA

```bash
openssl x509 -in certs/cert-a.pem -noout -issuer | \
  grep -q "SPKI-Lab-Root-CA" && echo "✓ Firmado por CA local" || echo "❌ No firmado por CA local"
```

### Validar Fechas de Validez

```bash
openssl x509 -in certs/cert-a.pem -noout -dates
```

### Validar SAN (Subject Alternative Name)

```bash
openssl x509 -in certs/cert-a.pem -text -noout | grep -A 1 "Subject Alternative Name"
```

**Salida esperada:**
```
X509v3 Subject Alternative Name:
    DNS:localhost, IP Address:127.0.0.1
```

---

## Convertir Formatos

### PEM a DER

```bash
openssl x509 -in certs/cert-a.pem -outform DER -out certs/cert-a.der
```

### DER a PEM

```bash
openssl x509 -inform DER -in certs/cert-a.der -out certs/cert-a.pem
```

### Extraer Clave Pública en DER

```bash
openssl x509 -in certs/cert-a.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER -out certs/pubkey-a.der
```

### Crear Bundle de Certificados

```bash
cat certs/cert-a.pem certs/cert-b.pem certs/cert-c.pem > certs/bundle.pem
```

---

## Troubleshooting

### Error: "unable to load certificate"

**Causa:** Archivo no encontrado o formato incorrecto.

**Solución:**
```bash
# Verificar que el archivo existe
ls -la certs/cert-a.pem

# Verificar que es un certificado válido
openssl x509 -in certs/cert-a.pem -text -noout
```

### Error: "unable to load Private Key"

**Causa:** Clave privada no encontrada o formato incorrecto.

**Solución:**
```bash
# Verificar que la clave existe
ls -la certs/key-a.pem

# Verificar que es una clave válida
openssl pkey -in certs/key-a.pem -text -noout
```

### Error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

**Causa:** El certificado no está firmado por la CA especificada.

**Solución:**
```bash
# Verificar que la CA es correcta
openssl verify -CAfile certs/ca-cert.pem certs/cert-a.pem

# Si falla, regenerar el certificado
openssl x509 -req -days 365 -in certs/cert-a.csr \
  -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial \
  -out certs/cert-a.pem
```

### Error: "certificate has expired"

**Causa:** El certificado ha expirado.

**Solución:**
```bash
# Ver fechas de validez
openssl x509 -in certs/cert-a.pem -noout -dates

# Regenerar con más días
openssl x509 -req -days 3650 -in certs/cert-a.csr \
  -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial \
  -out certs/cert-a.pem
```

### Error: "unable to write 'random state'"

**Causa:** Problema de permisos en el directorio home.

**Solución:**
```bash
# Crear directorio .rnd
touch ~/.rnd
chmod 600 ~/.rnd
```

---

## Ejemplos Completos

### Generar Certificado Autofirmado (sin CA)

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=Test/CN=localhost"
```

### Generar CSR para CA Externo

```bash
openssl req -new -newkey rsa:2048 -keyout key.pem -out cert.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=Test/CN=example.com"
```

### Verificar Certificado y Clave Coinciden

```bash
# Extraer módulo de clave pública del certificado
CERT_MOD=$(openssl x509 -in cert.pem -noout -pubkey | \
  openssl pkey -pubin -text -noout | grep -A 10 "Public-Key" | tail -n 1)

# Extraer módulo de la clave privada
KEY_MOD=$(openssl pkey -in key.pem -text -noout | grep -A 10 "Public-Key" | tail -n 1)

# Comparar
if [ "$CERT_MOD" = "$KEY_MOD" ]; then
  echo "✓ Certificado y clave coinciden"
else
  echo "❌ Certificado y clave NO coinciden"
fi
```

---

## Referencia Rápida

| Tarea | Comando |
|-------|---------|
| Generar clave privada | `openssl genrsa -out key.pem 2048` |
| Generar CSR | `openssl req -new -key key.pem -out cert.csr` |
| Generar certificado autofirmado | `openssl req -x509 -key key.pem -out cert.pem` |
| Firmar CSR | `openssl x509 -req -in cert.csr -CA ca.pem -CAkey ca-key.pem -out cert.pem` |
| Calcular pin SPKI | `openssl x509 -in cert.pem -pubkey -noout \| openssl pkey -pubin -outform DER \| openssl dgst -sha256 -binary \| openssl enc -base64` |
| Ver certificado | `openssl x509 -in cert.pem -text -noout` |
| Validar certificado | `openssl verify -CAfile ca.pem cert.pem` |
| Convertir PEM a DER | `openssl x509 -in cert.pem -outform DER -out cert.der` |

---

**Próximo paso:** Revisa ESCENARIOS.md para descripción técnica de cada escenario.
