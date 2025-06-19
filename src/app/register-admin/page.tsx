
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; // Not directly used with RHF, but good to keep for potential direct use
import { Building, UserPlus, UserCircle, KeyRound, Phone, Globe, FileTextIcon, Image as ImageIcon } from 'lucide-react';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useForm } from "react-hook-form"; // Removed Controller as not explicitly used in this version
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from '@/app/(main)/my-profile/page'; 
import Link from 'next/link';


const adminRegistrationSchema = z.object({
  // Admin Details
  adminName: z.string().min(3, "Admin name must be at least 3 characters."),
  adminEmail: z.string().email("Invalid email address. This will be your login ID."),
  adminPassword: z.string().min(6, "Password must be at least 6 characters."),
  adminConfirmPassword: z.string().min(6, "Please confirm your password."),
  adminPhone: z.string().min(10, "Admin phone number must be at least 10 digits.").regex(/^\d+[\d\s-]*$/, "Admin phone must be valid."),
  
  // Company Details
  companyName: z.string().min(3, "Company name must be at least 3 characters."),
  companyAddress: z.string().min(10, "Company address must be at least 10 characters."),
  companyContactPhone: z.string().min(10, "Company contact phone must be at least 10 digits.").regex(/^\d+[\d\s-]*$/, "Company phone must be valid."),
  companyGstin: z.string().optional().or(z.literal('')).refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
    message: "Invalid GSTIN format (e.g., 29ABCDE1234F1Z5) or leave blank.",
  }),
  companyLogoUrl: z.string().url("Must be a valid URL (e.g., https://example.com/logo.png) or leave blank.").optional().or(z.literal('')),
}).refine(data => data.adminPassword === data.adminConfirmPassword, {
  message: "Passwords don't match.",
  path: ["adminConfirmPassword"], 
});

type AdminRegistrationFormValues = z.infer<typeof adminRegistrationSchema>;

export default function RegisterAdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<AdminRegistrationFormValues>({
    resolver: zodResolver(adminRegistrationSchema),
    defaultValues: {
        adminName: "", adminEmail: "", adminPassword: "", adminConfirmPassword: "", adminPhone: "",
        companyName: "", companyAddress: "", companyContactPhone: "", companyGstin: "", companyLogoUrl: ""
    },
  });

  const onSubmit = async (values: AdminRegistrationFormValues) => {
    setLoading(true);
    try {
      // 1. Check for unique admin email (globally unique due to Firebase Auth)
      // Firebase createUserWithEmailAndPassword will handle this, but an early check can be good UX
      const emailQuery = query(collection(db, "users"), where("email", "==", values.adminEmail));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        form.setError("adminEmail", { type: "manual", message: "This email is already registered. Please try logging in or use a different email." });
        setLoading(false);
        return;
      }

      // 2. Check for unique company (Company Name + Company Contact Phone) among existing admins
      const companyQuery = query(collection(db, "users"), 
        where("role", "==", "admin"), 
        where("companyName", "==", values.companyName),
        where("companyContact", "==", values.companyContactPhone) 
      );
      const companySnapshot = await getDocs(companyQuery);
      if (!companySnapshot.empty) {
        form.setError("companyName", { type: "manual", message: "A company with this name and contact phone already exists." });
        form.setError("companyContactPhone", { type: "manual", message: "A company with this name and contact phone already exists." });
        setLoading(false);
        return;
      }

      // 3. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, values.adminEmail, values.adminPassword);
      const user = userCredential.user;

      if (!user || !user.uid) {
        throw new Error("Firebase Auth user creation failed or UID is missing.");
      }

      // 4. Prepare data for Firestore document (using auth UID as companyId)
      const companyId = user.uid; 
      const adminProfileData: UserProfile = {
        uid: user.uid,
        authUid: user.uid,
        name: values.adminName,
        email: values.adminEmail,
        contactNumber: values.adminPhone, 
        role: 'admin',
        companyId: companyId,
        companyName: values.companyName,
        companyAddress: values.companyAddress,
        companyContact: values.companyContactPhone, 
        companyGstin: values.companyGstin || undefined, 
        companyLogoUrl: values.companyLogoUrl || undefined, 
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        status: "Active",
      };

      // 5. Create Firestore document in 'users' collection
      await setDoc(doc(db, "users", user.uid), adminProfileData);

      toast({
        title: "Admin Account Created!",
        description: "Your admin account and company profile have been successfully created.",
      });
      
      router.push('/login?registrationSuccess=true');

    } catch (error: any) {
      console.error("Admin registration error: ", error);
      let errorMessage = "Failed to create admin account. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        form.setError("adminEmail", { type: "manual", message: "This email is already registered. Please try logging in or use a different email." });
        errorMessage = "This email is already in use.";
      } else if (error.code === 'auth/weak-password') {
        form.setError("adminPassword", { type: "manual", message: "The password is too weak. Please use a stronger password (at least 6 characters)." });
        errorMessage = "Password is too weak.";
      }
      toast({ title: "Registration Failed", description: error.message || errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 py-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center mb-3">
            <UserPlus className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline text-foreground">Create Admin Account</CardTitle>
          <CardDescription>Set up your company profile and admin credentials.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8 pt-6 pb-2 max-h-[70vh] overflow-y-auto px-3 sm:px-6">
              {/* Admin Details Section */}
              <section className="space-y-4 p-3 sm:p-4 border rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-primary flex items-center"><UserCircle className="mr-2 h-5 w-5"/>Admin Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="adminName" render={({ field }) => (
                      <FormItem><FormLabel>Your Full Name</FormLabel><FormControl><Input placeholder="e.g., Priya Sharma" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="adminEmail" render={({ field }) => (
                      <FormItem><FormLabel>Login Email</FormLabel><FormControl><Input type="email" placeholder="e.g., admin@mycompany.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="adminPassword" render={({ field }) => (
                      <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="adminConfirmPassword" render={({ field }) => (
                      <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" placeholder="Re-enter password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name="adminPhone" render={({ field }) => (
                    <FormItem><FormLabel>Your Personal Phone</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </section>

              {/* Company Information Section */}
              <section className="space-y-4 p-3 sm:p-4 border rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-primary flex items-center"><Building className="mr-2 h-5 w-5"/>Company Information</h3>
                <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="e.g., My Awesome Company Pvt. Ltd." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="companyAddress" render={({ field }) => (
                    <FormItem><FormLabel>Company Full Address</FormLabel><FormControl><Textarea placeholder="123 Business Park, Industrial Area, City, State, PIN" {...field} rows={3}/></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyContactPhone" render={({ field }) => (
                      <FormItem><FormLabel>Company Contact Phone</FormLabel><FormControl><Input placeholder="e.g., 011-23456789" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="companyGstin" render={({ field }) => (
                      <FormItem><FormLabel>Company GSTIN (Optional)</FormLabel><FormControl><Input placeholder="e.g., 29ABCDE1234F1Z5" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="companyLogoUrl" render={({ field }) => (
                    <FormItem><FormLabel>Company Logo URL (Optional)</FormLabel><FormControl><Input placeholder="https://example.com/your_logo.png" {...field} /></FormControl><FormDescription>Paste a direct link to your company logo image.</FormDescription><FormMessage /></FormItem>)} />
              </section>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-6 px-3 sm:px-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Admin Account &amp; Company Profile'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Login Here
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
    