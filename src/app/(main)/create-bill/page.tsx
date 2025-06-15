
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus, PlusCircle, Trash2, Search, XCircle, Calculator, Percent } from "lucide-react"; // Added Calculator, Percent
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
// Future: Import Firebase functions for Firestore operations
// import { collection, getDocs, doc, runTransaction, serverTimestamp, addDoc } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';
// import { auth } from '@/lib/firebase/firebaseConfig'; // To get current manager ID

/**
 * @fileOverview Page for creating new bills/invoices.
 * Accessible by Store Managers and Admins.
 * Allows selection of a customer, adding products to the bill, calculating totals including GST,
 * and generating the bill (which notionally deducts stock).
 */

interface Customer {
  id: string;
  name: string;
  gstin?: string;
  // Future: stateCode (for IGST calculation)
}
// Dummy data, replace with actual data fetching in Phase 2
const dummyCustomers: Customer[] = [
  { id: "CUST-LOCAL-001", name: "Alice Wonderland", gstin: "29AABCU9517R1Z5" },
  { id: "CUST-LOCAL-002", name: "Bob The Builder" },
  { id: "CUST-LOCAL-003", name: "Charlie Chaplin", gstin: "07AABCS1234D1Z2" },
];

interface Product {
  id: string;
  name: string;
  numericPrice: number; 
  displayPrice: string; 
  stock: number;
  unitOfMeasure: string;
  // Future: hsnCode, taxRate (percentage)
}
// Dummy data, replace with actual data fetching in Phase 2
const dummyProducts: Product[] = [
  { id: "PROD-LOCAL-001", name: "Premium Widget", numericPrice: 2080, displayPrice: "₹2,080.00", stock: 150, unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-002", name: "Standard Gizmo", numericPrice: 1240, displayPrice: "₹1,240.00", stock: 25, unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-003", name: "Luxury Doodad", numericPrice: 3995, displayPrice: "₹3,995.00", stock: 0, unitOfMeasure: "box" },
  { id: "PROD-LOCAL-004", name: "Basic Thingamajig", numericPrice: 800, displayPrice: "₹800.00", stock: 500, unitOfMeasure: "pcs" },
];

interface BillItem extends Product {
  quantity: number;
  total: number; // quantity * numericPrice
}

const BUSINESS_STATE_CODE = "29"; // Example: Karnataka. Future: Make this configurable.

/**
 * CreateBillPage component.
 * Provides UI and logic for creating new bills.
 */
