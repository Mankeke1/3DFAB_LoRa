# Registros de Decisiones Arquitectónicas (ADRs)

Este directorio contiene los Registros de Decisiones Arquitectónicas (ADRs) del proyecto LoRa IoT.

## ¿Qué es un ADR?

Un Registro de Decisión Arquitectónica (ADR) captura una decisión arquitectónica importante junto con su contexto y consecuencias.

## Plantilla de ADR

Cada ADR sigue esta estructura:

- **Título**: Frase corta describiendo la decisión
- **Estado**: Propuesto | Aceptado | Obsoleto | Reemplazado
- **Contexto**: ¿Cuál es el problema que nos lleva a tomar esta decisión?
- **Decisión**: ¿Cuál es el cambio que proponemos?
- **Consecuencias**: ¿Qué se vuelve más fácil o más difícil debido a este cambio?

## Índice

| ADR | Título | Estado | Fecha |
|-----|--------|--------|-------|
| [001](001-mongodb-vs-postgresql.md) | MongoDB vs PostgreSQL para Datos de Series Temporales | Aceptado | 2026-02-02 |
| [002](002-bearer-token-vs-hmac-webhook.md) | Bearer Token vs HMAC para Autenticación del Webhook | Aceptado | 2026-02-03 |
| [003](003-short-polling-vs-websockets.md) | Short Polling vs WebSockets para Actualizaciones en Tiempo Real | Aceptado | 2026-02-04 |
