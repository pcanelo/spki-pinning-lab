# Laboratorio de SPKI Pinning

## Descripción General

Este laboratorio educativo demuestra **SPKI Pinning** (Subject Public Key Info Pinning), una técnica de seguridad avanzada que va más allá de la validación TLS estándar.

### ¿Qué aprenderás?

- **Qué es SPKI pinning**: Validación de la clave pública del servidor, no solo del certificado
- **Diferencia crítica**: TLS válido ≠ SPKI válido
- **Rotación de pins**: Cómo mantener múltiples pins activos durante transiciones de certificados
- **Demo MITM conceptual**: Cómo un certificado válido por TLS puede fallar en pinning

### Estructura del Laboratorio

```
spki-pinning-lab/
├── README.md                    # Este archivo
├── package.json                 # Dependencias y scripts
├── certs/                       # Certificados y claves (generados)
│   ├── ca-cert.pem             # CA local (root)
│   ├── ca-key.pem              # Clave privada de CA
│   ├── cert-a.pem              # Certificado A
│   ├── key-a.pem               # Clave privada A
│   ├── cert-b.pem              # Certificado B
│   ├── key-b.pem               # Clave privada B
│   ├── cert-c.pem              # Certificado C (MITM demo)
│   ├── key-c.pem               # Clave privada C
│   └── pins.json                # SPKIs calculados
├── src/
│   ├── server.js                # Servidor HTTPS con rotación de certs
│   └── client.js                # Cliente con validación SPKI
├── scripts/
│   ├── generate-certs.sh        # Genera CA y certificados
│   └── calculate-pin.js         # Helper para calcular pins
└── docs/
    ├── CONCEPTOS.md             # Conceptos teóricos
    ├── OPENSSL-COMMANDS.md      # Comandos OpenSSL referencia
    └── ESCENARIOS.md            # Descripción de escenarios
```

---

## Inicio Rápido (5 minutos)

### Paso 1: Generar Certificados

```bash
cd spki-pinning-lab
bash scripts/generate-certs.sh
```

**Qué ocurre:**
- Se crea una CA local (autoridad certificadora)
- Se generan 3 pares de certificados (A, B, C)
- Se calculan los SPKI pins (SHA-256 de la clave pública)
- Se guarda todo en `certs/`

**Evidencia a observar:**
```
✓ Clave privada de CA generada: ca-key.pem
✓ Certificado de CA generado: ca-cert.pem
✓ SPKI Pin A (SHA-256, base64): ...
✓ SPKI Pin B (SHA-256, base64): ...
✓ SPKI Pin C (SHA-256, base64): ...
```

**Aprendizaje:** Los pins son hashes SHA-256 de la clave pública, no del certificado completo.

---

### Paso 2: Iniciar el Servidor

En una terminal:

```bash
node src/server.js --cert a
```

**Qué ocurre:**
- Servidor HTTPS escucha en `https://localhost:3000`
- Usa Certificado A
- Endpoints disponibles:
  - `/health` - Estado del servidor
  - `/ping` - Ping simple
  - `/cert-info` - Info del certificado
  - `/api/test` - Endpoint de prueba

**Evidencia a observar:**
```
✓ Servidor iniciado en https://localhost:3000
✓ Certificado en uso: cert-A
✓ TLS: TLSv1.2 - TLSv1.3
```

**Aprendizaje:** El servidor puede cambiar de certificado sin cambiar la identidad del servidor.

---

### Paso 3: Ejecutar el Cliente

En otra terminal:

```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

**Qué ocurre:**
1. Cliente se conecta a `https://localhost:3000/health`
2. Realiza handshake TLS normal
3. Extrae la clave pública del certificado del servidor
4. Calcula el SPKI pin (SHA-256)
5. Compara contra pins permitidos (en este caso, solo A)
6. Valida o rechaza la conexión

