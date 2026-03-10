import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Trash2, Pencil, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/shared/EmptyState";
import ArticleFormDialog from "../components/articles/ArticleFormDialog";
import FabricInventorySummary from "../components/articles/FabricInventorySummary";

const ARTICLE_TYPES = [
  "All",
  "Mattress Protector",
  "Pillow Protector",
  "Total Encasement",
  "Sleeper Encasement",
  "Other",
  "📦 Fabric Inventory",
];

export default function Articles() {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [activeTab, setActiveTab] = useState("All");
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

  const isInventoryTab = activeTab === "📦 Fabric Inventory";

  const filtered = (activeTab === "All" || isInventoryTab)
    ? articles
    : articles.filter((a) => a.article_type === activeTab);

  // Count per type
  const countByType = (type) => {
    if (type === "All" || type === "📦 Fabric Inventory") return articles.length;
    return articles.filter((a) => a.article_type === type).length;
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} article{filtered.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => { setEditingArticle(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Article
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-border pb-0">
        {ARTICLE_TYPES.map((type) => {
          const count = countByType(type);
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${
                activeTab === type
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fabric Inventory Summary */}
      {isInventoryTab ? (
        <FabricInventorySummary articles={articles} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={`No ${activeTab === "All" ? "Articles" : activeTab}`}
          description="Define article structures with component-wise fabric breakdowns."
          actionLabel="Create Article"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((article) => {
            const po = purchaseOrders.find((p) => p.id === article.po_id);
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold">{article.article_name}</CardTitle>
                      {article.size_name && (
                        <Badge variant="outline" className="text-[10px] font-normal">{article.size_name}</Badge>
                      )}
                      {article.program_code && (
                        <Badge className="text-[10px] font-normal bg-primary/10 text-primary border-0">{article.program_code}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {article.article_code && <span>{article.article_code}</span>}
                      {article.size_dimensions && <span> · {article.size_dimensions}</span>}
                      {article.pi_number && <span> · PI: {article.pi_number}</span>}
                      {po && <span> · {po.po_number}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingArticle(article); setShowForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(article.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Qty</p>
                      <p className="text-sm font-semibold">{article.order_quantity?.toLocaleString() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Total Fabric</p>
                      <p className="text-sm font-semibold">{article.total_fabric_required?.toLocaleString() || "—"} m</p>
                    </div>
                    {article.total_fabric_value > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Fabric Value</p>
                        <p className="text-sm font-semibold">${article.total_fabric_value?.toLocaleString() || "—"}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Components</p>
                      <p className="text-sm font-semibold">{article.components?.length || 0}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.components?.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {c.component_type}{c.total_meters ? `: ${c.total_meters.toFixed(1)}m` : ""}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      ) : null}

      <ArticleFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditingArticle(null); }}
        onSave={handleSave}
        purchaseOrders={purchaseOrders}
        initialData={editingArticle}
      />
    </div>
  );
}