import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Loader2, FileSpreadsheet, ChevronDown, ChevronUp, Info } from "lucide-react";

/**
 * SmartExcelImport — parses structured master-data Excel files.
 * Sheets (matched by name pattern, order-independent):
 *   1. Articles (SKUs)
 *   2. SKU Fabric Consumption
 *   3. SKU Accessory Consumption
 *   4. Carton Master
 *   5. Price List
 */

// ── Utilities ────────────────────────────────────────────────────────────────

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// Parse a sheet to array-of-objects with normalized keys
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

// Find a sheet by keyword priority (first match wins)
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

// Get a field by trying multiple normalized key names
function get(row, ...keys) {
  for (const k of keys) {
    const nk = normalizeHeader(k);
    if (row[nk] !== undefined && row[nk] !== null && row[nk] !== "") return row[nk];
  }
  return null;
}

// Map raw category + item name to our enum
function mapCategory(cat, itemName) {
  const c = String(cat ?? "").toLowerCase().trim();
  const n = String(itemName ?? "").toLowerCase().trim();
  if (c === "label" || n.includes("label") || n.includes("law tag") || n.includes("hang tag") || n.includes("care")) return "Label";
  if (c === "sticker" || n.includes("sticker") || n.includes("upc") || n.includes("barcode")) return "Sticker";
  if (n.includes("polybag") || n.includes("poly bag")) return "Polybag";
  if (n.includes("stiffener") || n.includes("board insert")) return "Stiffener";
  if (n.includes("carton") || n.includes("master box") || n.includes("printed box")) return "Carton";
  if (n.includes("zipper") || n.includes("zip")) return "Zipper";
  if (n.includes("elastic") && !n.includes("band")) return "Elastic";
  if (n.includes("elastic band") || c === "trim") return "Accessory";
  if (n.includes("dori") || n.includes("drawstring") || n.includes("cord")) return "Dori";
  if (n.includes("button") || n.includes("snap")) return "Button";
  if (n.includes("eyelet") || n.includes("grommet")) return "Eyelet";
  if (n.includes("thread") || n.includes("sewing")) return "Stitching Thread";
  if (n.includes("insert card") || n.includes("swing tag")) return "Insert Card";
  return "Accessory";
}

// Build a lookup: key → [rows], supporting both exact and prefix matching
function buildLookup(rows, keyField) {
  const map = {};
  rows.forEach(r => {
    const code = String(get(r, keyField, "item_code", "itemcode", "sku") ?? "").trim();
    if (!code) return;
    if (!map[code]) map[code] = [];
    map[code].push(r);
  });
  return map;
}

// Lookup rows for a full item code, falling back to the base code (strip last suffix)
function lookupRows(map, fullCode) {
  if (!fullCode) return [];
  // Exact match first
  if (map[fullCode]) return map[fullCode];
  // Try stripping last dash segment (e.g. PCSJMO-T-WH → PCSJMO-T)
  const parts = fullCode.split("-");
  if (parts.length > 1) {
    const baseCode = parts.slice(0, -1).join("-");
    if (map[baseCode]) return map[baseCode];
  }
  return [];
}