**Evidencia a observar:**
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
Pin calculado: ...
Pins permitidos:
  ✓ Pin A: ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ ÉXITO: SPKI pin válido
```

**Aprendizaje:** El cliente valida tanto TLS como SPKI. Ambos deben ser válidos.

---

## Escenarios Pedagógicos

### Escenario 1: Servidor A + Pin A ✓ ÉXITO

**Objetivo:** Demostrar que todo funciona correctamente.

**Terminal 1 - Servidor:**
```bash
node src/server.js --cert a
```

**Terminal 2 - Cliente:**
```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

**Resultado esperado:**
```
✓ ÉXITO: SPKI pin válido
```

**Checklist pedagógico:**
- [ ] El handshake TLS es exitoso
- [ ] El pin calculado coincide con Pin A
- [ ] El cliente acepta la conexión
- [ ] **Aprendizaje:** Cuando el pin coincide, la conexión es segura

---

### Escenario 2: Rotación de Certificados (A→B con Pins A+B) ✓ ÉXITO

**Objetivo:** Demostrar rotación de certificados sin interrumpir el servicio.

**Paso 1 - Servidor con Cert A:**
```bash
node src/server.js --cert a
```

**Paso 2 - Cliente con Pins A+B:**
```bash
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

**Resultado esperado:**
```
✓ ÉXITO: SPKI pin válido
```

**Paso 3 - Cambiar servidor a Cert B:**

En Terminal 1, presiona Ctrl+C y ejecuta:
```bash
node src/server.js --cert b
```

**Paso 4 - Ejecutar cliente nuevamente:**
```bash
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

**Resultado esperado:**
```
✓ ÉXITO: SPKI pin válido
```

**Checklist pedagógico:**
- [ ] Servidor cambia de certificado sin cambiar puerto/IP
- [ ] Cliente con pins A+B acepta ambos certificados
- [ ] No hay interrupción de servicio durante la rotación
- [ ] **Aprendizaje:** Múltiples pins permiten transiciones suaves de certificados

---

### Escenario 3: Pin Faltante (Cert B sin PinB) ❌ FALLO

**Objetivo:** Demostrar qué ocurre cuando el pin no está autorizado.

**Paso 1 - Servidor con Cert B:**
```bash
node src/server.js --cert b
```

**Paso 2 - Cliente SOLO con Pin A:**
```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

**Resultado esperado:**
```
❌ FALLO: SPKI pin NO coincide
❌ El certificado es válido por TLS, pero NO está pineado
❌ Posible ataque MITM o certificado no autorizado
```

**Checklist pedagógico:**
- [ ] El handshake TLS es exitoso (✓)
- [ ] El pin calculado NO coincide con Pin A (❌)
- [ ] El cliente rechaza la conexión
- [ ] **Aprendizaje:** TLS válido no garantiza seguridad sin pinning

---

### Escenario 4: MITM Conceptual (Cert C - TLS OK, Pinning FALLA) ❌ FALLO

**Objetivo:** Demostrar un ataque MITM conceptual donde el certificado es válido pero no está pineado.

**Contexto teórico:**
- Cert C está firmado por nuestra CA local (TLS válido)
- Pero NO está en la lista de pins permitidos
- Simula un escenario donde un atacante tiene un certificado válido pero no autorizado

**Paso 1 - Servidor con Cert C:**
```bash
node src/server.js --cert c
```

**Paso 2 - Cliente con Pins A+B:**
```bash
node src/client.js --pins a,b --cert-file certs/ca-cert.pem
```

**Resultado esperado:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN TLS (Handshake)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Handshake TLS exitoso
✓ Protocolo: TLSv1.3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDACIÓN SPKI PINNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pin calculado: [DIFERENTE]
Pins permitidos:
  ✗ Pin A: ...
  ✗ Pin B: ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FALLO: SPKI pin NO coincide
❌ El certificado es válido por TLS, pero NO está pineado
❌ Posible ataque MITM o certificado no autorizado
```

