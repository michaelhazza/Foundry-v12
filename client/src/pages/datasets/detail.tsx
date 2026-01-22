import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Download, Trash2, Calendar, FileText, Database, Eye, AlertCircle, Filter } from 'lucide-react';

interface Dataset {
  id: number;
  name: string;
  format: 'jsonl' | 'csv' | 'parquet';
  recordCount: number;
  filteredCount: number;
  fileSize: number;
  split: 'train' | 'validation' | 'test' | 'full';
  createdAt: string;
  processingRunId: number;
}

interface DatasetRecord {
  instruction: string;
  input?: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export default function DatasetDetailPage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sampleRecords, setSampleRecords] = useState<DatasetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!projectId || !datasetId) return;

    const fetchData = async () => {
      try {
        const [projectRes, datasetRes, samplesRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: Dataset }>(`/projects/${projectId}/datasets/${datasetId}`),
          api.get<{ data: DatasetRecord[] }>(`/projects/${projectId}/datasets/${datasetId}/samples?limit=5`),
        ]);
        setProjectName(projectRes.data.data.name);
        setDataset(datasetRes.data.data);
        setSampleRecords(samplesRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load dataset');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, datasetId]);

  const handleDownload = async () => {
    try {
      const response = await api.get<{ data: { url: string } }>(
        `/projects/${projectId}/datasets/${datasetId}/download`
      );
      window.open(response.data.data.url, '_blank');
    } catch {
      setError('Failed to generate download link');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/datasets/${datasetId}`);
      navigate(`/projects/${projectId}/datasets`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to delete dataset');
      }
      setIsDeleting(false);
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

  if (isLoading) {
    return (
      <ProjectLayout projectId={projectId!} projectName="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProjectLayout>
    );
  }

  if (error && !dataset) {
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
        title={dataset?.name || 'Dataset'}
        description={`${dataset?.format.toUpperCase()} format • ${dataset?.split} split`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{dataset?.recordCount.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>File Size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{formatFileSize(dataset?.fileSize || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Split Type</CardDescription>
          </CardHeader>
          <CardContent>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSplitColor(dataset?.split || 'full')}`}>
              {dataset?.split}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{formatDate(dataset?.createdAt || '')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtered Records Notice */}
      {dataset?.filteredCount && dataset.filteredCount > 0 && (
        <Card className="mb-6 border-yellow-500 bg-yellow-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  {dataset.filteredCount.toLocaleString()} records were filtered out
                </p>
                <p className="text-sm text-yellow-700">
                  Some records did not pass the de-identification or quality filters
                </p>
              </div>
            </div>
            <Link to={`/projects/${projectId}/datasets/${datasetId}/filtered`}>
              <Button variant="outline" size="sm">
                View Filtered Records
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Sample Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Sample Records
          </CardTitle>
          <CardDescription>
            Preview of the first 5 records in this dataset
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sampleRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No records to display</p>
          ) : (
            <div className="space-y-4">
              {sampleRecords.map((record, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Instruction</p>
                    <p className="text-sm">{record.instruction}</p>
                  </div>
                  {record.input && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Input</p>
                      <p className="text-sm">{record.input}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Output</p>
                    <p className="text-sm whitespace-pre-wrap">{record.output}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Delete Dataset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Are you sure you want to delete "{dataset?.name}"? This action cannot be undone.
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
