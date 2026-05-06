import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const MODULE_DEFS = [
  { key: "TechPackRecord",   label: "Tech Pack Library",       codeField: "article_code" },
  { key: "Article",          label: "Article Master",          codeField: "article_code" },
  { key: "FabricTemplate",   label: "Fabric Templates",        codeField: "article_code" },
  { key: "PriceList",        label: "Price List",              codeField: "item_code"    },
  { key: "ArticlePackaging", label: "Article Packaging",       codeField: "article_code" },
  { key: "AccessoryItem",    label: "Accessories Module",      codeField: "article_code" },
];

// Required fields to check per module
const REQUIRED_FIELDS = {
  TechPackRecord:   ["article_name", "article_code"],
  Article:          ["article_name", "article_code", "components"],
  FabricTemplate:   ["article_code", "components"],
  PriceList:        ["item_code", "cbm_per_carton", "qty_per_carton"],
  ArticlePackaging: ["article_code", "article_name"],
  AccessoryItem:    ["article_code", "category", "item_description"],
};

function isMissing(val) {
  if (val === null || val === undefined || val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function getStatus(record, requiredFields) {
  const missing = requiredFields.filter(f => isMissing(record[f]));
  if (missing.length === 0) return { type: "ok", missing: [] };
  if (missing.length === requiredFields.length) return { type: "error", missing };
  return { type: "warn", missing };
}

function StatusBadge({ type }) {
  if (type === "ok") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="h-3 w-3" /> Synced
    </span>
  );
  if (type === "warn") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
      <AlertTriangle className="h-3 w-3" /> Partial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="h-3 w-3" /> Missing
    </span>
  );
}

