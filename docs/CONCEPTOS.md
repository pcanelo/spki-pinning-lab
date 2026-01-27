# Conceptos Teóricos - SPKI Pinning

## Índice

1. [Introducción a SPKI Pinning](#introducción-a-spki-pinning)
2. [Diferencia entre TLS y SPKI Pinning](#diferencia-entre-tls-y-spki-pinning)
3. [¿Qué es SPKI?](#qué-es-spki)
4. [Cálculo del Pin](#cálculo-del-pin)
5. [Escenarios de Seguridad](#escenarios-de-seguridad)
6. [Rotación de Certificados](#rotación-de-certificados)
7. [Casos de Uso Reales](#casos-de-uso-reales)
8. [Ventajas y Desventajas](#ventajas-y-desventajas)

---

## Introducción a SPKI Pinning

**SPKI Pinning** es una técnica de seguridad que añade una capa adicional de validación más allá de TLS estándar. En lugar de confiar en las autoridades certificadoras (CAs), una aplicación confía en una lista local de claves públicas permitidas.

### Analogía del Mundo Real

Imagina que tienes una caja de seguridad:

- **TLS estándar:** Confías en que cualquiera con un documento firmado por una autoridad de confianza (notario) puede acceder
- **SPKI Pinning:** Solo confías en personas que están en tu lista personal de acceso, sin importar qué documentos tengan

---

## Diferencia entre TLS y SPKI Pinning

### TLS Estándar (X.509)

```
Cliente                                    Servidor
  │                                           │
  ├─────────── ClientHello ─────────────────>│
  │                                           │
  │<─────────── ServerCertificate ───────────┤
  │                                           │
  ├─ Valida:                                 │
  │  1. Firma del certificado                │
  │  2. Cadena de CAs                        │
  │  3. Fecha de validez                     │
  │  4. Nombre del dominio (CN/SAN)          │
  │                                           │
  ├─────────── ClientKeyExchange ───────────>│
  │<─────────── ServerFinished ──────────────┤
  │                                           │
  └─ Conexión TLS establecida ──────────────>│
```

**Validaciones de TLS:**
- ✓ Certificado firmado por CA de confianza
- ✓ Certificado no expirado
- ✓ Nombre del dominio coincide (CN o SAN)
- ✓ Cadena de certificados válida

**Problema:** Si una CA es comprometida, puede emitir certificados válidos para cualquier dominio.

### SPKI Pinning

```
Cliente (con pins locales)                 Servidor
  │                                           │
  ├─ Realiza handshake TLS normal ──────────>│
  │                                           │
  ├─ Valida TLS (como arriba) ──────────────>│
  │                                           │
  ├─ Extrae clave pública del certificado    │
  │                                           │
  ├─ Calcula SHA-256(SPKI)                   │
  │                                           │
  ├─ Compara contra lista local de pins      │
  │                                           │
  ├─ Si coincide: ✓ Conexión permitida       │
  │ Si NO coincide: ❌ Conexión rechazada    │
  │                                           │
  └─ Decisión final ─────────────────────────>│
```

**Validaciones adicionales de SPKI Pinning:**
- ✓ Todas las validaciones de TLS
- ✓ Clave pública en lista de pins permitidos

---

## ¿Qué es SPKI?

**SPKI** = **Subject Public Key Info**

Es la estructura ASN.1 DER que contiene:
1. El algoritmo de clave pública (RSA, ECDSA, etc.)
2. La clave pública en sí

### Estructura de un Certificado X.509

```
Certificate ::= SEQUENCE {
  tbsCertificate       TBSCertificate,
  signatureAlgorithm   AlgorithmIdentifier,
  signatureValue       BIT STRING
}

TBSCertificate ::= SEQUENCE {
  version              [0] Version,
  serialNumber         CertificateSerialNumber,
  signature            AlgorithmIdentifier,
  issuer               Name,
  validity             Validity,
  subject              Name,
  subjectPublicKeyInfo SubjectPublicKeyInfo,  <-- AQUÍ
  ...
}

SubjectPublicKeyInfo ::= SEQUENCE {
  algorithm            AlgorithmIdentifier,
  subjectPublicKey     BIT STRING
}
```

### Por qué pinear SPKI y no el certificado completo

| Aspecto | Pin de Certificado | Pin de SPKI |
|---------|-------------------|------------|
| **Qué incluye** | Todo el certificado | Solo la clave pública |
| **Afectado por** | Renovaciones, cambios de CN, etc. | Solo cambios de clave |
| **Estabilidad** | Baja (cambia cada renovación) | Alta (cambia solo con nueva clave) |
| **Recomendado** | No | ✓ Sí |

---

## Cálculo del Pin

### Proceso Paso a Paso

#### 1. Extraer la clave pública del certificado

```bash
openssl x509 -in cert.pem -pubkey -noout
```

Salida:
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
...
-----END PUBLIC KEY-----
```

#### 2. Convertir a formato DER (binario)

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER
```

Esto produce bytes binarios (no visible en texto).

#### 3. Calcular SHA-256

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary
```

Produce 32 bytes (256 bits) de hash binario.

#### 4. Codificar a Base64

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

**Resultado final:**
```
aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
```

### En Node.js

```javascript
const crypto = require('crypto');

function calculateSPKIPin(certificate) {
  // certificate es el objeto de certificado de Node.js
  const publicKeyDER = crypto.createPublicKey({
    key: certificate.pubkey,
    format: 'der',
    type: 'spki'
  }).export({ format: 'der', type: 'spki' });

  const hash = crypto.createHash('sha256');
  hash.update(publicKeyDER);
  return hash.digest('base64');
}
```

---

## Escenarios de Seguridad

### Escenario 1: Todo Válido ✓

```
TLS: ✓ Válido (certificado firmado por CA de confianza)
SPKI: ✓ Válido (pin coincide con lista local)
Resultado: ✓ CONEXIÓN PERMITIDA
```

**Ejemplo:**
- Servidor: Cert A (firmado por CA local)
- Cliente: Pins = [A]
- Pin calculado: A
- Decisión: Permitir

### Escenario 2: TLS Válido, SPKI Inválido ❌

```
TLS: ✓ Válido (certificado firmado por CA de confianza)
SPKI: ❌ Inválido (pin NO coincide)
Resultado: ❌ CONEXIÓN RECHAZADA (MITM DETECTADO)
```

**Ejemplo:**
- Servidor: Cert B (firmado por CA local, pero no está en pins)
- Cliente: Pins = [A]
- Pin calculado: B
- Decisión: Rechazar

**Interpretación:**
- El certificado es válido por TLS
- Pero no está autorizado por la aplicación
- Posible ataque MITM o certificado no autorizado

### Escenario 3: TLS Inválido, SPKI Irrelevante ❌

```
TLS: ❌ Inválido (certificado expirado, firma incorrecta, etc.)
SPKI: (no se evalúa)
Resultado: ❌ CONEXIÓN RECHAZADA (ANTES de validar SPKI)
```

**Ejemplo:**
- Servidor: Certificado expirado
- Cliente: Pins = [A]
- Decisión: Rechazar en validación TLS (no llega a SPKI)

---

## Rotación de Certificados

### Problema

Cuando necesitas cambiar el certificado del servidor:
- Viejo pin: A
- Nuevo pin: B

Si cambias de golpe, los clientes con pin A rechazarán la conexión.

### Solución: Rotación Gradual

#### Fase 1: Preparación

- Servidor usa Cert A
- Cliente valida Pin A
- **Estado:** Todo funciona

#### Fase 2: Actualizar Cliente

- Servidor sigue usando Cert A
- Cliente se actualiza a Pins [A, B]
- **Estado:** Cliente acepta A o B

#### Fase 3: Cambiar Servidor

- Servidor cambia a Cert B
- Cliente valida Pins [A, B]
- **Estado:** Conexión con B (sin interrupciones)

#### Fase 4: Limpiar Cliente

- Servidor usa Cert B
- Cliente se actualiza a Pin [B]
- **Estado:** Solo B es válido

### Timeline

```
Tiempo →

Fase 1 (Preparación)
├─ Servidor: Cert A
├─ Cliente: Pin A
└─ Estado: ✓ OK

Fase 2 (Actualizar Cliente)
├─ Servidor: Cert A
├─ Cliente: Pins A+B
└─ Estado: ✓ OK

Fase 3 (Cambiar Servidor)
├─ Servidor: Cert B
├─ Cliente: Pins A+B
└─ Estado: ✓ OK

Fase 4 (Limpiar)
├─ Servidor: Cert B
├─ Cliente: Pin B
└─ Estado: ✓ OK
```

### Ventajas

- ✓ Sin interrupciones de servicio
- ✓ Tiempo para actualizar todos los clientes
- ✓ Rollback posible si hay problemas

---

## Casos de Uso Reales

### 1. Aplicaciones Bancarias

**Problema:** Un banco necesita protegerse contra certificados válidos emitidos por CAs comprometidas.

**Solución:** SPKI pinning
```javascript
const allowedPins = [
  'pin-cert-actual',
  'pin-cert-backup'
];
```

### 2. Wallets de Criptomonedas

**Problema:** Proteger contra MITM en transacciones de alto valor.

**Solución:** Pins de múltiples servidores
```javascript
const serverPins = {
  'api.exchange.com': ['pin1', 'pin2'],
  'wallet.service.com': ['pin3', 'pin4']
};
```

### 3. Aplicaciones de Fintech

**Problema:** Validación de identidad y autenticación segura.

**Solución:** SPKI pinning + validación adicional
```javascript
if (spkiValid && certificateValid && additionalChecks) {
  // Permitir transacción
}
```

### 4. APIs Internas

**Problema:** Proteger comunicación entre microservicios.

**Solución:** Pins de certificados internos
```javascript
const internalServicePins = {
  'payment-service': 'pin-internal-cert',
  'auth-service': 'pin-internal-cert'
};
```

---

## Ventajas y Desventajas

### Ventajas de SPKI Pinning

| Ventaja | Descripción |
|---------|------------|
| **Protección contra CA comprometida** | No confía en CAs, solo en claves conocidas |
| **Control total** | Define exactamente qué certificados son válidos |
| **Rotación controlada** | Múltiples pins permiten transiciones suaves |
| **Defensa en profundidad** | Capa adicional de seguridad |
| **Detección de MITM** | Identifica ataques de certificados válidos |

### Desventajas de SPKI Pinning

| Desventaja | Descripción |
|-----------|------------|
| **Complejidad** | Requiere gestión de pins y rotaciones |
| **Riesgo de bloqueo** | Error en rotación = aplicación inútil |
| **Actualización de cliente** | Todos los clientes deben actualizarse |
| **Mantenimiento** | Requiere seguimiento de certificados |
| **No es universal** | No protege contra todas las amenazas |

### Mitigación de Desventajas

| Desventaja | Mitigación |
|-----------|-----------|
| Complejidad | Automatizar generación y rotación de pins |
| Riesgo de bloqueo | Mantener múltiples pins, plan de rollback |
| Actualización de cliente | Usar versionado de API, notificaciones |
| Mantenimiento | Monitoreo y alertas de expiración |
| No es universal | Combinar con otras medidas de seguridad |

---

## Comparación con Otras Técnicas

### SPKI Pinning vs Certificate Pinning

| Aspecto | Certificate Pinning | SPKI Pinning |
|--------|-------------------|------------|
| **Qué pineamos** | Certificado completo | Solo SPKI |
| **Afectado por renovación** | Sí | No |
| **Estabilidad** | Baja | Alta |
| **Recomendación** | No | ✓ Sí |

### SPKI Pinning vs HPKP (HTTP Public Key Pinning)

| Aspecto | HPKP | SPKI Pinning |
|--------|------|------------|
| **Mecanismo** | Header HTTP | Lógica de aplicación |
| **Control** | Servidor | Cliente |
| **Flexibilidad** | Limitada | Alta |
| **Complejidad** | Baja | Media |
| **Estado actual** | Deprecado | Activo |

---

## Mejores Prácticas

### 1. Usar SPKI, no certificado completo

```javascript
// ❌ Incorrecto
const pin = sha256(certificatePEM);

// ✓ Correcto
const pin = sha256(spkiDER);
```

### 2. Mantener múltiples pins

```javascript
// ✓ Correcto
const pins = [
  'pin-actual',
  'pin-backup-1',
  'pin-backup-2'
];
```

### 3. Planificar rotaciones

```javascript
// Fase 1: Actualizar cliente
const pins = ['pin-actual', 'pin-nuevo'];

// Fase 2: Cambiar servidor
// Servidor usa nuevo certificado

// Fase 3: Limpiar cliente
const pins = ['pin-nuevo'];
```

### 4. Monitorear expiración

```javascript
// Alertar antes de expiración
if (daysUntilExpiry < 30) {
  alertAdmin('Certificado expirando en ' + daysUntilExpiry + ' días');
}
```

### 5. Documentar pins

```javascript
const pins = {
  'pin-actual': {
    value: 'aBcD1234...',
    cert: 'cert-a.pem',
    validFrom: '2024-01-01',
    validTo: '2025-01-01',
    status: 'active'
  },
  'pin-backup': {
    value: 'efGH5678...',
    cert: 'cert-b.pem',
    validFrom: '2024-06-01',
    validTo: '2025-06-01',
    status: 'standby'
  }
};
```

---

## Resumen

| Concepto | Clave |
|---------|-------|
| **SPKI Pinning** | Valida clave pública, no solo certificado |
| **Pin** | SHA-256(SPKI) en base64 |
| **Diferencia de TLS** | Capa adicional de validación local |
| **Rotación** | Múltiples pins permiten transiciones suaves |
| **Caso de uso** | Aplicaciones de seguridad crítica |
| **Ventaja** | Protección contra CA comprometida |
| **Desventaja** | Requiere gestión cuidadosa |

---

## Recursos Adicionales

- [RFC 7469 - Public Key Pinning Extension for HTTP](https://tools.ietf.org/html/rfc7469)
- [OWASP - Certificate and Public Key Pinning](https://owasp.org/www-community/controls/Certificate_and_public_key_pinning)
- [Node.js TLS Documentation](https://nodejs.org/api/tls.html)
- [OpenSSL Documentation](https://www.openssl.org/docs/)

---

**Próximo paso:** Revisa OPENSSL-COMMANDS.md para referencia de comandos.
