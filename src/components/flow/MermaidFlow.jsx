import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check, Printer } from "lucide-react";

mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });

export const FLOW_CHART_DEFINITION = `flowchart TD
    PO["Purchase Order Received<br/>Email / PDF / WhatsApp / Manual"] --> PI["Proforma Invoice<br/>PI No & Date"]
    PO --> PV["Price Verification<br/>PO Items vs Price List"]
    PV -->|Approved| CBM["CBM Calculated"]
    ART["Articles<br/>Per SKU, Color, Size, Qty"]
    CBM --> ART
    ART --> FW["Fabric Working<br/>Components, GSM, Consumption, Wastage"]
    FW --> YP["Yarn Planning<br/>Count, Type, Total Kgs"]
    TP["Tech Pack Upload<br/>PDF / Excel / Image"] --> AIX["AI Extraction + Review"]
    AIX --> TPA["Tech Pack Approved"]
    TPA --> ART
    TR["Trims & Labels<br/>Zipper, Elastic, Button, Dori..."]
    TPA --> TR
    PKG["Packaging Planning<br/>Sheet / Roll / Box Pack"]
    TPA --> PKG
    APO["Accessory Purchase Orders<br/>Draft - Issued - Confirmed - Received"]
    TR --> APO
    PKG --> APO
    PROD["Production Order<br/>Factory, Line, Priority"]
    ART --> PROD
    YP --> PROD
    APO -->|Materials Inhouse| PROD
    PROD --> STG["Production Stages<br/>Fabric Inhouse - Cutting - Stitching - Filling -<br/>Inspection - Packing - Carton Packing -<br/>Warehouse - Shipment Ready - Shipped"]
    STG --> LOG["Daily Production Logs<br/>Produced / Rejected / Reworked"]
    LOG --> SR["Shipment Readiness %"]
    STG --> JC["Job Cards<br/>Weaving / Knitting / Dyeing / Finishing"]
    STG --> SHIP["Shipping Documents<br/>B/L, Invoice, Packing List, Certificates"]
    SR --> SHIP
    SHIP --> DONE["PO Completed & Shipped"]

    style PO fill:#2563eb,stroke:#1e40af,color:#fff
    style TPA fill:#7c3aed,stroke:#5b21b6,color:#fff
    style TR fill:#d97706,stroke:#92400e,color:#fff
    style PKG fill:#d97706,stroke:#92400e,color:#fff
    style APO fill:#059669,stroke:#065f46,color:#fff
    style PROD fill:#dc2626,stroke:#991b1b,color:#fff
    style STG fill:#dc2626,stroke:#991b1b,color:#fff
    style DONE fill:#16a34a,stroke:#14532d,color:#fff
`;

export default function MermaidFlow() {
  const [svg, setSvg] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { svg } = await mermaid.render(
        `tex-flow-${Date.now()}`,
        FLOW_CHART_DEFINITION
      );
      if (!cancelled) setSvg(svg);
    })();
    return () => { cancelled = true; };
  }, []);

  const copyCode = async () => {
    await navigator.clipboard.writeText(FLOW_CHART_DEFINITION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printChart = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    w.document.write(
      `<html><head><title>Smart Tex Planner - App Flowchart</title>` +
      `<style>body{font-family:sans-serif;padding:16px}svg{max-width:100%;height:auto}</style>` +
      `</head><body>${svg}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Code2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Mermaid Flowchart</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyCode}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Code"}
          </Button>
          <Button variant="outline" size="sm" onClick={printChart} disabled={!svg}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCode(!showCode)}>
            <Code2 className="h-3.5 w-3.5" />
            {showCode ? "Hide Code" : "Show Code"}
          </Button>
        </div>
      </div>

      {showCode && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          {FLOW_CHART_DEFINITION}
        </pre>
      )}

      <div ref={containerRef} className="mt-4 overflow-auto rounded-lg border bg-background p-4">
        {svg ? (
          <div className="mermaid-output flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}