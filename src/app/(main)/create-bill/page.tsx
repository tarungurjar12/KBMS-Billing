
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus, PlusCircle, Trash2, Search, XCircle, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { collection, getDocs, doc, runTransaction, serverTimestamp, addDoc, updateDoc, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Customer } from './../customers/page'; // Re-using Customer interface
import type { Product } from './../products/page'; // Re-using Product interface
import type { InvoiceItem, Invoice } from './../billing/page'; // Re-using Invoice interfaces

/**
 * @fileOverview Page for creating new bills/invoices or editing existing ones.
 * Accessible by Store Managers and Admins.
 * Allows selection of a customer, adding products to the bill, calculating totals including GST,
 * and generating/updating the bill which deducts/adjusts stock in Firestore.
 */

// Define Product type specific to this page if needed, or import from products/page.tsx
// For now, assuming Product interface from products/page.tsx is suitable.

interface BillItem extends Product { // Product here refers to the imported Product type
  quantity: number;
  total: number; // quantity * numericPrice
}

const BUSINESS_STATE_CODE = "29"; // Example: Karnataka. Future: Make this configurable in app settings.

/**
 * CreateBillPage component.
 * Provides UI and logic for creating or editing bills.
 * @returns {JSX.Element} The rendered create/edit bill page.
 */
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


  const formatCurrency = useCallback((num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

  /**
   * Fetches initial data: customers and products from Firestore.
   * If editing an invoice, fetches that invoice's data too.
   */
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [customersSnapshot, productsSnapshot] = await Promise.all([
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "products"))
      ]);
      
      const fetchedCustomers = customersSnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Customer));
      setCustomers(fetchedCustomers);

      const fetchedProducts = productsSnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return { 
              id: docSnapshot.id, 
              name: data.name,
              sku: data.sku,
              numericPrice: data.numericPrice,
              displayPrice: formatCurrency(data.numericPrice),
              stock: data.stock,
              unitOfMeasure: data.unitOfMeasure,
              category: data.category,
              imageUrl: data.imageUrl,
              dataAiHint: data.dataAiHint,
          } as Product;
      });
      setProducts(fetchedProducts);

      if (editInvoiceId) {
        const invoiceRef = doc(db, "invoices", editInvoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data() as Invoice;
          setSelectedCustomerId(invoiceData.customerId);
          const loadedBillItems = invoiceData.items.map(item => {
            const productDetails = fetchedProducts.find(p => p.id === item.productId);
            return {
              ...productDetails!, // Assume product exists
              id: item.productId, // Ensure 'id' is used consistently for product ID
              quantity: item.quantity,
              total: item.total,
              // Other product fields are spread from productDetails
            } as BillItem;
          });
          setBillItems(loadedBillItems);
          setOriginalBillItemsForEdit(loadedBillItems.map(item => ({...item}))); // Store a deep copy
        } else {
          toast({ title: "Error", description: "Invoice to edit not found.", variant: "destructive"});
          router.push("/billing");
        }
      }

    } catch (error) {
      console.error("Error fetching initial data: ", error);
      toast({ title: "Error", description: "Could not load required data from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, editInvoiceId, router, formatCurrency]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  const handleAddProductToBill = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
      return;
    }
    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(item => item.id === product.id);
      if (existingItemIndex > -1) {
        const updatedBillItems = [...prevItems];
        const existingItem = updatedBillItems[existingItemIndex];
        if (existingItem.quantity < product.stock) {
          existingItem.quantity += 1;
          existingItem.total = existingItem.quantity * existingItem.numericPrice;
        } else {
          toast({ title: "Max Stock Reached", description: `Cannot add more ${product.name} than available in stock (${product.stock}).`, variant: "destructive" });
        }
        return updatedBillItems;
      } else {
        return [...prevItems, { ...product, quantity: 1, total: product.numericPrice }];
      }
    });
    setProductSearchTerm("");
  }, [toast]);

  const handleQuantityChange = (productId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    setBillItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.id === productId);
      if (itemIndex === -1) return prevItems;

      const updatedBillItems = [...prevItems];
      const currentItem = { ...updatedBillItems[itemIndex] }; // Work with a copy

      if (isNaN(newQuantity) || newQuantity < 1) {
          updatedBillItems.splice(itemIndex, 1); // Remove item
          return updatedBillItems;
      }
      if (newQuantity > currentItem.stock) {
          toast({ title: "Stock Limit Exceeded", description: `Cannot set quantity for ${currentItem.name} above available stock (${currentItem.stock}). Setting to max available.`, variant: "destructive"});
          currentItem.quantity = currentItem.stock;
      } else {
          currentItem.quantity = newQuantity;
      }
      currentItem.total = currentItem.quantity * currentItem.numericPrice;
      updatedBillItems[itemIndex] = currentItem;
      return updatedBillItems;
    });
  };
  
  const handleRemoveItem = (productId: string) => {
    setBillItems(billItems.filter(item => item.id !== productId));
  };

  const subTotal = billItems.reduce((acc, item) => acc + item.total, 0);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const isInterState = selectedCustomer?.gstin ? selectedCustomer.gstin.substring(0, 2) !== BUSINESS_STATE_CODE : false;
  
  // Simplified GST for now. Future: product-specific tax rates.
  const GST_RATE = 0.18; 
  let cgst = 0, sgst = 0, igst = 0;
  if (selectedCustomer?.gstin) { // Apply GST only if customer has GSTIN
    if (isInterState) {
      igst = subTotal * GST_RATE;
    } else {
      cgst = subTotal * (GST_RATE / 2);
      sgst = subTotal * (GST_RATE / 2);
    }
  }
  const grandTotal = subTotal + cgst + sgst + igst;

  const handleGenerateOrUpdateBill = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Customer Not Selected", description: "Please select a customer.", variant: "destructive" });
      return;
    }
    if (billItems.length === 0) {
      toast({ title: "No Items in Bill", description: "Please add products to the bill.", variant: "destructive" });
      return;
    }
    
    const currentFirebaseUser = auth.currentUser;
    if (!currentFirebaseUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        // Stock adjustment logic
        const stockAdjustments: { ref: any, newStock: number, item: BillItem }[] = [];

        // For new bill or edited bill, calculate new stock changes
        for (const item of billItems) {
            const productRef = doc(db, "products", item.id);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error(`Product ${item.name} not found.`);
            
            let currentDbStock = productSnap.data().stock;
            let quantityChange = item.quantity; // Amount to deduct for new item

            if (editInvoiceId) {
                const originalItem = originalBillItemsForEdit.find(oi => oi.id === item.id);
                if (originalItem) { // Item existed in original bill
                    quantityChange = item.quantity - originalItem.quantity; // Difference to adjust stock by
                }
                // If item is new to an edited bill, quantityChange remains item.quantity
            }
            
            if (currentDbStock < quantityChange && quantityChange > 0) { // Check only if we are deducting stock
                 throw new Error(`Insufficient stock for ${item.name}. Available: ${currentDbStock}, Needed for this change: ${quantityChange}.`);
            }
            stockAdjustments.push({ ref: productRef, newStock: currentDbStock - quantityChange, item });
        }
        
        // For items removed from an edited bill, add their stock back
        if (editInvoiceId) {
            for (const originalItem of originalBillItemsForEdit) {
                if (!billItems.find(bi => bi.id === originalItem.id)) { // Item was removed
                    const productRef = doc(db, "products", originalItem.id);
                    const productSnap = await transaction.get(productRef); // Assuming it exists
                    if (!productSnap.exists()) throw new Error(`Product ${originalItem.name} not found for stock restoration.`);
                    let currentDbStock = productSnap.data().stock;
                    stockAdjustments.push({ ref: productRef, newStock: currentDbStock + originalItem.quantity, item: originalItem });
                }
            }
        }

        // Apply stock updates
        stockAdjustments.forEach(adj => transaction.update(adj.ref, { stock: adj.newStock }));
        
        // Prepare bill data
        const billData: Omit<Invoice, 'id'> = { 
          customerId: selectedCustomerId, 
          customerName: customers.find(c=>c.id === selectedCustomerId)?.name || "N/A",
          items: billItems.map(i => ({productId: i.id, name: i.name, quantity: i.quantity, unitPrice: i.numericPrice, total: i.total, unitOfMeasure: i.unitOfMeasure})), 
          subTotal, cgst, sgst, igst, 
          totalAmount: grandTotal, // Renamed from grandTotal in interface
          displayTotal: formatCurrency(grandTotal),
          status: "Pending", // Default status for new/edited bill
          invoiceNumber: editInvoiceId ? (billItems[0]?.sku.substring(0,3) + Date.now().toString().slice(-4)) : `INV-${Date.now().toString().slice(-6)}`, // Generate new or use existing if logic allows
          date: format(new Date(), "MMM dd, yyyy"),
          isoDate: new Date().toISOString(),
          // createdBy: currentFirebaseUser.uid, // Store manager/admin ID
          // createdAt: serverTimestamp(), // Firestore server timestamp
        };
        // Remove 'id' if it exists, as Firestore handles it
        // const { id, ...dataToSave } = billData;

        if (editInvoiceId) {
            const invoiceRef = doc(db, "invoices", editInvoiceId);
            transaction.update(invoiceRef, billData);
        } else {
            const newInvoiceRef = doc(collection(db, "invoices")); // Auto-generate ID
            transaction.set(newInvoiceRef, billData);
        }
      });

      toast({ title: editInvoiceId ? "Bill Updated" : "Bill Generated", description: `Bill ${editInvoiceId ? 'updated' : 'created'} successfully. Inventory updated.` });
      // Reset form
      setSelectedCustomerId(undefined);
      setBillItems([]);
      setProductSearchTerm("");
      setOriginalBillItemsForEdit([]);
      router.push("/billing"); // Navigate to billing page after success
    } catch (error: any) {
      console.error(`Error ${editInvoiceId ? 'updating' : 'generating'} bill: `, error);
      toast({ title: `Bill ${editInvoiceId ? 'Update' : 'Generation'} Failed`, description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(productSearchTerm.toLowerCase()))
    : [];

  if (isLoading) {
    return <PageHeader title={editInvoiceId ? "Edit Bill" : "Create New Bill"} description="Loading data from database..." icon={ClipboardPlus} />;
  }

  return (
    <>
      <PageHeader
        title={editInvoiceId ? "Edit Bill" : "Create New Bill"}
        description={editInvoiceId ? "Modify the existing bill details." : "Generate a new bill for a customer. Calculates GST automatically."}
        icon={ClipboardPlus}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Customer & Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">1. Customer & Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customer-select">Select Customer</Label>
                <div className="flex gap-2 mt-1">
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                    <SelectTrigger id="customer-select" className={selectedCustomerId ? "" : "text-muted-foreground"}><SelectValue placeholder="Choose an existing customer" /></SelectTrigger>
                    <SelectContent>
                        {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} {customer.gstin ? `(GSTIN: ${customer.gstin})` : ''}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => router.push("/customers?addNew=true")} disabled={isSubmitting}> {/* Redirect to customer page to add new */}
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New
                    </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="product-search">Add Products to Bill</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="product-search" 
                    placeholder="Search products by name, SKU..." 
                    className="pl-8" 
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {productSearchTerm && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setProductSearchTerm("")} title="Clear search" disabled={isSubmitting}>
                        <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {productSearchTerm && filteredProducts.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-background shadow-md z-10">
                    {filteredProducts.map(product => (
                      <div 
                        key={product.id} 
                        className="p-3 hover:bg-accent/80 dark:hover:bg-accent/20 cursor-pointer flex justify-between items-center"
                        onClick={() => !isSubmitting && handleAddProductToBill(product)}
                      >
                        <div>
                            <p className="font-medium">{product.name} <span className="text-xs text-muted-foreground">({product.unitOfMeasure})</span></p>
                            <p className="text-sm text-muted-foreground">Price: {product.displayPrice} - Stock: {product.stock}</p>
                        </div>
                        <Button variant="ghost" size="sm" disabled={product.stock <= 0 || isSubmitting} onClick={(e) => { e.stopPropagation(); if(!isSubmitting) handleAddProductToBill(product); }}>
                            {product.stock > 0 ? "Add" : "Out of Stock"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                 {productSearchTerm && filteredProducts.length === 0 && (
                     <p className="mt-2 text-sm text-muted-foreground">No products found matching "{productSearchTerm}".</p>
                 )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">2. Bill Items</CardTitle>
            </CardHeader>
            <CardContent>
              {billItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[100px]">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[50px]"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.unitOfMeasure})</span></TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={item.quantity} 
                            min="1"
                            max={item.stock + (originalBillItemsForEdit.find(oi => oi.id === item.id)?.quantity || 0) } // Allow up to current stock + original quantity if editing
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="h-8 w-20"
                            disabled={isSubmitting}
                          />
                        </TableCell>
                        <TableCell className="text-right">{item.displayPrice}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => !isSubmitting && handleRemoveItem(item.id)} title={`Remove ${item.name}`} disabled={isSubmitting}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 bg-muted/30 rounded-md text-center border border-dashed">
                  <p className="text-muted-foreground">Search and add products to build the bill.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Bill Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg rounded-xl sticky top-6">
            <CardHeader>
              <CardTitle className="font-headline text-foreground flex items-center gap-2"><Calculator className="h-5 w-5"/>3. Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(subTotal)}</span>
              </div>
              {selectedCustomer?.gstin && !isInterState && (
                <>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST ({(GST_RATE/2)*100}%):</span>
                    <span className="font-medium">{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST ({(GST_RATE/2)*100}%):</span>
                    <span className="font-medium">{formatCurrency(sgst)}</span>
                </div>
                </>
              )}
              {selectedCustomer?.gstin && isInterState && (
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST ({GST_RATE*100}%):</span>
                    <span className="font-medium">{formatCurrency(igst)}</span>
                </div>
              )}
               {!selectedCustomer?.gstin && subTotal > 0 && (
                <p className="text-xs text-muted-foreground text-center">(GST not applied as customer GSTIN is not provided)</p>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={handleGenerateOrUpdateBill} disabled={billItems.length === 0 || !selectedCustomerId || isLoading || isSubmitting}>
                {isSubmitting ? (editInvoiceId ? "Updating Bill..." : "Generating Bill...") : (editInvoiceId ? "Update Bill" : "Generate Bill")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
