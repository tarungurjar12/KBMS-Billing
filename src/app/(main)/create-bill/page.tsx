
"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus, PlusCircle, Trash2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// Dummy data (replace with actual data fetching)
interface Customer {
  id: string;
  name: string;
  gstin?: string;
}
const dummyCustomers: Customer[] = [
  { id: "CUST001", name: "Alice Wonderland", gstin: "29AABCU9517R1Z5" },
  { id: "CUST002", name: "Bob The Builder" },
  { id: "CUST003", name: "Charlie Chaplin", gstin: "07AABCS1234D1Z2" },
];

interface Product {
  id: string;
  name: string;
  price: number; // Store as number for calculations
  displayPrice: string; // For display with currency
  stock: number;
  unitOfMeasure: string;
}
const dummyProducts: Product[] = [
  { id: "PROD001", name: "Premium Widget", price: 2080, displayPrice: "₹2,080", stock: 150, unitOfMeasure: "pcs" },
  { id: "PROD002", name: "Standard Gizmo", price: 1240, displayPrice: "₹1,240", stock: 25, unitOfMeasure: "pcs" },
  { id: "PROD003", name: "Luxury Doodad", price: 3995, displayPrice: "₹3,995", stock: 0, unitOfMeasure: "box" },
  { id: "PROD004", name: "Basic Thingamajig", price: 800, displayPrice: "₹800", stock: 500, unitOfMeasure: "pcs" },
];

interface BillItem extends Product {
  quantity: number;
  total: number; // quantity * price
}

