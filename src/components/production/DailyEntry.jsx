import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2, Download } from "lucide-react";

const STAGES = ["Fabric Inhouse","Cutting","Stitching","Filling","Inspection","Packing","Carton Packing","Warehouse","Shipment Ready","Shipped"];
const inp = "w-full text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-background";

const blankRow = (date) => ({
  log_date: date,
  production_order_id: "",
  po_number: "",
  article_name: "",
  stage_name: "Stitching",
  shift: "Morning",
  operator_name: "",
  line_name: "",
  factory: "",
  quantity_produced: "",
  quantity_rejected: "",
  quantity_reworked: "",
  target_quantity: "",
  hours_worked: 8,
  notes: "",
});

function calcEfficiency(produced, target) {
  if (!target || !produced) return 0;
  return Math.round((Number(produced) / Number(target)) * 100);
}

export default function DailyEntry() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([blankRow(today)]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 200),
  });
  const { data: existing = [], refetch } = useQuery({
    queryKey: ["dailyLogs", date],
    queryFn: () => base44.entities.DailyProductionLog.filter({ log_date: date }),
  });

  const setRow = (i, k, v) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const handleOrderSelect = (i, orderId) => {
    const o = orders.find(x => x.id === orderId);
    setRow(i, "production_order_id", orderId);
    if (o) {
      setRow(i, "po_number", o.po_number || "");
      setRow(i, "article_name", o.article_name || "");
      setRow(i, "factory", o.factory || "");
      setRow(i, "line_name", o.production_line || "");
    }
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.production_order_id && r.quantity_produced !== "");
    if (!validRows.length) { alert("Add at least one row with a production order and quantity."); return; }
    setSaving(true);
    await Promise.all(
      validRows.map(r => base44.entities.DailyProductionLog.create({
        ...r,
        log_date: date,
        quantity_produced: Number(r.quantity_produced) || 0,
        quantity_rejected: Number(r.quantity_rejected) || 0,
        quantity_reworked: Number(r.quantity_reworked) || 0,
        target_quantity: Number(r.target_quantity) || null,
        hours_worked: Number(r.hours_worked) || 8,
        efficiency_percentage: calcEfficiency(r.quantity_produced, r.target_quantity),
      }))
    );
    setSaving(false);
    setRows([blankRow(date)]);
    refetch();
    qc.invalidateQueries({ queryKey: ["dailyLogs-today"] });
  };

  const exportCsv = () => {
    if (!existing.length) return;
    const headers = ["Date","PO","Article","Stage","Shift","Operator","Line","Produced","Rejected","Reworked","Target","Efficiency%","Hours"];
    const csvRows = existing.map(r => [
      r.log_date, r.po_number, r.article_name, r.stage_name, r.shift, r.operator_name,
      r.line_name, r.quantity_produced, r.quantity_rejected, r.quantity_reworked,
      r.target_quantity, r.efficiency_percentage, r.hours_worked,
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `DailyProduction_${date}.csv`;
    a.click();
  };

  const totalProduced = rows.reduce((s, r) => s + (Number(r.quantity_produced) || 0), 0);
  const totalRejected = rows.reduce((s, r) => s + (Number(r.quantity_rejected) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mr-2">Date</label>
          <input type="date" className="text-sm border border-border rounded-lg px-3 py-2 focus:outline-none"
            value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save All Entries"}
          </Button>
        </div>
      </div>

      {/* Entry Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "#1F3864" }}>
          <span className="text-sm font-semibold text-white">Daily Production Entry — {date}</span>
          <div className="flex items-center gap-4 text-xs text-white/80">
            <span>Total Produced: <strong className="text-white">{totalProduced.toLocaleString()}</strong></span>
            <span>Total Rejected: <strong className="text-red-300">{totalRejected.toLocaleString()}</strong></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {["Production Order","Stage","Shift","Operator","Line","Target","Produced","Rejected","Reworked","Hrs","Eff%","Notes",""].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="px-2 py-1.5" style={{ minWidth: 160 }}>
                    <select className={inp} value={row.production_order_id}
                      onChange={e => handleOrderSelect(i, e.target.value)}>
                      <option value="">— Select Order —</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.po_number ? `${o.po_number} · ` : ""}{o.article_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 120 }}>
                    <select className={inp} value={row.stage_name} onChange={e => setRow(i, "stage_name", e.target.value)}>
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className={inp} value={row.shift} onChange={e => setRow(i, "shift", e.target.value)}>
                      {["Morning","Evening","Night"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 100 }}>
                    <input className={inp} value={row.operator_name} onChange={e => setRow(i, "operator_name", e.target.value)} placeholder="Operator" />
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 80 }}>
                    <input className={inp} value={row.line_name} onChange={e => setRow(i, "line_name", e.target.value)} placeholder="Line" />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: 70 }}>
                    <input className={inp + " text-right"} type="number" value={row.target_quantity}
                      onChange={e => setRow(i, "target_quantity", e.target.value)} placeholder="0" />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: 70 }}>
                    <input className={inp + " text-right"} type="number" value={row.quantity_produced}
                      onChange={e => setRow(i, "quantity_produced", e.target.value)} placeholder="0" />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: 70 }}>
                    <input className={inp + " text-right"} type="number" value={row.quantity_rejected}
                      onChange={e => setRow(i, "quantity_rejected", e.target.value)} placeholder="0" />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: 70 }}>
                    <input className={inp + " text-right"} type="number" value={row.quantity_reworked}
                      onChange={e => setRow(i, "quantity_reworked", e.target.value)} placeholder="0" />
                  </td>
                  <td className="px-2 py-1.5" style={{ width: 50 }}>
                    <input className={inp + " text-right"} type="number" value={row.hours_worked}
                      onChange={e => setRow(i, "hours_worked", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold" style={{ width: 50 }}>
                    <span className={calcEfficiency(row.quantity_produced, row.target_quantity) >= 90 ? "text-green-600" : calcEfficiency(row.quantity_produced, row.target_quantity) >= 70 ? "text-amber-600" : "text-red-500"}>
                      {calcEfficiency(row.quantity_produced, row.target_quantity)}%
                    </span>
                  </td>
                  <td className="px-2 py-1.5" style={{ minWidth: 100 }}>
                    <input className={inp} value={row.notes} onChange={e => setRow(i, "notes", e.target.value)} placeholder="Notes" />
                  </td>
                  <td className="px-2 py-1.5">
                    {rows.length > 1 && (
                      <button onClick={() => setRows(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-border">
          <button onClick={() => setRows(p => [...p, blankRow(date)])}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
            <Plus className="h-3 w-3" /> Add Row
          </button>
        </div>
      </div>

      {/* Existing entries for the day */}
      {existing.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Saved Entries — {date} ({existing.length} records)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  {["PO","Article","Stage","Shift","Operator","Line","Produced","Rejected","Reworked","Eff%"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {existing.map((r, i) => (
                  <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-3 py-1.5">{r.po_number || "—"}</td>
                    <td className="px-3 py-1.5 font-medium">{r.article_name}</td>
                    <td className="px-3 py-1.5">{r.stage_name}</td>
                    <td className="px-3 py-1.5">{r.shift}</td>
                    <td className="px-3 py-1.5">{r.operator_name || "—"}</td>
                    <td className="px-3 py-1.5">{r.line_name || "—"}</td>
                    <td className="px-3 py-1.5 font-bold text-blue-700">{r.quantity_produced}</td>
                    <td className="px-3 py-1.5 text-red-600">{r.quantity_rejected}</td>
                    <td className="px-3 py-1.5 text-amber-600">{r.quantity_reworked}</td>
                    <td className="px-3 py-1.5 font-bold"
                      style={{ color: r.efficiency_percentage >= 90 ? "#16a34a" : r.efficiency_percentage >= 70 ? "#d97706" : "#dc2626" }}>
                      {r.efficiency_percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}