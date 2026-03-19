import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Table2, BarChart3, Upload } from "lucide-react";
import FWSImportDialog from "../components/articles/FWSImportDialog";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/shared/EmptyState";
import ArticleFormDialog from "../components/articles/ArticleFormDialog";
import FabricInventorySummary from "../components/articles/FabricInventorySummary";
import ArticleTable from "../components/articles/ArticleTable";
import ArticlePivotSummary from "../components/articles/ArticlePivotSummary";

const VIEWS = [
  { id: "table", label: "Table View", icon: Table2 },
  { id: "pivot", label: "Summary / Pivot", icon: BarChart3 },
  { id: "inventory", label: "Fabric Inventory", icon: BarChart3 },
];

export default function Articles() {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [activeView, setActiveView] = useState("table");
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: () => base44.entities.Article.list("-created_date"),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date"),
  });

  const handleSave = async (data) => {
    if (editingArticle) {
      await base44.entities.Article.update(editingArticle.id, data);
    } else {
      await base44.entities.Article.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["articles"] });
    setShowForm(false);
    setEditingArticle(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this article?")) {
      await base44.entities.Article.delete(id);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    }
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* View Toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeView === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{articles.length} articles</span>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import FWS
          </Button>
          <Button onClick={() => { setEditingArticle(null); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> New Article
          </Button>
        </div>
      </div>

      {/* Content */}
      {articles.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No Articles"
          description="Define article structures with component-wise fabric breakdowns."
          actionLabel="Create Article"
          onAction={() => setShowForm(true)}
        />
      ) : activeView === "table" ? (
        <ArticleTable
          articles={articles}
          purchaseOrders={purchaseOrders}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : activeView === "pivot" ? (
        <ArticlePivotSummary
          articles={articles}
          purchaseOrders={purchaseOrders}
        />
      ) : (
        <FabricInventorySummary articles={articles} />
      )}

      <ArticleFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditingArticle(null); }}
        onSave={handleSave}
        purchaseOrders={purchaseOrders}
        initialData={editingArticle}
      />
      <FWSImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        purchaseOrders={purchaseOrders}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["articles"] });
          setShowImport(false);
        }}
      />
    </div>
  );
}