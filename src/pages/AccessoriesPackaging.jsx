import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Tag, Box, Package, Layers, CheckCircle } from "lucide-react";
import UploadPackagingSheet from "../components/packaging/UploadPackagingSheet";
import ArticlePackagingForm from "../components/packaging/ArticlePackagingForm";
import ArticlePackagingCard from "../components/packaging/ArticlePackagingCard";

export default function AccessoriesPackaging() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["articlePackaging"],
    queryFn: () => base44.entities.ArticlePackaging.list(),
  });

  const filtered = templates.filter(t =>
    !search ||
    t.article_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.article_code?.toLowerCase().includes(search.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editingItem) {
      await base44.entities.ArticlePackaging.update(editingItem.id, data);
    } else {
      await base44.entities.ArticlePackaging.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["articlePackaging"] });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this packaging template?")) {
      await base44.entities.ArticlePackaging.delete(id);
      queryClient.invalidateQueries({ queryKey: ["articlePackaging"] });
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  // Stats
  const totalLabels = templates.reduce((s, t) => s + (t.labels?.length || 0), 0);
  const withStiffener = templates.filter(t => t.stiffener?.used).length;
  const withPolybag = templates.filter(t => t.polybag?.type).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Packaging</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define packaging instructions once per article — auto-applied on repeat orders
          </p>
        </div>
        <div className="flex gap-2">
          <UploadPackagingSheet onSuccess={() => queryClient.invalidateQueries({ queryKey: ["articlePackaging"] })} />
          <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Article Template
        </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Article Templates</p><p className="text-xl font-bold">{templates.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center"><Tag className="h-4 w-4 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total Labels</p><p className="text-xl font-bold">{totalLabels}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center"><Box className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">With Polybag</p><p className="text-xl font-bold">{withPolybag}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center"><CheckCircle className="h-4 w-4 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">With Stiffener</p><p className="text-xl font-bold">{withStiffener}</p></div>
        </CardContent></Card>
      </div>

      {/* How it works banner */}
      {templates.length === 0 && !isLoading && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center">
            <Layers className="h-10 w-10 text-primary mx-auto mb-3 opacity-60" />
            <h3 className="font-semibold text-sm mb-1">Create your first packaging template</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
              Define labels, polybag specs, stiffeners, carton details, and stickers once per article. 
              When a repeat order arrives, all instructions are instantly available — no re-entry needed.
            </p>
            <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Create First Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading templates...</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pkg => (
            <ArticlePackagingCard key={pkg.id} pkg={pkg} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {filtered.length === 0 && templates.length > 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No templates match your search.</div>
          )}
        </div>
      )}

      <ArticlePackagingForm
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditingItem(null); }}
        onSave={handleSave}
        initialData={editingItem}
      />
    </div>
  );
}