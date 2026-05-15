import React from "react";
import { Package, Layers, Tag, Box, FileText, User, Ruler, Palette, Hash } from "lucide-react";

const Section = ({ icon: IconComp, title, color, children }) => (
  <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
    <div className="px-4 py-2.5 text-white text-sm font-semibold flex items-center gap-2" style={{ backgroundColor: color }}>
      <IconComp className="h-4 w-4" />
      {title}
    </div>
    <div className="p-4 bg-white">{children}</div>
  </div>
);

const Field = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase text-gray-400">{label}</span>
      <span className="text-xs text-gray-800 font-medium break-words">{String(value)}</span>
    </div>
  );
};

const Badge = ({ text, color = "#1F3864" }) => (
  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
    {text}
  </span>
);

export default function TechPackSummaryView({ extractedData }) {
  if (!extractedData) return (
    <div className="py-16 text-center text-gray-400 text-sm">No extracted data available.</div>
  );

  const { article = {}, fabric_components = [], stitching = [], accessories = [], packaging = {} } = extractedData;

  const labels = packaging?.labels || [];
  const stickers = packaging?.stickers || [];
  const polybag = packaging?.polybag;
  const stiffener = packaging?.stiffener;
  const carton = packaging?.carton;
  const insert_card = packaging?.insert_card;

  // Group accessories by category
  const accByCategory = accessories.reduce((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Article Header Card */}
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{article.article_name || <span className="text-gray-400 italic">No Article Name</span>}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {article.article_code && <Badge text={`SKU: ${article.article_code}`} color="#1F3864" />}
              {article.size_label && <Badge text={article.size_label} color="#374151" />}
              {article.color && <Badge text={article.color} color="#6B7280" />}
              {article.customer_name && <Badge text={article.customer_name} color="#2563EB" />}
            </div>
            {article.description && (
              <p className="text-xs text-gray-500 mt-2 max-w-xl">{article.description}</p>
            )}
          </div>
          {article.order_quantity != null && (
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-700">{Number(article.order_quantity).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 uppercase font-semibold">Order Qty</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Fabric Components", count: fabric_components.length, color: "#2E4A7A" },
          { label: "Stitching Entries", count: stitching.length, color: "#3D5A99" },
          { label: "Accessories / Trims", count: accessories.length, color: "#4A6741" },
          { label: "Packaging Items", count: labels.length + stickers.length + (polybag ? 1 : 0) + (carton ? 1 : 0) + (stiffener?.used ? 1 : 0) + (insert_card?.used ? 1 : 0), color: "#6B4F2E" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3 bg-white shadow-sm">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[11px] text-gray-500 font-medium leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Fabric Components */}
      {fabric_components.length > 0 && (
        <Section icon={Layers} title="Fabric / BOM Components" color="#2E4A7A">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-50">
                  {["Component", "Fabric Type / Description", "Composition", "GSM", "Width", "Construction", "Consumption/Unit", "Wastage %"].map(h => (
                    <th key={h} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fabric_components.map((f, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800">{f.component_type || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-gray-600 max-w-xs">{f.fabric_type || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-gray-600">{f.composition || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center font-medium text-blue-700">{f.gsm ?? "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{f.width ?? "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{f.construction || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{f.consumption_per_unit ?? "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-center">{f.wastage_percent != null ? `${f.wastage_percent}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fabric_components.some(f => f.finish || f.notes) && (
            <div className="mt-3 space-y-1">
              {fabric_components.filter(f => f.finish || f.notes).map((f, i) => (
                <div key={i} className="text-[10px] bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800">
                  <span className="font-bold">{f.component_type}:</span> {f.finish || f.notes}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Accessories & Trims */}
      {accessories.length > 0 && (
        <Section icon={Tag} title="Accessories / Trims" color="#4A6741">
          <div className="space-y-3">
            {Object.entries(accByCategory).map(([cat, items]) => (
              <div key={cat}>
                <div className="text-[10px] font-bold uppercase text-gray-500 mb-1.5 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
                  {cat} ({items.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-green-50">
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Description</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Color</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Size / Spec</th>
                        <th className="border border-gray-200 px-2 py-1 text-center font-semibold text-gray-600">Qty/Pc</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Placement / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FFF8" }}>
                          <td className="border border-gray-200 px-2 py-1 font-medium text-gray-800">{a.item_description || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{a.color || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{a.size_spec || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-center">{a.quantity_per_piece ?? "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-500 text-[10px]">{a.placement || a.material || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Packaging */}
      {(labels.length > 0 || polybag || stiffener?.used || carton || insert_card?.used || stickers.length > 0) && (
        <Section icon={Box} title="Packaging Details" color="#6B4F2E">
          <div className="space-y-4">

            {/* Labels */}
            {labels.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Labels ({labels.length})</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-50">
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Label Type</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Description</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Size</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Material</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Color</th>
                        <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">Placement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labels.map((l, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#FFFBF5" }}>
                          <td className="border border-gray-200 px-2 py-1 font-medium text-gray-800">{l.label_type || l.type || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{l.description || l.section || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{l.size_cm || l.size_spec || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{l.material || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-600">{l.color || "—"}</td>
                          <td className="border border-gray-200 px-2 py-1 text-gray-500 text-[10px]">{l.placement || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Polybag, Stiffener, Insert Card, Carton inline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {polybag && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Polybag</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Type" value={polybag.type} />
                    <Field label="Size" value={polybag.size_cm} />
                    <Field label="Thickness" value={polybag.thickness_microns ? `${polybag.thickness_microns} microns` : null} />
                    <Field label="Printed" value={polybag.printed != null ? (polybag.printed ? "Yes" : "No") : null} />
                  </div>
                </div>
              )}
              {stiffener?.used && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Stiffener</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Material" value={stiffener.material} />
                    <Field label="Size" value={stiffener.size_cm} />
                  </div>
                </div>
              )}
              {insert_card?.used && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Insert / Inlay Card</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Description" value={insert_card.description} />
                    <Field label="Size" value={insert_card.size_cm} />
                  </div>
                </div>
              )}
              {carton && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Carton</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Type" value={carton.type} />
                    <Field label="Quality" value={carton.quality} />
                    <Field label="Size (LxWxH cm)" value={carton.size_cm} />
                    <Field label="Pcs / Carton" value={carton.pieces_per_carton} />
                    <Field label="CBM / Carton" value={carton.cbm_per_carton} />
                  </div>
                </div>
              )}
            </div>

            {/* Stickers */}
            {stickers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Stickers ({stickers.length})</p>
                <div className="flex flex-wrap gap-2">
                  {stickers.map((s, i) => (
                    <div key={i} className="border border-gray-200 rounded px-3 py-1.5 bg-gray-50 text-xs">
                      <span className="font-medium text-gray-800">{s.sticker_type || "Sticker"}</span>
                      {s.description && <span className="text-gray-400 ml-1">— {s.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Stitching */}
      {stitching.length > 0 && (
        <Section icon={FileText} title="Stitching Details" color="#3D5A99">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-50">
                  {["Stitch Type", "Thread Type", "Thread Count", "Color", "Location"].map(h => (
                    <th key={h} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stitching.map((s, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFF" }}>
                    <td className="border border-gray-200 px-2 py-1.5">{s.stitch_type || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{s.thread_type || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{s.thread_count || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{s.color || "—"}</td>
                    <td className="border border-gray-200 px-2 py-1.5">{s.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Empty state */}
      {fabric_components.length === 0 && accessories.length === 0 && labels.length === 0 && (
        <div className="py-10 text-center text-gray-400 text-sm italic">
          No structured data was extracted. Try the "Full Review & Save" tab to manually enter data.
        </div>
      )}
    </div>
  );
}