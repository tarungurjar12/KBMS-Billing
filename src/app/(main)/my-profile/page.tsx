
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MyProfilePage() {
  return (
    <>
      <PageHeader
        title="My Profile"
        description="View and update your personal information."
        icon={UserCircle}
      />
      <Card className="shadow-lg rounded-xl max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Your Details</CardTitle>
          <CardDescription>Update your contact information and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="Store Manager Name (Placeholder)" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input id="userId" defaultValue="manager" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactNumber">Contact Number</Label>
            <Input id="contactNumber" placeholder="Enter your contact number" />
          </div>
           <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" placeholder="Enter current password to change" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" placeholder="Enter new password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
            <Input id="confirmNewPassword" type="password" placeholder="Confirm new password" />
          </div>
          <div className="flex justify-end pt-4">
            <Button>Update Profile</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