// Lookup single row
function lookupRow(map, fullCode) {
  if (!fullCode) return null;
  if (map[fullCode]) return map[fullCode];
  const parts = fullCode.split("-");
  if (parts.length > 1) {
    const baseCode = parts.slice(0, -1).join("-");
    if (map[baseCode]) return map[baseCode];
  }
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SmartExcelImport({ pos = [], selectedPoId, onSaved, onClose }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState([]);
  const [errors, setErrors] = useState([]);
  const [expandedSku, setExpandedSku] = useState(null);
  const [localPoId, setLocalPoId] = useState(selectedPoId || "");
  const [sheetDebug, setSheetDebug] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(null); setSaved([]); setErrors([]); setSheetDebug(null); }
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setErrors([]);
    setSheetDebug(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });

      // ── Find sheets with precise keyword priority ──
      // Articles: must contain "article" OR "sku" but NOT "consumption"
      const articleSheet = findSheet(wb,
        ["article", "sku"],
        ["articles"],
        ["sku"]
      );
      // Fabric: must contain "fabric"
      const fabricSheet = findSheet(wb,
        ["fabric", "consumption"],
        ["fabric"]
      );
      // Accessory: must contain "accessory"
      const accessorySheet = findSheet(wb,
        ["accessory", "consumption"],
        ["accessory"],
        ["trim", "consumption"],
        ["trim"]
      );
      // Carton: must contain "carton"
      const cartonSheet = findSheet(wb, ["carton"]);
      // Price: must contain "price"
      const priceSheet = findSheet(wb, ["price"]);

      // Debug info
      const debug = {
        sheets: wb.SheetNames,
        matched: {
          articles: wb.SheetNames.find(n => wb.Sheets[n] === articleSheet) || "NOT FOUND",
          fabric: wb.SheetNames.find(n => wb.Sheets[n] === fabricSheet) || "NOT FOUND",
          accessory: wb.SheetNames.find(n => wb.Sheets[n] === accessorySheet) || "NOT FOUND",
          carton: wb.SheetNames.find(n => wb.Sheets[n] === cartonSheet) || "NOT FOUND",
          price: wb.SheetNames.find(n => wb.Sheets[n] === priceSheet) || "NOT FOUND",
        }
      };
      setSheetDebug(debug);

      if (!articleSheet) {
        setErrors(["Could not find Articles/SKUs sheet. Sheet names found: " + wb.SheetNames.join(", ")]);
        setParsing(false);
        return;
      }

      const articles = sheetToObjects(articleSheet);
      const fabrics = fabricSheet ? sheetToObjects(fabricSheet) : [];
      const accessories = accessorySheet ? sheetToObjects(accessorySheet) : [];
      const cartons = cartonSheet ? sheetToObjects(cartonSheet) : [];
      const prices = priceSheet ? sheetToObjects(priceSheet) : [];

      // Build lookups (with base-code fallback built into lookup functions)
      const fabricMap = buildLookup(fabrics, "item_code");
      const accessoryMap = buildLookup(accessories, "item_code");
      const cartonMap = buildLookup(cartons, "item_code");
      const priceMap = buildLookup(prices, "item_code");

      const records = articles.map(art => {
        const itemCode = String(get(art, "item_code", "itemcode", "sku", "bob_sku") ?? "").trim();
        const brand = get(art, "brand", "customer", "buyer") ?? "";
        const productType = get(art, "product_type", "product_category", "producttype", "category") ?? "";
        const productCategory = get(art, "product_category", "productcategory") ?? "";
        const size = String(get(art, "size", "size_label") ?? "").trim();
        const color = String(get(art, "color", "colour") ?? "White").trim();
        const techPackCode = get(art, "tech_pack_code", "techpackcode") ?? "";
        const unitsPerCarton = parseNumber(get(art, "units_per_carton", "unitspercarton", "pcs_per_carton", "qty_per_carton"));
        const cartonSizeRaw = get(art, "carton_size_cm", "cartonsizecm", "carton_size") ?? "";
        const finishDimensions = get(art, "finish_dimensions", "finishdimensions") ?? "";
        const pvcBagDimensions = get(art, "pvc_bag_dimensions", "pvcbagdimensions") ?? "";
        const stiffenerSize = get(art, "stiffener_size") ?? "";
        const zipperLength = get(art, "zipper_length_cm") ?? null;

        // ── Fabric components (base-code fallback: PCSJMO-T-WH → PCSJMO-T) ──
        const fabricRows = lookupRows(fabricMap, itemCode);
        const fabric_components = fabricRows.map(f => ({
          component_type: get(f, "component_type", "componenttype", "component", "panel") ?? "",
          product_size: get(f, "product_size", "productsize", "dimensions") ?? "",
          direction: get(f, "direction", "knitting_direction") ?? "",
          fabric_type: get(f, "fabric_type", "fabrictype", "construction") ?? "",
          gsm: parseNumber(get(f, "gsm", "grams")),
          width: parseNumber(get(f, "width_cm", "widthcm", "width_in", "width")),
          composition: get(f, "composition", "fiber_content", "content") ?? "",
          consumption_per_unit: parseNumber(get(f, "consumption_per_unit", "consumptionperunit", "mtrs_per_pc", "consumption")),
          wastage_percent: parseNumber(get(f, "wastage_percent", "wastagepercent", "wastage")),
          construction: get(f, "construction") ?? "",
          yarn_count: get(f, "yarn_count", "yarncount") ?? "",
          finish: get(f, "finish") ?? "",
        }));

        // ── Accessories (exact code match — accessory sheet has full SKU codes) ──
        const accessoryRows = lookupRows(accessoryMap, itemCode);
        const accessories_list = accessoryRows.map(a => {
          const catRaw = get(a, "category") ?? "";
          const itemName = get(a, "item_name", "itemname", "name", "description") ?? "";
          const material = get(a, "material") ?? "";
          const variant = get(a, "variant") ?? "";
          const placement = get(a, "placement") ?? "";
          return {
            category: mapCategory(catRaw, itemName),
            item_description: [itemName, material].filter(Boolean).join(" — "),
            color: get(a, "color", "colour", "variant") ?? "",
            size_spec: get(a, "size_spec", "sizespec", "size") ?? "",
            quantity_per_piece: parseNumber(get(a, "consumption_per_unit", "consumptionperunit", "qty_per_piece", "quantity")) ?? 1,
            unit: get(a, "unit") ?? "Pcs",
            placement: placement,
            variant: variant,
            wastage_percent: parseNumber(get(a, "wastage_percent", "wastagepercent")) ?? 0,
          };
        });

        // Separate packaging sub-types from accessory rows
        const labelRows = accessoryRows.filter(a => String(get(a, "category") ?? "").toLowerCase() === "label");
        const stickerRows = accessoryRows.filter(a => {
          const cat = String(get(a, "category") ?? "").toLowerCase();
          const nm = String(get(a, "item_name") ?? "").toLowerCase();
          return cat === "sticker" || nm.includes("sticker") || nm.includes("upc");
        });
        const polyRow = accessoryRows.find(a => String(get(a, "item_name") ?? "").toLowerCase().includes("polybag") || String(get(a, "item_name") ?? "").toLowerCase().includes("poly bag"));
        const stiffRow = accessoryRows.find(a => String(get(a, "item_name") ?? "").toLowerCase().includes("stiffener") || String(get(a, "item_name") ?? "").toLowerCase().includes("insert card"));

        // ── Carton data (exact or base-code fallback) ──
        const cartonRows = lookupRows(cartonMap, itemCode);
        const carton = cartonRows[0] ?? {};
        const cartonLength = parseNumber(get(carton, "carton_length_cm", "cartonlengthcm", "length_cm", "length"));
        const cartonWidth = parseNumber(get(carton, "carton_width_cm", "cartonwidthcm", "width_cm"));
        const cartonHeight = parseNumber(get(carton, "carton_height_cm", "cartonheightcm", "height_cm"));
        const cbmPerCarton = parseNumber(get(carton, "cbm_per_carton", "cbmpercarton", "cbm"));
        const cartonUnits = parseNumber(get(carton, "units_per_carton", "unitspercarton", "qty_per_carton", "pcs_per_carton")) ?? unitsPerCarton;
        const cartonSizeFinal = get(carton, "carton_size_cm", "cartonsizecm") ?? cartonSizeRaw ?? "";

        // ── Price data ──
        const priceRow = lookupRow(priceMap, itemCode);
        const priceUsd = parseNumber(get(priceRow, "price_usd", "priceusd", "unit_price", "price"));
        const refCbmPerCarton = parseNumber(get(priceRow, "cbm_per_carton", "cbmpercarton", "cbm")) ?? cbmPerCarton;
        const refQtyPerCarton = parseNumber(get(priceRow, "pieces_per_carton", "piecespercarton", "qty_per_carton", "units_per_carton")) ?? cartonUnits;
        const itemDescription = get(priceRow, "item_description", "description") ?? `${brand} ${productType} ${productCategory}`.trim();

        const packaging = {
          labels: labelRows.map(l => ({
            label_type: get(l, "item_name", "itemname") ?? "Label",
            description: get(l, "material") ?? "",
            size_spec: get(l, "size_spec", "sizespec") ?? "",
            placement: get(l, "placement") ?? "",
            variant: get(l, "variant") ?? "",
          })),
          polybag: polyRow ? {
            type: (() => {
              const m = String(get(polyRow, "material") ?? "").toLowerCase();
              if (m.includes("pp")) return "PP";
              if (m.includes("pvc")) return "PVC";
              if (m.includes("opp")) return "OPP";
              if (m.includes("ldpe")) return "LDPE";
              return "PE";
            })(),
            size_cm: get(polyRow, "size_spec", "sizespec") ?? pvcBagDimensions ?? "",
            thickness_microns: null,
            printed: String(get(polyRow, "variant") ?? get(polyRow, "material") ?? "").toLowerCase().includes("print"),
          } : (pvcBagDimensions ? { type: "PE", size_cm: pvcBagDimensions, thickness_microns: null, printed: false } : null),
          stiffener: stiffRow ? {
            used: true,
            material: get(stiffRow, "material") ?? "Cardboard",
            size_cm: get(stiffRow, "size_spec", "sizespec") ?? stiffenerSize ?? "",
          } : (stiffenerSize ? { used: true, material: "Cardboard", size_cm: stiffenerSize } : null),
          carton: {
            type: "Printed",
            quality: "",
            size_cm: cartonSizeFinal,
            pieces_per_carton: cartonUnits ?? null,
            length_cm: cartonLength,
            width_cm: cartonWidth,
            height_cm: cartonHeight,
            cbm_per_carton: cbmPerCarton,
          },
          stickers: stickerRows.map(s => ({
            sticker_type: get(s, "item_name", "itemname") ?? "Sticker",
            description: get(s, "material") ?? get(s, "variant") ?? "",
          })),
        };

        return {
          article_name: `${brand} ${productType}`.trim() || itemDescription,
          article_code: itemCode,
          customer_name: brand,
          size_label: size,
          color: color,
          file_name: file.name,
          file_url: null,
          version: 1,
          status: "Draft",
          po_id: localPoId || null,
          po_number: pos.find(p => p.id === localPoId)?.po_number ?? null,
          extracted_data: {
            article: {
              article_name: `${brand} ${productType}`.trim() || itemDescription,
              article_code: itemCode,
              size_label: size,
              color: color,
              description: [productType, productCategory].filter(Boolean).join(" — "),
              order_quantity: cartonUnits ?? null,
              price_usd: priceUsd,
              tech_pack_code: techPackCode,
              finish_dimensions: finishDimensions,
              item_description: itemDescription,
            },
            fabric_components,
            stitching: [],
            accessories: accessories_list,
            packaging,
            // Save carton + price data for PriceList sync
            price_list: priceRow ? {
              item_code: itemCode,
              item_description: itemDescription,
              price_usd: priceUsd,
              qty_per_carton: refQtyPerCarton,
              cbm_per_carton: refCbmPerCarton,
              carton_length_cm: parseNumber(get(priceRow, "carton_length_cm")) ?? cartonLength,
              carton_width_cm: parseNumber(get(priceRow, "carton_width_cm")) ?? cartonWidth,
              carton_height_cm: parseNumber(get(priceRow, "carton_height_cm")) ?? cartonHeight,
            } : null,
          },
        };
      }).filter(r => r.article_code); // skip rows without item_code

      setPreview(records);
    } catch (err) {
      setErrors([`Parse error: ${err.message}`]);
    }
    setParsing(false);
  };

  // Full sync — bulk pre-load existing records then process efficiently
  const handleSave = async () => {
    if (!preview?.length) return;
    setSaving(true);
    const savedList = [];
    const errorList = [];
    const poRecord = pos.find(p => p.id === localPoId);
    const poNum = poRecord?.po_number || "";

    try {
      // ── Step 1: Bulk pre-load all existing records to avoid N×filter() calls ──
      const [existingTPs, existingArticles, existingTemplates, existingPriceLists, existingPackaging] = await Promise.all([
        base44.entities.TechPackRecord.list("-created_date", 1000),
        base44.entities.Article.list("-created_date", 1000),
        base44.entities.FabricTemplate.list("-created_date", 1000),
        base44.entities.PriceList.list("-created_date", 1000),
        base44.entities.ArticlePackaging.list("-created_date", 1000),
      ]);

      // Build lookup maps by article_code / item_code
      const tpMap = {};
      existingTPs.forEach(r => { if (r.article_code) tpMap[r.article_code.toUpperCase()] = r; });
      const artMap = {};
      existingArticles.forEach(r => { if (r.article_code) artMap[r.article_code.toUpperCase()] = r; });
      const tplMap = {};
      existingTemplates.forEach(r => { if (r.article_code) tplMap[r.article_code.toUpperCase()] = r; });
      const plMap = {};
      existingPriceLists.forEach(r => { if (r.item_code) plMap[r.item_code.toUpperCase()] = r; });
      const apMap = {};
      existingPackaging.forEach(r => { if (r.article_code) apMap[r.article_code.toUpperCase()] = r; });

      // ── Step 2: Process each SKU ──────────────────────────────────────────────
      for (const rec of preview) {
        try {
          const artCode = rec.article_code;
          const artCodeKey = artCode.toUpperCase();
          const artName = rec.article_name;
          const custName = rec.customer_name || poRecord?.customer_name || "";
          const ed = rec.extracted_data || {};
          const fabricComponents = ed.fabric_components || [];
          const accessories = ed.accessories || [];
          const packaging = ed.packaging || {};
          const pl = ed.price_list || {};

          const componentData = fabricComponents.map(f => ({
            component_type: f.component_type || "",
            product_size: f.product_size || "",
            direction: f.direction || "",
            fabric_type: f.fabric_type || "",
            gsm: f.gsm || null,
            width: f.width || null,
            composition: f.composition || "",
            consumption_per_unit: f.consumption_per_unit || null,
            wastage_percent: f.wastage_percent || null,
            total_required: null,
          }));

          // All upserts run in parallel per SKU
          const ops = [];

          // 1. TechPackRecord
          const existingTP = tpMap[artCodeKey];
          if (existingTP) {
            ops.push(base44.entities.TechPackRecord.update(existingTP.id, {
              ...rec, version: (existingTP.version || 1) + 1, status: "Updated",
            }).then(() => savedList.push({ code: artCode, action: "updated" })));
          } else {
            ops.push(base44.entities.TechPackRecord.create(rec)
              .then(() => savedList.push({ code: artCode, action: "created" })));
          }

          // 2. Article
          const existingArt = artMap[artCodeKey];
          const artData = {
            article_name: artName, article_code: artCode, customer_name: custName,
            color: rec.color || "", size_label: rec.size_label || "",
            po_id: localPoId || null, components: componentData,
          };
          if (existingArt) {
            ops.push(base44.entities.Article.update(existingArt.id, artData));
          } else {
            ops.push(base44.entities.Article.create(artData));
          }

          // 3. FabricTemplate
          if (fabricComponents.length > 0) {
            const existingTpl = tplMap[artCodeKey];
            const tplData = { article_code: artCode, article_name: artName, components: componentData };
            if (existingTpl) {
              ops.push(base44.entities.FabricTemplate.update(existingTpl.id, tplData));
            } else {
              ops.push(base44.entities.FabricTemplate.create(tplData));
            }
          }

          // 4. PriceList
          if (pl.price_usd != null || pl.cbm_per_carton != null) {
            const plData = {
              item_code: artCode,
              article: pl.item_description || artName,
              price_usd: pl.price_usd ?? null,
              qty_per_carton: pl.qty_per_carton ?? null,
              cbm_per_carton: pl.cbm_per_carton ?? null,
            };
            const existingPl = plMap[artCodeKey];
            if (existingPl) {
              ops.push(base44.entities.PriceList.update(existingPl.id, plData));
            } else {
              ops.push(base44.entities.PriceList.create(plData));
            }
          }

          // 5. ArticlePackaging (always — no PO required)
          if (packaging.labels?.length || packaging.polybag || packaging.carton || packaging.stiffener) {
            const apData = {
              article_name: artName, article_code: artCode, customer_name: custName,
              labels: (packaging.labels || []).map(l => ({
                label_type: l.label_type || "", description: l.description || "",
                notes: [l.placement, l.variant].filter(Boolean).join(" | ") || "",
              })),
              polybag: packaging.polybag ? {
                type: packaging.polybag.type || "PE",
                size_cm: packaging.polybag.size_cm || "",
                thickness_microns: packaging.polybag.thickness_microns || null,
                printed: !!packaging.polybag.printed,
              } : undefined,
              stiffener: packaging.stiffener?.used ? {
                used: true, material: packaging.stiffener.material || "", size_cm: packaging.stiffener.size_cm || "",
              } : undefined,
              carton: packaging.carton ? {
                type: packaging.carton.type || "Printed", quality: packaging.carton.quality || "",
                size_cm: packaging.carton.size_cm || "",
                pieces_per_carton: packaging.carton.pieces_per_carton || null,
                cbm_per_carton: packaging.carton.cbm_per_carton || null,
              } : undefined,
              stickers: (packaging.stickers || []).map(s => ({ sticker_type: s.sticker_type || "", description: s.description || "" })),
            };
            const existingAp = apMap[artCodeKey];
            if (existingAp) {
              ops.push(base44.entities.ArticlePackaging.update(existingAp.id, apData));
            } else {
              ops.push(base44.entities.ArticlePackaging.create(apData));
            }
          }

          // 6. AccessoryItems — create for all (PO link optional)
          const accCreateList = [];
          accessories.filter(a => a.item_description).forEach(a => {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum,
              article_name: artName, article_code: artCode,
              category: a.category || "Accessory",
              item_description: a.item_description || "",
              color: a.color || "", size_spec: a.size_spec || "",
              multiplier: a.quantity_per_piece || 1,
              consumption_per_unit: a.quantity_per_piece || null,
              unit: a.unit || "Pcs", wastage_percent: a.wastage_percent || 5,
              status: "Planned",
              notes: [a.placement, a.variant].filter(Boolean).join(" | ") || "",
            });
          });
          (packaging.labels || []).filter(l => l.label_type).forEach(l => {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum, article_name: artName, article_code: artCode,
              category: "Label", item_description: l.label_type, size_spec: l.size_spec || "",
              notes: [l.placement, l.variant].filter(Boolean).join(" | ") || "",
              unit: "Pcs", wastage_percent: 5, multiplier: 1, status: "Planned",
            });
          });
          if (packaging.polybag?.type) {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum, article_name: artName, article_code: artCode,
              category: "Polybag", item_description: `${packaging.polybag.type} Polybag`,
              size_spec: packaging.polybag.size_cm || "", unit: "Pcs", wastage_percent: 3, multiplier: 1, status: "Planned",
            });
          }
          if (packaging.stiffener?.used) {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum, article_name: artName, article_code: artCode,
              category: "Stiffener", item_description: packaging.stiffener.material || "Stiffener",
              size_spec: packaging.stiffener.size_cm || "", unit: "Pcs", wastage_percent: 3, multiplier: 1, status: "Planned",
            });
          }
          if (packaging.carton?.size_cm || packaging.carton?.type) {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum, article_name: artName, article_code: artCode,
              category: "Carton", item_description: packaging.carton.type || "Carton",
              size_spec: packaging.carton.size_cm || "", notes: packaging.carton.quality || "",
              multiplier: packaging.carton.pieces_per_carton || 1, unit: "Pcs", wastage_percent: 2, status: "Planned",
            });
          }
          (packaging.stickers || []).filter(s => s.sticker_type).forEach(s => {
            accCreateList.push({
              po_id: localPoId || null, po_number: poNum, article_name: artName, article_code: artCode,
              category: "Sticker", item_description: s.sticker_type, size_spec: s.description || "",
              unit: "Pcs", wastage_percent: 5, multiplier: 1, status: "Planned",
            });
          });
          // Bulk create accessories in batches of 10
          for (let i = 0; i < accCreateList.length; i += 10) {
            ops.push(base44.entities.AccessoryItem.bulkCreate(accCreateList.slice(i, i + 10)));
          }

          await Promise.all(ops);
        } catch (err) {
          errorList.push(`${rec.article_code}: ${err.message}`);
        }
      }
    } catch (err) {
      errorList.push(`Fatal: ${err.message}`);
    }

    setSaved(savedList);
    setErrors(errorList);
    setSaving(false);
    if (savedList.length > 0 && onSaved) onSaved();
  };

  const isComplete = saved.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Structured Excel Import</span>
        </div>
        <p className="text-xs text-blue-700">
          Directly parses master-data Excel files (Articles, Fabric Consumption, Accessory Consumption, Carton Master, Price List).
          Supports multi-SKU files with base-code fallback for fabric sheets. Also auto-syncs Price List data.
        </p>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => document.getElementById("smart-import-file").click()}
      >
        <FileSpreadsheet className="h-10 w-10 mx-auto text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">Click to select Excel file (.xlsx / .xls)</p>
        <p className="text-xs text-gray-400 mt-1">Structured master-data format with named sheets</p>
        <input id="smart-import-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      </div>

      {file && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">{file.name}</span>
          <span className="text-xs text-green-600 ml-auto">{(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      {/* Optional PO link */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Link to Purchase Order (optional)</label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={localPoId}
          onChange={e => setLocalPoId(e.target.value)}
        >
          <option value="">— Select PO —</option>
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

          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-80 overflow-y-auto">
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
                      {rec.extracted_data.accessories.length} accessories
                    </span>
                    <span className={rec.extracted_data.article.price_usd ? "text-blue-600" : "text-gray-300"}>
                      ${rec.extracted_data.article.price_usd ?? "—"}
                    </span>
                    {expandedSku === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
                {expandedSku === idx && (
                  <div className="mt-2 ml-2 space-y-1 text-[11px] text-gray-600">
                    <p><strong>Article:</strong> {rec.article_name} | Size: {rec.size_label} | Color: {rec.color}</p>
                    {rec.extracted_data.article.price_usd && (
                      <p><strong>Price:</strong> ${rec.extracted_data.article.price_usd} | CBM/Ctn: {rec.extracted_data.packaging.carton.cbm_per_carton} | Pcs/Ctn: {rec.extracted_data.packaging.carton.pieces_per_carton}</p>
                    )}
                    {rec.extracted_data.fabric_components.length > 0 && (
                      <>
                        <p className="font-semibold text-gray-700 mt-1">Fabric Components ({rec.extracted_data.fabric_components.length}):</p>
                        {rec.extracted_data.fabric_components.map((f, fi) => (
                          <p key={fi} className="ml-2">• {f.component_type}: {f.fabric_type} — {f.gsm}gsm, {f.width}cm, {f.consumption_per_unit}m/unit</p>
                        ))}
                      </>
                    )}
                    {rec.extracted_data.accessories.length > 0 && (
                      <>
                        <p className="font-semibold text-gray-700 mt-1">Accessories ({rec.extracted_data.accessories.length}):</p>
                        {rec.extracted_data.accessories.slice(0, 6).map((a, ai) => (
                          <p key={ai} className="ml-2">• [{a.category}] {a.item_description}</p>
                        ))}
                        {rec.extracted_data.accessories.length > 6 && (
                          <p className="ml-2 text-gray-400">… and {rec.extracted_data.accessories.length - 6} more</p>
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
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving {preview.length} records…</>
              : `Save & Sync ${preview.length} SKU(s) → All Modules`}
          </Button>
        </div>
      )}

      {/* Done */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-5 text-center space-y-3">
          <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
          <p className="text-sm font-bold text-green-800">Import Complete!</p>
          <div className="text-xs text-green-700 space-y-0.5 max-h-48 overflow-y-auto">
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