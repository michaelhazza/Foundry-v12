import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Plus, FileText, Upload, Link as LinkIcon, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Source {
  id: number;
  name: string;
  type: 'file_upload' | 'teamwork_desk';
  status: 'pending' | 'processing' | 'ready' | 'failed';
  recordCount: number | null;
  createdAt: string;
}

export default function SourcesListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sources, setSources] = useState<Source[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourcesRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: Source[] }>(`/projects/${projectId}/sources`),
        ]);
        setProjectName(projectRes.data.data.name);
        setSources(sourcesRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load sources');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'file_upload' ? (
      <Upload className="h-5 w-5 text-muted-foreground" />
    ) : (
      <LinkIcon className="h-5 w-5 text-muted-foreground" />
    );
  };

  return (
    <ProjectLayout projectId={projectId!} projectName={projectName}>
      <PageHeader
        title="Data Sources"
        description="Manage source data for this project"
        action={
          <div className="flex gap-2">
            <Link to={`/projects/${projectId}/sources/upload`}>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </Link>
            <Link to={`/projects/${projectId}/sources/connect`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Connect Teamwork
              </Button>
            </Link>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {!isLoading && !error && sources.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No data sources"
          description="Add your first data source to start building training datasets."
          action={
            <div className="flex gap-2">
              <Link to={`/projects/${projectId}/sources/upload`}>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </Link>
              <Link to={`/projects/${projectId}/sources/connect`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Teamwork
                </Button>
              </Link>
            </div>
          }
        />
      )}

      {!isLoading && !error && sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((source) => (
            <Link key={source.id} to={`/projects/${projectId}/sources/${source.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getTypeIcon(source.type)}
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {source.type === 'file_upload' ? 'File Upload' : 'Teamwork Desk'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {source.recordCount !== null && (
                        <div className="text-right">
                          <p className="font-medium">{source.recordCount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">records</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {getStatusIcon(source.status)}
                        <span className="text-sm">{getStatusText(source.status)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(source.createdAt)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </ProjectLayout>
  );
}
