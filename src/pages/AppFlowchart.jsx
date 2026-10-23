import React from "react";
import {
  FileText, Receipt, Layers, Shirt, Scissors, Tag, Package,
  Cog, Ship, ClipboardList, Workflow, ChevronDown, CheckCircle2, Sparkles
} from "lucide-react";
import MermaidFlow from "@/components/flow/MermaidFlow";

const STAGE_COLORS = {
  intake: "#2563eb",
  article: "#0891b2",
  techpack: "#7c3aed",
  trims: "#d97706",
  procurement: "#059669",
  production: "#dc2626",
  shipping: "#475569",
};

function FlowNode({ icon: Icon, title, items, tone }) {
  return (
    <div className="w-full rounded-xl border-2 bg-card p-4 shadow-sm" style={{ borderColor: tone }}>
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: tone }}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-semibold text-sm text-foreground leading-tight">{title}</h3>
      </div>
      {items && items.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tone }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Arrow({ label }) {
  return (
    <div className="flex flex-col items-center py-1">
      {label && <span className="text-[10px] font-semibold text-muted-foreground mb-0.5">{label}</span>}
      <ChevronDown className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function StageLabel({ num, title, tone }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-6 w-6 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: tone }}>{num}</span>
      <h2 className="text-sm font-bold tracking-wide uppercase" style={{ color: tone }}>{title}</h2>
      <div className="flex-1 h-px" style={{ backgroundColor: tone + "33" }} />
    </div>
  );
}

