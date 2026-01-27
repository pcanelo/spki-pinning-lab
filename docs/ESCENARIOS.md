# Descripción Técnica de Escenarios

## Índice

1. [Escenario 1: Éxito Básico](#escenario-1-éxito-básico)
2. [Escenario 2: Rotación de Certificados](#escenario-2-rotación-de-certificados)
3. [Escenario 3: Pin Faltante](#escenario-3-pin-faltante)
4. [Escenario 4: MITM Conceptual](#escenario-4-mitm-conceptual)
5. [Análisis Comparativo](#análisis-comparativo)
6. [Flujos de Decisión](#flujos-de-decisión)

---

## Escenario 1: Éxito Básico

### Descripción

El caso más simple: servidor con Cert A, cliente valida Pin A.

### Configuración

```
Servidor:
  ├─ Certificado: Cert A
  ├─ Clave privada: key-a.pem
  ├─ Firmado por: CA local
  └─ Puerto: 3000

Cliente:
  ├─ Pins permitidos: [A]
  ├─ CA de confianza: ca-cert.pem
  └─ URL: https://localhost:3000/health
```

### Ejecución

**Terminal 1 - Servidor:**
```bash
node src/server.js --cert a
```

**Terminal 2 - Cliente:**
```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

### Flujo Técnico

```
1. Cliente inicia conexión HTTPS
   └─ ClientHello

2. Servidor responde con Cert A
   └─ ServerCertificate

3. Cliente valida TLS
   ├─ ✓ Firma del certificado (CA local)
   ├─ ✓ Cadena de certificados
   ├─ ✓ Fecha de validez
   ├─ ✓ Nombre del dominio (SAN)
   └─ Resultado: TLS válido

4. Cliente extrae SPKI de Cert A
   └─ Clave pública en formato DER

5. Cliente calcula SHA-256(SPKI)
   └─ Pin calculado: aBcD1234...

6. Cliente compara contra pins permitidos
   ├─ Pin A: aBcD1234... ✓ COINCIDE
   └─ Resultado: SPKI válido

7. Cliente acepta conexión
   └─ ClientKeyExchange + Finished

8. Servidor responde con datos
   └─ Respuesta JSON
```

### Evidencia Observable

**Logs del Servidor:**
```
✓ Servidor iniciado en https://localhost:3000
✓ Certificado en uso: cert-A
✓ TLS: TLSv1.2 - TLSv1.3

[2024-01-26T12:00:00Z] GET /health
  TLS: TLSv1.3, Cipher: TLS_AES_256_GCM_SHA384
```

**Logs del Cliente:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN TLS (Handshake)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Handshake TLS exitoso
✓ Protocolo: TLSv1.3
✓ Cipher: TLS_AES_256_GCM_SHA384

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN SPKI PINNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pin calculado: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
Pins permitidos:
  ✓ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ ÉXITO: SPKI pin válido
✓ El certificado es de confianza y está pineado correctamente
```

### Aprendizajes

1. **TLS y SPKI en armonía:** Ambas validaciones pasan
2. **Handshake exitoso:** El protocolo TLS funciona normalmente
3. **Pin coincide:** La clave pública es la esperada
4. **Conexión segura:** Todo está en orden

### Código Relevante

**Cliente - Validación SPKI:**
```javascript
const calculatedPin = calculateSPKIPin(serverCert);
const pinValid = validatePin(calculatedPin, ['a']);

if (pinValid) {
  console.log('✓ ÉXITO: SPKI pin válido');
} else {
  console.log('❌ FALLO: SPKI pin NO coincide');
}
```

---

## Escenario 2: Rotación de Certificados

### Descripción

Demostración de rotación segura: servidor cambia de Cert A a Cert B, cliente con Pins A+B.

### Configuración

**Fase 1 - Inicial:**
```
Servidor: Cert A
Cliente: Pin A
Estado: ✓ OK
```

**Fase 2 - Preparación:**
```
Servidor: Cert A
Cliente: Pins A+B
Estado: ✓ OK (cliente acepta ambos)
```

**Fase 3 - Transición:**
```
Servidor: Cert B
Cliente: Pins A+B
Estado: ✓ OK (sin interrupciones)
```

**Fase 4 - Limpieza:**
```
Servidor: Cert B
Cliente: Pin B
Estado: ✓ OK (solo B válido)
```

### Ejecución

**Fase 1 - Inicial:**
```bash
# Terminal 1
node src/server.js --cert a

# Terminal 2
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

**Fase 2 - Actualizar Cliente:**
```bash
# Terminal 2 (ejecutar nuevamente)
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

**Fase 3 - Cambiar Servidor:**
```bash
# Terminal 1: Ctrl+C para detener
# Terminal 1: Iniciar con Cert B
node src/server.js --cert b

# Terminal 2: Ejecutar cliente nuevamente
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

**Fase 4 - Limpiar:**
```bash
# Terminal 2: Actualizar a solo Pin B
node src/client.js --pins b --cert-file certs/ca-cert.pem
```

### Flujo Técnico

#### Fase 1: Inicial

```
Cliente (Pin A) → Servidor (Cert A)
  ├─ TLS: ✓ Válido
  ├─ Pin calculado: A
  ├─ Pin permitido: A
  └─ Resultado: ✓ ACEPTADO
```

#### Fase 2: Preparación

```
Cliente (Pins A+B) → Servidor (Cert A)
  ├─ TLS: ✓ Válido
  ├─ Pin calculado: A
  ├─ Pins permitidos: [A, B]
  └─ Resultado: ✓ ACEPTADO (A está en la lista)
```

#### Fase 3: Transición

```
Cliente (Pins A+B) → Servidor (Cert B)
  ├─ TLS: ✓ Válido
  ├─ Pin calculado: B
  ├─ Pins permitidos: [A, B]
  └─ Resultado: ✓ ACEPTADO (B está en la lista)
```

#### Fase 4: Limpieza

```
Cliente (Pin B) → Servidor (Cert B)
  ├─ TLS: ✓ Válido
  ├─ Pin calculado: B
  ├─ Pin permitido: B
  └─ Resultado: ✓ ACEPTADO
```

### Evidencia Observable

**Fase 2 - Cliente con Pins A+B:**
```
Pin calculado: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
Pins permitidos:
  ✓ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
  ✗ Pin B: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234
```

**Fase 3 - Cliente con Pins A+B, Servidor con Cert B:**
```
Pin calculado: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234
Pins permitidos:
  ✗ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
  ✓ Pin B: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234
```

### Aprendizajes

1. **Múltiples pins:** Permiten transiciones suaves
2. **Sin interrupciones:** El servicio continúa funcionando
3. **Validación gradual:** Cada fase es válida
4. **Rollback posible:** Si hay problemas, revertir es fácil

### Código Relevante

**Cliente - Validación con múltiples pins:**
```javascript
const pins = ['a', 'b'];  // Múltiples pins permitidos
const allowedPinValues = pins.map(p => expectedPins[p]);

if (allowedPinValues.includes(calculatedPin)) {
  console.log('✓ Pin válido');
}
```

---

## Escenario 3: Pin Faltante

### Descripción

Servidor con Cert B, pero cliente solo tiene Pin A. Demuestra fallo de pinning.

### Configuración

```
Servidor:
  ├─ Certificado: Cert B
  ├─ Clave privada: key-b.pem
  ├─ Firmado por: CA local
  └─ Puerto: 3000

Cliente:
  ├─ Pins permitidos: [A]  ← Solo A, no B
  ├─ CA de confianza: ca-cert.pem
  └─ URL: https://localhost:3000/health
```

### Ejecución

**Terminal 1 - Servidor:**
```bash
node src/server.js --cert b
```

**Terminal 2 - Cliente:**
```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

### Flujo Técnico

```
1. Cliente inicia conexión HTTPS
   └─ ClientHello

2. Servidor responde con Cert B
   └─ ServerCertificate

3. Cliente valida TLS
   ├─ ✓ Firma del certificado (CA local)
   ├─ ✓ Cadena de certificados
   ├─ ✓ Fecha de validez
   ├─ ✓ Nombre del dominio (SAN)
   └─ Resultado: TLS válido ✓

4. Cliente extrae SPKI de Cert B
   └─ Clave pública en formato DER

5. Cliente calcula SHA-256(SPKI)
   └─ Pin calculado: efGH5678...

6. Cliente compara contra pins permitidos
   ├─ Pin A: aBcD1234... ✗ NO COINCIDE
   └─ Resultado: SPKI inválido ❌

7. Cliente rechaza conexión
   └─ Error: Pin no válido
```

### Evidencia Observable

**Logs del Cliente:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN TLS (Handshake)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Handshake TLS exitoso
✓ Protocolo: TLSv1.3
✓ Cipher: TLS_AES_256_GCM_SHA384

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN SPKI PINNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pin calculado: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234
Pins permitidos:
  ✗ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FALLO: SPKI pin NO coincide
❌ El certificado es válido por TLS, pero NO está pineado
❌ Posible ataque MITM o certificado no autorizado
```

**Exit Code:**
```bash
echo $?  # Salida: 1 (error)
```

### Aprendizajes

1. **TLS no es suficiente:** Un certificado válido puede no estar autorizado
2. **Detección de cambios:** SPKI pinning detecta cambios de certificado
3. **Seguridad en profundidad:** Capa adicional de protección
4. **Fallo claro:** Mensaje explícito de rechazo

### Casos de Uso

- **Detección de rotación no autorizada:** Si el servidor cambió de certificado sin notificar
- **Protección contra CA comprometida:** Certificado válido pero no esperado
- **Control de versiones:** Solo ciertos certificados son permitidos

---

## Escenario 4: MITM Conceptual

### Descripción

Demostración de un ataque MITM conceptual donde:
- El certificado es válido por TLS (firmado por CA local)
- Pero NO está en la lista de pins permitidos

### Contexto Teórico

En un escenario real de MITM:
1. Atacante intercepta conexión
2. Presenta su propio certificado (válido por CA comprometida)
3. Cliente valida TLS (porque confía en la CA)
4. Pero SPKI pinning detecta que la clave pública es diferente

En este laboratorio:
- Cert C simula el certificado del atacante
- Está firmado por nuestra CA local (TLS válido)
- Pero no está en la lista de pins (SPKI inválido)

### Configuración

```
Servidor:
  ├─ Certificado: Cert C (válido por CA, pero no pineado)
  ├─ Clave privada: key-c.pem
  ├─ Firmado por: CA local
  └─ Puerto: 3000

Cliente:
  ├─ Pins permitidos: [A, B]  ← C no está en la lista
  ├─ CA de confianza: ca-cert.pem
  └─ URL: https://localhost:3000/health
```

### Ejecución

**Terminal 1 - Servidor:**
```bash
node src/server.js --cert c
```

**Terminal 2 - Cliente:**
```bash
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

### Flujo Técnico

```
1. Cliente inicia conexión HTTPS
   └─ ClientHello

2. Servidor responde con Cert C
   └─ ServerCertificate

3. Cliente valida TLS
   ├─ ✓ Firma del certificado (CA local)
   ├─ ✓ Cadena de certificados
   ├─ ✓ Fecha de validez
   ├─ ✓ Nombre del dominio (SAN)
   └─ Resultado: TLS válido ✓

4. Cliente extrae SPKI de Cert C
   └─ Clave pública en formato DER

5. Cliente calcula SHA-256(SPKI)
   └─ Pin calculado: ijKL9012mnOP3456qrST7890uvWX==aBcD1234

6. Cliente compara contra pins permitidos
   ├─ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX== ✗
   ├─ Pin B: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234 ✗
   └─ Resultado: SPKI inválido ❌

7. Cliente rechaza conexión
   └─ Error: Pin no válido (posible MITM)
```

### Evidencia Observable

**Logs del Cliente:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFORMACIÓN DEL CERTIFICADO DEL SERVIDOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subject: { C: 'UY', ST: 'Montevideo', L: 'Montevideo', O: 'SPKI Lab', CN: 'localhost' }
Issuer: { C: 'UY', ST: 'Montevideo', L: 'Montevideo', O: 'SPKI Lab', CN: 'SPKI-Lab-Root-CA' }
Valid From: Jan 26 12:00:00 2024 GMT
Valid To: Jan 26 12:00:00 2025 GMT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN TLS (Handshake)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Handshake TLS exitoso
✓ Protocolo: TLSv1.3
✓ Cipher: TLS_AES_256_GCM_SHA384

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN SPKI PINNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pin calculado: ijKL9012mnOP3456qrST7890uvWX==aBcD1234efGH5678
Pins permitidos:
  ✗ Pin A: aBcD1234efGH5678ijKL9012mnOP3456qrST7890uvWX==
  ✗ Pin B: efGH5678ijKL9012mnOP3456qrST7890uvWX==aBcD1234

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FALLO: SPKI pin NO coincide
❌ El certificado es válido por TLS, pero NO está pineado
❌ Posible ataque MITM o certificado no autorizado
```

### Aprendizajes

1. **TLS válido ≠ Seguro:** El handshake TLS es exitoso
2. **SPKI pinning protege:** Detecta certificados no autorizados
3. **Diferencia crítica:** Este es el punto clave del laboratorio
4. **Defensa en profundidad:** Dos capas de validación

### Interpretación de Seguridad

| Validación | Resultado | Interpretación |
|-----------|-----------|----------------|
| TLS | ✓ Válido | Certificado firmado por CA de confianza |
| SPKI | ❌ Inválido | Clave pública no está en lista de autorización |
| **Decisión Final** | **❌ Rechazar** | Posible certificado no autorizado o MITM |

---

## Análisis Comparativo

### Matriz de Escenarios

| Escenario | Servidor | Cliente Pins | TLS | SPKI | Resultado |
|-----------|----------|-------------|-----|------|-----------|
| 1 | Cert A | [A] | ✓ | ✓ | ✓ Aceptar |
| 2a | Cert A | [A,B] | ✓ | ✓ | ✓ Aceptar |
| 2b | Cert B | [A,B] | ✓ | ✓ | ✓ Aceptar |
| 3 | Cert B | [A] | ✓ | ❌ | ❌ Rechazar |
| 4 | Cert C | [A,B] | ✓ | ❌ | ❌ Rechazar |

### Decisiones de Seguridad

```
┌─────────────────────────────────────────┐
│ ¿TLS válido?                            │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       NO            SÍ
        │             │
        │      ┌──────▼──────────────┐
        │      │ ¿SPKI en pins?      │
        │      └──────┬──────────────┘
        │             │
        │      ┌──────┴──────┐
        │      │             │
        │     NO            SÍ
        │      │             │
        │      │      ┌──────▼──────┐
        │      │      │             │
    ❌ Rechazar  ❌ Rechazar    ✓ Aceptar
```

---

## Flujos de Decisión

### Cliente - Validación Completa

```javascript
function validateConnection(serverCert, allowedPins) {
  // Paso 1: Validar TLS
  if (!isTLSValid(serverCert)) {
    return {
      tlsValid: false,
      spkiValid: null,
      decision: 'REJECT',
      reason: 'TLS validation failed'
    };
  }

  // Paso 2: Calcular SPKI pin
  const calculatedPin = calculateSPKIPin(serverCert);

  // Paso 3: Validar SPKI
  const spkiValid = allowedPins.includes(calculatedPin);

  // Paso 4: Decisión final
  return {
    tlsValid: true,
    spkiValid: spkiValid,
    decision: spkiValid ? 'ACCEPT' : 'REJECT',
    reason: spkiValid ? 'All validations passed' : 'SPKI pin mismatch'
  };
}
```

### Matriz de Decisiones

| TLS | SPKI | Decisión | Razón |
|-----|------|----------|-------|
| ❌ | N/A | Rechazar | TLS inválido |
| ✓ | ❌ | Rechazar | SPKI no coincide |
| ✓ | ✓ | Aceptar | Todas las validaciones pasaron |

---

## Resumen Pedagógico

### Escenario 1: Aprender que todo funciona correctamente
- **Objetivo:** Validación exitosa
- **Concepto:** Cuando TLS y SPKI son válidos
- **Resultado:** Conexión segura

### Escenario 2: Aprender sobre rotación segura
- **Objetivo:** Transición sin interrupciones
- **Concepto:** Múltiples pins permiten cambios graduales
- **Resultado:** Servicio continuo

### Escenario 3: Aprender sobre detección de cambios
- **Objetivo:** Detectar certificado no autorizado
- **Concepto:** TLS válido no garantiza seguridad
- **Resultado:** Rechazo de conexión

### Escenario 4: Aprender sobre protección MITM
- **Objetivo:** Detectar certificado válido pero no autorizado
- **Concepto:** SPKI pinning es capa adicional de seguridad
- **Resultado:** Defensa contra MITM conceptual

---

**Próximo paso:** Ejecuta los escenarios en orden para consolidar el aprendizaje.
