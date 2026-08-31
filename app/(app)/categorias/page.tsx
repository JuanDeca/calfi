import { Topbar } from "@/components/layout/Topbar";
import { CategoriesPanel } from "@/components/categories/CategoriesPanel";
import { getCategories, getCategoryTransactionCounts } from "@/lib/categories";

export default function CategoriasPage() {
  const categories = getCategories();
  const transactionCounts = getCategoryTransactionCounts();

  return (
    <>
      <Topbar title="Categorías" />
      <div className="flex flex-1 overflow-hidden">
        <CategoriesPanel categories={categories} transactionCounts={transactionCounts} />
      </div>
    </>
  );
}
