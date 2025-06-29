
"use client";

import type { Invoice, CompanyDetailsForInvoice } from "@/app/(main)/billing/page";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from 'next/image';

/**
 * @fileOverview InvoiceTemplate component.
 * This is a presentational component responsible for rendering the visual layout of an invoice.
 * It takes invoice data and company details as props and displays them in a standard,
 * print-friendly format. It is used for both viewing in a dialog and for generating PDFs.
 */

interface InvoiceTemplateProps {
  invoice: Invoice;
  companyDetails: CompanyDetailsForInvoice;
}

/**
 * Formats a number into a currency string (Indian Rupee).
 * @param {number} num - The number to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Generates initials from a name string for use in a fallback logo.
 * @param {string | undefined} name - The company name.
 * @returns {string} The capitalized initials (up to 3 characters).
 */
const getInitials = (name?: string): string => {
  if (!name) return "NA";
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 3);
};

/**
 * Renders a complete invoice layout based on the provided data.
 * @param {InvoiceTemplateProps} props - The props containing the invoice and company details.
 * @returns {JSX.Element} The rendered invoice template.
 */
export function InvoiceTemplate({ invoice, companyDetails }: InvoiceTemplateProps) {
  return (
    <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-gray-200 text-gray-800 text-sm font-sans">
      {/* Header Section: Company info and Invoice details */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 sm:mb-8">
        {/* Company Information */}
        <div className="w-full sm:w-1/2 mb-4 sm:mb-0 sm:pr-2">
          {companyDetails.companyLogoUrl ? (
            <Image src={companyDetails.companyLogoUrl} alt={`${companyDetails.companyName || 'Company'} Logo`} width={120} height={60} className="object-contain max-h-16" />
          ) : (
            // Fallback logo with company initials
            <div className="w-20 h-20 bg-primary text-primary-foreground flex items-center justify-center rounded-md text-2xl font-bold">
              {getInitials(companyDetails.companyName)}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-primary mt-2 break-words">{companyDetails.companyName || "Your Company Name"}</h1>
          <p className="text-xs break-words">{companyDetails.companyAddress || "Company Address, City, State, Pin"}</p>
          <p className="text-xs break-words">{companyDetails.companyContact || "Phone: (XXX) XXX-XXXX | Email: contact@company.com"}</p>
          {companyDetails.companyGstin && <p className="text-xs break-words">GSTIN: {companyDetails.companyGstin}</p>}
        </div>
        {/* Invoice Details */}
        <div className="w-full sm:w-1/2 text-left sm:text-right sm:pl-2">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 uppercase mb-1">Invoice</h2>
          <p className="text-xs"><strong>Invoice #:</strong> {invoice.invoiceNumber}</p>
          <p className="text-xs"><strong>Date:</strong> {invoice.date}</p>
          {invoice.dueDate && <p className="text-xs"><strong>Due Date:</strong> {invoice.dueDate}</p>}
          <p className="text-xs mt-1"><strong>Status:</strong> <span className={`font-semibold ${invoice.status === 'Paid' ? 'text-green-600' : invoice.status === 'Pending' ? 'text-orange-500' : 'text-red-500'}`}>{invoice.status}</span></p>
        </div>
      </div>

      <Separator className="my-4 sm:my-6" />

      {/* Bill To Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-1">Bill To:</h3>
          <p className="font-medium text-gray-700">{invoice.customerName}</p>
          {/* Future enhancement: Customer address/contact could be fetched from DB using customerId */}
           <p className="text-xs">Customer ID: {invoice.customerId}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <Table className="min-w-full text-xs">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">#</TableHead>
              <TableHead className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Item Description</TableHead>
              <TableHead className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Qty</TableHead>
              <TableHead className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Unit Price (₹)</TableHead>
              <TableHead className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">Total (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item, index) => (
              <TableRow key={item.productId + index} className="border-b border-gray-200">
                <TableCell className="px-2 py-2 whitespace-nowrap align-top">{index + 1}</TableCell>
                <TableCell className="px-2 py-2 whitespace-normal break-words align-top" style={{ whiteSpace: 'pre-line' }}>
                    {item.name}
                    {/* Display unit of measure if it's not a generic 'details' entry */}
                    {item.unitOfMeasure !== 'details' && (
                         <span className="block text-gray-500 text-[10px]">({item.unitOfMeasure})</span>
                    )}
                </TableCell>
                <TableCell className="px-2 py-2 text-right whitespace-nowrap align-top">{item.quantity}</TableCell>
                <TableCell className="px-2 py-2 text-right whitespace-nowrap align-top">{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell className="px-2 py-2 text-right whitespace-nowrap align-top">{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals Section */}
      <div className="flex justify-end mt-4 sm:mt-6">
        <div className="w-full sm:w-64 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCurrency(invoice.subTotal)}</span>
          </div>
          {invoice.cgst > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">CGST:</span>
              <span className="font-medium">{formatCurrency(invoice.cgst)}</span>
            </div>
          )}
          {invoice.sgst > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">SGST:</span>
              <span className="font-medium">{formatCurrency(invoice.sgst)}</span>
            </div>
          )}
          {invoice.igst > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">IGST:</span>
              <span className="font-medium">{formatCurrency(invoice.igst)}</span>
            </div>
          )}
          <Separator className="my-1"/>
          <div className="flex justify-between text-sm font-bold text-primary">
            <span>Grand Total:</span>
            <span>{formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Footer / Notes Section */}
      <div className="mt-8 sm:mt-12 pt-4 border-t border-gray-200 text-xs text-gray-500">
        <h4 className="font-semibold text-gray-600 mb-1">Terms & Conditions:</h4>
        <p className="mb-2">1. Payment due within 30 days.</p>
        <p className="mb-2">2. Goods once sold will not be taken back or exchanged.</p>
        <p className="mb-4">3. Interest @18% p.a. will be charged on overdue bills.</p>
        <p className="text-center">Thank you for your business!</p>
        <p className="text-center mt-1 text-[10px]">This is a computer-generated invoice and does not require a signature.</p>
      </div>
    </div>
  );
}
