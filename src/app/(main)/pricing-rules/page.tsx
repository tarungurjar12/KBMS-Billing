
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SlidersHorizontal, PlusCircle, Edit, Trash2, ToggleRight, ToggleLeft, Info, AlertCircle } from "lucide-react"; 
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"; 

/**
 * @fileOverview Page for Admin to manage Pricing Rules in Firestore.
 * Allows Admin to define and manage rules for automated tiered, bulk, and volume pricing.
 * This is an Admin-only module. Pricing rule application logic is TBD and complex.
 * This page focuses on CRUD for rule definitions.
 */

/**
 * Interface representing a Pricing Rule document in Firestore.
 */
export interface PricingRule {
  id: string; 
  name: string; 
  type: "Tiered Pricing" | "Bulk Pricing" | "Volume Pricing" | "Manual Override"; 
  description: string; 
  status: "Active" | "Inactive"; 
  conditions: string; 
  action: string;     
  priority?: number; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}

const PRICING_RULE_TYPES = ["Tiered Pricing", "Bulk Pricing", "Volume Pricing", "Manual Override"] as const;
const PRICING_RULE_STATUSES = ["Active", "Inactive"] as const;

const pricingRuleSchema = z.object({
  name: z.string().min(3, { message: "Rule name must be at least 3 characters." }),
  type: z.enum(PRICING_RULE_TYPES, { required_error: "Please select a rule type." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters to be clear." }),
  status: z.enum(PRICING_RULE_STATUSES, { required_error: "Please select a status for the rule."}),
  conditions: z.string().min(5, {message: "Conditions field must be at least 5 characters."}).describe("e.g., Product SKU: PW-001, Min Qty: 10, Customer Group: Wholesale"),
  action: z.string().min(5, {message: "Action field must be at least 5 characters."}).describe("e.g., Discount: 10% OR Set Price: ₹1800 OR Add free item: SKU-FREEBIE"),
  priority: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : parseInt(String(val), 10)),
    z.number().int().min(0).optional() 
  ),
});

type PricingRuleFormValues = z.infer<typeof pricingRuleSchema>;

/**
 * PricingRulesPage component.
 * Provides UI for Admin to view, create, edit, and delete pricing rules in Firestore.
 * @returns {JSX.Element} The rendered pricing rules page.
 */
