"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { Transaction } from "@/types/transaction";
import { CategorizationModal } from "@/components/transactions/CategorizationModal";

export function CategorizeTrigger({
  transaction,
  categories,
  className = "cursor-pointer text-left",
  children,
}: {
  transaction: Transaction;
  categories: Category[];
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={className}
      >
        {children}
      </div>
      {open && (
        <CategorizationModal
          transaction={transaction}
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
