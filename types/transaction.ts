export type ImpactsAnalysis = "Sí" | "No" | "Pendiente";
export type ExpenseClass = "Fijo" | "Variable" | "Extraordinario" | "No aplica";

export interface Transaction {
  id: number;
  date: string; // ISO "YYYY-MM-DD"
  description: string;
  mpReference: string | null;
  amount: number; // negativo = egreso, positivo = ingreso
  runningBalance: number | null;
  categoryId: number | null;
  // Denormalizado solo en el tipo de lectura/mock: en Fase 1 se resuelve con JOIN a categories.
  categoryName: string | null;
  subcategory: string | null;
  ruleReason: string | null;
  impactsAnalysis: ImpactsAnalysis;
  impactType: string | null;
  impactReason: string | null;
  analysisAmount: number | null;
  expenseClass: ExpenseClass;
  eventId: number | null;
  parentTransactionId: number | null;
  hasSplitChildren: boolean;
  sourceFile: string | null;
  mpRawId: string | null;
  createdAt: string; // ISO datetime
  // Reintegros: si esta transacción es un ingreso que reintegra un gasto, apunta a ese gasto.
  reimbursesTransactionId: number | null;
  // Denormalizado solo para mostrar sin fetch extra: descripción del gasto reintegrado.
  reimbursesDescription: string | null;
  // Se setea sobre el gasto (no el reintegro): cuánto espera recibir en total de vuelta.
  reimbursementExpected: number | null;
  // Calculado: suma de los montos de las transacciones que reintegran esta (si es un gasto).
  reimbursedSum: number;
  // Columna propia en la UI (wireframe la muestra separada de description);
  // en Fase 1 puede seguir derivándose de description o pasar a columna real.
  counterparty: string;
  // Nota personal de Juan sobre esta transacción — la descripción de MP suele ser
  // críptica ("Pago con QR X"), esto es para recordar de qué se trataba en realidad.
  notes: string | null;
  // Para gastos en dólares (tarjeta en moneda extranjera, no pasan por MP): el monto
  // original en USD y el tipo de cambio (MEP) usado para convertir a pesos, así el
  // monto en `amount` no queda ambiguo — no es un cargo en pesos "real" de MP.
  originalAmountUsd: number | null;
  usdExchangeRate: number | null;
  // true si otra transacción de la misma contraparte ya quedó marcada con
  // subcategoría "Desconocidos" — para avisar que quizás esta ayude a recordar
  // aquella (o viceversa), sin tener que abrir cada una para descubrirlo.
  hasUnknownHistory: boolean;
}
