import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Printer, Upload, Trash2, Edit2, X, CheckCircle } from "lucide-react";

const CATEGORIES = ["Zipper", "Slider", "Elastic", "Button", "Dori", "Eyelet", "Stitching Thread", "Other"];
const UNITS = ["Pcs", "Meters", "Kgs", "Rolls", "Dozens", "Gross", "Sets"];
const STATUSES = ["Planned", "Ordered", "Received", "Approved"];

const STATUS_COLORS = {
  Planned: "bg-gray-100 text-gray-700",
  Ordered: "bg-blue-100 text-blue-700",
  Received: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
};

const CAT_ICONS = {
  Zipper: "🔗", Slider: "🎚️", Elastic: "〰️", Button: "🔵",
  Dori: "🪢", Eyelet: "⭕", "Stitching Thread": "🧵", Other: "📦"
};

const emptyForm = {
  po_number: "", article_name: "", article_code: "", category: "Other",
  item_description: "", color: "", size_spec: "", quantity_required: "",
  unit: "Pcs", consumption_per_unit: "", supplier: "", unit_cost: "",
  total_cost: "", status: "Planned", notes: ""
};

export default function Accessories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["accessoryItems"],
    queryFn: () => base44.entities.AccessoryItem.list("-created_date", 200),
  });

  const filtered = items.filter(i => {
    const matchCat = filterCat === "All" || i.category === filterCat;
    const matchSearch = !search ||
      i.item_description?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase()) ||
      i.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.article_code?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const openNew = () => { setForm(emptyForm); setEditingItem(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({ ...emptyForm, ...item });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    const data = {
      ...form,
      quantity_required: form.quantity_required ? +form.quantity_required : undefined,
      consumption_per_unit: form.consumption_per_unit ? +form.consumption_per_unit : undefined,
      unit_cost: form.unit_cost ? +form.unit_cost : undefined,
      total_cost: form.unit_cost && form.quantity_required
        ? +(+form.unit_cost * +form.quantity_required).toFixed(4) : undefined,
    };
    if (editingItem) {
      await base44.entities.AccessoryItem.update(editingItem.id, data);
    } else {
      await base44.entities.AccessoryItem.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this accessory item?")) {
      await base44.entities.AccessoryItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Reading file...");
    const text = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsText(file);
    });
    setUploadMsg("Extracting accessories with AI...");
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract accessories/trims data from this CSV. For each row extract: po_number, article_name, article_code, category (one of: Zipper, Slider, Elastic, Button, Dori, Eyelet, Stitching Thread, Other), item_description, color, size_spec, quantity_required (number), unit, consumption_per_unit (number), supplier, unit_cost (number), notes.\n\nContent:\n${text.substring(0, 12000)}`,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                po_number: { type: "string" }, article_name: { type: "string" }, article_code: { type: "string" },
                category: { type: "string" }, item_description: { type: "string" }, color: { type: "string" },
                size_spec: { type: "string" }, quantity_required: { type: "number" }, unit: { type: "string" },
                consumption_per_unit: { type: "number" }, supplier: { type: "string" }, unit_cost: { type: "number" }, notes: { type: "string" }
              }
            }
          }
        }
      }
    });
    const rows = extracted?.items || [];
    for (const row of rows) {
      if (!row.item_description && !row.category) continue;
      await base44.entities.AccessoryItem.create(row);
    }
    queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
    setUploadMsg(`Done! Imported ${rows.length} items.`);
    setTimeout(() => { setUploading(false); setUploadMsg(""); }, 2500);
    fileRef.current.value = "";
  };

  const handlePrint = () => {
    window.print();
  };

  // Summary by category
  const catSummary = CATEGORIES.map(cat => ({
    cat, count: items.filter(i => i.category === cat).length
  })).filter(x => x.count > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Accessories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage trims & accessories — Zipper, Elastic, Button, Dori, Thread & more</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1.5" />
            {uploading ? uploadMsg : "Upload CSV Sheet"}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Accessory
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap">
        {["All", ...CATEGORIES].map(cat => (
          <button key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterCat === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
            {cat !== "All" && <span className="mr-1">{CAT_ICONS[cat]}</span>}{cat}
            {cat !== "All" && <span className="ml-1 opacity-60">({items.filter(i => i.category === cat).length})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9 h-9 text-sm" placeholder="Search accessories..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="p-10 text-center">
            <p className="text-4xl mb-3">🧵</p>
            <p className="font-semibold text-sm">No accessories yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add accessories manually or upload a CSV sheet</p>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Add First Accessory</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Category", "Description", "Color/Spec", "Article", "PO#", "Qty", "Unit", "Supplier", "Unit Cost", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="mr-1">{CAT_ICONS[item.category] || "📦"}</span>
                      <span className="font-medium text-xs">{item.category}</span>
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{item.item_description}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{[item.color, item.size_spec].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.article_code || item.article_name || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.po_number || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{item.quantity_required?.toLocaleString() || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.unit}</td>
                    <td className="px-3 py-2 text-xs">{item.supplier || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{item.unit_cost ? `$${item.unit_cost}` : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ""}`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-muted"><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-base">{editingItem ? "Edit Accessory" : "Add Accessory"}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { label: "Category", key: "category", type: "select", options: CATEGORIES },
                { label: "Unit", key: "unit", type: "select", options: UNITS },
                { label: "Status", key: "status", type: "select", options: STATUSES },
                { label: "Description", key: "item_description", span: true },
                { label: "Color", key: "color" },
                { label: "Size / Spec", key: "size_spec" },
                { label: "Article Name", key: "article_name" },
                { label: "Article Code", key: "article_code" },
                { label: "PO Number", key: "po_number" },
                { label: "Supplier", key: "supplier" },
                { label: "Qty Required", key: "quantity_required", inputType: "number" },
                { label: "Consumption/Unit", key: "consumption_per_unit", inputType: "number" },
                { label: "Unit Cost ($)", key: "unit_cost", inputType: "number" },
                { label: "Notes", key: "notes", span: true },
              ].map(({ label, key, type, options, span, inputType }) => (
                <div key={key} className={span ? "col-span-2" : ""}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  {type === "select" ? (
                    <Select value={form[key]} onValueChange={v => setForm(f => ({ ...f, [key]: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-8 text-sm" type={inputType || "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}