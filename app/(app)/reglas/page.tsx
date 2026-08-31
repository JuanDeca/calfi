import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { RulesPanel } from "@/components/categories/RulesPanel";
import { getCategories, getCategorizationRules, getCategoryById } from "@/lib/categories";
import { getCounterpartyOccurrenceCounts } from "@/lib/categorization";
import { db } from "@/lib/db";

export default async function ReglasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const sp = await searchParams;
  const categories = getCategories();
  const rules = getCategorizationRules();
  const occurrenceCounts = Object.fromEntries(getCounterpartyOccurrenceCounts(db));
  const initialCategoryId = sp.categoryId ? Number(sp.categoryId) : undefined;
  const sourceCategory = initialCategoryId ? getCategoryById(initialCategoryId) : null;

  return (
    <>
      {sourceCategory && (
        <Breadcrumb
          items={[{ href: `/insights/categoria/${sourceCategory.id}`, label: sourceCategory.name }]}
        />
      )}
      <Topbar title="Reglas" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <RulesPanel
          rules={rules}
          categories={categories}
          occurrenceCounts={occurrenceCounts}
          initialCategoryId={initialCategoryId}
        />
      </div>
    </>
  );
}
