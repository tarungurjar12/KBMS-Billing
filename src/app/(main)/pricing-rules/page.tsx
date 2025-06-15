
"use client"; // For future interactivity with adding/editing rules

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SlidersHorizontal, PlusCircle, Edit, Trash2, ToggleRight, ToggleLeft } from "lucide-react"; // Added Toggle icons
import { useToast } from "@/hooks/use-toast";
// Future: Import for Dialogs, Forms if adding/editing rules inline.
// Future: Import Firebase functions if rules are stored in Firestore.

/**
 * @fileOverview Page for Admin to manage Pricing Rules.
 * Allows Admin to define and manage rules for automated tiered, bulk, and volume pricing.
 * This is an Admin-only module.
 */

interface PricingRule {
  id: string; // Firestore document ID or unique local ID
  name: string;
  type: "Tiered Pricing" | "Bulk Pricing" | "Volume Pricing" | "Manual Override"; // Added Manual Override
  description: string; // Explanation of how the rule works
  status: "Active" | "Inactive";
  conditions: string; // Simplified representation of conditions, e.g., "Product: PW-001, Qty: 10-20"
  action: string; // Simplified representation of action, e.g., "Discount: 10%" or "Set Price: ₹1800"
  // Future: More structured fields for conditions (productId, minQty, maxQty) and actions (discountType, discountValue, fixedPrice).
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialPricingRules: PricingRule[] = [
  { id: "RULE-LOCAL-001", name: "Bulk Discount - Widgets", type: "Bulk Pricing", description: "10% off for 10+ Premium Widgets", status: "Active", conditions: "Product SKU: PW-001, Min Qty: 10", action: "Discount: 10%" },
  { id: "RULE-LOCAL-002", name: "Tiered Pricing - Gizmos", type: "Tiered Pricing", description: "₹1240 (1-5), ₹1100 (6-10), ₹1000 (10+)", status: "Active", conditions: "Product SKU: SG-002", action: "Tiered: 1-5 @ ₹1240, 6-10 @ ₹1100, 11+ @ ₹1000" },
  { id: "RULE-LOCAL-003", name: "Volume Discount - Doodads", type: "Volume Pricing", description: "5% off orders over ₹20000 of Doodads", status: "Inactive", conditions: "Category: Doodads, Min Order Value: ₹20000", action: "Discount: 5% on Doodad items" },
  { id: "RULE-LOCAL-004", name: "Special Price - Thingamajig", type: "Manual Override", description: "Fixed special price for Basic Thingamajig", status: "Active", conditions: "Product SKU: BT-004", action: "Set Price: ₹750.00" },
];

/**
 * PricingRulesPage component.
 * Provides UI for Admin to view and manage pricing rules.
 * Currently, adding/editing rules is a placeholder.
 */
export default function PricingRulesPage() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Effect to load pricing rules (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch pricing rules from Firestore
    // const fetchRules = async () => { /* ... Firestore fetch logic ... */ setIsLoading(false); };
    // fetchRules();

    // Phase 1: Use local data
    setPricingRules(initialPricingRules);
    setIsLoading(false);
  }, []);

  const handleAddRule = () => {
    // Future: Open a dialog or navigate to a form for creating a new pricing rule.
    toast({ title: "Add New Rule (Placeholder)", description: "Functionality to add new pricing rules to be implemented." });
  };

  const handleEditRule = (ruleId: string) => {
    // Future: Open a dialog or navigate to a form for editing the selected rule.
    toast({ title: "Edit Rule (Placeholder)", description: `Editing rule ID: ${ruleId}. To be implemented.` });
  };

  const handleDeleteRule = (ruleId: string) => {
    // Future: Implement delete confirmation and Firestore deletion.
    toast({ title: "Delete Rule (Placeholder)", description: `Deleting rule ID: ${ruleId}. Needs confirmation.`, variant: "destructive" });
    // Phase 1 local example:
    // setPricingRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const handleToggleStatus = (ruleId: string) => {
    // Future: Update status in Firestore.
    setPricingRules(prevRules =>
      prevRules.map(rule =>
        rule.id === ruleId
          ? { ...rule, status: rule.status === "Active" ? "Inactive" : "Active" }
          : rule
      )
    );
    const updatedRule = pricingRules.find(r => r.id === ruleId);
    toast({
      title: `Rule Status Updated (Locally)`,
      description: `Rule "${updatedRule?.name}" is now ${updatedRule?.status === "Active" ? "Inactive" : "Active"}.`,
    });
  };

  if (isLoading) {
    return <PageHeader title="Pricing Rules Engine" description="Loading pricing rules..." icon={SlidersHorizontal} />;
  }

  return (
    <>
      <PageHeader
        title="Pricing Rules Engine"
        description="Flexible pricing rules for automated tiered, bulk, and volume pricing. (Admin Only)"
        icon={SlidersHorizontal}
        actions={
          <Button onClick={handleAddRule}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Rule
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pricingRules.map((rule) => (
          <Card key={rule.id} className="shadow-lg rounded-xl flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-foreground text-lg">{rule.name}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleToggleStatus(rule.id)} title={rule.status === 'Active' ? 'Deactivate Rule' : 'Activate Rule'}>
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
            <CardFooter className="pt-2 pb-4">
               <div className="flex space-x-2 w-full">
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleEditRule(rule.id)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDeleteRule(rule.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
         <Card className="shadow-lg rounded-xl border-dashed border-2 flex flex-col items-center justify-center hover:border-primary transition-colors cursor-pointer min-h-[200px]" onClick={handleAddRule}>
          <PlusCircle className="h-10 w-10 mb-2 text-muted-foreground group-hover:text-primary" />
          <span className="text-muted-foreground group-hover:text-primary font-medium">Add New Pricing Rule</span>
        </Card>
      </div>
       {pricingRules.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground">
            No pricing rules configured yet. Click "Add New Rule" to start.
        </div>
      )}
      {/* 
        Phase 1 Data Storage: Pricing rules are stored in local component state.
        Phase 2 (Future-Ready):
        - Pricing rules will be stored in a 'pricingRules' collection in Firebase Firestore.
        - Each document would represent a rule with structured fields for:
          - name, type, description, status
          - conditions: (e.g., array of objects: [{ field: 'productId', operator: '==', value: 'XYZ' }, { field: 'quantity', operator: '>=', value: 10 }])
          - action: (e.g., { type: 'discountPercentage', value: 10 } or { type: 'fixedPrice', value: 1800 })
          - priority/order (for rule evaluation if multiple rules could apply)
        - The billing/invoicing module would fetch active rules and apply them to calculate final prices.
        - This requires a more complex UI for defining conditions and actions.
      */}
    </>
  );
}
