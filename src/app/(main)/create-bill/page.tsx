
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus, PlusCircle, Trash2, Search, XCircle, Calculator, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { collection, getDocs, doc, runTransaction, serverTimestamp, addDoc, updateDoc, getDoc, query, Timestamp, where } from 'firebase/firestore';
import type { DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import type { Customer } from './../customers/page'; 
import type { Product } from './../products/page';
import type { InvoiceItem, Invoice } from './../billing/page';
import type { LedgerEntry } from './../ledger/page';
import { format } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * @fileOverview Page for creating new bills/invoices or editing existing ones.
 * Allows selection of a customer, adding products, calculating totals including GST,
 * and generating/updating the bill which deducts/adjusts stock in Firebase Firestore.
 * Includes functionality to create a consolidated invoice for a customer's pending ledger items.
 */

interface BillItem extends Product { 
  quantity: number;
  total: number; 
}

interface PendingLedgerItemToInvoice extends LedgerEntry {
  isSelected: boolean;
}

const BUSINESS_STATE_CODE = "29"; 
const GST_RATE = 0.18; 
type BillCreationMode = "standard" | "from_pending_ledger";

export default function CreateBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editInvoiceId = searchParams.get('editInvoiceId'); 

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  
  const [originalBillItemsForEdit, setOriginalBillItemsForEdit] = useState<BillItem[]>([]);
  const [billCreationMode, setBillCreationMode] = useState<BillCreationMode>("standard");
  const [pendingLedgerItems, setPendingLedgerItems] = useState<PendingLedgerItemToInvoice[]>([]);
  const [isLoadingPendingItems, setIsLoadingPendingItems] = useState(false);

  const formatCurrency = useCallback((num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [customersSnapshot, productsSnapshot] = await Promise.all([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "products"))
      ]);
      
      const fetchedCustomers = customersSnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Customer));
      setCustomers(fetchedCustomers);

      const fetchedProducts = productsSnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data(), displayPrice: formatCurrency(docSnapshot.data().numericPrice || 0) } as Product));
      setProducts(fetchedProducts);

      if (editInvoiceId) {
        setBillCreationMode("standard"); // Editing always implies standard mode
        const invoiceRef = doc(db, "invoices", editInvoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data() as Invoice;
          setSelectedCustomerId(invoiceData.customerId);
          const loadedBillItems = invoiceData.items.map(item => {
            const productDetails = fetchedProducts.find(p => p.id === item.productId);
            return { ...productDetails, id: item.productId, quantity: item.quantity, total: item.total, numericPrice: item.unitPrice, displayPrice: formatCurrency(item.unitPrice) } as BillItem;
          });
          setBillItems(loadedBillItems);
          setOriginalBillItemsForEdit(loadedBillItems.map(item => ({...item}))); 
        } else {
          toast({ title: "Invoice Not Found", variant: "destructive"}); router.push("/billing"); 
        }
      }
    } catch (error) {
      toast({ title: "Data Load Error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, editInvoiceId, router, formatCurrency]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const fetchPendingLedgerItems = useCallback(async (customerId: string) => {
    if (!customerId) { setPendingLedgerItems([]); return; }
    setIsLoadingPendingItems(true);
    try {
      const q = query(collection(db, "ledgerEntries"), 
        where("entityId", "==", customerId), 
        where("type", "==", "sale"), 
        where("entryPurpose", "==", "Transactional"),
        where("paymentStatus", "in", ["pending", "partial"])
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, isSelected: false } as PendingLedgerItemToInvoice));
      setPendingLedgerItems(items);
      if (items.length === 0) {
        toast({title: "No Pending Items", description: "This customer has no pending or partially paid sales ledger entries.", variant: "default"});
      }
    } catch (error) {
      toast({title: "Error Fetching Pending Items", variant: "destructive"});
    } finally {
      setIsLoadingPendingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    if (billCreationMode === "from_pending_ledger" && selectedCustomerId) {
      fetchPendingLedgerItems(selectedCustomerId);
    } else {
      setPendingLedgerItems([]);
    }
     setBillItems([]); // Clear standard bill items when mode changes
  }, [billCreationMode, selectedCustomerId, fetchPendingLedgerItems]);


  const handleAddProductToBill = useCallback((product: Product) => {
    if (product.stock <= 0) { toast({ title: "Out of Stock", variant: "destructive" }); return; }
    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(item => item.id === product.id);
      if (existingItemIndex > -1) { 
        const updatedBillItems = [...prevItems];
        const existingItem = updatedBillItems[existingItemIndex];
        const originalItem = originalBillItemsForEdit.find(oi => oi.id === product.id);
        const effectiveStockAvailable = product.stock + (originalItem ? originalItem.quantity : 0);
        if (existingItem.quantity < effectiveStockAvailable) {
          existingItem.quantity += 1; existingItem.total = existingItem.quantity * existingItem.numericPrice; 
        } else {
          toast({ title: "Max Stock Reached", variant: "destructive" });
        }
        return updatedBillItems;
      } else { 
        return [...prevItems, { ...product, quantity: 1, total: product.numericPrice }];
      }
    });
    setProductSearchTerm(""); 
  }, [toast, originalBillItemsForEdit]);

  const handleQuantityChange = (productId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    setBillItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.id === productId);
      if (itemIndex === -1) return prevItems; 
      const updatedBillItems = [...prevItems];
      const currentItem = { ...updatedBillItems[itemIndex] }; 
      const productDetails = products.find(p => p.id === productId); 
      if (isNaN(newQuantity) || newQuantity < 1) { updatedBillItems.splice(itemIndex, 1); return updatedBillItems; }
      const originalItem = originalBillItemsForEdit.find(oi => oi.id === currentItem.id);
      const effectiveStockLimit = (productDetails?.stock || 0) + (originalItem ? originalItem.quantity : 0);
      if (newQuantity > effectiveStockLimit) {
          toast({ title: "Stock Limit Exceeded", variant: "destructive"}); currentItem.quantity = effectiveStockLimit;
      } else { currentItem.quantity = newQuantity; }
      currentItem.total = currentItem.quantity * currentItem.numericPrice; 
      updatedBillItems[itemIndex] = currentItem;
      return updatedBillItems;
    });
  };
  
  const handleRemoveItem = (productId: string) => setBillItems(billItems.filter(item => item.id !== productId));

  const handleTogglePendingItemSelection = (itemId: string) => {
    setPendingLedgerItems(prev => prev.map(item => item.id === itemId ? { ...item, isSelected: !item.isSelected } : item));
  };

  const subTotal = useMemo(() => {
    if (billCreationMode === 'standard') {
      return billItems.reduce((acc, item) => acc + item.total, 0);
    } else { // from_pending_ledger
      return pendingLedgerItems.filter(item => item.isSelected).reduce((acc, item) => acc + (item.remainingAmount || 0), 0);
    }
  }, [billItems, pendingLedgerItems, billCreationMode]);

  const selectedCustomerDetails = customers.find(c => c.id === selectedCustomerId);
  const isInterState = selectedCustomerDetails?.gstin ? selectedCustomerDetails.gstin.substring(0, 2) !== BUSINESS_STATE_CODE : false;
  
  let cgst = 0, sgst = 0, igst = 0;
  if (selectedCustomerDetails?.gstin) { 
    if (isInterState) igst = subTotal * GST_RATE;
    else { cgst = subTotal * (GST_RATE / 2); sgst = subTotal * (GST_RATE / 2); }
  }
  const grandTotal = subTotal + cgst + sgst + igst;

  const handleGenerateOrUpdateBill = async () => {
    if (!selectedCustomerId) { toast({ title: "Customer Not Selected", variant: "destructive" }); return; }
    if (billCreationMode === 'standard' && billItems.length === 0) { toast({ title: "No Items in Bill", variant: "destructive" }); return; }
    if (billCreationMode === 'from_pending_ledger' && !pendingLedgerItems.some(i => i.isSelected)) { toast({ title: "No Pending Items Selected", variant: "destructive" }); return; }
    
    const currentFirebaseUser = auth.currentUser;
    if (!currentFirebaseUser) { toast({ title: "Authentication Error", variant: "destructive" }); return; }
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        let existingInvoiceNumber: string | undefined;
        if (editInvoiceId && billCreationMode === 'standard') {
            const invoiceToEditRef = doc(db, "invoices", editInvoiceId);
            const invoiceToEditSnap = await transaction.get(invoiceToEditRef);
            if (invoiceToEditSnap.exists()) existingInvoiceNumber = invoiceToEditSnap.data().invoiceNumber;
            else throw new Error(`Invoice with ID ${editInvoiceId} not found.`);
        }

        let invoiceItemsForSave: InvoiceItem[];
        if (billCreationMode === 'standard') {
            const allProductIdsInvolved = new Set([...billItems.map(item => item.id), ...originalBillItemsForEdit.map(item => item.id)]);
            const productSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
            for (const productId of allProductIdsInvolved) {
                const productRef = doc(db, "products", productId);
                const productSnap = await transaction.get(productRef);
                if (!productSnap.exists()) throw new Error(`Product ID ${productId} not found.`);
                productSnapshots.set(productId, productSnap);
            }
            const productUpdates: { ref: any, newStock: number }[] = [];
            for (const productId of allProductIdsInvolved) {
                const productSnap = productSnapshots.get(productId)!;
                const currentDbStock = productSnap.data()!.stock as number;
                const currentBillItem = billItems.find(item => item.id === productId);
                const originalBillItem = originalBillItemsForEdit.find(item => item.id === productId);
                const originalQuantityInBill = originalBillItem ? originalBillItem.quantity : 0;
                const newQuantityInBill = currentBillItem ? currentBillItem.quantity : 0;
                const stockChange = originalQuantityInBill - newQuantityInBill; 
                const newStockLevel = currentDbStock + stockChange;
                if (newStockLevel < 0) throw new Error(`Insufficient stock for ${productSnap.data()!.name}.`);
                productUpdates.push({ ref: productSnap.ref, newStock: newStockLevel });
            }
            for (const pu of productUpdates) transaction.update(pu.ref, { stock: pu.newStock, updatedAt: serverTimestamp() });
            invoiceItemsForSave = billItems.map(i => ({ productId: i.id, name: i.name, quantity: i.quantity, unitPrice: i.numericPrice, total: i.total, unitOfMeasure: i.unitOfMeasure }));
        } else { // from_pending_ledger
             invoiceItemsForSave = pendingLedgerItems.filter(i => i.isSelected).map(li => ({
                productId: `PENDING_REF:${li.id}`, // Special ID to indicate it's from a ledger entry
                name: `Ref: Ledger ${li.id.substring(0,6)} (${format(new Date(li.date), "dd/MM/yy")}) - ${li.items.map(i=>i.productName).join(', ').substring(0,20)}...`,
                quantity: 1, unitPrice: li.remainingAmount || 0, total: li.remainingAmount || 0, unitOfMeasure: "summary"
            }));
            // No stock adjustment for "from_pending_ledger" mode
        }
        
        const billData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & {createdAt?: any, updatedAt?: any, createdBy: string} = { 
          customerId: selectedCustomerId, customerName: customers.find(c=>c.id === selectedCustomerId)?.name || "N/A",
          items: invoiceItemsForSave, subTotal, cgst, sgst, igst, totalAmount: grandTotal, displayTotal: formatCurrency(grandTotal),
          status: "Pending", invoiceNumber: (editInvoiceId && billCreationMode === 'standard') ? existingInvoiceNumber! : `INV-${Date.now().toString().slice(-6)}`,
          date: format(new Date(), "MMM dd, yyyy"), isoDate: new Date().toISOString(), createdBy: currentFirebaseUser.uid, 
        };
        
        if (editInvoiceId && billCreationMode === 'standard') {
            transaction.update(doc(db, "invoices", editInvoiceId), {...billData, updatedAt: serverTimestamp()});
        } else {
            transaction.set(doc(collection(db, "invoices")), {...billData, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
        }
      });

      toast({ title: (editInvoiceId && billCreationMode === 'standard') ? "Bill Updated" : "Bill Generated", description: `Bill ${(editInvoiceId && billCreationMode === 'standard') ? 'updated' : 'created'} successfully.` });
      setSelectedCustomerId(undefined); setBillItems([]); setProductSearchTerm(""); setOriginalBillItemsForEdit([]); setPendingLedgerItems([]);
      router.push("/billing"); 
    } catch (error: any) {
      toast({ title: `Bill ${(editInvoiceId && billCreationMode === 'standard') ? 'Update' : 'Generation'} Failed`, description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())))
    : [];

  if (isLoading) return <PageHeader title={editInvoiceId ? "Edit Bill" : "Create New Bill"} description="Loading data..." icon={ClipboardPlus} />;

  const pageTitle = editInvoiceId ? "Edit Bill" : (billCreationMode === "from_pending_ledger" ? "Create Invoice from Pending Ledger" : "Create New Bill");
  const pageDescription = editInvoiceId ? "Modify existing bill." : (billCreationMode === "from_pending_ledger" ? "Consolidate customer's pending ledger items into a new invoice." : "Generate a new bill for a customer.");

  return (
    <>
      <PageHeader title={pageTitle} description={pageDescription} icon={billCreationMode === "from_pending_ledger" ? FileText : ClipboardPlus} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">1. Select Customer & Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customer-select">Select Customer</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                    <SelectTrigger id="customer-select" className={selectedCustomerId ? "" : "text-muted-foreground"}><SelectValue placeholder="Choose an existing customer" /></SelectTrigger>
                    <SelectContent>{customers.map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name} {customer.gstin ? `(GSTIN: ${customer.gstin})` : ''}</SelectItem>))}</SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => router.push("/customers?addNew=true")} disabled={isSubmitting} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>
                </div>
              </div>
              {!editInvoiceId && ( // Mode selection only for new bills
                <div>
                    <Label>Bill Creation Mode</Label>
                    <div className="flex gap-2 mt-1">
                        <Button variant={billCreationMode === 'standard' ? 'default' : 'outline'} onClick={() => setBillCreationMode('standard')} disabled={isSubmitting}>Standard Bill</Button>
                        <Button variant={billCreationMode === 'from_pending_ledger' ? 'default' : 'outline'} onClick={() => setBillCreationMode('from_pending_ledger')} disabled={isSubmitting}>From Pending Ledger</Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          {billCreationMode === "standard" && (
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">2. Add Products to Bill</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="product-search">Search Products</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="product-search" placeholder="Search by name, SKU..." className="pl-8" value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)} disabled={isSubmitting}/>
                  {productSearchTerm && (<Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setProductSearchTerm("")} title="Clear search" disabled={isSubmitting}><XCircle className="h-4 w-4" /></Button>)}
                </div>
                {productSearchTerm && filteredProducts.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-background shadow-md z-10">
                    {filteredProducts.map(product => (<div key={product.id} className="p-3 hover:bg-accent/80 cursor-pointer flex justify-between items-center" onClick={() => !isSubmitting && handleAddProductToBill(product)}>
                        <div><p className="font-medium">{product.name} <span className="text-xs text-muted-foreground">({product.unitOfMeasure})</span></p><p className="text-sm text-muted-foreground">Price: {product.displayPrice} - Stock: {product.stock}</p></div>
                        <Button variant="ghost" size="sm" disabled={product.stock <= 0 || isSubmitting} onClick={(e) => { e.stopPropagation(); if(!isSubmitting) handleAddProductToBill(product); }}>{product.stock > 0 ? "Add" : "Out of Stock"}</Button>
                      </div>))}</div>)}
                 {productSearchTerm && filteredProducts.length === 0 && (<p className="mt-2 text-sm text-muted-foreground">No products found.</p>)}
              </div>
              {billItems.length > 0 ? (
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-[120px]">Quantity</TableHead><TableHead className="text-right hidden sm:table-cell">Unit Price</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-[50px]"> </TableHead></TableRow></TableHeader>
                  <TableBody>{billItems.map(item => (<TableRow key={item.id}><TableCell className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.unitOfMeasure})</span></TableCell><TableCell>
                        <Input type="number" value={item.quantity} min="0" max={(products.find(p=>p.id === item.id)?.stock || 0) + (originalBillItemsForEdit.find(oi => oi.id === item.id)?.quantity || 0) } onChange={(e) => handleQuantityChange(item.id, e.target.value)} onBlur={(e) => { const val = parseInt(e.target.value, 10); if (isNaN(val) || val < 1) handleQuantityChange(item.id, "0");}} className="h-8 w-24" disabled={isSubmitting}/>
                        </TableCell><TableCell className="text-right hidden sm:table-cell">{item.displayPrice}</TableCell><TableCell className="text-right">{formatCurrency(item.total)}</TableCell><TableCell>
                        <Button variant="ghost" size="icon" onClick={() => !isSubmitting && handleRemoveItem(item.id)} title={`Remove ${item.name}`} disabled={isSubmitting}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}
                  </TableBody></Table></div>
              ) : (<div className="p-6 bg-muted/30 rounded-md text-center border border-dashed"><p className="text-muted-foreground">Search and add products.</p></div>)}
            </CardContent>
          </Card>
          )}

          {billCreationMode === "from_pending_ledger" && (
            <Card className="shadow-lg rounded-xl">
                <CardHeader><CardTitle className="font-headline text-foreground">2. Select Pending Ledger Items</CardTitle></CardHeader>
                <CardContent>
                    {isLoadingPendingItems ? (<p className="text-muted-foreground">Loading pending items...</p>)
                    : pendingLedgerItems.length === 0 ? (<p className="text-muted-foreground">No pending sale ledger items found for the selected customer, or customer not selected.</p>)
                    : (<ScrollArea className="h-96"><div className="space-y-3">
                        {pendingLedgerItems.map(item => (
                            <Card key={item.id} className={`p-3 flex items-center gap-3 ${item.isSelected ? 'bg-primary/10 border-primary' : ''}`}>
                                <Checkbox id={`item-${item.id}`} checked={item.isSelected} onCheckedChange={() => handleTogglePendingItemSelection(item.id)} disabled={isSubmitting} />
                                <div className="flex-grow text-sm">
                                    <Label htmlFor={`item-${item.id}`} className="font-medium cursor-pointer">
                                        Ledger ID: {item.id.substring(0,6)}... (Date: {format(new Date(item.date), "dd/MM/yy")})
                                    </Label>
                                    <p className="text-xs text-muted-foreground">Items: {item.items.map(i => `${i.productName} (x${i.quantity})`).join(', ').substring(0,50)}...</p>
                                    <p className="text-xs font-semibold">Pending Amt: {formatCurrency(item.remainingAmount || 0)}</p>
                                </div>
                            </Card>
                        ))}
                      </div></ScrollArea>)}
                </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="shadow-lg rounded-xl sticky top-6"> 
            <CardHeader><CardTitle className="font-headline text-foreground flex items-center gap-2"><Calculator className="h-5 w-5"/>3. Bill Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(subTotal)}</span></div>
              {selectedCustomerDetails?.gstin && !isInterState && (<><div className="flex justify-between"><span className="text-muted-foreground">CGST ({(GST_RATE/2)*100}%):</span><span className="font-medium">{formatCurrency(cgst)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">SGST ({(GST_RATE/2)*100}%):</span><span className="font-medium">{formatCurrency(sgst)}</span></div></>)}
              {selectedCustomerDetails?.gstin && isInterState && (<div className="flex justify-between"><span className="text-muted-foreground">IGST ({GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(igst)}</span></div>)}
              {!selectedCustomerDetails?.gstin && subTotal > 0 && (<p className="text-xs text-muted-foreground text-center">(GST not applied as customer GSTIN not provided)</p>)}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={handleGenerateOrUpdateBill} disabled={isLoading || isSubmitting || !selectedCustomerId || (billCreationMode === 'standard' && billItems.length === 0) || (billCreationMode === 'from_pending_ledger' && !pendingLedgerItems.some(i=>i.isSelected))}>
                {isSubmitting ? (editInvoiceId ? "Updating Bill..." : "Generating Bill...") : (editInvoiceId ? "Update Bill" : "Generate Bill")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}

    