export default function CreateBillPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Formats a number as an Indian Rupee string.
  const formatCurrency = (num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Effect to load initial data (customers, products)
  useEffect(() => {
    // Future: Fetch customers and products (with stock) from Firestore
    // const fetchInitialData = async () => {
    //   setIsLoading(true);
    //   try {
    //     const [customersSnapshot, productsSnapshot] = await Promise.all([
    //       getDocs(collection(db, "customers")),
    //       getDocs(collection(db, "products"))
    //     ]);
    //     const fetchedCustomers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    //     const fetchedProducts = productsSnapshot.docs.map(doc => {
    //         const data = doc.data();
    //         return { 
    //             id: doc.id, 
    //             name: data.name,
    //             numericPrice: data.numericPrice,
    //             displayPrice: formatCurrency(data.numericPrice),
    //             stock: data.stock,
    //             unitOfMeasure: data.unitOfMeasure,
    //         } as Product;
    //     });
    //     setCustomers(fetchedCustomers);
    //     setProducts(fetchedProducts);
    //   } catch (error) {
    //     console.error("Error fetching initial data: ", error);
    //     toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchInitialData();

    // Phase 1: Use local dummy data
    setCustomers(dummyCustomers);
    setProducts(dummyProducts);
    setIsLoading(false);
  }, [toast]);

  /**
   * Adds a product to the current bill or increments its quantity.
   */
  const handleAddProductToBill = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
      return;
    }
    const existingItemIndex = billItems.findIndex(item => item.id === product.id);
    if (existingItemIndex > -1) {
      const updatedBillItems = [...billItems];
      const existingItem = updatedBillItems[existingItemIndex];
      if (existingItem.quantity < product.stock) {
        existingItem.quantity += 1;
        existingItem.total = existingItem.quantity * existingItem.numericPrice;
        setBillItems(updatedBillItems);
      } else {
        toast({ title: "Max Stock Reached", description: `Cannot add more ${product.name} than available in stock (${product.stock}).`, variant: "destructive" });
      }
    } else {
      setBillItems([...billItems, { ...product, quantity: 1, total: product.numericPrice }]);
    }
    setProductSearchTerm(""); // Clear search after adding
  }, [billItems, toast]);

  /**
   * Handles changes to the quantity of an item in the bill.
   */
  const handleQuantityChange = (productId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    const itemIndex = billItems.findIndex(item => item.id === productId);
    if (itemIndex === -1) return;

    const updatedBillItems = [...billItems];
    const currentItem = updatedBillItems[itemIndex];

    if (isNaN(newQuantity) || newQuantity < 1) {
        // Remove item if quantity is invalid or less than 1
        updatedBillItems.splice(itemIndex, 1);
        setBillItems(updatedBillItems);
        return;
    }
    if (newQuantity > currentItem.stock) {
        toast({ title: "Stock Limit Exceeded", description: `Cannot set quantity for ${currentItem.name} above available stock (${currentItem.stock}). Setting to max available.`, variant: "destructive"});
        currentItem.quantity = currentItem.stock;
    } else {
        currentItem.quantity = newQuantity;
    }
    currentItem.total = currentItem.quantity * currentItem.numericPrice;
    setBillItems(updatedBillItems);
  };
  
  /**
   * Removes an item from the bill.
   */
  const handleRemoveItem = (productId: string) => {
    setBillItems(billItems.filter(item => item.id !== productId));
  };

  // Calculate bill totals
  const subTotal = billItems.reduce((acc, item) => acc + item.total, 0);
  
  // GST Calculation Logic (Simplified for Phase 1)
  // Future: This should be more robust, considering product-specific tax rates, customer state for IGST.
  const selectedCustomerGstin = customers.find(c => c.id === selectedCustomerId)?.gstin;
  const isInterState = selectedCustomerGstin ? selectedCustomerGstin.substring(0, 2) !== BUSINESS_STATE_CODE : false;
  
  const GST_RATE = 0.18; // Default combined GST rate (e.g., 18%). Future: per-product HSN/SAC based rates.
  let cgst = 0, sgst = 0, igst = 0;

  if (isInterState) {
    igst = subTotal * GST_RATE;
  } else {
    cgst = subTotal * (GST_RATE / 2);
    sgst = subTotal * (GST_RATE / 2);
  }
  const grandTotal = subTotal + cgst + sgst + igst;

  /**
   * Handles the generation of the bill.
   * Phase 1: Simulates bill creation and stock deduction.
   * Future: Creates bill document in Firestore, updates stock in a transaction.
   */
  const handleGenerateBill = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Customer Not Selected", description: "Please select a customer.", variant: "destructive" });
      return;
    }
    if (billItems.length === 0) {
      toast({ title: "No Items in Bill", description: "Please add products to the bill.", variant: "destructive" });
      return;
    }
    
    // const currentFirebaseUser = auth.currentUser; // Get current manager/admin
    // if (!currentFirebaseUser) {
    //   toast({ title: "Authentication Error", description: "You must be logged in to generate a bill.", variant: "destructive" });
    //   return;
    // }

    // Future: Firebase integration
    // try {
    //   await runTransaction(db, async (transaction) => {
    //     // 1. For each item in billItems, read product stock
    //     const productRefsAndData = await Promise.all(
    //       billItems.map(async (item) => {
    //         const productRef = doc(db, "products", item.id);
    //         const productSnap = await transaction.get(productRef);
    //         if (!productSnap.exists() || productSnap.data().stock < item.quantity) {
    //           throw new Error(`Insufficient stock for ${item.name} or product not found.`);
    //         }
    //         return { ref: productRef, newStock: productSnap.data().stock - item.quantity };
    //       })
    //     );
    //     // 2. Update stock for all products
    //     productRefsAndData.forEach(p => transaction.update(p.ref, { stock: p.newStock }));
        
    //     // 3. Create the bill document in 'invoices' collection
    //     const billData = { 
    //       customerId: selectedCustomerId, 
    //       customerName: customers.find(c=>c.id === selectedCustomerId)?.name || "N/A",
    //       items: billItems.map(i => ({productId: i.id, name: i.name, quantity: i.quantity, unitPrice: i.numericPrice, total: i.total, unitOfMeasure: i.unitOfMeasure})), 
    //       subTotal, cgst, sgst, igst, grandTotal, 
    //       status: "Pending", // Default status
    //       invoiceNumber: `INV-LOCAL-${Date.now()}`, // Future: Better invoice number generation
    //       date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD for consistency
    //       isoDate: new Date().toISOString(),
    //       createdAt: serverTimestamp(),
    //       createdBy: currentFirebaseUser.uid, // Manager/Admin ID
    //     };
    //     // const newInvoiceRef = doc(collection(db, "invoices")); // Auto-generate ID
    //     // transaction.set(newInvoiceRef, billData);
    //     await addDoc(collection(db, "invoices"), billData); // Simpler addDoc if not needing the ID back immediately in transaction.

    //   });

    //   toast({ title: "Bill Generated", description: `Bill created successfully. Inventory updated.` });
    //   // Reset form
    //   setSelectedCustomerId(undefined);
    //   setBillItems([]);
    //   setProductSearchTerm("");
    //   // Optionally, re-fetch products to reflect stock changes or update local state
    // } catch (error: any) {
    //   console.error("Error generating bill: ", error);
    //   toast({ title: "Bill Generation Failed", description: error.message || "Failed to generate bill.", variant: "destructive" });
    // }

    // Phase 1: Simulate bill generation and stock update
    const tempInvoiceNumber = `INV-LOCAL-${Date.now().toString().slice(-6)}`;
    toast({ title: "Bill Generated (Simulated)", description: `Bill ${tempInvoiceNumber} for customer ID ${selectedCustomerId} created. Total: ${formatCurrency(grandTotal)}. Inventory deduction simulated.` });
    
    // Simulate stock deduction locally
    const updatedProducts = products.map(p => {
        const billedItem = billItems.find(bi => bi.id === p.id);
        if (billedItem) {
            return { ...p, stock: p.stock - billedItem.quantity };
        }
        return p;
    });
    setProducts(updatedProducts);

    // Reset form
    setSelectedCustomerId(undefined);
    setBillItems([]);
    setProductSearchTerm("");
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(productSearchTerm.toLowerCase()))
    : [];

  if (isLoading) {
    return <PageHeader title="Create New Bill" description="Loading data..." icon={ClipboardPlus} />;
  }

  return (
    <>
      <PageHeader
        title="Create New Bill"
        description="Generate a new bill for a customer. Calculates GST automatically."
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
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger id="customer-select"><SelectValue placeholder="Choose an existing customer" /></SelectTrigger>
                    <SelectContent>
                        {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} {customer.gstin ? `(GSTIN: ${customer.gstin})` : ''}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => toast({title: "Add New Customer (Placeholder)", description: "Navigate to Customers page to add."})}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New
                    </Button>
                    {/* Future: Add New Customer Dialog could be integrated here */}
                </div>
              </div>

              <div>
                <Label htmlFor="product-search">Add Products to Bill</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="product-search" 
                    placeholder="Search products by name or SKU..." 
                    className="pl-8" 
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                  {productSearchTerm && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setProductSearchTerm("")} title="Clear search">
                        <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {productSearchTerm && filteredProducts.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-background shadow-md z-10">
                    {filteredProducts.map(product => (
                      <div 
                        key={product.id} 
                        className="p-3 hover:bg-accent cursor-pointer flex justify-between items-center"
                        onClick={() => handleAddProductToBill(product)}
                      >
                        <div>
                            <p className="font-medium">{product.name} <span className="text-xs text-muted-foreground">({product.unitOfMeasure})</span></p>
                            <p className="text-sm text-muted-foreground">Price: {product.displayPrice} - Stock: {product.stock}</p>
                        </div>
                        <Button variant="ghost" size="sm" disabled={product.stock <= 0} onClick={(e) => { e.stopPropagation(); handleAddProductToBill(product); }}>
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
                            min="1" // Cannot go below 1, use delete button instead
                            max={item.stock} // Cannot exceed stock
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right">{item.displayPrice}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} title={`Remove ${item.name}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 bg-muted/50 rounded-md text-center">
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
              {!isInterState && (
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
              {isInterState && (
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST ({GST_RATE*100}%):</span>
                    <span className="font-medium">{formatCurrency(igst)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={handleGenerateBill} disabled={billItems.length === 0 || !selectedCustomerId || isLoading}>
                {isLoading ? "Loading..." : "Generate Bill"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      {/* 
        Phase 1 Data Storage: Customer and Product data for selection is local. Bill items are local state.
        Phase 2 (Future-Ready):
        - Customers and Products (with real-time stock) fetched from Firestore.
        - "Generate Bill" action would:
          1. Perform a Firestore transaction to:
             a. Read current stock for all items in the bill.
             b. Verify sufficient stock.
             c. Decrement stock for each product.
             d. Create a new document in an 'invoices' collection in Firestore.
                - Store customerId, items (with productId, name, quantity, unitPrice, total), subTotal, cgst, sgst, igst, grandTotal, status ('Pending' initially), createdBy (manager/admin UID), createdAt (serverTimestamp).
          2. Tax calculation would be more robust, potentially based on HSN codes and product-specific tax rates stored in Firestore.
          3. IGST determination based on customer's state (from customer profile) vs business's state (configurable).
      */}
    </>
  );
}
