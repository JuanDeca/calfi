# Calfi

Gestor de finanzas personales, de un solo usuario, pensado para correr 100% local. Centraliza
transacciones, categorización, reparto de sueldo y patrimonio en una sola base, con foco en
que los números siempre cierren.

## Funcionalidad

- Transacciones con categorización automática por reglas aprendidas (y ajuste manual cuando
  la regla no aplica).
- Reparto de sueldo por "sobres" (porcentajes por categoría, con sub-reparto interno y
  seguimiento de saldo estimado entre confirmaciones manuales).
- Patrimonio: activos y deudas con historial de valor, para trackear evolución neta en el
  tiempo.
- Movimientos fijos (recurrentes, mensuales o anuales) que se generan solos y se concilian
  contra la transacción real cuando llega.
- Desgloses de gastos grupales y reintegros, con seguimiento de qué falta cobrar.
- Deudores, compras planificadas, eventos e insights agregados sobre el gasto.
- Reglas de categorización con detección de reglas huérfanas (cuando una descripción se
  trunca en el parseo y deja una regla vieja sin uso).
- Auditoría de integridad (`scripts/audit-integrity.ts`): batería de chequeos de solo lectura
  contra la base — cadena de saldos, desgloses que no cierran, referencias colgantes,
  patrimonio desincronizado con su historial, backups desactualizados, y más. Pensada para
  correrse periódicamente.
- Backup automático de la base tras cada escritura, con historial rotativo de 90 días.

## Stack

Next.js (App Router) + TypeScript + better-sqlite3 (SQLite embebido, sin ORM) + Tailwind CSS +
Recharts. Sin backend separado: las páginas leen directo de `lib/*.ts` como Server Components;
las mutaciones van por API routes y refrescan con `router.refresh()`. Mismo patrón que el
proyecto hermano `todoj`.

## Setup

```bash
npm install
cp .env.example .env   # opcional — todas las variables tienen default razonable
npm run dev
```

La base SQLite se crea sola en `data/calfi.db` la primera vez que corre. Las variables de
entorno en `.env.example` son todas opcionales: definen la carpeta de backups y las rutas a
Excel de migración histórica (solo relevantes si se necesita volver a importar datos viejos).

## Auditoría de integridad

```bash
npx tsx scripts/audit-integrity.ts
```

Corre de solo lectura contra la base real (o contra una copia, con `--db <path>`) y reporta
hallazgos agrupados por severidad.
