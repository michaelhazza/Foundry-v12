import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, ArrowRight, Check, HelpCircle } from 'lucide-react';

interface SchemaField {
  name: string;
  type: string;
  sampleValues: string[];
}

interface SchemaMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
}

const TARGET_FIELDS = [
  { name: 'instruction', description: 'The user question or prompt', required: true },
  { name: 'input', description: 'Additional context or input data', required: false },
  { name: 'output', description: 'The ideal response or answer', required: true },
  { name: 'context', description: 'Background information', required: false },
  { name: 'metadata', description: 'Additional metadata fields', required: false },
];

export default function SchemaMappingPage() {
  const { projectId, sourceId } = useParams<{ projectId: string; sourceId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [mappings, setMappings] = useState<SchemaMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !sourceId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourceRes, schemaRes, mappingRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: { name: string } }>(`/projects/${projectId}/sources/${sourceId}`),
          api.get<{ data: SchemaField[] }>(`/projects/${projectId}/sources/${sourceId}/schema`),
          api.get<{ data: SchemaMapping[] }>(`/projects/${projectId}/sources/${sourceId}/mapping`).catch(() => ({ data: { data: [] } })),
        ]);
        setProjectName(projectRes.data.data.name);
        setSourceName(sourceRes.data.data.name);
        setSchema(schemaRes.data.data);
        setMappings(mappingRes.data.data || []);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load schema');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, sourceId]);

  const handleMappingChange = (targetField: string, sourceField: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.targetField === targetField);
      if (sourceField === '') {
        return prev.filter((m) => m.targetField !== targetField);
      }
      if (existing) {
        return prev.map((m) =>
          m.targetField === targetField ? { ...m, sourceField } : m
        );
      }
      return [...prev, { sourceField, targetField }];
    });
  };

  const getMappedSourceField = (targetField: string) => {
    return mappings.find((m) => m.targetField === targetField)?.sourceField || '';
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    // Validate required fields
    const hasInstruction = mappings.some((m) => m.targetField === 'instruction');
    const hasOutput = mappings.some((m) => m.targetField === 'output');

    if (!hasInstruction || !hasOutput) {
      setError('Please map at least the instruction and output fields');
      setIsSaving(false);
      return;
    }

    try {
      await api.put(`/projects/${projectId}/sources/${sourceId}/mapping`, {
        mappings,
      });
      setSuccess('Schema mapping saved successfully');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to save mapping');
      }
    } finally {
      setIsSaving(false);
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
        title="Schema Mapping"
        description={`Map fields from "${sourceName}" to training data format`}
      />

      <div className="space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Field Mapping</CardTitle>
            <CardDescription>
              Map your source data fields to the training data format. Instruction and output are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {TARGET_FIELDS.map((target) => (
              <div key={target.name} className="grid gap-4 md:grid-cols-[1fr,auto,1fr] items-center">
                <div className="space-y-1">
                  <Label htmlFor={`target-${target.name}`}>Source Field</Label>
                  <select
                    id={`target-${target.name}`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={getMappedSourceField(target.name)}
                    onChange={(e) => handleMappingChange(target.name, e.target.value)}
                  >
                    <option value="">-- Select field --</option>
                    {schema.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </option>
                    ))}
                  </select>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label>
                      {target.name}
                      {target.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {getMappedSourceField(target.name) && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    {target.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Mapping
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}/sources/${sourceId}`)}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>

        {/* Schema Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Source Schema Reference</CardTitle>
            <CardDescription>Available fields from your source data</CardDescription>
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
                        {field.sampleValues.slice(0, 2).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProjectLayout>
  );
}
