import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Play, CheckCircle, Clock, AlertCircle, Calendar, Database, History } from 'lucide-react';

interface ProcessingRun {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  recordsProcessed: number;
  recordsTotal: number;
  datasetsCreated: number;
  errorMessage: string | null;
}

export default function ProcessingHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState('');
  const [runs, setRuns] = useState<ProcessingRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, runsRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: ProcessingRun[] }>(`/projects/${projectId}/processing/runs`),
        ]);
        setProjectName(projectRes.data.data.name);
        setRuns(runsRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load processing history');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
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

  return (
    <ProjectLayout projectId={projectId!} projectName={projectName}>
      <PageHeader
        title="Processing History"
        description="View past processing runs and their results"
        action={
          <Link to={`/projects/${projectId}/processing/run`}>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              New Run
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
          {error}
        </div>
      )}

      {runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No processing runs"
          description="Start processing your data to create training datasets."
          action={
            <Link to={`/projects/${projectId}/processing/run`}>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                Start Processing
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(run.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Run #{run.id}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(run.startedAt)}
                        </span>
                        {run.completedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(run.startedAt, run.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium">
                        {run.recordsProcessed.toLocaleString()} / {run.recordsTotal.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">records processed</p>
                    </div>

                    {run.status === 'completed' && run.datasetsCreated > 0 && (
                      <div className="text-right">
                        <p className="font-medium flex items-center gap-1">
                          <Database className="h-4 w-4" />
                          {run.datasetsCreated}
                        </p>
                        <p className="text-sm text-muted-foreground">datasets created</p>
                      </div>
                    )}

                    {run.status === 'completed' && (
                      <Link to={`/projects/${projectId}/datasets`}>
                        <Button variant="outline" size="sm">
                          View Datasets
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {run.status === 'failed' && run.errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {run.errorMessage}
                  </div>
                )}

                {run.status === 'running' && (
                  <div className="mt-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${run.recordsTotal > 0 ? (run.recordsProcessed / run.recordsTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ProjectLayout>
  );
}
