import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Database, Download, Calendar, FileText, Play } from 'lucide-react';

interface Dataset {
  id: number;
  name: string;
  format: 'jsonl' | 'csv' | 'parquet';
  recordCount: number;
  fileSize: number;
  split: 'train' | 'validation' | 'test' | 'full';
  createdAt: string;
  downloadUrl?: string;
}

export default function DatasetsListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, datasetsRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: Dataset[] }>(`/projects/${projectId}/datasets`),
        ]);
        setProjectName(projectRes.data.data.name);
        setDatasets(datasetsRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load datasets');
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSplitColor = (split: string) => {
    switch (split) {
      case 'train':
        return 'bg-blue-100 text-blue-700';
      case 'validation':
        return 'bg-purple-100 text-purple-700';
      case 'test':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleDownload = async (dataset: Dataset) => {
    try {
      const response = await api.get<{ data: { url: string } }>(
        `/projects/${projectId}/datasets/${dataset.id}/download`
      );
      window.open(response.data.data.url, '_blank');
    } catch {
      setError('Failed to generate download link');
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
        title="Datasets"
        description="Generated training datasets ready for download"
        action={
          <Link to={`/projects/${projectId}/processing/run`}>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Generate New Dataset
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
          {error}
        </div>
      )}

      {datasets.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No datasets yet"
          description="Process your source data to generate training datasets."
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
          {datasets.map((dataset) => (
            <Link key={dataset.id} to={`/projects/${projectId}/datasets/${dataset.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Database className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{dataset.name}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSplitColor(dataset.split)}`}>
                            {dataset.split}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {dataset.format.toUpperCase()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(dataset.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium">{dataset.recordCount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">records</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatFileSize(dataset.fileSize)}</p>
                        <p className="text-sm text-muted-foreground">file size</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownload(dataset);
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
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
