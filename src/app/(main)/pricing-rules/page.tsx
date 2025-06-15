
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SlidersHorizontal, PlusCircle, Edit, Trash2, ToggleRight, ToggleLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Added for description
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Pricing Rules in Firestore.
 * Allows Admin to define and manage rules for automated tiered, bulk, and volume pricing.
 * This is an Admin-only module.
 */

export interface PricingRule {
  id: string; // Firestore document ID
  name: string;
  type: "Tiered Pricing" | "Bulk Pricing" | "Volume Pricing" | "Manual Override";
  description: string;
  status: "Active" | "Inactive";
  conditions: string; // Simplified for now; Future: structured object
  action: string;     // Simplified for now; Future: structured object
  // Future fields for structured conditions: productId, categoryId, minQuantity, maxQuantity, minOrderValue
  // Future fields for structured actions: discountType ('percentage' or 'fixed'), discountValue, fixedPrice
  createdAt?: Timestamp;
}

const PRICING_RULE_TYPES = ["Tiered Pricing", "Bulk Pricing", "Volume Pricing", "Manual Override"] as const;
const PRICING_RULE_STATUSES = ["Active", "Inactive"] as const;

// Zod schema for pricing rule form validation
const pricingRuleSchema = z.object({
  name: z.string().min(3, { message: "Rule name must be at least 3 characters." }),
  type: z.enum(PRICING_RULE_TYPES, { required_error: "Please select a rule type." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  status: z.enum(PRICING_RULE_STATUSES, { required_error: "Please select a status."}),
  conditions: z.string().min(5, {message: "Conditions must be at least 5 characters."}).describe("e.g., Product SKU: PW-001, Min Qty: 10"),
  action: z.string().min(5, {message: "Action must be at least 5 characters."}).describe("e.g., Discount: 10% OR Set Price: ₹1800"),
});

type PricingRuleFormValues = z.infer<typeof pricingRuleSchema>;

/**
 * PricingRulesPage component.
 * Provides UI for Admin to view and manage pricing rules in Firestore.
 * @returns {JSX.Element} The rendered pricing rules page.
 */
export default function PricingRulesPage() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const { toast } = useToast();

  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: { type: "Bulk Pricing", status: "Active" },
  });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "pricingRules"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedRules = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as PricingRule));
      setPricingRules(fetchedRules);
    } catch (error) {
      console.error("Error fetching pricing rules: ", error);
      toast({ title: "Error", description: "Could not load pricing rules from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (editingRule && isFormDialogOpen) {
      form.reset(editingRule);
    } else {
      form.reset({ name: "", type: "Bulk Pricing", description: "", status: "Active", conditions: "", action: "" });
    }
  }, [editingRule, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: PricingRuleFormValues) => {
    try {
      const dataToSave = { ...values, createdAt: serverTimestamp() };
      if (editingRule) {
        const ruleRef = doc(db, "pricingRules", editingRule.id);
        await updateDoc(ruleRef, dataToSave);
        toast({ title: "Rule Updated", description: `Pricing rule "${values.name}" updated in Firestore.` });
      } else {
        await addDoc(collection(db, "pricingRules"), dataToSave);
        toast({ title: "Rule Added", description: `New pricing rule "${values.name}" added to Firestore.` });
      }
      fetchRules(); // Refresh list
      setIsFormDialogOpen(false);
      setEditingRule(null);
    } catch (error) {
      console.error("Error saving pricing rule: ", error);
      toast({ title: "Error", description: "Could not save pricing rule to database.", variant: "destructive" });
    }
  };

  const openAddDialog = () => {
    setEditingRule(null);
    form.reset({ name: "", type: "Bulk Pricing", description: "", status: "Active", conditions: "", action: "" });
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (rule: PricingRule) => {
    setEditingRule(rule);
    setIsFormDialogOpen(true);
  };

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    // Future: Implement confirmation dialog.
    try {
        await deleteDoc(doc(db, "pricingRules", ruleId));
        toast({ title: "Rule Deleted", description: `Pricing rule "${ruleName}" deleted.`, variant: "default" });
        fetchRules();
    } catch (error) {
        console.error("Error deleting rule: ", error);
        toast({ title: "Error", description: "Could not delete pricing rule.", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (rule: PricingRule) => {
    const newStatus = rule.status === "Active" ? "Inactive" : "Active";
    try {
      const ruleRef = doc(db, "pricingRules", rule.id);
      await updateDoc(ruleRef, { status: newStatus });
      toast({ title: "Status Updated", description: `Rule "${rule.name}" is now ${newStatus}.` });
      fetchRules();
    } catch (error) {
      console.error("Error toggling rule status: ", error);
      toast({ title: "Error", description: "Could not update rule status.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageHeader title="Pricing Rules Engine" description="Loading pricing rules from database..." icon={SlidersHorizontal} />;
  }

  return (
    <>
      <PageHeader
        title="Pricing Rules Engine"
        description="Flexible pricing rules for automated tiered, bulk, and volume pricing. (Admin Only)"
        icon={SlidersHorizontal}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Rule</Button>}
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsFormDialogOpen(false); setEditingRule(null); form.reset(); } else {setIsFormDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Add New Pricing Rule"}</DialogTitle>
            <DialogDescription>Define the conditions and actions for this pricing rule.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Rule Name</FormLabel><FormControl><Input placeholder="e.g., Widget Bulk Discount" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Rule Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{PRICING_RULE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Explain how this rule works" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                    <SelectContent>{PRICING_RULE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="conditions" render={({ field }) => (<FormItem><FormLabel>Conditions (Simplified)</FormLabel><FormControl><Textarea placeholder="e.g., Product SKU: X, Min Qty: 10" {...field} /></FormControl><FormDescription>Future: Structured conditions editor.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="action" render={({ field }) => (<FormItem><FormLabel>Action (Simplified)</FormLabel><FormControl><Textarea placeholder="e.g., Discount: 10% OR Set Price: ₹500" {...field} /></FormControl><FormDescription>Future: Structured actions editor.</FormDescription><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsFormDialogOpen(false); setEditingRule(null);}}>Cancel</Button></DialogClose>
                <Button type="submit">{editingRule ? "Save Changes" : "Add Rule"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pricingRules.map((rule) => (
          <Card key={rule.id} className="shadow-lg rounded-xl flex flex-col justify-between hover:shadow-primary/10 transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-foreground text-lg">{rule.name}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleToggleStatus(rule)} title={rule.status === 'Active' ? 'Deactivate Rule' : 'Activate Rule'}>
                  {rule.status === 'Active' ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
                  <span className="sr-only">{rule.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </Button>
              </div>
              <CardDescription>{rule.type} - <span className={rule.status === 'Active' ? 'text-accent' : 'text-muted-foreground'}>{rule.status}</span></CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground mb-1"><strong className="text-foreground/80">Description:</strong> {rule.description}</p>
              <p className="text-xs text-muted-foreground mb-1"><strong className="text-foreground/70">Conditions:</strong> {rule.conditions}</p>
              <p className="text-xs text-muted-foreground"><strong className="text-foreground/70">Action:</strong> {rule.action}</p>
            </CardContent>
            <CardFooter className="pt-2 pb-4 border-t mt-2">
               <div className="flex space-x-2 w-full">
                <Button variant="outline" size="sm" className="w-full" onClick={() => openEditDialog(rule)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDeleteRule(rule.id, rule.name)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
         <Card className="shadow-lg rounded-xl border-dashed border-2 flex flex-col items-center justify-center hover:border-primary transition-colors cursor-pointer min-h-[200px]" onClick={openAddDialog}>
          <PlusCircle className="h-10 w-10 mb-2 text-muted-foreground group-hover:text-primary" />
          <span className="text-muted-foreground group-hover:text-primary font-medium">Add New Pricing Rule</span>
        </Card>
      </div>
       {pricingRules.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground">
            No pricing rules configured yet. Click "Add New Rule" to start.
        </div>
      )}
    </>
  );
}
