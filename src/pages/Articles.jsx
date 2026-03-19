import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/shared/EmptyState";
import ArticleFormDialog from "../components/articles/ArticleFormDialog";

export default function Articles() {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
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

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{articles.length} article{articles.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => { setEditingArticle(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Article
        </Button>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Articles"
          description="Define article structures with component-wise fabric breakdowns."
          actionLabel="Create Article"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => {
            const po = purchaseOrders.find((p) => p.id === article.po_id);
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{article.article_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {article.article_code && `Code: ${article.article_code}`}
                      {po && ` • PO: ${po.po_number}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingArticle(article); setShowForm(true); }}>
                      <Layers className="h-3.5 w-3.5" />
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
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Components</p>
                      <p className="text-sm font-semibold">{article.components?.length || 0}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.components?.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {c.component_type}: {c.total_required?.toLocaleString() || 0}m
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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