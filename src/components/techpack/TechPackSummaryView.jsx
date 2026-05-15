import React from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TH = ({ children, center }) => (
  <th className={`border border-gray-400 bg-gray-100 px-2 py-1.5 text-[11px] font-bold text-gray-700 whitespace-nowrap ${center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

const TD = ({ children, center, bold, mono, span }) => (
  <td
    colSpan={span}
    className={`border border-gray-300 px-2 py-1.5 text-xs text-gray-800 ${center ? "text-center" : ""} ${bold ? "font-semibold" : ""} ${mono ? "font-mono" : ""}`}
  >
    {children ?? "—"}
  </td>
);

const SectionHeader = ({ color, children }) => (
  <tr>
    <td colSpan={99} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: color }}>
      {children}
    </td>
  </tr>
);

const LabelValue = ({ label, value, span }) => (
  <td colSpan={span} className="border border-gray-300 px-0">
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase text-gray-400 px-2 pt-1">{label}</span>
      <span className="text-xs font-medium text-gray-800 px-2 pb-1">{value || "—"}</span>
    </div>
  </td>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function TechPackSummaryView({ extractedData }) {
  if (!extractedData) return (
    <div className="py-16 text-center text-gray-400 text-sm">No extracted data available.</div>
  );

  const {
    article = {},
    fabric_components = [],
    stitching = [],
    accessories = [],
    packaging = {},
  } = extractedData;

  const labels     = packaging?.labels     || [];
  const stickers   = packaging?.stickers   || [];
  const polybag    = packaging?.polybag    || null;
  const stiffener  = packaging?.stiffener  || null;
  const carton     = packaging?.carton     || null;
  const insert_card= packaging?.insert_card|| null;

  // Separate trims from accessories
  const PACKAGING_CATS = new Set(["Label", "Polybag", "Stiffener", "Carton", "Sticker", "Insert Card"]);
  const trims = accessories.filter(a => !PACKAGING_CATS.has(a.category));

  return (
    <div className="space-y-0 font-sans text-xs print:text-[10px]">

      {/* ── HEADER BLOCK ────────────────────────────────────────────────── */}
      <div className="border-2 border-gray-700 rounded-t-lg overflow-hidden">
        {/* Company banner */}
        <div className="bg-[#1F3864] px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-white text-lg font-extrabold tracking-wide leading-tight">TECH PACK</div>
            <div className="text-blue-200 text-[10px] font-medium uppercase tracking-widest">Production Specification Sheet</div>
          </div>
          <div className="text-right">
            <div className="text-blue-100 text-[10px]">Status</div>
            <div className="text-white font-bold text-sm bg-blue-600 px-3 py-0.5 rounded-full mt-0.5">DRAFT</div>
          </div>
        </div>

        {/* Article info grid */}
        <table className="w-full border-collapse">
          <tbody>
            <tr className="bg-gray-50">
              <LabelValue label="Article Name" value={article.article_name} span={3} />
              <LabelValue label="Article Code / SKU" value={article.article_code} />
              <LabelValue label="Customer / Brand" value={article.customer_name} />
            </tr>
            <tr>
              <LabelValue label="Size" value={article.size_label} />
              <LabelValue label="Color" value={article.color} />
              <LabelValue label="Product Category" value={article.description} />
              <LabelValue label="Finish Dimensions" value={article.finish_dimensions} />
              <LabelValue label="Order Quantity" value={article.order_quantity != null ? Number(article.order_quantity).toLocaleString() + " pcs" : null} />
            </tr>
            <tr className="bg-gray-50">
              <LabelValue label="Tech Pack Code" value={article.tech_pack_code} />
              <LabelValue label="BOB SKU" value={article.bob_sku} />
              <LabelValue label="Price (USD)" value={article.price_usd != null ? `$${article.price_usd}` : null} />
              <LabelValue label="Units / Carton" value={article.units_per_carton} />
              <LabelValue label="Item Description" value={article.item_description} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FABRIC / BOM ─────────────────────────────────────────────────── */}
      <div className="border-2 border-t-0 border-gray-700">
        <div className="bg-[#2E4A7A] px-3 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide">
          1. Fabric Bill of Materials (BOM)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Component</TH>
                <TH>Product Size</TH>
                <TH>Direction</TH>
                <TH>Fabric Type</TH>
                <TH>Composition</TH>
                <TH center>GSM</TH>
                <TH center>Width (cm)</TH>
                <TH>Construction / Finish</TH>
                <TH center>Consumption/Unit (m)</TH>
                <TH center>Wastage %</TH>
                <TH>Remarks</TH>
              </tr>
            </thead>
            <tbody>
              {fabric_components.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-4 text-gray-400 italic border border-gray-200">No fabric components extracted</td></tr>
              ) : (
                fabric_components.map((f, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                    <TD center bold>{i + 1}</TD>
                    <TD bold>{f.component_type}</TD>
                    <TD>{f.product_size}</TD>
                    <TD center>{f.direction}</TD>
                    <TD>{f.fabric_type}</TD>
                    <TD>{f.composition}</TD>
                    <TD center bold>{f.gsm}</TD>
                    <TD center>{f.width}</TD>
                    <TD>{[f.construction, f.finish].filter(Boolean).join(" + ") || null}</TD>
                    <TD center bold mono>{f.consumption_per_unit}</TD>
                    <TD center>{f.wastage_percent != null ? `${f.wastage_percent}%` : null}</TD>
                    <TD>{f.notes}</TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TRIMS ────────────────────────────────────────────────────────── */}
      <div className="border-2 border-t-0 border-gray-700">
        <div className="bg-[#4A6741] px-3 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide">
          2. Trims &amp; Hardware
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Category</TH>
                <TH>Item Description</TH>
                <TH>Material / Spec</TH>
                <TH>Size / Spec</TH>
                <TH>Color</TH>
                <TH center>Qty / Pc</TH>
                <TH>Unit</TH>
                <TH>Placement</TH>
                <TH center>Wastage %</TH>
                <TH>Supplier</TH>
              </tr>
            </thead>
            <tbody>
              {trims.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-4 text-gray-400 italic border border-gray-200">No trim items extracted</td></tr>
              ) : (
                trims.map((a, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-green-50/30"}>
                    <TD center bold>{i + 1}</TD>
                    <TD bold>{a.category}</TD>
                    <TD>{a.item_description}</TD>
                    <TD>{a.material}</TD>
                    <TD>{a.size_spec}</TD>
                    <TD>{a.color}</TD>
                    <TD center mono>{a.consumption_per_unit ?? a.quantity_per_piece}</TD>
                    <TD>{a.unit}</TD>
                    <TD>{a.placement}</TD>
                    <TD center>{a.wastage_percent != null ? `${a.wastage_percent}%` : null}</TD>
                    <TD>{a.supplier}</TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PACKAGING ────────────────────────────────────────────────────── */}
      <div className="border-2 border-t-0 border-gray-700">
        <div className="bg-[#6B4F2E] px-3 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide">
          3. Packaging Specifications
        </div>

        {/* Labels table */}
        <div className="border-b border-gray-300">
          <div className="px-3 py-1 bg-amber-50 text-[10px] font-bold uppercase text-amber-800 border-b border-amber-200">
            3a. Labels ({labels.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <TH>#</TH>
                  <TH>Label Type</TH>
                  <TH>Description / Content</TH>
                  <TH>Material</TH>
                  <TH>Size (cm)</TH>
                  <TH>Color</TH>
                  <TH>Placement</TH>
                  <TH center>Qty/Pc</TH>
                </tr>
              </thead>
              <tbody>
                {labels.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-3 text-gray-400 italic border border-gray-200">No labels extracted</td></tr>
                ) : (
                  labels.map((l, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}>
                      <TD center bold>{i + 1}</TD>
                      <TD bold>{l.label_type || l.type}</TD>
                      <TD>{l.description}</TD>
                      <TD>{l.material}</TD>
                      <TD>{l.size_cm || l.size_spec}</TD>
                      <TD>{l.color}</TD>
                      <TD>{l.placement}</TD>
                      <TD center>1</TD>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Polybag / Stiffener / Insert Card / Carton in 2-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-300">

          {/* Polybag */}
          <div className="border-r border-gray-300">
            <div className="px-3 py-1 bg-sky-50 text-[10px] font-bold uppercase text-sky-800 border-b border-sky-200">3b. Polybag</div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 w-1/3">Type</td>
                  <TD bold>{polybag?.type || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Size (cm)</td>
                  <TD mono>{polybag?.size_cm || "—"}</TD>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Thickness</td>
                  <TD>{polybag?.thickness_microns ? `${polybag.thickness_microns} microns` : "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-2 py-1 text-[10px] font-semibold text-gray-500">Printed</td>
                  <TD>{polybag?.printed != null ? (polybag.printed ? "Yes" : "No") : "—"}</TD>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Stiffener */}
          <div>
            <div className="px-3 py-1 bg-purple-50 text-[10px] font-bold uppercase text-purple-800 border-b border-purple-200">3c. Stiffener / Board</div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 w-1/3">Used</td>
                  <TD bold>{stiffener ? (stiffener.used ? "Yes" : "No") : "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Material</td>
                  <TD>{stiffener?.material || "—"}</TD>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Size (cm)</td>
                  <TD mono>{stiffener?.size_cm || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-2 py-1 text-[10px] font-semibold text-gray-500">Notes</td>
                  <TD>{stiffener?.notes || "—"}</TD>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* Insert / Inlay Card */}
          <div className="border-r border-gray-300">
            <div className="px-3 py-1 bg-green-50 text-[10px] font-bold uppercase text-green-800 border-b border-green-200">3d. Insert / Inlay Card</div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 w-1/3">Description</td>
                  <TD>{insert_card?.description || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Material</td>
                  <TD>{insert_card?.material || "—"}</TD>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Size (cm)</td>
                  <TD mono>{insert_card?.size_cm || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-2 py-1 text-[10px] font-semibold text-gray-500">Notes</td>
                  <TD>{insert_card?.notes || "—"}</TD>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Carton */}
          <div>
            <div className="px-3 py-1 bg-orange-50 text-[10px] font-bold uppercase text-orange-800 border-b border-orange-200">3e. Master Carton</div>
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 w-1/3">Type</td>
                  <TD bold>{carton?.type || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Quality</td>
                  <TD>{carton?.quality || "—"}</TD>
                </tr>
                <tr>
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Size (L×W×H cm)</td>
                  <TD mono bold>{carton?.size_cm || "—"}</TD>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500">Pcs / Carton</td>
                  <TD center bold>{carton?.pieces_per_carton ?? "—"}</TD>
                </tr>
                <tr>
                  <td className="px-2 py-1 text-[10px] font-semibold text-gray-500">CBM / Carton</td>
                  <TD center mono>{carton?.cbm_per_carton ?? "—"}</TD>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Stickers */}
        {stickers.length > 0 && (
          <div className="border-t border-gray-300">
            <div className="px-3 py-1 bg-gray-100 text-[10px] font-bold uppercase text-gray-600 border-b border-gray-200">3f. Stickers / Barcodes ({stickers.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr><TH>#</TH><TH>Sticker Type</TH><TH>Description</TH></tr>
                </thead>
                <tbody>
                  {stickers.map((s, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TD center>{i + 1}</TD>
                      <TD bold>{s.sticker_type}</TD>
                      <TD>{s.description}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── STITCHING ────────────────────────────────────────────────────── */}
      <div className="border-2 border-t-0 border-gray-700 rounded-b-lg overflow-hidden">
        <div className="bg-[#3D5A99] px-3 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide">
          4. Stitching Specifications
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Stitch Type</TH>
                <TH>Thread Type</TH>
                <TH>Thread Count</TH>
                <TH>Color</TH>
                <TH>SPI</TH>
                <TH>Location / Area</TH>
                <TH>Notes</TH>
              </tr>
            </thead>
            <tbody>
              {stitching.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-4 text-gray-400 italic border border-gray-200">No stitching details extracted</td></tr>
              ) : (
                stitching.map((s, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}>
                    <TD center bold>{i + 1}</TD>
                    <TD bold>{s.stitch_type}</TD>
                    <TD>{s.thread_type}</TD>
                    <TD center>{s.thread_count}</TD>
                    <TD>{s.color}</TD>
                    <TD center>{s.spi}</TD>
                    <TD>{s.location}</TD>
                    <TD>{s.notes}</TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex justify-between items-center text-[10px] text-gray-400">
          <span>Auto-generated by TextilePro Tech Pack Module</span>
          <span>{fabric_components.length} fabrics · {trims.length} trims · {labels.length} labels · {stitching.length} stitching entries</span>
        </div>
      </div>
    </div>
  );
}