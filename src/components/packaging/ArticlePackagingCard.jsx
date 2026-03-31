import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, Tag, Box, Package, Sticker, Layers } from "lucide-react";

function MiniSection({ title, icon: Icon, items, renderItem }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      <div className="space-y-1">{items.map((item, i) => renderItem(item, i))}</div>
    </div>
  );
}

export default function ArticlePackagingCard({ pkg, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const labelCount = pkg.labels?.length || 0;
  const stickerCount = pkg.stickers?.length || 0;
  const otherCount = pkg.other_accessories?.length || 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground">{pkg.article_name}</h3>
              {pkg.article_code && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{pkg.article_code}</span>}
              {pkg.customer_name && <Badge variant="outline" className="text-xs">{pkg.customer_name}</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Tag className="h-3 w-3" />{labelCount} Labels</span>
              {pkg.polybag?.type && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Package className="h-3 w-3" />Polybag: {pkg.polybag.type} {pkg.polybag.printed ? "Printed" : "Plain"}</span>}
              {pkg.carton?.size_cm && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Box className="h-3 w-3" />Carton: {pkg.carton.size_cm} · {pkg.carton.pieces_per_carton}pcs</span>}
              {stickerCount > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Layers className="h-3 w-3" />{stickerCount} Stickers</span>}
              {pkg.stiffener?.used && <Badge variant="secondary" className="text-[10px]">Stiffener</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(pkg)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(pkg.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Labels */}
            {labelCount > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Labels ({labelCount})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pkg.labels.map((lbl, i) => (
                    <div key={i} className="bg-muted/40 rounded p-2 text-xs">
                      <div className="font-medium">{lbl.label_type}</div>
                      {lbl.description && <div className="text-muted-foreground">{lbl.description}</div>}
                      <div className="flex gap-3 mt-1 text-muted-foreground">
                        {lbl.supplier && <span>Supplier: {lbl.supplier}</span>}
                        {lbl.unit_cost && <span>Cost: ${lbl.unit_cost}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Polybag */}
            {pkg.polybag?.type && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Polybag</span>
                </div>
                <div className="bg-muted/40 rounded p-2 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">Type: </span><span className="font-medium">{pkg.polybag.type}</span></div>
                  <div><span className="text-muted-foreground">Finish: </span><span className="font-medium">{pkg.polybag.printed ? "Printed" : "Plain"}</span></div>
                  {pkg.polybag.thickness_microns && <div><span className="text-muted-foreground">Thickness: </span><span className="font-medium">{pkg.polybag.thickness_microns} microns</span></div>}
                  {pkg.polybag.size_cm && <div><span className="text-muted-foreground">Size: </span><span className="font-medium">{pkg.polybag.size_cm}</span></div>}
                  {pkg.polybag.supplier && <div><span className="text-muted-foreground">Supplier: </span><span className="font-medium">{pkg.polybag.supplier}</span></div>}
                  {pkg.polybag.unit_cost && <div><span className="text-muted-foreground">Cost: </span><span className="font-medium">${pkg.polybag.unit_cost}</span></div>}
                </div>
              </div>
            )}

            {/* Stiffener */}
            {pkg.stiffener?.used && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stiffener</span>
                </div>
                <div className="bg-muted/40 rounded p-2 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {pkg.stiffener.material && <div><span className="text-muted-foreground">Material: </span><span className="font-medium">{pkg.stiffener.material}</span></div>}
                  {pkg.stiffener.size_cm && <div><span className="text-muted-foreground">Size: </span><span className="font-medium">{pkg.stiffener.size_cm}</span></div>}
                  {pkg.stiffener.supplier && <div><span className="text-muted-foreground">Supplier: </span><span className="font-medium">{pkg.stiffener.supplier}</span></div>}
                </div>
              </div>
            )}

            {/* Carton */}
            {pkg.carton?.size_cm && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Box className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carton</span>
                </div>
                <div className="bg-muted/40 rounded p-2 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {pkg.carton.type && <div><span className="text-muted-foreground">Type: </span><span className="font-medium">{pkg.carton.type}</span></div>}
                  {pkg.carton.quality && <div><span className="text-muted-foreground">Quality: </span><span className="font-medium">{pkg.carton.quality}</span></div>}
                  <div><span className="text-muted-foreground">Size: </span><span className="font-medium">{pkg.carton.size_cm}</span></div>
                  {pkg.carton.pieces_per_carton && <div><span className="text-muted-foreground">Pcs/Ctn: </span><span className="font-medium">{pkg.carton.pieces_per_carton}</span></div>}
                  {pkg.carton.cbm_per_carton && <div><span className="text-muted-foreground">CBM/Ctn: </span><span className="font-medium">{pkg.carton.cbm_per_carton}</span></div>}
                  {pkg.carton.gross_weight_kg && <div><span className="text-muted-foreground">Gross Wt: </span><span className="font-medium">{pkg.carton.gross_weight_kg} kg</span></div>}
                </div>
              </div>
            )}

            {/* Stickers */}
            {stickerCount > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stickers ({stickerCount})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pkg.stickers.map((s, i) => (
                    <div key={i} className="bg-muted/40 rounded p-2 text-xs">
                      <div className="font-medium">{s.sticker_type}</div>
                      {s.description && <div className="text-muted-foreground">{s.description}</div>}
                      {(s.supplier || s.unit_cost) && (
                        <div className="flex gap-3 mt-1 text-muted-foreground">
                          {s.supplier && <span>Supplier: {s.supplier}</span>}
                          {s.unit_cost && <span>Cost: ${s.unit_cost}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other */}
            {otherCount > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Other Accessories ({otherCount})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pkg.other_accessories.map((o, i) => (
                    <div key={i} className="bg-muted/40 rounded p-2 text-xs">
                      <div className="font-medium">{o.name}</div>
                      {o.description && <div className="text-muted-foreground">{o.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pkg.notes && <div className="text-xs text-muted-foreground italic border-t pt-2">Notes: {pkg.notes}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}