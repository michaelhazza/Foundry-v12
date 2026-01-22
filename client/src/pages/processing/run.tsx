import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Play, CheckCircle, AlertCircle, FileText, Database, Settings2 } from 'lucide-react';

interface Source {
  id: number;
  name: string;
  status: string;
  recordCount: number | null;
  hasMappings: boolean;
}

interface ProcessingConfig {
  id: number;
  name: string;
  outputFormat: string;
}

interface ProcessingRun {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  recordsProcessed: number;
  recordsTotal: number;
  progress: number;
}

export default function ProcessingRunPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [config, setConfig] = useState<ProcessingConfig | null>(null);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [currentRun, setCurrentRun] = useState<ProcessingRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourcesRes, configRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: Source[] }>(`/projects/${projectId}/sources`),
          api.get<{ data: ProcessingConfig }>(`/projects/${projectId}/processing/config`).catch(() => null),
        ]);
        setProjectName(projectRes.data.data.name);
        setSources(sourcesRes.data.data.filter((s) => s.status === 'ready'));
        if (configRes?.data?.data) {
          setConfig(configRes.data.data);
        }
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  // Poll for run status when running
  useEffect(() => {
    if (!currentRun || currentRun.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get<{ data: ProcessingRun }>(
          `/projects/${projectId}/processing/runs/${currentRun.id}`
        );
        setCurrentRun(response.data.data);

        if (response.data.data.status === 'completed') {
          // Navigate to datasets on completion
          setTimeout(() => {
            navigate(`/projects/${projectId}/datasets`);
          }, 2000);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentRun, projectId, navigate]);

  const toggleSource = (sourceId: number) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const selectAllReady = () => {
    const readySources = sources.filter((s) => s.hasMappings).map((s) => s.id);
    setSelectedSources(readySources);
  };

  const handleStartProcessing = async () => {
    if (selectedSources.length === 0) {
      setError('Please select at least one source to process');
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      const response = await api.post<{ data: ProcessingRun }>(
        `/projects/${projectId}/processing/runs`,
        { sourceIds: selectedSources }
      );
      setCurrentRun(response.data.data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to start processing');
      }
    } finally {
      setIsStarting(false);
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

  // Show run progress
  if (currentRun) {
    return (
      <ProjectLayout projectId={projectId!} projectName={projectName}>
        <PageHeader
          title="Processing"
          description="Your data is being processed"
        />

        <Card className="max-w-2xl">
          <CardHeader className="text-center">
            {currentRun.status === 'running' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <CardTitle>Processing in Progress</CardTitle>
                <CardDescription>
                  Please wait while your data is being processed
                </CardDescription>
              </>
            )}
            {currentRun.status === 'completed' && (
              <>
                <div className="rounded-full bg-green-100 p-3 mx-auto mb-4 w-fit">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Processing Complete!</CardTitle>
                <CardDescription>
                  Your dataset has been created successfully
                </CardDescription>
              </>
            )}
            {currentRun.status === 'failed' && (
              <>
                <div className="rounded-full bg-red-100 p-3 mx-auto mb-4 w-fit">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle>Processing Failed</CardTitle>
                <CardDescription>
                  An error occurred during processing
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{currentRun.recordsProcessed.toLocaleString()} / {currentRun.recordsTotal.toLocaleString()} records</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    currentRun.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                  }`}
                  style={{ width: `${currentRun.progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {currentRun.progress}% complete
              </p>
            </div>

            {currentRun.status === 'completed' && (
              <div className="flex justify-center gap-4 pt-4">
                <Link to={`/projects/${projectId}/datasets`}>
                  <Button>
                    <Database className="mr-2 h-4 w-4" />
                    View Datasets
                  </Button>
                </Link>
              </div>
            )}

            {currentRun.status === 'failed' && (
              <div className="flex justify-center gap-4 pt-4">
                <Button onClick={() => setCurrentRun(null)}>
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId!} projectName={projectName}>
      <PageHeader
        title="Run Processing"
        description="Select sources and start processing"
      />

      <div className="space-y-6 max-w-3xl">
        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Configuration Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Processing Configuration
              </span>
              <Link to={`/projects/${projectId}/processing`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Configuration</p>
                  <p className="font-medium">{config.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Output Format</p>
                  <p className="font-medium">{config.outputFormat.toUpperCase()}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No configuration set.{' '}
                <Link to={`/projects/${projectId}/processing`} className="text-primary hover:underline">
                  Configure processing settings
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Source Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Select Sources</span>
              <Button variant="outline" size="sm" onClick={selectAllReady}>
                Select All Ready
              </Button>
            </CardTitle>
            <CardDescription>
              Choose which sources to include in this processing run
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No ready sources available.{' '}
                <Link to={`/projects/${projectId}/sources`} className="text-primary hover:underline">
                  Add a source
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedSources.includes(source.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    } ${!source.hasMappings ? 'opacity-50' : ''}`}
                    onClick={() => source.hasMappings && toggleSource(source.id)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source.id)}
                        onChange={() => {}}
                        disabled={!source.hasMappings}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {source.recordCount?.toLocaleString() || 0} records
                          </p>
                        </div>
                      </div>
                    </div>
                    {source.hasMappings ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Link
                        to={`/projects/${projectId}/sources/${source.id}/schema`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-primary hover:underline"
                      >
                        Configure mapping
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start Button */}
        <div className="flex gap-4">
          <Button
            size="lg"
            onClick={handleStartProcessing}
            disabled={isStarting || selectedSources.length === 0}
          >
            {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-2 h-4 w-4" />
            Start Processing ({selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''})
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </ProjectLayout>
  );
}
