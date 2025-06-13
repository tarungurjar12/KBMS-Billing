
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const customerPayments = [
  { id: "PAYC001", invoiceId: "INV001", date: "2024-07-15", amount: "₹20,000.00", method: "Credit Card", status: "Completed" },
  { id: "PAYC002", invoiceId: "INV002", date: "2024-07-19", amount: "₹12,060.00", method: "Bank Transfer", status: "Pending" },
];

const supplierPayments = [
  { id: "PAYS001", supplier: "Widget Co.", date: "2024-07-10", amount: "₹40,000.00", method: "ACH", status: "Completed" }, // Assuming $500
  { id: "PAYS002", supplier: "Gizmo Inc.", date: "2024-07-21", amount: "₹25,600.00", method: "Check", status: "Sent" }, // Assuming $320
];

export default function PaymentsPage() {
  return (
    <>
      <PageHeader
        title="Payment Records"
        description="Track and manage payment status for customer and supplier payments."
        icon={CreditCard}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Payment Record
          </Button>
        }
      />
      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="customer_payments">Customer Payments</TabsTrigger>
          <TabsTrigger value="supplier_payments">Supplier Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle>
              <CardDescription>Records of payments received from customers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id}</TableCell>
                      <TableCell>{payment.invoiceId}</TableCell>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell className="text-right">{payment.amount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={payment.status === "Completed" ? "default" : "secondary"}
                               className={payment.status === "Completed" ? "bg-accent text-accent-foreground" : ""}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Update Status</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">Delete Record</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supplier_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Supplier Payment History</CardTitle>
              <CardDescription>Records of payments made to suppliers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id}</TableCell>
                      <TableCell>{payment.supplier}</TableCell>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell className="text-right">{payment.amount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={payment.status === "Completed" ? "default" : "secondary"}
                               className={payment.status === "Completed" ? "bg-accent text-accent-foreground" : ""}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Update Status</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">Delete Record</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
