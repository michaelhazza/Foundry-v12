import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layouts/main-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Loader2, Building2, AlertTriangle } from 'lucide-react';

const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Name must be 100 characters or less'),
});

type OrganizationForm = z.infer<typeof organizationSchema>;

interface Organization {
  id: number;
  name: string;
  createdAt: string;
  memberCount: number;
}

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
  });

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await api.get<{ data: Organization }>('/organisations/current');
        setOrganization(response.data.data);
        reset({ name: response.data.data.name });
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load organization');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganization();
  }, [reset]);

  const onSubmit = async (data: OrganizationForm) => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const response = await api.patch<{ data: Organization }>('/organisations/current', {
        name: data.name,
      });
      setOrganization(response.data.data);
      setSuccess('Organization settings saved successfully');
      reset({ name: response.data.data.name });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = user?.role === 'owner';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Organization Settings"
        description="Manage your organization's profile and settings"
      />

      <div className="space-y-6 max-w-2xl">
        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 text-sm text-green-600 bg-green-100 rounded-md">
            {success}
          </div>
        )}

        {!isOwner && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-yellow-700">
                Only organization owners can modify these settings.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Profile
            </CardTitle>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  type="text"
                  disabled={!isOwner}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="font-medium">{organization?.memberCount || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {organization?.createdAt
                      ? new Date(organization.createdAt).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
              </div>
            </CardContent>

            {isOwner && (
              <CardFooter>
                <Button type="submit" disabled={isSaving || !isDirty}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        {/* Billing Section Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscription</CardTitle>
            <CardDescription>
              Manage your subscription and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Billing features are not yet available. Contact support for billing inquiries.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
