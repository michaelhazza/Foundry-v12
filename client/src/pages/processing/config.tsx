import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Settings2, Play, HelpCircle } from 'lucide-react';

interface ProcessingConfig {
  id?: number;
  name: string;
  outputFormat: 'jsonl' | 'csv' | 'parquet';
  includeMetadata: boolean;
  splitRatio?: { train: number; validation: number; test: number };
  filterRules?: FilterRule[];
}

interface FilterRule {
  field: string;
  operator: 'equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: string;
}

export default function ProcessingConfigPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [config, setConfig] = useState<ProcessingConfig>({
    name: 'Default Configuration',
    outputFormat: 'jsonl',
    includeMetadata: false,
    splitRatio: { train: 0.8, validation: 0.1, test: 0.1 },
    filterRules: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      try {
        const [projectRes, configRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: ProcessingConfig }>(`/projects/${projectId}/processing/config`).catch(() => null),
        ]);
        setProjectName(projectRes.data.data.name);
        if (configRes?.data?.data) {
          setConfig(configRes.data.data);
        }
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load configuration');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await api.put(`/projects/${projectId}/processing/config`, config);
      setSuccess('Processing configuration saved successfully');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to save configuration');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateSplitRatio = (key: 'train' | 'validation' | 'test', value: number) => {
    setConfig((prev) => ({
      ...prev,
      splitRatio: {
        ...prev.splitRatio!,
        [key]: value,
      },
    }));
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
        title="Processing Configuration"
        description="Configure how your data will be processed and formatted"
        action={
          <Button onClick={() => navigate(`/projects/${projectId}/processing/run`)}>
            <Play className="mr-2 h-4 w-4" />
            Run Processing
          </Button>
        }
      />

      <div className="space-y-6 max-w-3xl">
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

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Configuration Name</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter configuration name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Output Format</Label>
              <select
                id="format"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={config.outputFormat}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    outputFormat: e.target.value as 'jsonl' | 'csv' | 'parquet',
                  }))
                }
              >
                <option value="jsonl">JSONL (JSON Lines)</option>
                <option value="csv">CSV</option>
                <option value="parquet">Parquet</option>
              </select>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                JSONL is recommended for most AI training frameworks
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="metadata"
                checked={config.includeMetadata}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, includeMetadata: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="metadata" className="cursor-pointer">
                Include metadata in output
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Dataset Split */}
        <Card>
          <CardHeader>
            <CardTitle>Dataset Split</CardTitle>
            <CardDescription>
              Configure how records are split between training, validation, and test sets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="train">Training ({Math.round((config.splitRatio?.train || 0.8) * 100)}%)</Label>
                <Input
                  id="train"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={(config.splitRatio?.train || 0.8) * 100}
                  onChange={(e) => updateSplitRatio('train', parseInt(e.target.value) / 100)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validation">Validation ({Math.round((config.splitRatio?.validation || 0.1) * 100)}%)</Label>
                <Input
                  id="validation"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={(config.splitRatio?.validation || 0.1) * 100}
                  onChange={(e) => updateSplitRatio('validation', parseInt(e.target.value) / 100)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test">Test ({Math.round((config.splitRatio?.test || 0.1) * 100)}%)</Label>
                <Input
                  id="test"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={(config.splitRatio?.test || 0.1) * 100}
                  onChange={(e) => updateSplitRatio('test', parseInt(e.target.value) / 100)}
                />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary"
                  style={{ width: `${(config.splitRatio?.train || 0.8) * 100}%` }}
                />
                <div
                  className="bg-blue-400"
                  style={{ width: `${(config.splitRatio?.validation || 0.1) * 100}%` }}
                />
                <div
                  className="bg-green-400"
                  style={{ width: `${(config.splitRatio?.test || 0.1) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Train</span>
                <span>Validation</span>
                <span>Test</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}`)}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProjectLayout>
  );
}
