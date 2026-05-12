import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Search, ChevronUp, ChevronDown, Eye, Pencil, Download,
  Copy, RefreshCw, Trash2, Plus, ArrowUpDown, Filter
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  Draft:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  Approved: "bg-green-100 text-green-800 border-green-200",
  Updated:  "bg-blue-100 text-blue-800 border-blue-200",
};

const th = "px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none cursor-pointer hover:bg-gray-100 border-b border-gray-200";
const td = "px-3 py-2 text-xs text-gray-700 whitespace-nowrap border-b border-gray-100";

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-300 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 text-primary inline" />
    : <ChevronDown className="h-3 w-3 ml-1 text-primary inline" />;
}

export default function TechPackList({ onEdit, onNew }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState("created_date");
  const [sortDir, setSortDir] = useState("desc");
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("Approved");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["techPackRecords"],
    queryFn: () => base44.entities.TechPackRecord.list("-created_date", 500),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.list("-created_date", 200),
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...records];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.article_name||"").toLowerCase().includes(q) ||
        (r.article_code||"").toLowerCase().includes(q) ||
        (r.customer_name||"").toLowerCase().includes(q) ||
        (r.file_name||"").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") rows = rows.filter(r => r.status === filterStatus);
    rows.sort((a, b) => {
      let av = a[sortField] ?? "", bv = b[sortField] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [records, search, filterStatus, sortField, sortDir]);

  const handleStatusChange = async (id, status) => {
    await base44.entities.TechPackRecord.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this tech pack record? This will not delete articles or accessories already saved.")) return;
    setDeleting(id);
    await base44.entities.TechPackRecord.delete(id);
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });
    setDeleting(null);
  };

  const handleCreatePO = async (record) => {
    const art = record.extracted_data?.article || {};
    const poNumber = `PO-TP-${Date.now().toString().slice(-6)}`;
    const newPo = await base44.entities.PurchaseOrder.create({
      po_number: poNumber,
      customer_name: record.customer_name || art.article_name || "TBD",
      status: "PO Received",
      source: "Manual",
      notes: `Auto-created from Tech Pack: ${record.article_name} (${record.article_code || ""})`,
    });
    alert(`PO ${poNumber} created! Go to Purchase Orders to complete it.`);
    queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
  };

  const handleRepeatOrder = async (record) => {
    // Check if a FabricTemplate already exists for this article code
    if (record.article_code) {
      try {
        const templates = await base44.entities.FabricTemplate.filter({ article_code: record.article_code });
        if (templates.length > 0) {
          const tpl = templates[0];
          // Merge template fabric data into the extracted_data for pre-fill
          const merged = {
            ...(record.extracted_data || {}),
            article: { ...(record.extracted_data?.article || {}), order_quantity: null },
            fabric_components: tpl.components?.length ? tpl.components : (record.extracted_data?.fabric_components || []),
          };
          onEdit({ ...record, extracted_data: merged }, true);
          return;
        }
      } catch (_) {}
    }
    onEdit(record, true);
  };

  const handleUpdateVersion = async (record) => {
    if (onEdit) onEdit(record, false, true);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selected.size === 0) return;
    setBulkUpdating(true);
    await Promise.all([...selected].map(id =>
      base44.entities.TechPackRecord.update(id, { status: bulkStatus })
    ));
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });
    setSelected(new Set());
    setBulkUpdating(false);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected tech pack record(s)? This cannot be undone.`)) return;
    setBulkUpdating(true);
    await Promise.all([...selected].map(id => base44.entities.TechPackRecord.delete(id)));
    queryClient.invalidateQueries({ queryKey: ["techPackRecords"] });
    setSelected(new Set());
    setBulkUpdating(false);
  };

  const cols = [
    { field: "article_name",  label: "Article Name" },
    { field: "article_code",  label: "Article Code" },
    { field: "customer_name", label: "Customer" },
    { field: "size_label",    label: "Size" },
    { field: "tech_pack_code",label: "TP Code" },
    { field: "price_usd",     label: "Price (USD)" },
    { field: "cbm",           label: "CBM/Ctn" },
    { field: "qty_per_carton",label: "Pcs/Ctn" },
    { field: "created_date",  label: "Upload Date" },
    { field: "version",       label: "Ver." },
    { field: "status",        label: "Status" },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="Search by article, code, customer or file…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Updated">Updated</option>
          </select>
        </div>
        <Button size="sm" onClick={onNew} className="gap-1.5 ml-auto">
          <Plus className="h-3.5 w-3.5" /> New Tech Pack
        </Button>
      </div>

      {/* Bulk action bar — shown when rows are selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-700">Set status to:</span>
            <select
              className="text-xs border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none"
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
            >
              <option value="Draft">Draft</option>
              <option value="Approved">Approved</option>
              <option value="Updated">Updated</option>
            </select>
            <button
              onClick={handleBulkStatusUpdate}
              disabled={bulkUpdating}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkUpdating ? "Updating…" : "Apply"}
            </button>
          </div>
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50 ml-auto"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span><strong className="text-gray-800">{records.length}</strong> total</span>
        <span><strong className="text-yellow-700">{records.filter(r=>r.status==="Draft").length}</strong> Draft</span>
        <span><strong className="text-green-700">{records.filter(r=>r.status==="Approved").length}</strong> Approved</span>
        <span><strong className="text-blue-700">{records.filter(r=>r.status==="Updated").length}</strong> Updated</span>
        {filtered.length !== records.length && (
          <span className="ml-auto text-primary">Showing {filtered.length} of {records.length}</span>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead style={{ backgroundColor: "#1F3864" }}>
              <tr>
                <th className="px-3 py-2.5 text-center" style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {cols.map(c => (
                  <th key={c.field} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap cursor-pointer hover:bg-white/10 border-r border-white/10 last:border-r-0"
                    onClick={() => handleSort(c.field)}>
                    {c.label}
                    <SortIcon field={c.field} sortField={sortField} sortDir={sortDir} />
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-white" style={{ minWidth: 240 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={13} className="text-center py-10 text-gray-400 text-xs">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-14 text-gray-400">
                    <p className="text-sm font-medium">No tech packs found</p>
                    <p className="text-xs mt-1">Upload a tech pack to get started.</p>
                  </td>
                </tr>
              )}
              {filtered.map((r, idx) => {
                const art = r.extracted_data?.article || {};
                const pl  = r.extracted_data?.price_list || {};
                const carton = r.extracted_data?.packaging?.carton || {};
                const priceUsd = pl.price_usd ?? art.price_usd ?? null;
                const cbm      = pl.cbm_per_carton ?? carton.cbm_per_carton ?? null;
                const pcsPerCtn= pl.qty_per_carton ?? carton.pieces_per_carton ?? null;
                const tpCode   = r.tech_pack_code || art.tech_pack_code || "";
                return (
                <tr key={r.id}
                  style={{ backgroundColor: selected.has(r.id) ? "#EFF6FF" : idx % 2 === 0 ? "#fff" : "#F9FAFB" }}
                  className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-3 py-1.5 text-center border-b border-gray-100">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
                  <td className={td + " font-medium text-gray-900 max-w-[180px] truncate"} title={r.article_name}>
                    {r.article_name || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className={td}>
                    {r.article_code
                      ? <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5">{r.article_code}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className={td + " max-w-[120px] truncate"} title={r.customer_name}>
                    {r.customer_name || <span className="text-gray-400">—</span>}
                  </td>
                  <td className={td}>{r.size_label || <span className="text-gray-400">—</span>}</td>
                  <td className={td}>
                    {tpCode
                      ? <span className="font-mono bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 text-[10px] font-semibold">{tpCode}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={td + " text-right"}>
                    {priceUsd != null
                      ? <span className="text-green-700 font-semibold">${Number(priceUsd).toFixed(2)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={td + " text-right"}>
                    {cbm != null
                      ? <span className="text-purple-700">{Number(cbm).toFixed(4)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={td + " text-center"}>
                    {pcsPerCtn != null
                      ? <span className="text-gray-700">{pcsPerCtn}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={td}>
                    {r.created_date ? format(new Date(r.created_date), "dd MMM yyyy") : "—"}
                  </td>
                  <td className={td + " text-center"}>
                    <span className="font-bold text-gray-700">v{r.version || 1}</span>
                  </td>
                  <td className={td}>
                    <select
                      className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}
                      value={r.status || "Draft"}
                      onChange={e => handleStatusChange(r.id, e.target.value)}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
                      <option value="Updated">Updated</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      {/* View / Edit */}
                      <button
                        title="View / Edit extracted data"
                        onClick={() => onEdit && onEdit(r, false, false)}
                        className="p-1 rounded hover:bg-blue-100 text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Edit"
                        onClick={() => onEdit && onEdit(r, false, false)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Download original file */}
                      {r.file_url && (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download original file"
                          className="p-1 rounded hover:bg-green-100 text-green-600 hover:text-green-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}

                      {/* Repeat order */}
                      <button
                        title="Use for Repeat Order"
                        onClick={() => handleRepeatOrder(r)}
                        className="p-1 rounded hover:bg-purple-100 text-purple-600 hover:text-purple-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      {/* Create PO */}
                      <button
                        title="Create PO from Tech Pack"
                        onClick={() => handleCreatePO(r)}
                        className="p-1 rounded hover:bg-amber-100 text-amber-600 hover:text-amber-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {/* Update version */}
                      <button
                        title="Upload new version"
                        onClick={() => handleUpdateVersion(r)}
                        className="p-1 rounded hover:bg-cyan-100 text-cyan-600 hover:text-cyan-800"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        title="Delete record"
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-gray-400 pt-1 flex-wrap">
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> View/Edit</span>
        <span className="flex items-center gap-1"><Download className="h-3 w-3" /> Download original</span>
        <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Repeat order (re-use data)</span>
        <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Create PO</span>
        <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Upload new version</span>
      </div>
    </div>
  );
}