function ModuleCard({ moduleDef, records, techPackCodes }) {
  const [expanded, setExpanded] = useState(false);
  const { key, label, codeField } = moduleDef;
  const requiredFields = REQUIRED_FIELDS[key];

  // Build a map: articleCode -> most recent record
  const byCode = {};
  (records || []).forEach(r => {
    const code = r[codeField];
    if (!code) return;
    const existing = byCode[code.toUpperCase()];
    if (!existing || new Date(r.updated_date) > new Date(existing.updated_date)) {
      byCode[code.toUpperCase()] = r;
    }
  });

  // For each tech pack code, check if it's present in this module
  const rows = techPackCodes.map(code => {
    const rec = byCode[code.toUpperCase()];
    if (!rec) return { code, status: { type: "error", missing: ["Record not found"] }, updatedDate: null, record: null };
    const status = getStatus(rec, requiredFields);
    return { code, status, updatedDate: rec.updated_date, record: rec };
  });

  const okCount = rows.filter(r => r.status.type === "ok").length;
  const warnCount = rows.filter(r => r.status.type === "warn").length;
  const errorCount = rows.filter(r => r.status.type === "error").length;
  const lastSync = rows
    .filter(r => r.updatedDate)
    .map(r => new Date(r.updatedDate))
    .sort((a, b) => b - a)[0];

  const overallType = errorCount > 0 ? "error" : warnCount > 0 ? "warn" : "ok";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${
          overallType === "error" ? "bg-red-50/50" : overallType === "warn" ? "bg-amber-50/50" : "bg-green-50/30"
        }`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <StatusBadge type={overallType} />
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <span className="text-xs text-gray-400">({rows.length} SKUs)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            {okCount > 0 && <span className="text-green-600 font-medium">✓ {okCount} ok</span>}
            {warnCount > 0 && <span className="text-amber-600 font-medium">⚠ {warnCount} partial</span>}
            {errorCount > 0 && <span className="text-red-600 font-medium">✗ {errorCount} missing</span>}
          </div>
          {lastSync && (
            <span className="hidden md:flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(lastSync, { addSuffix: true })}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {/* Detail rows */}
      {expanded && (
        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-gray-50 text-[10px] font-bold uppercase text-gray-500 tracking-wide">
            <div className="col-span-3">Article Code</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-4">Missing Fields</div>
            <div className="col-span-3">Last Synced</div>
          </div>
          {rows.map(({ code, status, updatedDate }) => (
            <div key={code} className={`grid grid-cols-12 gap-2 px-4 py-2 text-xs items-center ${
              status.type === "error" ? "bg-red-50/40" : status.type === "warn" ? "bg-amber-50/30" : ""
            }`}>
              <div className="col-span-3 font-mono font-semibold text-gray-700">{code}</div>
              <div className="col-span-2"><StatusBadge type={status.type} /></div>
              <div className="col-span-4 text-gray-500 text-[11px]">
                {status.missing.length > 0
                  ? status.missing.join(", ")
                  : <span className="text-green-600">All fields present</span>}
              </div>
              <div className="col-span-3 text-gray-400 text-[10px]">
                {updatedDate
                  ? formatDistanceToNow(new Date(updatedDate), { addSuffix: true })
                  : <span className="text-red-400 font-medium">Never synced</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SyncDiagnosticDashboard() {
  const { data: techPacks = [], isLoading: tpLoading, refetch } = useQuery({
    queryKey: ["techPackRecords-diag"],
    queryFn: () => base44.entities.TechPackRecord.list("-updated_date", 500),
  });
  const { data: articles = [], isLoading: artLoading } = useQuery({
    queryKey: ["articles-diag"],
    queryFn: () => base44.entities.Article.list("-updated_date", 500),
  });
  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ["fabricTemplates-diag"],
    queryFn: () => base44.entities.FabricTemplate.list("-updated_date", 500),
  });
  const { data: priceLists = [], isLoading: plLoading } = useQuery({
    queryKey: ["priceLists-diag"],
    queryFn: () => base44.entities.PriceList.list("-updated_date", 500),
  });
  const { data: packaging = [], isLoading: pkgLoading } = useQuery({
    queryKey: ["articlePackaging-diag"],
    queryFn: () => base44.entities.ArticlePackaging.list("-updated_date", 500),
  });
  const { data: accessories = [], isLoading: accLoading } = useQuery({
    queryKey: ["accessoryItems-diag"],
    queryFn: () => base44.entities.AccessoryItem.list("-updated_date", 500),
  });

  const isLoading = tpLoading || artLoading || tplLoading || plLoading || pkgLoading || accLoading;

  // Unique article codes from TechPackRecords as the source of truth
  const techPackCodes = [...new Set(techPacks.map(r => r.article_code).filter(Boolean).map(c => c.toUpperCase()))];

  const moduleData = {
    TechPackRecord:   techPacks,
    Article:          articles,
    FabricTemplate:   templates,
    PriceList:        priceLists,
    ArticlePackaging: packaging,
    AccessoryItem:    accessories,
  };

  // Summary counts
  const totalSKUs = techPackCodes.length;
  const summaryByModule = MODULE_DEFS.map(m => {
    const byCode = {};
    (moduleData[m.key] || []).forEach(r => {
      const code = r[m.codeField];
      if (code) byCode[code.toUpperCase()] = r;
    });
    const synced = techPackCodes.filter(c => byCode[c] && getStatus(byCode[c], REQUIRED_FIELDS[m.key]).type === "ok").length;
    const partial = techPackCodes.filter(c => byCode[c] && getStatus(byCode[c], REQUIRED_FIELDS[m.key]).type === "warn").length;
    const missing = techPackCodes.filter(c => !byCode[c]).length;
    return { ...m, synced, partial, missing };
  });

  const overallHealth = summaryByModule.reduce((acc, m) => {
    acc.synced += m.synced;
    acc.partial += m.partial;
    acc.missing += m.missing;
    return acc;
  }, { synced: 0, partial: 0, missing: 0 });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
      <RefreshCw className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading sync diagnostics...</span>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800">Sync Diagnostic Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing sync coverage across all modules for <strong>{totalSKUs}</strong> article codes from the Tech Pack library.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{overallHealth.synced}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">Fully Synced</p>
          <p className="text-[10px] text-green-500">records across all modules</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{overallHealth.partial}</p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">Partial / Missing Fields</p>
          <p className="text-[10px] text-amber-500">records with incomplete data</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{overallHealth.missing}</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">Not Synced</p>
          <p className="text-[10px] text-red-500">SKUs missing from modules</p>
        </div>
      </div>

      {/* Quick coverage bar per module */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2.5">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Coverage per Module</p>
        {summaryByModule.map(m => {
          const total = totalSKUs || 1;
          const syncPct = Math.round((m.synced / total) * 100);
          const partialPct = Math.round((m.partial / total) * 100);
          return (
            <div key={m.key} className="flex items-center gap-3">
              <div className="w-36 text-xs text-gray-700 font-medium truncate">{m.label}</div>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-400 h-full transition-all" style={{ width: `${syncPct}%` }} />
                <div className="bg-amber-300 h-full transition-all" style={{ width: `${partialPct}%` }} />
                <div className="bg-red-200 h-full transition-all" style={{ width: `${Math.round((m.missing / total) * 100)}%` }} />
              </div>
              <div className="text-[10px] text-gray-400 w-20 text-right">
                {m.synced}/{total} synced
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-4 pt-1 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" /> Synced</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-300" /> Partial</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200" /> Not synced</span>
        </div>
      </div>

      {/* Per-module expandable cards */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Module Detail — click to expand</p>
        {MODULE_DEFS.map(m => (
          <ModuleCard
            key={m.key}
            moduleDef={m}
            records={moduleData[m.key]}
            techPackCodes={techPackCodes}
          />
        ))}
      </div>
    </div>
  );
}