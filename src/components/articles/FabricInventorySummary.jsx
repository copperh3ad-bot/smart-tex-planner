import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, TrendingUp } from "lucide-react";

// Extract a short fabric type label from the description
function getFabricType(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes("terry"))           return "Terry";
  if (d.includes("mesh"))            return "Mesh";
  if (d.includes("satin"))           return "Satin";
  if (d.includes("nylon") || d.includes("microfiber jersey") || d.includes("mica")) return "Nylon Microfiber";
  if (d.includes("microfiber"))      return "Microfiber";
  if (d.includes("interlock"))       return "Interlock";
  if (d.includes("birdeye"))         return "Birdeye";
  if (d.includes("evalon") || d.includes("tpu") || d.includes("lamination")) return "Lamination / TPU";
  if (d.includes("plain weave"))     return "Plain Weave";
  if (d.includes("fleece"))          return "Fleece";
  if (d.includes("cotton"))          return "Cotton";
  if (d.includes("polyester"))       return "Polyester";
  return desc ? desc.substring(0, 30) : "Unspecified";
}

const TYPE_COLORS = {
  "Terry":             "bg-blue-100 text-blue-800",
  "Mesh":              "bg-green-100 text-green-800",
  "Satin":             "bg-purple-100 text-purple-800",
  "Nylon Microfiber":  "bg-orange-100 text-orange-800",
  "Microfiber":        "bg-yellow-100 text-yellow-800",
  "Interlock":         "bg-cyan-100 text-cyan-800",
  "Birdeye":           "bg-pink-100 text-pink-800",
  "Lamination / TPU":  "bg-red-100 text-red-800",
  "Plain Weave":       "bg-teal-100 text-teal-800",
  "Fleece":            "bg-indigo-100 text-indigo-800",
  "Cotton":            "bg-lime-100 text-lime-800",
  "Polyester":         "bg-sky-100 text-sky-800",
};

export default function FabricInventorySummary({ articles }) {
  const [search, setSearch] = useState("");

  // Aggregate: group by fabric_description (or component_type fallback)
  const summary = useMemo(() => {
    const map = {};
    articles.forEach((article) => {
      (article.components || []).forEach((comp) => {
        const key = comp.fabric_description?.trim() || `[${comp.component_type}]`;
        if (!map[key]) {
          map[key] = {
            fabric_description: key,
            fabric_type: getFabricType(comp.fabric_description || ""),
            gsm: comp.gsm,
            width_cm: comp.width_cm,
            total_meters: 0,
            total_value: 0,
            price_per_meter: comp.price_per_meter,
            articles: [],
            component_types: new Set(),
          };
        }
        map[key].total_meters += comp.total_meters || 0;
        map[key].total_value  += comp.total_value  || 0;
        if (!map[key].articles.includes(article.article_name)) {
          map[key].articles.push(article.article_name);
        }
        map[key].component_types.add(comp.component_type);
        // Use first seen price if not set
        if (!map[key].price_per_meter && comp.price_per_meter) {
          map[key].price_per_meter = comp.price_per_meter;
        }
      });
    });

    return Object.values(map)
      .map((r) => ({ ...r, component_types: [...r.component_types] }))
      .sort((a, b) => b.total_meters - a.total_meters);
  }, [articles]);

  const filtered = search
    ? summary.filter((r) =>
        r.fabric_description.toLowerCase().includes(search.toLowerCase()) ||
        r.fabric_type.toLowerCase().includes(search.toLowerCase())
      )
    : summary;

  const grandTotalMeters = filtered.reduce((s, r) => s + r.total_meters, 0);
  const grandTotalValue  = filtered.reduce((s, r) => s + r.total_value,  0);

  if (!articles.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No articles yet. Create articles with fabric components to see the inventory summary.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Fabric Types</p>
            <p className="text-2xl font-bold text-primary">{summary.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Meters Reqd</p>
            <p className="text-2xl font-bold text-green-700">{grandTotalMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} m</p>
          </CardContent>
        </Card>
        {grandTotalValue > 0 && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Est. Fabric Value</p>
              <p className="text-2xl font-bold text-accent-foreground">${grandTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Articles</p>
            <p className="text-2xl font-bold">{articles.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search fabric type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Fabric Requirements by Type
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Fabric Description</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Type</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">GSM</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Width (cm)</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Price/m</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-primary">Total Meters</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Est. Value</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Used In</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const colorClass = TYPE_COLORS[row.fabric_type] || "bg-gray-100 text-gray-700";
                  return (
                    <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium max-w-[220px]">
                        <span className="line-clamp-2">{row.fabric_description}</span>
                        {row.component_types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {row.component_types.map((ct) => (
                              <span key={ct} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">{ct}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-[10px] font-normal border-0 ${colorClass}`}>
                          {row.fabric_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{row.gsm || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{row.width_cm || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {row.price_per_meter ? `$${row.price_per_meter}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-bold text-primary text-sm">
                          {row.total_meters.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-muted-foreground ml-0.5">m</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {row.total_value > 0 ? `$${row.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {row.articles.slice(0, 3).map((a, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] truncate max-w-[120px]">{a}</span>
                          ))}
                          {row.articles.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">+{row.articles.length - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={5} className="px-4 py-2.5 font-semibold text-xs">Total</td>
                    <td className="px-3 py-2.5 text-right font-bold text-primary">
                      {grandTotalMeters.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-muted-foreground">
                      {grandTotalValue > 0 ? `$${grandTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}