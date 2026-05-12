import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Loader2, FileSpreadsheet, ChevronDown, ChevronUp, Info, AlertTriangle } from "lucide-react";

/**
 * SmartExcelImport — parses the structured BOB master-data Excel format.
 *
 * Expected sheets (matched by keyword, order-independent):
 *   "1. Articles (SKUs)"               → item master
 *   "2. SKU Fabric Consumption"        → fabric components per SKU
 *   "3. SKU Accessory Consumption"     → accessories / packaging per SKU
 *   "4. Carton Master"                 → carton dims & CBM per SKU
 *   "5. Price List"                    → USD prices per SKU
 *
 * Syncs to:
 *   TechPackRecord, Article, FabricTemplate, PriceList,
 *   ArticlePackaging, AccessoryItem, POItem (when PO selected)
 */

// ── Utilities ────────────────────────────────────────────────────────────────

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function sheetToObjects(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  return rows
    .map(row => {
      const out = {};
      Object.entries(row).forEach(([k, v]) => {
        out[normalizeHeader(k)] = v === "" ? null : v;
      });
      return out;
    })
    .filter(r => Object.values(r).some(v => v !== null && v !== undefined));
}

// Find a sheet — matches by ALL keywords in a group (case-insensitive substring)
function findSheet(wb, ...keywordGroups) {
  const names = wb.SheetNames;
  for (const keywords of keywordGroups) {
    for (const name of names) {
      const lower = name.toLowerCase();
      if (keywords.every(kw => lower.includes(kw))) return wb.Sheets[name];
    }
  }
  return null;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

// Get first non-null value by trying multiple normalized key names
function get(row, ...keys) {
  if (!row) return null;
  for (const k of keys) {
    const nk = normalizeHeader(k);
    if (row[nk] !== undefined && row[nk] !== null && row[nk] !== "") return row[nk];
  }
  return null;
}

// Map raw category string to AccessoryItem.category enum
function mapAccessoryCategory(cat, itemName) {
  const c = String(cat ?? "").toLowerCase().trim();
  const n = String(itemName ?? "").toLowerCase().trim();
  if (c === "label" || n.includes("label") || n.includes("law tag") || n.includes("hang tag") || n.includes("care")) return "Label";
  if (c === "sticker" || n.includes("sticker") || n.includes("upc") || n.includes("barcode")) return "Sticker";
  if (c === "polybag" || n.includes("polybag") || n.includes("poly bag") || n.includes("bag material")) return "Polybag";
  if (c === "packaging" || n.includes("packaging type") || n.includes("stiffener") || n.includes("board insert") || n.includes("insert card")) return "Stiffener";
  if (c === "carton" || n.includes("carton") || n.includes("master box") || n.includes("printed box")) return "Carton";
  if (n.includes("zipper") || n.includes("zip")) return "Zipper";
  if (n.includes("elastic")) return "Elastic";
  if (n.includes("dori") || n.includes("drawstring") || n.includes("cord")) return "Dori";
  if (n.includes("button") || n.includes("snap")) return "Button";
  if (n.includes("eyelet") || n.includes("grommet")) return "Eyelet";
  if (n.includes("thread") || n.includes("sewing")) return "Stitching Thread";
  return "Accessory";
}

// Map polybag type from material string
function mapPolybagType(material) {
  const m = String(material ?? "").toLowerCase();
  if (m.includes("opp")) return "OPP";
  if (m.includes("pp") && !m.includes("pvc")) return "PP";
  if (m.includes("pvc")) return "PVC";
  if (m.includes("ldpe")) return "LDPE";
  return "PE";
}

// Build lookup map: normalized item_code → array of rows
function buildLookup(rows, ...keyFields) {
  const map = {};
  rows.forEach(r => {
    for (const kf of keyFields) {
      const code = String(get(r, kf, "item_code", "itemcode") ?? "").trim().toUpperCase();
      if (code) {
        if (!map[code]) map[code] = [];
        map[code].push(r);
        break;
      }
    }
  });
  return map;
}

function lookupRows(map, code) {
  if (!code) return [];
  return map[code.toUpperCase()] || [];
}

function lookupRow(map, code) {
  return lookupRows(map, code)[0] || null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SmartExcelImport({ pos = [], selectedPoId, onSaved, onClose }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [saved, setSaved] = useState([]);
  const [errors, setErrors] = useState([]);
  const [expandedSku, setExpandedSku] = useState(null);
  const [localPoId, setLocalPoId] = useState(selectedPoId || "");
  const [sheetDebug, setSheetDebug] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(null); setSaved([]); setErrors([]); setSheetDebug(null); }
  };

  // ── Parse Excel → in-memory preview records ──────────────────────────────
  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setErrors([]);
    setSheetDebug(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });

      // Sheet discovery — numbered prefix format: "1. Articles (SKUs)", etc.
      const articleSheet  = findSheet(wb, ["article", "sku"], ["articles"], ["sku"]);
      const fabricSheet   = findSheet(wb, ["fabric", "consumption"], ["fabric"]);
      const accessorySheet= findSheet(wb, ["accessory", "consumption"], ["accessory"], ["trim", "consumption"], ["trim"]);
      const cartonSheet   = findSheet(wb, ["carton"]);
      const priceSheet    = findSheet(wb, ["price"]);

      const debug = {
        sheets: wb.SheetNames,
        matched: {
          articles:  wb.SheetNames.find(n => wb.Sheets[n] === articleSheet)  || "NOT FOUND",
          fabric:    wb.SheetNames.find(n => wb.Sheets[n] === fabricSheet)   || "NOT FOUND",
          accessory: wb.SheetNames.find(n => wb.Sheets[n] === accessorySheet)|| "NOT FOUND",
          carton:    wb.SheetNames.find(n => wb.Sheets[n] === cartonSheet)   || "NOT FOUND",
          price:     wb.SheetNames.find(n => wb.Sheets[n] === priceSheet)    || "NOT FOUND",
        }
      };
      setSheetDebug(debug);

      if (!articleSheet) {
        setErrors(["Could not find Articles/SKUs sheet. Sheets: " + wb.SheetNames.join(", ")]);
        setParsing(false);
        return;
      }

      const articles    = sheetToObjects(articleSheet);
      const fabrics     = fabricSheet    ? sheetToObjects(fabricSheet)    : [];
      const accessories = accessorySheet ? sheetToObjects(accessorySheet) : [];
      const cartons     = cartonSheet    ? sheetToObjects(cartonSheet)    : [];
      const prices      = priceSheet     ? sheetToObjects(priceSheet)     : [];

      // Build lookup maps
      const fabricMap    = buildLookup(fabrics,     "item_code");
      const accessoryMap = buildLookup(accessories, "item_code");
      const cartonMap    = buildLookup(cartons,     "item_code");
      const priceMap     = buildLookup(prices,      "item_code");

      const records = articles
        .map(art => {
          const itemCode   = String(get(art, "item_code", "itemcode", "sku") ?? "").trim();
          if (!itemCode) return null;

          const brand       = String(get(art, "brand", "customer", "buyer") ?? "").trim();
          const productType = String(get(art, "product_type", "product_category", "description") ?? "").trim();
          const size        = String(get(art, "size", "size_label") ?? "").trim();
          const color       = String(get(art, "color", "colour") ?? "White").trim();
          const techPackCode= get(art, "tech_pack_code", "techpackcode") ?? "";
          const unitsPerCarton = parseNumber(get(art, "units_per_carton", "pcs_per_carton", "qty_per_carton"));
          const cartonSizeRaw  = get(art, "carton_size_cm", "carton_size") ?? "";
          const pvcBagDimensions = get(art, "pvc_bag_dimensions") ?? "";
          const stiffenerSize    = get(art, "stiffener_size") ?? "";
          const inlayCardDims    = get(art, "inlay_card_dimensions") ?? "";

          const articleName = `${brand} ${productType}`.trim();

          // ── Fabric components ──────────────────────────────────────────────
          const fabricRows = lookupRows(fabricMap, itemCode);
          const fabric_components = fabricRows.map(f => ({
            component_type:      get(f, "component_type", "component", "panel") ?? "",
            product_size:        get(f, "product_size", "dimensions") ?? "",
            direction:           get(f, "direction", "knitting_direction") ?? "",
            fabric_type:         get(f, "fabric_type", "construction") ?? "",
            gsm:                 parseNumber(get(f, "gsm", "grams")),
            width:               parseNumber(get(f, "width_cm", "width_in", "width")),
            composition:         get(f, "composition", "fiber_content") ?? "",
            consumption_per_unit:parseNumber(get(f, "consumption_per_unit", "consumption")),
            wastage_percent:     parseNumber(get(f, "wastage_percent", "wastage")),
            construction:        get(f, "construction") ?? "",
            yarn_count:          get(f, "yarn_count") ?? "",
            finish:              get(f, "finish") ?? "",
          }));

          // ── Accessory & packaging rows ─────────────────────────────────────
          const accRows = lookupRows(accessoryMap, itemCode);

          // Separate into packaging sub-categories vs trims
          const labelRows   = accRows.filter(a => String(get(a, "category") ?? "").toLowerCase() === "label");
          const stickerRows = accRows.filter(a => {
            const cat = String(get(a, "category") ?? "").toLowerCase();
            const nm  = String(get(a, "item_name") ?? "").toLowerCase();
            return cat === "sticker" || nm.includes("sticker") || nm.includes("upc");
          });
          const polyRow  = accRows.find(a => {
            const cat = String(get(a, "category") ?? "").toLowerCase();
            const nm  = String(get(a, "item_name") ?? "").toLowerCase();
            return cat === "polybag" || nm.includes("polybag") || nm.includes("poly bag") || nm.includes("bag material");
          });
          const stiffRow = accRows.find(a => {
            const cat = String(get(a, "category") ?? "").toLowerCase();
            const nm  = String(get(a, "item_name") ?? "").toLowerCase();
            return nm.includes("stiffener") || nm.includes("cardboard") || cat === "packaging";
          });

          // All rows become AccessoryItem records (including packaging rows)
          const accessories_list = accRows.map(a => {
            const catRaw  = get(a, "category") ?? "";
            const itemName= get(a, "item_name", "name", "description") ?? "";
            const material= get(a, "material") ?? "";
            return {
              category:         mapAccessoryCategory(catRaw, itemName),
              item_description: [itemName, material].filter(Boolean).join(" — "),
              color:            get(a, "color", "colour") ?? "",
              size_spec:        get(a, "size_spec", "size") ?? "",
              quantity_per_piece: parseNumber(get(a, "consumption_per_unit", "qty_per_piece")) ?? 1,
              unit:             get(a, "unit") ?? "Pcs",
              placement:        get(a, "placement") ?? "",
              wastage_percent:  parseNumber(get(a, "wastage_percent")) ?? 2,
            };
          });

          // ── Carton data ────────────────────────────────────────────────────
          const cartonRow    = lookupRow(cartonMap, itemCode) || {};
          const cartonLength = parseNumber(get(cartonRow, "carton_length_cm", "length_cm", "length"));
          const cartonWidth  = parseNumber(get(cartonRow, "carton_width_cm",  "width_cm"));
          const cartonHeight = parseNumber(get(cartonRow, "carton_height_cm", "height_cm"));
          const cbmPerCarton = parseNumber(get(cartonRow, "cbm_per_carton", "cbm"));
          const cartonUnits  = parseNumber(get(cartonRow, "units_per_carton", "qty_per_carton")) ?? unitsPerCarton;
          const cartonSizeFinal = get(cartonRow, "carton_size_cm") ?? cartonSizeRaw ?? "";

          // ── Price data ─────────────────────────────────────────────────────
          const priceRow       = lookupRow(priceMap, itemCode);
          const priceUsd       = parseNumber(get(priceRow, "price_usd", "unit_price", "price"));
          const refCbm         = parseNumber(get(priceRow, "cbm_per_carton", "cbm")) ?? cbmPerCarton;
          const refQtyPerCtn   = parseNumber(get(priceRow, "pieces_per_carton", "qty_per_carton", "units_per_carton")) ?? cartonUnits;
          const itemDescription= get(priceRow, "item_description", "description") ?? `${brand} ${productType} ${size}`.trim();
          const priceLengthCm  = parseNumber(get(priceRow, "carton_length_cm")) ?? cartonLength;
          const priceWidthCm   = parseNumber(get(priceRow, "carton_width_cm"))  ?? cartonWidth;
          const priceHeightCm  = parseNumber(get(priceRow, "carton_height_cm")) ?? cartonHeight;

          // ── Packaging object ───────────────────────────────────────────────
          const packaging = {
            labels: labelRows.map(l => ({
              label_type:  get(l, "item_name") ?? "Label",
              description: get(l, "material") ?? "",
              size_spec:   get(l, "size_spec") ?? "",
              placement:   get(l, "placement") ?? "",
            })),
            polybag: polyRow ? {
              type:               mapPolybagType(get(polyRow, "material")),
              size_cm:            get(polyRow, "size_spec") ?? pvcBagDimensions ?? "",
              thickness_microns:  null,
              printed:            String(get(polyRow, "material") ?? "").toLowerCase().includes("print"),
            } : (pvcBagDimensions ? { type: "PE", size_cm: pvcBagDimensions, thickness_microns: null, printed: false } : null),
            stiffener: stiffRow ? {
              used:     true,
              material: get(stiffRow, "material") ?? "Cardboard",
              size_cm:  get(stiffRow, "size_spec") ?? stiffenerSize ?? "",
            } : (stiffenerSize ? { used: true, material: "Cardboard", size_cm: stiffenerSize } : null),
            carton: {
              type:             "Printed",
              quality:          "",
              size_cm:          cartonSizeFinal,
              pieces_per_carton: cartonUnits ?? null,
              length_cm:        cartonLength,
              width_cm:         cartonWidth,
              height_cm:        cartonHeight,
              cbm_per_carton:   cbmPerCarton,
            },
            stickers: stickerRows.map(s => ({
              sticker_type: get(s, "item_name") ?? "Sticker",
              description:  get(s, "material") ?? "",
            })),
          };

          return {
            article_name:  articleName,
            article_code:  itemCode,
            customer_name: brand,
            size_label:    size,
            color,
            tech_pack_code: techPackCode,
            file_name:     file.name,
            file_url:      null,
            version:       1,
            status:        "Draft",
            po_id:         localPoId || null,
            po_number:     pos.find(p => p.id === localPoId)?.po_number ?? null,
            extracted_data: {
              article: {
                article_name:     articleName,
                article_code:     itemCode,
                size_label:       size,
                color,
                description:      productType,
                order_quantity:   parseNumber(get(art, "order_quantity")) ?? null,
                price_usd:        priceUsd,
                tech_pack_code:   techPackCode,
                item_description: itemDescription,
              },
              fabric_components,
              stitching: [],
              accessories: accessories_list,
              packaging,
              // Saved for PriceList + POItem sync
              price_list: {
                item_code:        itemCode,
                item_description: itemDescription,
                price_usd:        priceUsd,
                qty_per_carton:   refQtyPerCtn,
                cbm_per_carton:   refCbm,
                carton_length_cm: priceLengthCm,
                carton_width_cm:  priceWidthCm,
                carton_height_cm: priceHeightCm,
                article:          articleName,
                size:             size,
              },
            },
          };
        })
        .filter(Boolean);

      setPreview(records);
    } catch (err) {
      setErrors([`Parse error: ${err.message}`]);
    }
    setParsing(false);
  };

  // ── Save / Sync all modules ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!preview?.length) return;
    setSaving(true);
    setSaveProgress("Loading existing records…");
    const savedList  = [];
    const errorList  = [];
    const poRecord   = pos.find(p => p.id === localPoId);
    const poNum      = poRecord?.po_number || "";

    try {
      // Step 1 — Bulk pre-load all existing records
      setSaveProgress("Fetching existing data from all modules…");
      const [existingTPs, existingArticles, existingTemplates, existingPriceLists, existingPackaging, existingPOItems] = await Promise.all([
        base44.entities.TechPackRecord.list("-created_date", 1000),
        base44.entities.Article.list("-created_date", 1000),
        base44.entities.FabricTemplate.list("-created_date", 1000),
        base44.entities.PriceList.list("-created_date", 1000),
        base44.entities.ArticlePackaging.list("-created_date", 1000),
        localPoId ? base44.entities.POItem.filter({ po_id: localPoId }, "-created_date", 500) : Promise.resolve([]),
      ]);

      // Build lookup maps
      const tpMap  = {};  existingTPs.forEach(r => { if (r.article_code) tpMap[r.article_code.toUpperCase()]  = r; });
      const artMap = {};  existingArticles.forEach(r => { if (r.article_code) artMap[r.article_code.toUpperCase()] = r; });
      const tplMap = {};  existingTemplates.forEach(r => { if (r.article_code) tplMap[r.article_code.toUpperCase()] = r; });
      const plMap  = {};  existingPriceLists.forEach(r => { if (r.item_code) plMap[r.item_code.toUpperCase()] = r; });
      const apMap  = {};  existingPackaging.forEach(r => { if (r.article_code) apMap[r.article_code.toUpperCase()] = r; });
      const poItemMap = {}; existingPOItems.forEach(r => { if (r.item_code) poItemMap[r.item_code.toUpperCase()] = r; });

      // Pre-load existing AccessoryItems to enable dedup per article
      // (fetch once per PO or globally if no PO — we delete+recreate per article code)
      const existingAccItems = await base44.entities.AccessoryItem.list("-created_date", 2000);
      const accByArtCode = {};
      existingAccItems.forEach(r => {
        const key = (r.article_code || "").toUpperCase();
        if (!accByArtCode[key]) accByArtCode[key] = [];
        accByArtCode[key].push(r);
      });

      // Step 2 — Process each SKU
      for (let i = 0; i < preview.length; i++) {
        const rec = preview[i];
        setSaveProgress(`Saving SKU ${i + 1}/${preview.length}: ${rec.article_code}…`);
        try {
          const artCode    = rec.article_code;
          const artCodeKey = artCode.toUpperCase();
          const artName    = rec.article_name;
          const custName   = rec.customer_name || poRecord?.customer_name || "";
          const ed         = rec.extracted_data || {};
          const fabricComponents = ed.fabric_components || [];
          const accList    = ed.accessories || [];
          const packaging  = ed.packaging   || {};
          const pl         = ed.price_list  || {};

          const componentData = fabricComponents.map(f => ({
            component_type:       f.component_type || "",
            product_size:         f.product_size || "",
            direction:            f.direction || "",
            fabric_type:          f.fabric_type || "",
            gsm:                  f.gsm ?? null,
            width:                f.width ?? null,
            composition:          f.composition || "",
            consumption_per_unit: f.consumption_per_unit ?? null,
            wastage_percent:      f.wastage_percent ?? null,
            total_required:       null,
          }));

          const ops = [];

          // ── 1. TechPackRecord ──────────────────────────────────────────────
          const existingTP = tpMap[artCodeKey];
          if (existingTP) {
            ops.push(
              base44.entities.TechPackRecord.update(existingTP.id, {
                ...rec,
                version: (existingTP.version || 1) + 1,
                status: "Updated",
              }).then(() => savedList.push({ code: artCode, action: "updated" }))
            );
          } else {
            ops.push(
              base44.entities.TechPackRecord.create(rec)
                .then(() => savedList.push({ code: artCode, action: "created" }))
            );
          }

          // ── 2. Article ─────────────────────────────────────────────────────
          const artData = {
            article_name: artName,
            article_code: artCode,
            customer_name: custName,
            color:         rec.color || "",
            size_label:    rec.size_label || "",
            po_id:         localPoId || null,
            components:    componentData,
          };
          const existingArt = artMap[artCodeKey];
          ops.push(
            existingArt
              ? base44.entities.Article.update(existingArt.id, artData)
              : base44.entities.Article.create(artData)
          );

          // ── 3. FabricTemplate ──────────────────────────────────────────────
          if (fabricComponents.length > 0) {
            const tplData = { article_code: artCode, article_name: artName, components: componentData };
            const existingTpl = tplMap[artCodeKey];
            ops.push(
              existingTpl
                ? base44.entities.FabricTemplate.update(existingTpl.id, tplData)
                : base44.entities.FabricTemplate.create(tplData)
            );
          }

          // ── 4. PriceList ───────────────────────────────────────────────────
          // Always upsert if we have carton data, even if price_usd is null
          if (pl.cbm_per_carton != null || pl.qty_per_carton != null || pl.price_usd != null) {
            const plData = {
              item_code:       artCode,
              article:         pl.item_description || artName,
              size:            pl.size || rec.size_label || "",
              program_code:    rec.tech_pack_code || "",
              price_usd:       pl.price_usd ?? null,
              qty_per_carton:  pl.qty_per_carton ?? null,
              cbm_per_carton:  pl.cbm_per_carton ?? null,
            };
            const existingPl = plMap[artCodeKey];
            ops.push(
              existingPl
                ? base44.entities.PriceList.update(existingPl.id, plData)
                : base44.entities.PriceList.create(plData)
            );
          }

          // ── 5. ArticlePackaging ────────────────────────────────────────────
          if (packaging.labels?.length || packaging.polybag || packaging.carton || packaging.stiffener) {
            const apData = {
              article_name:  artName,
              article_code:  artCode,
              customer_name: custName,
              labels: (packaging.labels || []).map(l => ({
                label_type:  l.label_type || "",
                description: l.description || "",
                notes:       l.placement || "",
              })),
              polybag: packaging.polybag ? {
                type:              packaging.polybag.type || "PE",
                size_cm:           packaging.polybag.size_cm || "",
                thickness_microns: packaging.polybag.thickness_microns ?? null,
                printed:           !!packaging.polybag.printed,
              } : undefined,
              stiffener: packaging.stiffener?.used ? {
                used:     true,
                material: packaging.stiffener.material || "",
                size_cm:  packaging.stiffener.size_cm  || "",
              } : undefined,
              carton: packaging.carton ? {
                type:              packaging.carton.type || "Printed",
                quality:           packaging.carton.quality || "",
                size_cm:           packaging.carton.size_cm || "",
                pieces_per_carton: packaging.carton.pieces_per_carton ?? null,
                cbm_per_carton:    packaging.carton.cbm_per_carton ?? null,
              } : undefined,
              stickers: (packaging.stickers || []).map(s => ({
                sticker_type: s.sticker_type || "",
                description:  s.description  || "",
              })),
            };
            const existingAp = apMap[artCodeKey];
            ops.push(
              existingAp
                ? base44.entities.ArticlePackaging.update(existingAp.id, apData)
                : base44.entities.ArticlePackaging.create(apData)
            );
          }

          // ── 6. POItem (when PO is selected) ───────────────────────────────
          if (localPoId && (pl.price_usd != null || pl.cbm_per_carton != null)) {
            const poItemData = {
              po_id:       localPoId,
              po_number:   poNum,
              item_code:   artCode,
              item_description: pl.item_description || artName,
              quantity:    parseNumber(get(rec, "order_quantity")) ?? 0,
              unit:        "Pieces",
              unit_price:  pl.price_usd ?? null,
              total_price: null, // calculated elsewhere
              cbm:         pl.cbm_per_carton ?? null,
              pieces_per_carton: pl.qty_per_carton ?? null,
              carton_length: pl.carton_length_cm ?? null,
              carton_width:  pl.carton_width_cm  ?? null,
              carton_height: pl.carton_height_cm ?? null,
              price_status: "Matched",
              expected_price: pl.price_usd ?? null,
            };
            const existingPoItem = poItemMap[artCodeKey];
            ops.push(
              existingPoItem
                ? base44.entities.POItem.update(existingPoItem.id, poItemData)
                : base44.entities.POItem.create(poItemData)
            );
          }

          // Run all entity ops in parallel for this SKU
          await Promise.all(ops);

          // ── 7. AccessoryItems — delete old ones for this article, then bulk-create fresh ──
          // This avoids duplicates on re-import
          const oldAccItems = accByArtCode[artCodeKey] || [];
          if (oldAccItems.length > 0) {
            await Promise.all(oldAccItems.map(a => base44.entities.AccessoryItem.delete(a.id)));
          }

          const accCreateList = [];

          // From the accessory sheet rows
          accList.filter(a => a.item_description).forEach(a => {
            accCreateList.push({
              po_id:           localPoId || null,
              po_number:       poNum,
              article_name:    artName,
              article_code:    artCode,
              category:        a.category || "Accessory",
              item_description:a.item_description || "",
              color:           a.color || "",
              size_spec:       a.size_spec || "",
              multiplier:      a.quantity_per_piece || 1,
              consumption_per_unit: a.quantity_per_piece || null,
              unit:            a.unit || "Pcs",
              wastage_percent: a.wastage_percent || 5,
              status:          "Planned",
              notes:           a.placement || "",
            });
          });

          // From packaging object — add carton explicitly
          if (packaging.carton?.size_cm || packaging.carton?.type) {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum,
              article_name: artName, article_code: artCode,
              category: "Carton",
              item_description: packaging.carton.type || "Carton",
              size_spec:  packaging.carton.size_cm || "",
              notes:      packaging.carton.quality || "",
              multiplier: packaging.carton.pieces_per_carton || 1,
              unit: "Pcs", wastage_percent: 2, status: "Planned",
            });
          }

          if (accCreateList.length > 0) {
            // Bulk create in batches of 20
            for (let bi = 0; bi < accCreateList.length; bi += 20) {
              await base44.entities.AccessoryItem.bulkCreate(accCreateList.slice(bi, bi + 20));
            }
          }

        } catch (err) {
          errorList.push(`${rec.article_code}: ${err.message}`);
        }
      }

      // Step 3 — Update PO status if PO was linked
      if (localPoId && savedList.length > 0) {
        try {
          await base44.entities.PurchaseOrder.update(localPoId, {
            status: "Items Entered",
          });
        } catch (_) { /* non-fatal */ }
      }

    } catch (err) {
      errorList.push(`Fatal: ${err.message}`);
    }

    setSaved(savedList);
    setErrors(errorList);
    setSaving(false);
    setSaveProgress("");
    if (savedList.length > 0 && onSaved) onSaved();
  };

  const isComplete = saved.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Structured Excel Import — Master Data Sync</span>
        </div>
        <p className="text-xs text-blue-700">
          Parses the BOB master-data Excel format (Articles, Fabric, Accessories, Carton, Price List).
          Syncs to: <strong>Tech Pack Library · Article Master · Fabric Templates · Price List · Article Packaging · Accessory Items</strong>
          {" "}— and <strong>PO Items + PO status</strong> when a PO is selected.
        </p>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => document.getElementById("smart-import-file").click()}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">Click to select Excel file (.xlsx / .xls)</p>
        <p className="text-xs text-gray-400 mt-1">BOB master-data format with named sheets</p>
        <input id="smart-import-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      </div>

      {file && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">{file.name}</span>
          <span className="text-xs text-green-600 ml-auto">{(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      {/* PO selector */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          Link to Purchase Order <span className="text-gray-400">(optional — also syncs PO Items)</span>
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={localPoId}
          onChange={e => setLocalPoId(e.target.value)}
        >
          <option value="">— No PO link —</option>
          {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} – {p.customer_name}</option>)}
        </select>
      </div>

      {/* Parse button */}
      {!preview && (
        <Button onClick={handleParse} disabled={!file || parsing} className="w-full gap-2">
          {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : "Parse Excel & Preview"}
        </Button>
      )}

      {/* Sheet detection debug */}
      {sheetDebug && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-600 space-y-1">
          <div className="flex items-center gap-1 font-semibold text-gray-700 mb-1"><Info className="h-3 w-3" /> Sheet Detection</div>
          <div>All sheets: {sheetDebug.sheets.join(" · ")}</div>
          {Object.entries(sheetDebug.matched).map(([key, val]) => (
            <div key={key}>
              <span className="font-medium capitalize">{key}:</span>{" "}
              <span className={val === "NOT FOUND" ? "text-red-500 font-semibold" : "text-green-700"}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {errors.length} error(s)
          </div>
          {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
        </div>
      )}

      {/* Preview */}
      {preview && !isComplete && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              {preview.length} SKU(s) ready to import
            </p>
            <button
              onClick={() => { setPreview(null); setFile(null); setSheetDebug(null); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Re-select file
            </button>
          </div>

          {/* Module sync summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px]">
            {[
              { label: "Tech Packs",   color: "blue"   },
              { label: "Articles",     color: "green"  },
              { label: "Fabric Tpl",   color: "purple" },
              { label: "Price List",   color: "orange" },
              { label: "Packaging",    color: "teal"   },
              { label: "Accessories",  color: "pink"   },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-center">
                <div className="font-semibold text-gray-700">{m.label}</div>
                <div className="text-gray-400">{preview.length} SKUs</div>
              </div>
            ))}
          </div>
          {localPoId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              PO selected — will also create/update <strong>PO Items</strong> and set PO status to <strong>"Items Entered"</strong>.
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {preview.map((rec, idx) => (
              <div key={idx} className="px-3 py-2 bg-white hover:bg-gray-50">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedSku(expandedSku === idx ? null : idx)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-800">{rec.article_code}</span>
                    <span className="text-xs text-gray-500 ml-2">{rec.size_label} · {rec.color}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-shrink-0">
                    <span className={rec.extracted_data.fabric_components.length > 0 ? "text-green-600" : "text-red-400"}>
                      {rec.extracted_data.fabric_components.length} fabrics
                    </span>
                    <span className={rec.extracted_data.accessories.length > 0 ? "text-green-600" : "text-amber-500"}>
                      {rec.extracted_data.accessories.length} acc
                    </span>
                    <span className={rec.extracted_data.price_list.price_usd ? "text-blue-600" : "text-gray-300"}>
                      ${rec.extracted_data.price_list.price_usd ?? "—"}
                    </span>
                    <span className={rec.extracted_data.price_list.cbm_per_carton ? "text-purple-600" : "text-gray-300"}>
                      {rec.extracted_data.price_list.cbm_per_carton ?? "—"} CBM
                    </span>
                    {expandedSku === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
                {expandedSku === idx && (
                  <div className="mt-2 ml-2 space-y-1 text-[11px] text-gray-600">
                    <p><strong>Article:</strong> {rec.article_name} | Size: {rec.size_label} | Color: {rec.color}</p>
                    <p><strong>Price:</strong> ${rec.extracted_data.price_list.price_usd ?? "—"} | CBM/Ctn: {rec.extracted_data.price_list.cbm_per_carton ?? "—"} | Pcs/Ctn: {rec.extracted_data.price_list.qty_per_carton ?? "—"}</p>
                    {rec.extracted_data.fabric_components.length > 0 && (
                      <>
                        <p className="font-semibold text-gray-700 mt-1">Fabric ({rec.extracted_data.fabric_components.length}):</p>
                        {rec.extracted_data.fabric_components.map((f, fi) => (
                          <p key={fi} className="ml-2">• {f.component_type}: {f.fabric_type} — {f.gsm}gsm, {f.width}cm, {f.consumption_per_unit}m/unit</p>
                        ))}
                      </>
                    )}
                    {rec.extracted_data.accessories.length > 0 && (
                      <>
                        <p className="font-semibold text-gray-700 mt-1">Accessories ({rec.extracted_data.accessories.length}):</p>
                        {rec.extracted_data.accessories.slice(0, 5).map((a, ai) => (
                          <p key={ai} className="ml-2">• [{a.category}] {a.item_description}</p>
                        ))}
                        {rec.extracted_data.accessories.length > 5 && (
                          <p className="ml-2 text-gray-400">… +{rec.extracted_data.accessories.length - 5} more</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {saveProgress || "Saving…"}</>
              : `Sync ${preview.length} SKU(s) → All Modules`}
          </Button>
        </div>
      )}

      {/* Done */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-5 text-center space-y-3">
          <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
          <p className="text-sm font-bold text-green-800">Import Complete!</p>
          <p className="text-xs text-green-600">
            {saved.filter(s => s.action === "created").length} created ·{" "}
            {saved.filter(s => s.action === "updated").length} updated
            {localPoId ? " · PO Items synced · PO status updated" : ""}
          </p>
          <div className="text-xs text-green-700 space-y-0.5 max-h-40 overflow-y-auto text-left px-2">
            {saved.map((s, i) => (
              <p key={i}>{s.action === "created" ? "✅ Created" : "🔄 Updated"}: <strong>{s.code}</strong></p>
            ))}
          </div>
          {errors.length > 0 && (
            <div className="mt-2 text-left">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">❌ {e}</p>)}
            </div>
          )}
          <Button onClick={onClose} size="sm" className="mt-2">View Saved Tech Packs</Button>
        </div>
      )}
    </div>
  );
}