export default function AppFlowchart() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Workflow className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Smart Tex Planner — Complete Flow</h1>
            <p className="text-xs text-muted-foreground">PO Receipt → Planning → Procurement → Production → Shipment</p>
          </div>
        </div>
      </div>

      {/* Mermaid Flowchart */}
      <MermaidFlow />

      {/* STAGE 1 — PO Intake */}
      <section>
        <StageLabel num={1} title="PO Receipt & Price Verification" tone={STAGE_COLORS.intake} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <FlowNode icon={FileText} title="Purchase Orders" tone={STAGE_COLORS.intake}
            items={["Source: Email / PDF / WhatsApp / Manual", "Customer, dates, value, qty, CBM"]} />
          <FlowNode icon={Receipt} title="Proforma Invoice" tone={STAGE_COLORS.intake}
            items={["PI number & date", "Buyer confirmation record"]} />
          <FlowNode icon={CheckCircle2} title="Price Verification" tone={STAGE_COLORS.intake}
            items={["PO items vs saved Price List", "Match / Mismatch → Approval", "Approved → CBM calculation"]} />
        </div>
      </section>

      <Arrow />

      {/* STAGE 2 — Article & Fabric */}
      <section>
        <StageLabel num={2} title="Article Setup & Fabric Planning" tone={STAGE_COLORS.article} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <FlowNode icon={Layers} title="Articles" tone={STAGE_COLORS.article}
            items={["Per SKU: name, code, color, size", "Order quantity per article"]} />
          <FlowNode icon={Shirt} title="Fabric Working" tone={STAGE_COLORS.article}
            items={["Components: Flat/Fitted Sheet, Pillow…", "GSM, width, direction, consumption", "Wastage % → total fabric required"]} />
          <FlowNode icon={Scissors} title="Yarn Planning" tone={STAGE_COLORS.article}
            items={["Yarn count & type", "Total kgs required", "Local / Import + lead time"]} />
        </div>
      </section>

      <Arrow />

      {/* STAGE 3 — Tech Pack (side feed) */}
      <section>
        <StageLabel num={3} title="Tech Pack (AI Extraction)" tone={STAGE_COLORS.techpack} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <div className="md:col-span-2 rounded-xl border-2 border-dashed p-4 shadow-sm" style={{ borderColor: STAGE_COLORS.techpack, backgroundColor: STAGE_COLORS.techpack + "0d" }}>
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5" style={{ color: STAGE_COLORS.techpack }} />
              <h3 className="font-semibold text-sm">Upload → Extract → Review → Approve</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {["PDF / Excel / Image upload", "AI extracts article, fabrics, trims, packaging", "Review & edit extracted data", "Only Approved packs push to modules"].map((s, i) => (
                <div key={i} className="rounded-lg bg-card border p-2.5 text-muted-foreground flex items-center gap-1.5">
                  <span className="font-bold shrink-0" style={{ color: STAGE_COLORS.techpack }}>{i + 1}.</span> {s}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-card border p-4 flex flex-col justify-center">
            <p className="text-xs font-semibold text-foreground mb-1.5">Feeds into ↓</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Articles & Fabric Templates</li>
              <li>• Price List</li>
              <li>• Trims & Labels</li>
              <li>• Packaging (pack type auto-locked)</li>
            </ul>
          </div>
        </div>
      </section>

      <Arrow />

      {/* STAGE 4 — Trims & Packaging */}
      <section>
        <StageLabel num={4} title="Trims & Packaging Planning" tone={STAGE_COLORS.trims} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <FlowNode icon={Scissors} title="Trims & Labels" tone={STAGE_COLORS.trims}
            items={["Zipper, Slider, Elastic, Button, Dori…", "Per Piece / Meter / Set / %", "Wastage % → quantity required"]} />
          <div className="md:col-span-2">
            <FlowNode icon={Tag} title="Packaging — by Pack Type" tone={STAGE_COLORS.trims}
              items={[
                "Sheet Pack / Roll Pack / Box Pack — strict isolation",
                "Labels, Insert Card, Polybag, Sticker, Stiffener, Carton, Bellyband",
                "Carton: pieces-per-carton → carton qty & CBM",
              ]} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {["Sheet Pack", "Roll Pack", "Box Pack"].map(pt => (
                <div key={pt} className="rounded-lg border bg-muted px-2 py-1.5 text-center text-[11px] font-semibold text-foreground">{pt}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Arrow />

      {/* STAGE 5 — Procurement */}
      <section>
        <StageLabel num={5} title="Procurement" tone={STAGE_COLORS.procurement} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FlowNode icon={Package} title="Accessory Purchase Orders" tone={STAGE_COLORS.procurement}
            items={["Planned items grouped per supplier", "Draft → Issued → Confirmed → Received", "Costs & currency tracked"]} />
          <FlowNode icon={Package} title="Accessory Templates" tone={STAGE_COLORS.procurement}
            items={["Master specs per category", "Default wastage & multiplier", "Reuse across POs"]} />
        </div>
      </section>

      <Arrow />

      {/* STAGE 6 — Production */}
      <section>
        <StageLabel num={6} title="Production" tone={STAGE_COLORS.production} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <FlowNode icon={Cog} title="Production Orders" tone={STAGE_COLORS.production}
            items={["Per article: qty, factory, line, priority", "Material readiness: fabric / trims / packaging", "Kanban board view"]} />
          <FlowNode icon={ClipboardList} title="10 Production Stages" tone={STAGE_COLORS.production}
            items={["Fabric Inhouse → Cutting → Stitching → Filling → Inspection → Packing → Carton → Warehouse → Ready → Shipped", "Daily logs: produced / rejected / reworked", "Efficiency % per shift"]} />
          <FlowNode icon={CheckCircle2} title="Shipment Readiness" tone={STAGE_COLORS.production}
            items={["Packed qty vs planned", "Readiness % per order", "Delay risk: Low / Medium / High / Critical"]} />
        </div>
      </section>

      <Arrow />

      {/* STAGE 7 — Shipping */}
      <section>
        <StageLabel num={7} title="Shipment" tone={STAGE_COLORS.shipping} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FlowNode icon={Ship} title="Shipping Documents" tone={STAGE_COLORS.shipping}
            items={["B/L, Commercial Invoice, Packing List", "Certificates & Test Reports", "Before / After shipment status"]} />
          <FlowNode icon={ClipboardList} title="Job Cards" tone={STAGE_COLORS.shipping}
            items={["Weaving / Knitting / Dyeing / Finishing", "Step status & dates", "Created → In Progress → Completed"]} />
        </div>
        <div className="mt-4 rounded-xl border-2 p-4 text-center" style={{ borderColor: STAGE_COLORS.shipping }}>
          <p className="text-sm font-bold text-foreground">📦 PO Completed & Shipped</p>
          <p className="text-xs text-muted-foreground mt-0.5">Status: PO Received → … → In Production → Shipped → Completed</p>
        </div>
      </section>
    </div>
  );
}