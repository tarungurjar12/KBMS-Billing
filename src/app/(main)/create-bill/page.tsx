
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
import { collection, getDocs, doc, runTransaction, serverTimestamp, addDoc, updateDoc, getDoc, query, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import type { Customer } from './../customers/page'; 
import type { Product } from './../products/page';
import type { InvoiceItem, Invoice } from './../billing/page';
import { format } from 'date-fns';

/**
 * @fileOverview Page for creating new bills/invoices or editing existing ones.
 * Accessible by Store Managers and Admins.
 * Allows selection of a customer, adding products to the bill, calculating totals including GST,
 * and generating/updating the bill which deducts/adjusts stock in Firebase Firestore.
 */

/**
 * Interface for items listed in the current bill being created/edited.
 * Extends the base Product interface with quantity and total for the bill.
 */
interface BillItem extends Product { 
  quantity: number;
  total: number; // Calculated as quantity * numericPrice
}

// Business-specific constants (example values, make configurable if needed)
const BUSINESS_STATE_CODE = "29"; // Example: Karnataka state code for GST calculation
const GST_RATE = 0.18; // Default GST rate (e.g., 18%)

/**
 * CreateBillPage component.
 * Provides UI and logic for creating or editing bills/invoices.
 * Handles customer selection, product addition, GST calculation, and Firestore transactions for stock and invoice data.
 * @returns {JSX.Element} The rendered create/edit bill page.
 */
export default function CreateBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editInvoiceId = searchParams.get('editInvoiceId'); // Get invoice ID from URL if editing

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true); // For initial data loading
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission state
  
  /**
   * Stores the original items of an invoice when it's being edited.
   * This is crucial for calculating the correct stock adjustments.
   * For example, if an item's quantity was 5 and is changed to 3, stock increases by 2.
   * If changed from 5 to 8, stock decreases by 3.
   * If a new item is added, its full quantity decreases stock.
   * If an original item is removed, its original quantity is added back to stock.
   */
  const [originalBillItemsForEdit, setOriginalBillItemsForEdit] = useState<BillItem[]>([]);

  /**
   * Formats a number into Indian Rupee currency string.
   * @param {number} num - The number to format.
   * @returns {string} Currency string (e.g., "₹1,234.56").
   */
  const formatCurrency = useCallback((num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

  /**
   * Fetches initial data: customers and products from Firestore.
   * If `editInvoiceId` is present, fetches that invoice's data to pre-fill the form
   * and stores its original items for stock adjustment logic.
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
          // Map invoice items to BillItem structure, ensuring product details are current
          const loadedBillItems = invoiceData.items.map(item => {
            const productDetails = fetchedProducts.find(p => p.id === item.productId);
            if (!productDetails) {
                // This case should ideally not happen if data integrity is maintained.
                // It means a product ID on an old invoice no longer exists in the products collection.
                // Handle by perhaps showing a warning or using placeholder data.
                console.warn(`Product with ID ${item.productId} not found for invoice ${editInvoiceId}.`);
                toast({title: "Product Missing", description: `Product ${item.name} (ID: ${item.productId}) from the original invoice was not found in the current product database. Its details might be incomplete.`, variant: "destructive"});
                return {
                  id: item.productId,
                  name: item.name + " (Product Missing)",
                  quantity: item.quantity,
                  numericPrice: item.unitPrice,
                  displayPrice: formatCurrency(item.unitPrice),
                  total: item.total,
                  stock: 0, // Assume 0 stock if product is missing
                  unitOfMeasure: item.unitOfMeasure,
                  category: "Unknown",
                  sku: "N/A",
                  imageUrl: `https://placehold.co/40x40.png?text=ERR`,
                  dataAiHint: "error missing",
                } as BillItem;
            }
            return {
              ...productDetails, 
              id: item.productId, 
              quantity: item.quantity,
              total: item.total, // Use total from invoice item, as price might have changed
              numericPrice: item.unitPrice, // Use unit price from invoice item
              displayPrice: formatCurrency(item.unitPrice),
            } as BillItem;
          });
          setBillItems(loadedBillItems);
          // Store a deep copy of these loaded items as the "original" state for stock adjustment.
          // This uses the product details *as they were when the invoice was created/last edited*.
          setOriginalBillItemsForEdit(loadedBillItems.map(item => ({...item}))); 
        } else {
          toast({ title: "Invoice Not Found", description: "The invoice you are trying to edit does not exist or may have been deleted.", variant: "destructive"});
          router.push("/billing"); 
        }
      }
    } catch (error) {
      console.error("Error fetching initial data: ", error);
      toast({ title: "Data Load Error", description: "Could not load required data from the database. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, editInvoiceId, router, formatCurrency]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  /**
   * Adds a product to the bill or increments its quantity if already present.
   * Checks for available stock before adding.
   * @param {Product} product - The product to add.
   */
  const handleAddProductToBill = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
      return;
    }
    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(item => item.id === product.id);
      if (existingItemIndex > -1) { // Item already in bill
        const updatedBillItems = [...prevItems];
        const existingItem = updatedBillItems[existingItemIndex];
        
        // Calculate available stock. If editing, consider the stock already "allocated" to this item in the original bill.
        const originalItem = originalBillItemsForEdit.find(oi => oi.id === product.id);
        const effectiveStockAvailable = product.stock + (originalItem ? originalItem.quantity : 0);

        if (existingItem.quantity < effectiveStockAvailable) {
          existingItem.quantity += 1;
          existingItem.total = existingItem.quantity * existingItem.numericPrice; // Use item's numericPrice for consistency
        } else {
          toast({ title: "Max Stock Reached", description: `Cannot add more ${product.name} than available in stock (${product.stock}). Original bill quantity already accounts for some stock if editing.`, variant: "destructive" });
        }
        return updatedBillItems;
      } else { // New item for the bill
        return [...prevItems, { ...product, quantity: 1, total: product.numericPrice }];
      }
    });
    setProductSearchTerm(""); // Clear search term after adding
  }, [toast, originalBillItemsForEdit]); // Added originalBillItemsForEdit dependency

  /**
   * Handles quantity change for an item in the bill.
   * Removes item if quantity is less than 1. Prevents exceeding stock.
   * @param {string} productId - The ID of the product whose quantity is changing.
   * @param {string} newQuantityStr - The new quantity as a string.
   */
  const handleQuantityChange = (productId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    setBillItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.id === productId);
      if (itemIndex === -1) return prevItems; 

      const updatedBillItems = [...prevItems];
      const currentItem = { ...updatedBillItems[itemIndex] }; 
      const productDetails = products.find(p => p.id === productId); // Get current product details from master list

      if (isNaN(newQuantity) || newQuantity < 1) { 
          updatedBillItems.splice(itemIndex, 1); 
          return updatedBillItems;
      }
      
      // Calculate the maximum quantity allowed for this item:
      // It's the current actual stock of the product in the database,
      // PLUS the quantity of this item that was on the original bill (if editing).
      // This allows, for example, reducing an item from 5 to 3, then increasing back to 5, even if current DB stock is low.
      const originalItem = originalBillItemsForEdit.find(oi => oi.id === currentItem.id);
      const effectiveStockLimit = (productDetails?.stock || 0) + (originalItem ? originalItem.quantity : 0);

      if (newQuantity > effectiveStockLimit) {
          toast({ title: "Stock Limit Exceeded", description: `Cannot set quantity for ${currentItem.name} above total effective stock (${effectiveStockLimit}). Setting to max available.`, variant: "destructive"});
          currentItem.quantity = effectiveStockLimit;
      } else {
          currentItem.quantity = newQuantity;
      }
      currentItem.total = currentItem.quantity * currentItem.numericPrice; // Recalculate total based on item's current price
      updatedBillItems[itemIndex] = currentItem;
      return updatedBillItems;
    });
  };
  
  /**
   * Removes an item from the bill.
   * @param {string} productId - The ID of the product to remove.
   */
  const handleRemoveItem = (productId: string) => {
    setBillItems(billItems.filter(item => item.id !== productId));
  };

  // Calculate bill summary: subtotal, GST, grand total
  const subTotal = billItems.reduce((acc, item) => acc + item.total, 0);
  const selectedCustomerDetails = customers.find(c => c.id === selectedCustomerId);
  const isInterState = selectedCustomerDetails?.gstin ? selectedCustomerDetails.gstin.substring(0, 2) !== BUSINESS_STATE_CODE : false;
  
  let cgst = 0, sgst = 0, igst = 0;
  if (selectedCustomerDetails?.gstin) { 
    if (isInterState) {
      igst = subTotal * GST_RATE;
    } else {
      cgst = subTotal * (GST_RATE / 2);
      sgst = subTotal * (GST_RATE / 2);
    }
  }
  const grandTotal = subTotal + cgst + sgst + igst;

  /**
   * Handles the generation of a new bill or update of an existing bill.
   * Performs a Firestore transaction to:
   *  1. Update product stock levels based on changes in bill items, comparing against original items if editing.
   *  2. Create or update the invoice document in Firestore.
   */
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
        // Iterate through all products involved: current bill items + original bill items (to catch removals)
        const allProductIdsInvolved = new Set([
            ...billItems.map(item => item.id),
            ...originalBillItemsForEdit.map(item => item.id)
        ]);

        for (const productId of allProductIdsInvolved) {
            const productRef = doc(db, "products", productId);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error(`Product with ID ${productId} not found in database during transaction.`);
            
            let currentDbStock = productSnap.data().stock as number;
            const currentBillItem = billItems.find(item => item.id === productId);
            const originalBillItem = originalBillItemsForEdit.find(item => item.id === productId);

            const originalQuantity = originalBillItem ? originalBillItem.quantity : 0;
            const newQuantity = currentBillItem ? currentBillItem.quantity : 0;
            
            // The net change in stock is original quantity (returned to stock) minus new quantity (taken from stock)
            const stockChange = originalQuantity - newQuantity; 
            const newStock = currentDbStock + stockChange;

            if (newStock < 0) {
                 throw new Error(`Insufficient stock for ${productSnap.data().name}. Transaction would result in negative stock (${newStock}).`);
            }
            transaction.update(productRef, { stock: newStock });
        }
        
        // Prepare bill data for Firestore
        const billData: Omit<Invoice, 'id' | 'createdAt'> & {createdAt?: any, createdBy: string} = { 
          customerId: selectedCustomerId, 
          customerName: customers.find(c=>c.id === selectedCustomerId)?.name || "N/A",
          items: billItems.map(i => ({
              productId: i.id, 
              name: i.name, 
              quantity: i.quantity, 
              unitPrice: i.numericPrice, // Price used for this item in this bill
              total: i.total, 
              unitOfMeasure: i.unitOfMeasure
          })), 
          subTotal, cgst, sgst, igst, 
          totalAmount: grandTotal, 
          displayTotal: formatCurrency(grandTotal),
          status: "Pending", 
          // Invoice number generation: for new, simple timestamp-based; for edit, retain existing.
          invoiceNumber: editInvoiceId 
            ? (await transaction.get(doc(db, "invoices", editInvoiceId))).data()?.invoiceNumber || `INV-ED-${Date.now().toString().slice(-6)}` 
            : `INV-${Date.now().toString().slice(-6)}`, // A more robust sequential number system might be needed for production.
          date: format(new Date(), "MMM dd, yyyy"), 
          isoDate: new Date().toISOString(), 
          createdBy: currentFirebaseUser.uid, 
        };

        if (editInvoiceId) {
            const invoiceRef = doc(db, "invoices", editInvoiceId);
            // For updates, we might want to add an `updatedAt` field.
            transaction.update(invoiceRef, {...billData, updatedAt: serverTimestamp()});
        } else {
            const newInvoiceRef = doc(collection(db, "invoices")); 
            transaction.set(newInvoiceRef, {...billData, createdAt: serverTimestamp()});
        }
      });

      toast({ title: editInvoiceId ? "Bill Updated" : "Bill Generated", description: `Bill ${editInvoiceId ? 'updated' : 'created'} successfully. Inventory levels adjusted.` });
      setSelectedCustomerId(undefined);
      setBillItems([]);
      setProductSearchTerm("");
      setOriginalBillItemsForEdit([]);
      router.push("/billing"); 
    } catch (error: any) {
      console.error(`Error ${editInvoiceId ? 'updating' : 'generating'} bill: `, error);
      toast({ title: `Bill ${editInvoiceId ? 'Update' : 'Generation'} Failed`, description: error.message || "An unexpected error occurred. Please check stock and try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  // Filter products based on search term (name, ID, or SKU)
  const filteredProducts = productSearchTerm
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
      )
    : [];

  if (isLoading) {
    return <PageHeader title={editInvoiceId ? "Edit Bill" : "Create New Bill"} description="Loading data from database..." icon={ClipboardPlus} />;
  }

  return (
    <>
      <PageHeader
        title={editInvoiceId ? "Edit Bill" : "Create New Bill"}
        description={editInvoiceId ? "Modify the existing bill details and items." : "Generate a new bill for a customer. Calculates GST and updates stock automatically."}
        icon={ClipboardPlus}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Customer Selection & Product Search/Addition */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">1. Select Customer & Add Products</CardTitle>
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
                    <Button variant="outline" onClick={() => router.push("/customers?addNew=true")} disabled={isSubmitting}>
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

          {/* Card for displaying current bill items */}
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
                      <TableHead className="w-[120px]">Quantity</TableHead>
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
                            min="0" 
                            max={(products.find(p=>p.id === item.id)?.stock || 0) + (originalBillItemsForEdit.find(oi => oi.id === item.id)?.quantity || 0) } 
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            onBlur={(e) => { const val = parseInt(e.target.value, 10); if (isNaN(val) || val < 1) handleQuantityChange(item.id, "0");}}
                            className="h-8 w-24"
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

        {/* Right Side: Bill Summary & Actions */}
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
              {selectedCustomerDetails?.gstin && !isInterState && (
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
              {selectedCustomerDetails?.gstin && isInterState && (
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST ({GST_RATE*100}%):</span>
                    <span className="font-medium">{formatCurrency(igst)}</span>
                </div>
              )}
               {!selectedCustomerDetails?.gstin && subTotal > 0 && (
                <p className="text-xs text-muted-foreground text-center">(GST not applied as customer GSTIN is not provided)</p>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                size="lg" 
                className="w-full" 
                onClick={handleGenerateOrUpdateBill} 
                disabled={billItems.length === 0 || !selectedCustomerId || isLoading || isSubmitting}
              >
                {isSubmitting ? (editInvoiceId ? "Updating Bill..." : "Generating Bill...") : (editInvoiceId ? "Update Bill" : "Generate Bill")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}