export default function CreateBillPage() {
  const [customers, setCustomers] = useState<Customer[]>(dummyCustomers);
  const [products, setProducts] = useState<Product[]>(dummyProducts);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedProductSearch, setSelectedProductSearch] = useState("");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const { toast } = useToast();

  // useEffect(() => {
  //   // Future: Fetch customers and products from API
  //   // const fetchInitialData = async () => {
  //   //   // const fetchedCustomers = await api.getCustomers();
  //   //   // const fetchedProducts = await api.getProductsWithStock();
  //   //   // setCustomers(fetchedCustomers);
  //   //   // setProducts(fetchedProducts);
  //   // };
  //   // fetchInitialData();
  // }, []);

  const handleAddProductToBill = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently out of stock.`, variant: "destructive" });
      return;
    }
    const existingItem = billItems.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setBillItems(billItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item));
      } else {
        toast({ title: "Max Stock Reached", description: `Cannot add more ${product.name} than available in stock (${product.stock}).`, variant: "destructive" });
      }
    } else {
      setBillItems([...billItems, { ...product, quantity: 1, total: product.price }]);
    }
    setSelectedProductSearch(""); // Clear search
  };

  const handleQuantityChange = (productId: string, newQuantityStr: string) => {
    const newQuantity = parseInt(newQuantityStr, 10);
    const productInBill = billItems.find(item => item.id === productId);
    if (!productInBill) return;

    if (isNaN(newQuantity) || newQuantity < 1) {
        // Remove item if quantity is invalid or less than 1
        setBillItems(billItems.filter(item => item.id !== productId));
        return;
    }
    if (newQuantity > productInBill.stock) {
        toast({ title: "Stock Limit Exceeded", description: `Cannot set quantity for ${productInBill.name} above available stock (${productInBill.stock}).`, variant: "destructive"});
        setBillItems(billItems.map(item => item.id === productId ? { ...item, quantity: productInBill.stock, total: productInBill.stock * item.price } : item));
        return;
    }
    setBillItems(billItems.map(item => item.id === productId ? { ...item, quantity: newQuantity, total: newQuantity * item.price } : item));
  };
  
  const handleRemoveItem = (productId: string) => {
    setBillItems(billItems.filter(item => item.id !== productId));
  };

  const subTotal = billItems.reduce((acc, item) => acc + item.total, 0);
  // Placeholder for GST calculation
  const cgstRate = 0.09; // 9%
  const sgstRate = 0.09; // 9%
  const igstRate = 0.18; // 18% (Applicable if customer is from different state - logic needed)
  
  // Simplified: Assuming local sale for now (CGST + SGST)
  // Future: Need logic to determine if IGST applies based on customer/business location.
  const isInterState = false; // This would be determined by customer's state vs business's state
  const cgst = isInterState ? 0 : subTotal * cgstRate;
  const sgst = isInterState ? 0 : subTotal * sgstRate;
  const igst = isInterState ? subTotal * igstRate : 0;
  const grandTotal = subTotal + cgst + sgst + igst;


  const handleGenerateBill = () => {
    if (!selectedCustomerId) {
      toast({ title: "Customer Not Selected", description: "Please select a customer.", variant: "destructive" });
      return;
    }
    if (billItems.length === 0) {
      toast({ title: "No Items in Bill", description: "Please add products to the bill.", variant: "destructive" });
      return;
    }

    // For future cloud integration:
    // try {
    //   const billData = { customerId: selectedCustomerId, items: billItems, subTotal, cgst, sgst, igst, grandTotal, status: "Pending" };
    //   const createdBill = await api.createBill(billData); // This API would handle inventory deduction
    //   toast({ title: "Bill Generated", description: `Bill #${createdBill.id} created successfully. Payment status: Pending.` });
    //   // Reset form
    //   setSelectedCustomerId(undefined);
    //   setBillItems([]);
    //   // Potentially fetch updated product stock
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to generate bill.", variant: "destructive" });
    // }

    toast({ title: "Bill Generated (Simulated)", description: `Bill for customer ID ${selectedCustomerId} created. Total: ₹${grandTotal.toFixed(2)}. Inventory deduction simulated.` });
    // Reset form
    setSelectedCustomerId(undefined);
    setBillItems([]);
  };

  const filteredProducts = selectedProductSearch
    ? products.filter(p => p.name.toLowerCase().includes(selectedProductSearch.toLowerCase()) || p.id.toLowerCase().includes(selectedProductSearch.toLowerCase()))
    : [];

  return (
    <>
      <PageHeader
        title="Create New Bill"
        description="Generate a new bill for a customer."
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
                    <SelectTrigger id="customer-select">
                        <SelectValue placeholder="Choose an existing customer" />
                    </SelectTrigger>
                    <SelectContent>
                        {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} {customer.gstin ? `(${customer.gstin})` : ''}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Button variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New
                    </Button>
                    {/* Future: Add New Customer Dialog */}
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
                    value={selectedProductSearch}
                    onChange={(e) => setSelectedProductSearch(e.target.value)}
                  />
                  {selectedProductSearch && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setSelectedProductSearch("")}>
                        <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selectedProductSearch && filteredProducts.length > 0 && (
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
                        <Button variant="ghost" size="sm" disabled={product.stock <= 0}>
                            {product.stock > 0 ? "Add" : "Out of Stock"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                 {selectedProductSearch && filteredProducts.length === 0 && (
                     <p className="mt-2 text-sm text-muted-foreground">No products found matching "{selectedProductSearch}".</p>
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
                            max={item.stock}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right">{item.displayPrice}</TableCell>
                        <TableCell className="text-right">₹{item.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 bg-muted/50 rounded-md text-center">
                  <p className="text-muted-foreground">Search and add products to the bill.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Bill Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg rounded-xl sticky top-6">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">3. Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">₹{subTotal.toFixed(2)}</span>
              </div>
              {!isInterState && (
                <>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST ({cgstRate*100}%):</span>
                    <span className="font-medium">₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST ({sgstRate*100}%):</span>
                    <span className="font-medium">₹{sgst.toFixed(2)}</span>
                </div>
                </>
              )}
              {isInterState && (
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST ({igstRate*100}%):</span>
                    <span className="font-medium">₹{igst.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={handleGenerateBill} disabled={billItems.length === 0 || !selectedCustomerId}>
                Generate Bill
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      {/* Comment for future data persistence:
          The 'customers', 'products', and 'billItems' states are currently managed locally with dummy data.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Customers and products (with real-time stock) would be fetched from the database.
          - Selecting a customer would store their ID.
          - Adding products would check stock against the database.
          - "Generate Bill" would:
            - Create a new bill document in the database.
            - Update inventory levels for each product in the bill (ideally in a transaction).
            - Record the transaction under the customer's history.
          - Tax calculation logic would be more robust, potentially considering customer location for IGST.
          - Example: `await firestore.collection('bills').add(billData);`
          - Example: `await firestore.runTransaction(async (transaction) => { ... });` for stock deduction.
      */}
    </>
  );
}

    