**Checklist pedagógico:**
- [ ] El handshake TLS es exitoso (✓)
- [ ] El certificado es válido por CA local (✓)
- [ ] El pin calculado NO coincide con A ni B (❌)
- [ ] El cliente rechaza la conexión
- [ ] **Aprendizaje:** SPKI pinning protege contra certificados válidos pero no autorizados

---

## Referencia de Comandos

### Generar Certificados

```bash
# Generar CA local
openssl genrsa -out certs/ca-key.pem 2048
openssl req -new -x509 -days 365 -key certs/ca-key.pem \
  -out certs/ca-cert.pem \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=SPKI-Lab-Root-CA"

# Generar Certificado A
openssl genrsa -out certs/key-a.pem 2048
openssl req -new -key certs/key-a.pem -out certs/cert-a.csr \
  -subj "/C=UY/ST=Montevideo/L=Montevideo/O=SPKI Lab/CN=localhost"
openssl x509 -req -days 365 -in certs/cert-a.csr \
  -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial \
  -out certs/cert-a.pem \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")
```

### Calcular SPKI Pin

```bash
# Método 1: Con OpenSSL (línea de comandos)
openssl x509 -in certs/cert-a.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

# Método 2: Con Node.js helper
node scripts/calculate-pin.js certs/cert-a.pem certs/cert-b.pem
```

### Inspeccionar Certificados

```bash
# Ver información del certificado
openssl x509 -in certs/cert-a.pem -text -noout

# Ver solo subject y issuer
openssl x509 -in certs/cert-a.pem -subject -issuer -noout

# Ver fechas de validez
openssl x509 -in certs/cert-a.pem -noout -dates

# Ver clave pública
openssl x509 -in certs/cert-a.pem -pubkey -noout
```

### Ejecutar Servidor y Cliente

```bash
# Servidor con Cert A
node src/server.js --cert a

# Servidor con Cert B en puerto 3001
node src/server.js --cert b --port 3001

# Cliente con Pin A
node src/client.js --pins a --cert-file certs/ca-cert.pem

# Cliente con Pins A+B
node src/client.js --pins a,b --cert-file certs/ca-cert.pem

# Cliente con verbose (debug)
node src/client.js --pins a --cert-file certs/ca-cert.pem --verbose
```

---

## Conceptos Clave

### TLS vs SPKI Pinning

| Aspecto | TLS Estándar | SPKI Pinning |
|---------|-------------|------------|
| **Qué valida** | Certificado completo | Clave pública (SPKI) |
| **Confía en** | Autoridades certificadoras (CAs) | Lista de pins locales |
| **Protege contra** | Certificados inválidos | Certificados válidos pero no autorizados |
| **Caso de uso** | Navegación web general | Aplicaciones críticas (banca, fintech) |
| **Complejidad** | Baja | Media-Alta |

### SPKI (Subject Public Key Info)

La **SPKI** es la estructura DER que contiene la clave pública del certificado. El pin es el hash SHA-256 de esta estructura:

```
Certificado X.509
    ↓
Extraer clave pública (DER)
    ↓
SHA-256(SPKI)
    ↓
Base64 encode
    ↓
Pin (ej: "aBcD1234...")
```

### Rotación de Pins

Durante la transición de un certificado a otro:

1. **Fase 1:** Servidor usa Cert A, Cliente valida Pin A
2. **Fase 2:** Cliente actualiza a Pins A+B
3. **Fase 3:** Servidor rota a Cert B
4. **Fase 4:** Cliente actualiza a solo Pin B

Esto permite transiciones sin interrupciones.

---

## Requisitos

- **Node.js** 14+ (LTS recomendado)
- **OpenSSL** 1.1.1+ (incluido en Linux/macOS)
- **Bash** (para scripts)
- **VS Code** (opcional, pero recomendado)

### Verificar requisitos