export default function PricingRulesPage() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<PricingRule | null>(null);
  const { toast } = useToast();

  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: { type: "Bulk Pricing", status: "Active", name: "", description: "", conditions: "", action: "", priority: undefined },
  });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      // Query requires a composite index on 'priority' (ASC) and 'name' (ASC).
      const q = query(collection(db, "pricingRules"), orderBy("priority", "asc"), orderBy("name", "asc")); 
      const querySnapshot = await getDocs(q);
      const fetchedRules = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as PricingRule));
      setPricingRules(fetchedRules);
    } catch (error: any) {
      console.error("Error fetching pricing rules: ", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for pricing rules failed. Please ensure the necessary Firestore index is created (e.g., on 'priority' and 'name'). Check console for link. Error: ${error.message}`,
            variant: "destructive",
            duration: 10000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load pricing rules: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingRule) {
        form.reset(editingRule);
      } else { 
        form.reset({ type: "Bulk Pricing", status: "Active", name: "", description: "", conditions: "", action: "", priority: undefined });
      }
    }
  }, [editingRule, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: PricingRuleFormValues) => {
    try {
      const dataToSave = { ...values, updatedAt: serverTimestamp() };
      if (editingRule) { 
        const ruleRef = doc(db, "pricingRules", editingRule.id);
        await updateDoc(ruleRef, dataToSave);
        toast({ title: "Rule Updated", description: `Pricing rule "${values.name}" has been updated successfully.` });
      } else { 
        await addDoc(collection(db, "pricingRules"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Rule Added", description: `New pricing rule "${values.name}" has been added successfully.` });
      }
      fetchRules(); 
      setIsFormDialogOpen(false); 
      setEditingRule(null); 
    } catch (error: any) {
      console.error("Error saving pricing rule: ", error);
      toast({ title: "Save Error", description: `Could not save pricing rule: ${error.message}`, variant: "destructive" });
    }
  };

  const openAddDialog = () => {
    setEditingRule(null);
    setIsFormDialogOpen(true);
  };

  const openEditDialog = (rule: PricingRule) => {
    setEditingRule(rule);
    setIsFormDialogOpen(true);
  };

  const openDeleteDialog = (rule: PricingRule) => {
    setRuleToDelete(rule);
    setIsDeleteConfirmOpen(true);
  };
  
  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    try {
        await deleteDoc(doc(db, "pricingRules", ruleToDelete.id));
        toast({ title: "Rule Deleted", description: `Pricing rule "${ruleToDelete.name}" has been deleted.`, variant: "default" });
        fetchRules(); 
    } catch (error: any) {
        console.error("Error deleting rule: ", error);
        toast({ title: "Deletion Error", description: `Could not delete the pricing rule: ${error.message}`, variant: "destructive" });
    } finally {
        setIsDeleteConfirmOpen(false);
        setRuleToDelete(null);
    }
  };

  const handleToggleStatus = async (rule: PricingRule) => {
    const newStatus = rule.status === "Active" ? "Inactive" : "Active";
    try {
      const ruleRef = doc(db, "pricingRules", rule.id);
      await updateDoc(ruleRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Status Updated", description: `Rule "${rule.name}" is now ${newStatus.toLowerCase()}.` });
      fetchRules(); 
    } catch (error: any) {
      console.error("Error toggling rule status: ", error);
      toast({ title: "Status Update Error", description: `Could not update the rule status: ${error.message}`, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageHeader title="Pricing Rules Engine" description="Loading pricing rules from database..." icon={SlidersHorizontal} />;
  }

  return (
    <>
      <PageHeader
        title="Pricing Rules Engine"
        description="Define and manage automated pricing adjustments. (Admin Only)"
        icon={SlidersHorizontal}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Pricing Rule</Button>}
      />
      
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 shadow-md">
        <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center text-lg">
                <Info className="mr-2 h-5 w-5 shrink-0"/> Important Note on Rule Logic
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-600 dark:text-blue-400 pb-4">
            <p>Currently, 'Conditions' and 'Actions' are stored as descriptive text. The actual application of these rules to live pricing (e.g., during bill creation) is a complex feature planned for future development and is not yet implemented.</p>
            <p className="mt-1">This page allows you to define and manage the rule definitions themselves.</p>
        </CardContent>
      </Card>


      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
              setIsFormDialogOpen(false); 
              setEditingRule(null); 
              form.reset(); 
          } else {
              setIsFormDialogOpen(isOpen); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Add New Pricing Rule"}</DialogTitle>
            <DialogDescription>Define the name, type, description, status, conditions, and actions for this pricing rule.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4"> 
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Rule Name</FormLabel><FormControl><Input placeholder="e.g., Summer Widget Discount" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Rule Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select rule type" /></SelectTrigger></FormControl>
                    <SelectContent>{PRICING_RULE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Explain when this rule applies and what it does (e.g., 10% off widgets if quantity > 5)" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select rule status" /></SelectTrigger></FormControl>
                    <SelectContent>{PRICING_RULE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
               <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority (Optional)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 1 (lower numbers apply first)" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} /></FormControl>
                    <FormDescription>Lower numbers indicate higher priority. Leave blank for default.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="conditions" render={({ field }) => (<FormItem><FormLabel>Conditions (Descriptive Text)</FormLabel><FormControl><Textarea placeholder="e.g., Product SKU: WIDGET-001, Minimum Quantity: 10 units, Customer Group: Wholesale" {...field} rows={3} /></FormControl><FormDescription>Describe when this rule should apply. Actual logic is TBD.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="action" render={({ field }) => (<FormItem><FormLabel>Action (Descriptive Text)</FormLabel><FormControl><Textarea placeholder="e.g., Apply 10% discount on item OR Set item price to ₹500.00" {...field} rows={3} /></FormControl><FormDescription>Describe what happens when conditions are met. Actual logic is TBD.</FormDescription><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingRule ? "Saving..." : "Adding...") : (editingRule ? "Save Changes" : "Add Rule")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setRuleToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Deleting rule &quot;{ruleToDelete?.name}&quot; will permanently remove it from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setRuleToDelete(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRule} className="bg-destructive hover:bg-destructive/90">
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pricingRules.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pricingRules.map((rule) => (
            <Card key={rule.id} className="shadow-lg rounded-xl flex flex-col justify-between hover:shadow-primary/10 transition-shadow">
                <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-foreground text-lg leading-tight">{rule.name}</CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={() => handleToggleStatus(rule)} title={rule.status === 'Active' ? 'Deactivate Rule' : 'Activate Rule'}>
                    {rule.status === 'Active' ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    <span className="sr-only">{rule.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                    </Button>
                </div>
                <CardDescription className="text-xs">
                    {rule.type} - <span className={rule.status === 'Active' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground'}>{rule.status}</span>
                    {rule.priority !== undefined && <span className="ml-2 text-muted-foreground">(Priority: {rule.priority})</span>}
                </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-2 text-sm">
                <p className="text-muted-foreground"><strong className="text-foreground/80">Description:</strong> {rule.description}</p>
                <p className="text-muted-foreground"><strong className="text-foreground/70">Conditions:</strong> <span className="text-xs">{rule.conditions}</span></p>
                <p className="text-muted-foreground"><strong className="text-foreground/70">Action:</strong> <span className="text-xs">{rule.action}</span></p>
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t mt-3">
                <div className="flex space-x-2 w-full">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => openEditDialog(rule)}>
                    <Edit className="mr-2 h-3 w-3" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => openDeleteDialog(rule)}>
                    <Trash2 className="mr-2 h-3 w-3" /> Delete
                    </Button>
                </div>
                </CardFooter>
            </Card>
            ))}
            {/* Placeholder card for adding new rule, if list is not empty */}
            {pricingRules.length > 0 && (
                <Card 
                    className="shadow-lg rounded-xl border-dashed border-2 flex flex-col items-center justify-center hover:border-primary transition-colors cursor-pointer min-h-[200px] group" 
                    onClick={openAddDialog}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openAddDialog()}
                >
                    <PlusCircle className="h-10 w-10 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-muted-foreground group-hover:text-primary font-medium">Add New Pricing Rule</span>
                </Card>
            )}
        </div>
       ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground mb-2">No Pricing Rules Yet</p>
            <p className="text-sm text-muted-foreground mb-6">Get started by defining your first pricing rule to automate discounts or special prices.</p>
            <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Pricing Rule</Button>
        </div>
      )}
    </>
  );
}
