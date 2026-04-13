import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Scissors, Trash2, Pencil, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "../components/shared/StatusBadge";
import YarnFormDialog from "../components/yarn/YarnFormDialog";

// Yarn kg from fabric: Total Meters × GSM × Width(cm) / 1000
function fabricToYarnKg(total_meters, gsm, width_cm) {
  if (!total_meters || !gsm || !width_cm) return 0;
  return +(total_meters * gsm * width_cm / 1000).toFixed(2);
}

export default function YarnPlanning() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const queryClient = useQueryClient();

  const { data: yarns = [], isLoading } = useQuery({
    queryKey: ["yarnRequirements"],
    queryFn: () => base44.entities.YarnRequirement.list("-created_date"),
  });
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: () => base44.entities.Article.list(),
  });

  const activePo = selectedPoId ? purchaseOrders.find(p => p.id === selectedPoId) : purchaseOrders[0];
  const poArticles = useMemo(() => articles.filter(a => a.po_id === activePo?.id), [articles, activePo]);

  // Fabric requirement summary for selected PO (grouped by fabric_type + width)
  const fabricRequirements = useMemo(() => {
    const map = {};
    poArticles.forEach((art) => {
      (art.components || []).forEach((comp) => {
        const key = `${comp.fabric_type}||${comp.gsm}||${comp.width}`;
        if (!map[key]) {
          map[key] = {
            fabric_type: comp.fabric_type || "Unknown",
            gsm: comp.gsm || 0,
            width: comp.width || 0,
            total_meters: 0,
            articles: [],
          };
        }
        map[key].total_meters += comp.total_required || 0;
        map[key].articles.push(art.article_name);
      });
    });
    return Object.values(map).map(f => ({
      ...f,
      total_meters: +f.total_meters.toFixed(2),
      yarn_kg: fabricToYarnKg(f.total_meters, f.gsm, f.width),
    }));
  }, [poArticles]);

  // Existing yarn for active PO
  const poYarns = useMemo(() => yarns.filter(y => y.po_id === activePo?.id), [yarns, activePo]);

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.YarnRequirement.update(editing.id, data);
    } else {
      await base44.entities.YarnRequirement.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["yarnRequirements"] });
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete?")) {
      await base44.entities.YarnRequirement.delete(id);
      queryClient.invalidateQueries({ queryKey: ["yarnRequirements"] });
    }
  };

  const handleGenerateFromFabric = async () => {
    if (!activePo || fabricRequirements.length === 0) return;
    if (!window.confirm(`Generate ${fabricRequirements.length} yarn requirement(s) from fabric working for PO ${activePo.po_number}? Existing yarn entries for this PO will be replaced.`)) return;

    setGenerating(true);
    setGenMsg("Clearing existing yarn requirements...");

    // Delete existing yarn for this PO
    const existing = yarns.filter(y => y.po_id === activePo.id);
    for (const y of existing) {
      await base44.entities.YarnRequirement.delete(y.id);
    }

    setGenMsg("Creating yarn requirements from fabric data...");
    const records = fabricRequirements.map(f => ({
      po_id: activePo.id,
      yarn_count: f.gsm ? `${f.gsm} GSM` : "—",
      yarn_type: f.fabric_type,
      consumption_per_unit: undefined,
      total_yarn_required: f.yarn_kg,
      procurement_source: "Local",
      status: "Planned",
    }));

    await base44.entities.YarnRequirement.bulkCreate(records);
    queryClient.invalidateQueries({ queryKey: ["yarnRequirements"] });
    setGenMsg(`✓ Generated ${records.length} yarn requirement(s)`);
    setTimeout(() => { setGenerating(false); setGenMsg(""); }, 2000);
  };

  const totalYarn = poYarns.reduce((s, y) => s + (y.total_yarn_required || 0), 0);
  const allYarnTotal = yarns.reduce((s, y) => s + (y.total_yarn_required || 0), 0);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Yarn Planning</h1>
          <p className="text-sm text-muted-foreground">Auto-calculate yarn requirements from fabric working sheet</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedPoId || activePo?.id || ""} onValueChange={setSelectedPoId}>
            <SelectTrigger className="w-64 h-9 text-xs">
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {purchaseOrders.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateFromFabric}
            disabled={generating || fabricRequirements.length === 0}
            className="gap-1.5"
          >
            <Zap className="h-4 w-4" />
            {generating ? genMsg : "Generate from Fabric"}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Manual
          </Button>
        </div>
      </div>

      {/* Fabric Requirement Preview for selected PO */}
      {activePo && fabricRequirements.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Fabric Requirements — {activePo.po_number} (source for yarn calculation)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-blue-200">
                    <th className="text-left py-1.5 px-2 text-blue-700 font-semibold">Fabric Type</th>
                    <th className="text-center py-1.5 px-2 text-blue-700 font-semibold">GSM</th>
                    <th className="text-center py-1.5 px-2 text-blue-700 font-semibold">Width (cm)</th>
                    <th className="text-right py-1.5 px-2 text-blue-700 font-semibold">Total Mtrs</th>
                    <th className="text-right py-1.5 px-2 text-blue-700 font-semibold">→ Yarn (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricRequirements.map((f, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-blue-50" : "bg-white"}>
                      <td className="py-1.5 px-2 font-medium">{f.fabric_type}</td>
                      <td className="py-1.5 px-2 text-center">{f.gsm || "—"}</td>
                      <td className="py-1.5 px-2 text-center">{f.width ? `${f.width}cm` : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{f.total_meters.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-blue-900">{f.yarn_kg.toLocaleString()} kg</td>
                    </tr>
                  ))}
                  <tr className="border-t border-blue-300 font-bold bg-blue-100">
                    <td colSpan={4} className="py-1.5 px-2 text-blue-900">TOTAL</td>
                    <td className="py-1.5 px-2 text-right text-blue-900">
                      {fabricRequirements.reduce((s, f) => s + f.yarn_kg, 0).toLocaleString()} kg
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-blue-600 mt-2 italic">
              Formula: Yarn (kg) = Total Meters × GSM × Width(cm) / 1000
            </p>
          </CardContent>
        </Card>
      )}

      {activePo && poArticles.length === 0 && (
        <div className="p-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-center text-sm text-amber-700 flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          No fabric working data found for {activePo.po_number}. Go to Fabric Working to define article components first.
        </div>
      )}

      {/* Yarn Requirements Table for selected PO */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">
            Yarn Requirements {activePo ? `— ${activePo.po_number}` : ""}
            {poYarns.length > 0 && <span className="ml-2 text-muted-foreground font-normal">({poYarns.length} items • {totalYarn.toLocaleString()} kg total)</span>}
          </h2>
        </div>

        {poYarns.length === 0 ? (
          <Card className="border-dashed border-2 border-primary/20">
            <CardContent className="p-8 text-center">
              <Scissors className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold text-sm">No yarn requirements yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Click "Generate from Fabric" to auto-calculate from fabric working, or add manually.
              </p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={handleGenerateFromFabric} disabled={fabricRequirements.length === 0}>
                  <Zap className="h-4 w-4 mr-1.5" /> Generate from Fabric
                </Button>
                <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Yarn Type / Fabric</TableHead>
                      <TableHead className="text-xs">Count / GSM</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Article</TableHead>
                      <TableHead className="text-xs">Total (kg)</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Source</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Lead Time</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poYarns.map((y) => {
                      const article = articles.find(a => a.id === y.article_id);
                      return (
                        <TableRow key={y.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">{y.yarn_type}</TableCell>
                          <TableCell className="text-xs">{y.yarn_count}</TableCell>
                          <TableCell className="text-xs hidden md:table-cell">{article?.article_name || "—"}</TableCell>
                          <TableCell className="text-xs font-bold">{y.total_yarn_required?.toLocaleString()}</TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">{y.procurement_source}</TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">{y.lead_time_days ? `${y.lead_time_days}d` : "—"}</TableCell>
                          <TableCell><StatusBadge status={y.status} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(y); setShowForm(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(y.id)}>
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* All POs summary */}
      {yarns.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          All POs total yarn: <strong>{allYarnTotal.toLocaleString()} kg</strong>
        </p>
      )}

      <YarnFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        onSave={handleSave}
        purchaseOrders={purchaseOrders}
        articles={articles}
        initialData={editing}
      />
    </div>
  );
}