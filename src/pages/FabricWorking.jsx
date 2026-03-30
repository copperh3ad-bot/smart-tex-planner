import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Layers, Pencil, Save, X, Plus, Trash2 } from "lucide-react";

const FABRIC_COMPONENT_TYPES = ["Front", "Skirt", "Bottom", "Piping", "Binding", "Filling", "Lamination", "Top Fabric"];

export default function FabricWorking() {
  const queryClient = useQueryClient();
  const [selectedPoId, setSelectedPoId] = useState("");
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const { data: pos = [] } = useQuery({ queryKey: ["purchaseOrders"], queryFn: () => base44.entities.PurchaseOrder.list() });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: () => base44.entities.Article.list() });
  const { data: poItems = [] } = useQuery({ queryKey: ["allPoItems"], queryFn: () => base44.entities.POItem.list() });

  const activePo = selectedPoId ? pos.find((p) => p.id === selectedPoId) : pos[0];
  const poArticles = useMemo(() => {
    if (!activePo) return [];
    return articles.filter((a) => a.po_id === activePo.id);
  }, [articles, activePo]);

  // Group by article type for summary
  const fabricSummary = useMemo(() => {
    const map = {};
    poArticles.forEach((art) => {
      (art.components || []).forEach((comp) => {
        const key = comp.fabric_type || "Unknown";
        if (!map[key]) map[key] = { fabric_type: key, width: comp.width, total_required: 0, price: 0 };
        map[key].total_required += comp.total_required || 0;
      });
    });
    return Object.values(map);
  }, [poArticles]);

  const updateArticle = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Article.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["articles"] }); setEditingArticleId(null); },
  });

  const startEdit = (article) => {
    setEditingArticleId(article.id);
    setEditForm({ ...article, components: JSON.parse(JSON.stringify(article.components || [])) });
  };

  const addComponent = () => {
    setEditForm((f) => ({ ...f, components: [...(f.components || []), { component_type: "Front", fabric_type: "", gsm: 0, width: 0, consumption_per_unit: 0, wastage_percent: 6, total_required: 0 }] }));
  };

  const removeComponent = (idx) => {
    setEditForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  };

  const updateComp = (idx, field, value) => {
    setEditForm((f) => {
      const comps = [...f.components];
      comps[idx] = { ...comps[idx], [field]: value };
      // Auto-calculate total_required
      if (field === "consumption_per_unit" || field === "wastage_percent") {
        const c = comps[idx];
        const net = (c.consumption_per_unit || 0) * (f.order_quantity || 0);
        comps[idx].total_required = net * (1 + (c.wastage_percent || 0) / 100);
      }
      return { ...f, components: comps };
    });
  };

  const saveEdit = () => {
    updateArticle.mutate({ id: editingArticleId, data: editForm });
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Fabric Working Sheet</h1>
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {activePo && (
        <div className="text-xs text-muted-foreground print:text-black print:font-semibold">
          PO: {activePo.po_number} | Customer: {activePo.customer_name} | MTA#2016-2026 | ETD: {activePo.etd}
        </div>
      )}

      {poArticles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No articles found for this PO.</p>
            <p className="text-xs mt-1">Add articles from the Articles page and link them to this PO.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {poArticles.map((article) => (
            <Card key={article.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between print:hidden">
                <CardTitle className="text-sm">{article.article_name} {article.article_code && <span className="text-muted-foreground font-normal">({article.article_code})</span>}</CardTitle>
                <div className="flex gap-2">
                  {editingArticleId === article.id ? (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingArticleId(null)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={saveEdit}><Save className="h-3 w-3 mr-1" />Save</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(article)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {editingArticleId === article.id && editForm ? (
                  <div className="p-4 space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border p-1.5 text-left">Part</th>
                            <th className="border p-1.5 text-left">Fabrication</th>
                            <th className="border p-1.5 text-center">GSM</th>
                            <th className="border p-1.5 text-center">Width cm</th>
                            <th className="border p-1.5 text-center">Cut/unit (m)</th>
                            <th className="border p-1.5 text-center">Wastage %</th>
                            <th className="border p-1.5 text-center">Total Mtrs</th>
                            <th className="border p-1.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(editForm.components || []).map((comp, idx) => (
                            <tr key={idx}>
                              <td className="border p-1">
                                <select className="w-full text-xs border rounded px-1 py-0.5" value={comp.component_type} onChange={(e) => updateComp(idx, "component_type", e.target.value)}>
                                  {FABRIC_COMPONENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="border p-1"><input className="w-full text-xs border rounded px-1 py-0.5" value={comp.fabric_type || ""} onChange={(e) => updateComp(idx, "fabric_type", e.target.value)} /></td>
                              <td className="border p-1"><input type="number" className="w-16 text-xs border rounded px-1 py-0.5" value={comp.gsm || ""} onChange={(e) => updateComp(idx, "gsm", Number(e.target.value))} /></td>
                              <td className="border p-1"><input type="number" className="w-16 text-xs border rounded px-1 py-0.5" value={comp.width || ""} onChange={(e) => updateComp(idx, "width", Number(e.target.value))} /></td>
                              <td className="border p-1"><input type="number" step="0.001" className="w-20 text-xs border rounded px-1 py-0.5" value={comp.consumption_per_unit || ""} onChange={(e) => updateComp(idx, "consumption_per_unit", Number(e.target.value))} /></td>
                              <td className="border p-1"><input type="number" className="w-14 text-xs border rounded px-1 py-0.5" value={comp.wastage_percent ?? 6} onChange={(e) => updateComp(idx, "wastage_percent", Number(e.target.value))} /></td>
                              <td className="border p-1 text-center font-medium">{comp.total_required?.toFixed(2) ?? "—"}</td>
                              <td className="border p-1"><button onClick={() => removeComponent(idx)} className="text-destructive hover:opacity-70"><Trash2 className="h-3 w-3" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={addComponent}><Plus className="h-3 w-3 mr-1" />Add Component</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="border border-gray-200 p-2 text-left">Part</th>
                          <th className="border border-gray-200 p-2 text-left">Fabrication</th>
                          <th className="border border-gray-200 p-2 text-center">GSM</th>
                          <th className="border border-gray-200 p-2 text-center">Width (cm)</th>
                          <th className="border border-gray-200 p-2 text-center">Cut/unit (m)</th>
                          <th className="border border-gray-200 p-2 text-center">Qty</th>
                          <th className="border border-gray-200 p-2 text-center">Net Mtrs</th>
                          <th className="border border-gray-200 p-2 text-center">Wastage %</th>
                          <th className="border border-gray-200 p-2 text-center font-bold">Total Mtrs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(article.components || []).length === 0 ? (
                          <tr><td colSpan={9} className="border border-gray-200 p-3 text-center text-muted-foreground">No components defined. Click Edit to add fabric components.</td></tr>
                        ) : (article.components || []).map((comp, idx) => {
                          const net = (comp.consumption_per_unit || 0) * (article.order_quantity || 0);
                          const total = comp.total_required || net * (1 + (comp.wastage_percent || 0) / 100);
                          return (
                            <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                              <td className="border border-gray-200 p-2">{comp.component_type}</td>
                              <td className="border border-gray-200 p-2">{comp.fabric_type}</td>
                              <td className="border border-gray-200 p-2 text-center">{comp.gsm}</td>
                              <td className="border border-gray-200 p-2 text-center">{comp.width}</td>
                              <td className="border border-gray-200 p-2 text-center">{comp.consumption_per_unit?.toFixed(4)}</td>
                              <td className="border border-gray-200 p-2 text-center">{article.order_quantity?.toLocaleString()}</td>
                              <td className="border border-gray-200 p-2 text-center">{net.toFixed(2)}</td>
                              <td className="border border-gray-200 p-2 text-center">{comp.wastage_percent ?? 6}%</td>
                              <td className="border border-gray-200 p-2 text-center font-bold">{total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Fabric Summary */}
          {fabricSummary.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fabric Requirement Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-primary/10">
                      <th className="border border-gray-200 p-2 text-left">Fabric Type / Quality</th>
                      <th className="border border-gray-200 p-2 text-center">Width</th>
                      <th className="border border-gray-200 p-2 text-right font-bold">Total Required (Mtrs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabricSummary.map((f, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                        <td className="border border-gray-200 p-2">{f.fabric_type}</td>
                        <td className="border border-gray-200 p-2 text-center">{f.width ? `${f.width}cm` : "—"}</td>
                        <td className="border border-gray-200 p-2 text-right font-bold">{f.total_required.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}