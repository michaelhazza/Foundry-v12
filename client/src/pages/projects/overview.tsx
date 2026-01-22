import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Plus, FileText, Database, Settings2, Play, ArrowRight } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Source {
  id: number;
  name: string;
  type: string;
  status: string;
  recordCount: number | null;
}

interface Dataset {
  id: number;
  name: string;
  format: string;
  recordCount: number;
  createdAt: string;
}

interface ProcessingRun {
  id: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsProcessed: number;
}

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [recentRuns, setRecentRuns] = useState<ProcessingRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourcesRes, datasetsRes, runsRes] = await Promise.all([
          api.get<{ data: Project }>(`/projects/${projectId}`),
          api.get<{ data: Source[] }>(`/projects/${projectId}/sources`),
          api.get<{ data: Dataset[] }>(`/projects/${projectId}/datasets`),
          api.get<{ data: ProcessingRun[] }>(`/projects/${projectId}/processing/runs?limit=5`),
        ]);

        setProject(projectRes.data.data);
        setSources(sourcesRes.data.data);
        setDatasets(datasetsRes.data.data);
        setRecentRuns(runsRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load project data');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
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

  if (error) {
    return (
      <ProjectLayout projectId={projectId!} projectName="Error">
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId!} projectName={project?.name || ''}>
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sources.length}</div>
              <p className="text-xs text-muted-foreground">
                {sources.filter((s) => s.status === 'ready').length} ready for processing
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Datasets</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{datasets.length}</div>
              <p className="text-xs text-muted-foreground">
                {datasets.reduce((sum, d) => sum + d.recordCount, 0).toLocaleString()} total records
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Processing Runs</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentRuns.length}</div>
              <p className="text-xs text-muted-foreground">
                {recentRuns.filter((r) => r.status === 'completed').length} completed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for this project</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Link to={`/projects/${projectId}/sources/upload`}>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Upload Source
              </Button>
            </Link>
            <Link to={`/projects/${projectId}/sources/connect`}>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Connect Teamwork
              </Button>
            </Link>
            <Link to={`/projects/${projectId}/processing`}>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Configure Processing
              </Button>
            </Link>
            <Link to={`/projects/${projectId}/processing/run`}>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                Run Processing
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Sources */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>Source data for this project</CardDescription>
            </div>
            <Link to={`/projects/${projectId}/sources`}>
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No sources added yet.{' '}
                <Link to={`/projects/${projectId}/sources/upload`} className="text-primary hover:underline">
                  Upload your first source
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {sources.slice(0, 5).map((source) => (
                  <Link
                    key={source.id}
                    to={`/projects/${projectId}/sources/${source.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground">{source.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {source.recordCount !== null && (
                        <span className="text-sm text-muted-foreground">
                          {source.recordCount.toLocaleString()} records
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                        {source.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Processing Runs</CardTitle>
                <CardDescription>Latest processing activity</CardDescription>
              </div>
              <Link to={`/projects/${projectId}/processing/history`}>
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Play className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Run #{run.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(run.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {run.recordsProcessed.toLocaleString()} records
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProjectLayout>
  );
}
