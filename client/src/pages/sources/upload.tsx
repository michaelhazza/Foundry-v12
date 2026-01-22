import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Upload, FileText, X, CheckCircle } from 'lucide-react';

export default function SourceUploadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (isValidFileType(droppedFile)) {
        setFile(droppedFile);
        if (!name) {
          setName(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setError('Invalid file type. Please upload a CSV or JSON file.');
      }
    }
  }, [name]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (isValidFileType(selectedFile)) {
        setFile(selectedFile);
        if (!name) {
          setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setError('Invalid file type. Please upload a CSV or JSON file.');
      }
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel'];
    const validExtensions = ['.csv', '.json'];
    return (
      validTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/projects/${projectId}/sources/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ApiRequestError(
          errorData.error?.message || 'Upload failed',
          errorData.error?.code || 'UPLOAD_ERROR',
          response.status
        );
      }

      const result = await response.json();
      navigate(`/projects/${projectId}/sources/${result.data.id}`);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        title="Upload Source File"
        description="Upload a CSV or JSON file as a data source"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
            <CardDescription>
              Drag and drop a file or click to browse. Supported formats: CSV, JSON.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Source Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Customer Support Tickets"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                        <FileText className="h-6 w-6 text-primary" />
                        <div className="text-left">
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">
                        Drag and drop your file here, or
                      </p>
                      <label htmlFor="file-upload">
                        <Button type="button" variant="outline" asChild>
                          <span>Browse Files</span>
                        </Button>
                        <input
                          id="file-upload"
                          type="file"
                          className="hidden"
                          accept=".csv,.json"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground mt-4">
                        CSV or JSON files up to 50MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  File ready for upload
                </div>
              )}
            </CardContent>

            <CardFooter className="flex gap-4">
              <Button type="submit" disabled={isLoading || !file || !name.trim()}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload Source
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
      </div>
    </ProjectLayout>
  );
}
