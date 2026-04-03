import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Printer, Plus, Trash2, Download, FileText, X, Ship } from "lucide-react";

const DOC_TYPES = [
  "Bill of Lading", "Commercial Invoice", "Packing List", "Certificate of Origin",
  "Inspection Certificate", "Insurance Certificate", "Phytosanitary Certificate",
  "GOTS Certificate", "Test Report", "Other"
];

const SHIPMENT_STATUS = ["Before Shipment", "After Shipment"];

const emptyForm = {
  po_number: "", customer_name: "", document_type: "Commercial Invoice",
  document_number: "", document_date: "", file_url: "", file_name: "",
  shipment_status: "Before Shipment", notes: ""
};

const STATUS_COLORS = {
  "Before Shipment": "bg-amber-100 text-amber-700",
  "After Shipment": "bg-green-100 text-green-700",
};

export default function ShippingDocuments() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [fileUploading, setFileUploading] = useState(false);
  const docFileRef = useRef();
  const uploadDocRef = useRef();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["shippingDocs"],
    queryFn: () => base44.entities.ShippingDocument.list("-created_date", 200),
  });

  const filtered = docs.filter(d => {
    const matchStatus = filterStatus === "All" || d.shipment_status === filterStatus;
    const matchSearch = !search ||
      d.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type?.toLowerCase().includes(search.toLowerCase()) ||
      d.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.document_number?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const openNew = () => { setForm(emptyForm); setEditingItem(null); setShowForm(true); };
  const openEdit = (doc) => { setForm({ ...emptyForm, ...doc }); setEditingItem(doc); setShowForm(true); };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url, file_name: file.name }));
    setFileUploading(false);
    docFileRef.current.value = "";
  };

  const handleSave = async () => {
    if (editingItem) {
      await base44.entities.ShippingDocument.update(editingItem.id, form);
    } else {
      await base44.entities.ShippingDocument.create(form);
    }
    queryClient.invalidateQueries({ queryKey: ["shippingDocs"] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this document?")) {
      await base44.entities.ShippingDocument.delete(id);
      queryClient.invalidateQueries({ queryKey: ["shippingDocs"] });
    }
  };

  const beforeShipment = docs.filter(d => d.shipment_status === "Before Shipment").length;
  const afterShipment = docs.filter(d => d.shipment_status === "After Shipment").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Shipping Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all shipping & compliance documents — before and after shipment</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Document
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total Documents</p><p className="text-xl font-bold">{docs.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center"><FileText className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">Before Shipment</p><p className="text-xl font-bold">{beforeShipment}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center"><Ship className="h-4 w-4 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">After Shipment</p><p className="text-xl font-bold">{afterShipment}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Input className="h-9 text-sm" placeholder="Search by PO, doc type, customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["All", "Before Shipment", "After Shipment"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="p-10 text-center">
            <Ship className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-sm">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Upload shipping documents like BL, Invoice, Packing List, COO etc.</p>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Add First Document</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{doc.document_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[doc.shipment_status] || ""}`}>{doc.shipment_status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                    {doc.po_number && <span>PO: {doc.po_number}</span>}
                    {doc.customer_name && <span>Customer: {doc.customer_name}</span>}
                    {doc.document_number && <span>Doc#: {doc.document_number}</span>}
                    {doc.document_date && <span>Date: {doc.document_date}</span>}
                    {doc.file_name && <span className="text-primary">📎 {doc.file_name}</span>}
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{doc.notes}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
                    </a>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(doc)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-base">{editingItem ? "Edit Document" : "Add Document"}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Document Type</label>
                <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shipment Status</label>
                <Select value={form.shipment_status} onValueChange={v => setForm(f => ({ ...f, shipment_status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{SHIPMENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "PO Number", key: "po_number" }, { label: "Customer Name", key: "customer_name" },
                  { label: "Document Number", key: "document_number" }, { label: "Document Date", key: "document_date", inputType: "date" },
                ].map(({ label, key, inputType }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                    <Input className="h-8 text-sm" type={inputType || "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Upload File</label>
                <input ref={docFileRef} type="file" className="hidden" onChange={handleFileUpload} />
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => docFileRef.current.click()} disabled={fileUploading}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />{fileUploading ? "Uploading..." : "Choose File"}
                  </Button>
                  {form.file_name && <span className="text-xs text-primary">📎 {form.file_name}</span>}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <Input className="h-8 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save Document</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}