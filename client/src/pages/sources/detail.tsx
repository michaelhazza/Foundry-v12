import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Trash2, RefreshCw, FileText, Calendar, Database, CheckCircle, Clock, AlertCircle, Settings2, Shield } from 'lucide-react';

interface Source {
  id: number;
  name: string;
  type: 'file_upload' | 'teamwork_desk';
  status: 'pending' | 'processing' | 'ready' | 'failed';
  recordCount: number | null;
  filePath: string | null;
  teamworkSubdomain: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SchemaField {
  name: string;
  type: string;
  sampleValues: string[];
}

export default function SourceDetailPage() {
  const { projectId, sourceId } = useParams<{ projectId: string; sourceId: string }>();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source | null>(null);
  const [projectName, setProjectName] = useState('');
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!projectId || !sourceId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourceRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: Source }>(`/projects/${projectId}/sources/${sourceId}`),
        ]);
        setProjectName(projectRes.data.data.name);
        setSource(sourceRes.data.data);

        // Fetch schema if source is ready
        if (sourceRes.data.data.status === 'ready') {
          try {
            const schemaRes = await api.get<{ data: SchemaField[] }>(
              `/projects/${projectId}/sources/${sourceId}/schema`
            );
            setSchema(schemaRes.data.data);
          } catch {
            // Schema might not be available yet
          }
        }
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load source');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, sourceId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/sources/${sourceId}`);
      navigate(`/projects/${projectId}/sources`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to delete source');
      }
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (source?.type !== 'teamwork_desk') return;

    setIsRefreshing(true);
    setError(null);

    try {
      await api.post(`/projects/${projectId}/sources/${sourceId}/sync`);
      // Refresh source data
      const response = await api.get<{ data: Source }>(
        `/projects/${projectId}/sources/${sourceId}`
      );
      setSource(response.data.data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to sync source');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready for processing';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Pending';
    }
  };

  if (isLoading) {
    return (
      <ProjectLayout projectId={projectId!} projectName="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProjectLayout>
    );
  }

  if (error && !source) {
    return (
      <ProjectLayout projectId={projectId!} projectName={projectName}>
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId!} projectName={projectName}>
      <PageHeader
        title={source?.name || 'Source'}
        description={source?.type === 'file_upload' ? 'File Upload' : 'Teamwork Desk'}
        action={
          <div className="flex gap-2">
            {source?.type === 'teamwork_desk' && (
              <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Now
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Source Info */}
        <Card>
          <CardHeader>
            <CardTitle>Source Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(source?.status || 'pending')}
                <span>{getStatusText(source?.status || 'pending')}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {source?.type === 'file_upload' ? 'File Upload' : 'Teamwork Desk'}
              </span>
            </div>
            {source?.recordCount !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Records</span>
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {source?.recordCount?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(source?.createdAt || '')}
              </span>
            </div>
            {source?.teamworkSubdomain && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subdomain</span>
                <span>{source.teamworkSubdomain}.teamwork.com</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up processing for this source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to={`/projects/${projectId}/sources/${sourceId}/schema`}>
              <Button variant="outline" className="w-full justify-start">
                <Settings2 className="mr-2 h-4 w-4" />
                Schema Mapping
              </Button>
            </Link>
            <Link to={`/projects/${projectId}/sources/${sourceId}/deidentification`}>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="mr-2 h-4 w-4" />
                De-identification Rules
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Schema Preview */}
      {schema.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Schema Preview</CardTitle>
            <CardDescription>Detected fields in your data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Field Name</th>
                    <th className="text-left py-2 px-4 font-medium">Type</th>
                    <th className="text-left py-2 px-4 font-medium">Sample Values</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((field) => (
                    <tr key={field.name} className="border-b last:border-0">
                      <td className="py-2 px-4 font-mono text-sm">{field.name}</td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-1 bg-muted rounded text-xs">
                          {field.type}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-sm text-muted-foreground">
                        {field.sampleValues.slice(0, 3).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Delete Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Are you sure you want to delete "{source?.name}"? This action cannot be undone.
              </p>
            </CardContent>
            <div className="p-6 pt-0 flex gap-4">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ProjectLayout>
  );
}
