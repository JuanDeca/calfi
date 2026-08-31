"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm debe usarse dentro de ConfirmProvider.");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(confirmed: boolean) {
    pending?.resolve(confirmed);
    setPending(null);
  }

  const contextValue = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="w-[380px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div
                className={`h-[9px] w-[9px] rounded-full ${
                  pending.danger ? "bg-terracotta-700" : "bg-sage-600"
                }`}
              />
              <span className="font-kalam text-sm font-bold text-ink">
                {pending.title ?? (pending.danger ? "Confirmar eliminación" : "Confirmar")}
              </span>
            </div>
            <div className="px-[18px] py-4">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{pending.description}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                >
                  {pending.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className={`flex-[1.4] rounded-control py-2.5 text-xs font-semibold text-white ${
                    pending.danger ? "bg-terracotta-700" : "bg-sage-600"
                  }`}
                >
                  {pending.confirmLabel ?? (pending.danger ? "Eliminar" : "Confirmar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