```bash
node --version      # v14.0.0 o superior
npm --version       # 6.0.0 o superior
openssl version     # OpenSSL 1.1.1 o superior
```

---

## Instalación

### 1. Clonar o descargar el laboratorio

```bash
cd ~/projects
unzip spki-pinning-lab.zip
cd spki-pinning-lab
```

### 2. Generar certificados

```bash
bash scripts/generate-certs.sh
```

### 3. Verificar estructura

```bash
tree -L 2
# o
find . -type f | head -20
```

---

## Ejecución de Escenarios

### Script de Automatización (Opcional)

Crea un archivo `run-scenario.sh`:

```bash
#!/bin/bash

SCENARIO=$1

case $SCENARIO in
  1)
    echo "Escenario 1: Cert A + Pin A"
    node src/server.js --cert a &
    sleep 2
    node src/client.js --pins a --cert-file certs/ca-cert.pem
    ;;
  2)
    echo "Escenario 2: Cert B + Pins A+B"
    node src/server.js --cert b &
    sleep 2
    node src/client.js --pins a,b --cert-file certs/ca-cert.pem
    ;;
  3)
    echo "Escenario 3: Cert B + Pin A (FALLA)"
    node src/server.js --cert b &
    sleep 2
    node src/client.js --pins a --cert-file certs/ca-cert.pem
    ;;
  4)
    echo "Escenario 4: Cert C + Pins A+B (MITM)"
    node src/server.js --cert c &
    sleep 2
    node src/client.js --pins a,b --cert-file certs/ca-cert.pem
    ;;
  *)
    echo "Uso: bash run-scenario.sh [1|2|3|4]"
    ;;
esac
```

---

## Solución de Problemas

### Error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

**Causa:** El cliente no confía en la CA local.

**Solución:**
```bash
node src/client.js --pins a --cert-file certs/ca-cert.pem
```

### Error: "EADDRINUSE"

**Causa:** Puerto 3000 ya está en uso.

**Solución:**
```bash
node src/server.js --cert a --port 3001
node src/client.js --pins a --cert-file certs/ca-cert.pem --url https://localhost:3001/health
```

### Error: "Certificados no encontrados"

**Causa:** No se ejecutó `generate-certs.sh`.

**Solución:**
```bash
bash scripts/generate-certs.sh
```

---

## Documentación Adicional

- **CONCEPTOS.md** - Explicación detallada de SPKI pinning
- **OPENSSL-COMMANDS.md** - Referencia completa de comandos OpenSSL
- **ESCENARIOS.md** - Descripción técnica de cada escenario

---

## Notas Importantes

### ¿Qué NO es este laboratorio?

- **No es un ataque real:** No demuestra bypass con hooking (mobile-specific)
- **No es anti-reverse engineering:** Es un lab conceptual y educativo
- **No es ofensivo:** Está diseñado para auditoría, arquitectura y formación

### Casos de Uso Reales

SPKI pinning se usa en:
- Aplicaciones bancarias
- Wallets de criptomonedas
- Aplicaciones de fintech
- Sistemas de pago
- Aplicaciones de seguridad crítica

---

## Licencia

MIT - Libre para uso educativo 
Created by: Patricio Canelo E.
pcanelo@gmail.com
---

## Autor

SPKI Pinning Lab - Laboratorio educativo de seguridad TLS

---

## Próximos Pasos

1. ✅ Ejecuta el Escenario 1 (éxito básico)
2. ✅ Ejecuta el Escenario 2 (rotación)
3. ✅ Ejecuta el Escenario 3 (fallo de pin)
4. ✅ Ejecuta el Escenario 4 (MITM conceptual)
5. 📖 Lee CONCEPTOS.md para profundizar
6. 🔍 Inspecciona el código fuente
7. 🧪 Experimenta con modificaciones

---

**¿Preguntas o sugerencias?** Revisa los archivos de documentación en `docs/`.
