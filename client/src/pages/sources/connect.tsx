import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Link as LinkIcon, ExternalLink, HelpCircle } from 'lucide-react';

const connectSchema = z.object({
  name: z.string().min(1, 'Source name is required').max(100, 'Name must be 100 characters or less'),
  subdomain: z.string().min(1, 'Subdomain is required'),
  apiKey: z.string().min(1, 'API key is required'),
});

type ConnectForm = z.infer<typeof connectSchema>;

export default function SourceConnectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConnectForm>({
    resolver: zodResolver(connectSchema),
  });

  const subdomain = watch('subdomain');
  const apiKey = watch('apiKey');

  useEffect(() => {
    if (!projectId) return;

    api.get<{ data: { name: string } }>(`/projects/${projectId}`)
      .then((response) => {
        setProjectName(response.data.data.name);
      })
      .catch(() => {
        setError('Failed to load project');
      })
      .finally(() => {
        setLoadingProject(false);
      });
  }, [projectId]);

  const handleTestConnection = async () => {
    if (!subdomain || !apiKey) return;

    setIsTesting(true);
    setTestSuccess(false);
    setError(null);

    try {
      await api.post(`/projects/${projectId}/sources/teamwork/test`, {
        subdomain,
        apiKey,
      });
      setTestSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Connection test failed. Please check your credentials.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = async (data: ConnectForm) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post<{ data: { id: number } }>(
        `/projects/${projectId}/sources/teamwork`,
        {
          name: data.name,
          subdomain: data.subdomain,
          apiKey: data.apiKey,
        }
      );

      navigate(`/projects/${projectId}/sources/${response.data.data.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingProject) {
    return (
      <ProjectLayout projectId={projectId!} projectName="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId!} projectName={projectName}>
      <PageHeader
        title="Connect Teamwork Desk"
        description="Import ticket data from Teamwork Desk"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Teamwork Desk Connection
            </CardTitle>
            <CardDescription>
              Enter your Teamwork Desk credentials to connect and import ticket data.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              {testSuccess && (
                <div className="p-3 text-sm text-green-600 bg-green-100 rounded-md">
                  Connection successful! Your credentials are valid.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Source Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Teamwork Support Tickets"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Teamwork Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    type="text"
                    placeholder="yourcompany"
                    {...register('subdomain')}
                  />
                  <span className="text-muted-foreground">.teamwork.com</span>
                </div>
                {errors.subdomain && (
                  <p className="text-sm text-destructive">{errors.subdomain.message}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Find this in your Teamwork Desk URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="••••••••••••••••"
                  {...register('apiKey')}
                />
                {errors.apiKey && (
                  <p className="text-sm text-destructive">{errors.apiKey.message}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  <a
                    href="https://developer.teamwork.com/desk/getting-started/authentication/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Learn how to get your API key
                  </a>
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !subdomain || !apiKey}
                >
                  {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect & Import
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/projects/${projectId}/sources`)}
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">What data will be imported?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Ticket subjects and descriptions
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Customer messages and agent responses
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Ticket metadata (status, priority, tags)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Resolution information
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ProjectLayout>
  );
}
