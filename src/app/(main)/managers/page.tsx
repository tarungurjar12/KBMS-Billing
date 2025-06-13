import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { UserCog, PlusCircle } from "lucide-react";

export default function ManageManagersPage() {
  return (
    <>
      <PageHeader
        title="Manage Managers"
        description="Administer Store Manager accounts and permissions."
        icon={UserCog}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Manager
          </Button>
        }
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Manager List</CardTitle>
          <CardDescription>A list of all store managers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
            <p className="text-muted-foreground">Manager list and management tools will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
