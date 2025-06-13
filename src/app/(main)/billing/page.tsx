
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText, PlusCircle, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const invoices = [
  { id: "INV001", customer: "Alice Wonderland", date: "2024-07-15", total: "₹20,000.00", status: "Paid" },
  { id: "INV002", customer: "Bob The Builder", date: "2024-07-18", total: "₹12,060.00", status: "Pending" },
  { id: "INV003", customer: "Charlie Chaplin", date: "2024-07-20", total: "₹40,040.00", status: "Overdue" },
  { id: "INV004", customer: "Diana Prince", date: "2024-07-22", total: "₹6,000.00", status: "Paid" },
];

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing & Invoicing"
        description="Create and manage GST-compliant bills and invoices."
        icon={FileText}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Invoice
          </Button>
        }
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Invoice List</CardTitle>
          <CardDescription>A list of all generated invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell className="text-right">{invoice.total}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={invoice.status === "Paid" ? "default" : invoice.status === "Pending" ? "secondary" : "destructive"}
                           className={invoice.status === "Paid" ? "bg-accent text-accent-foreground" : ""}>
                      {invoice.status}
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
                        <DropdownMenuItem>View Invoice</DropdownMenuItem>
                        <DropdownMenuItem>Download PDF</DropdownMenuItem>
                        <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">Delete Invoice</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
