import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, Plus, Trash2, Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface DeidentificationRule {
  id?: number;
  type: 'regex' | 'field' | 'builtin';
  pattern?: string;
  field?: string;
  replacement: string;
  builtinType?: string;
}

const BUILTIN_RULES = [
  { type: 'email', label: 'Email Addresses', description: 'Replaces email addresses with [EMAIL]' },
  { type: 'phone', label: 'Phone Numbers', description: 'Replaces phone numbers with [PHONE]' },
  { type: 'ssn', label: 'SSN/Tax IDs', description: 'Replaces Social Security and Tax IDs with [SSN]' },
  { type: 'credit_card', label: 'Credit Card Numbers', description: 'Replaces credit card numbers with [CC]' },
  { type: 'ip_address', label: 'IP Addresses', description: 'Replaces IP addresses with [IP]' },
  { type: 'name', label: 'Person Names', description: 'Attempts to detect and replace person names' },
];

export default function DeidentificationPage() {
  const { projectId, sourceId } = useParams<{ projectId: string; sourceId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [rules, setRules] = useState<DeidentificationRule[]>([]);
  const [enabledBuiltins, setEnabledBuiltins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!projectId || !sourceId) return;

    const fetchData = async () => {
      try {
        const [projectRes, sourceRes, configRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: { name: string } }>(`/projects/${projectId}/sources/${sourceId}`),
          api.get<{ data: { rules: DeidentificationRule[]; enabledBuiltins: string[] } }>(
            `/projects/${projectId}/sources/${sourceId}/deidentification`
          ).catch(() => ({ data: { data: { rules: [], enabledBuiltins: [] } } })),
        ]);
        setProjectName(projectRes.data.data.name);
        setSourceName(sourceRes.data.data.name);
        setRules(configRes.data.data?.rules || []);
        setEnabledBuiltins(configRes.data.data?.enabledBuiltins || []);
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
  }, [projectId, sourceId]);

  const toggleBuiltin = (type: string) => {
    setEnabledBuiltins((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const addCustomRule = () => {
    setRules((prev) => [
      ...prev,
      { type: 'regex', pattern: '', replacement: '[REDACTED]' },
    ]);
  };

  const updateRule = (index: number, updates: Partial<DeidentificationRule>) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...updates } : rule))
    );
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await api.put(`/projects/${projectId}/sources/${sourceId}/deidentification`, {
        rules,
        enabledBuiltins,
      });
      setSuccess('De-identification rules saved successfully');
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

  const handleTest = async () => {
    if (!testInput.trim()) return;

    setIsTesting(true);
    setTestOutput('');

    try {
      const response = await api.post<{ data: { output: string } }>(
        `/projects/${projectId}/sources/${sourceId}/deidentification/test`,
        {
          input: testInput,
          rules,
          enabledBuiltins,
        }
      );
      setTestOutput(response.data.data.output);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to test de-identification');
      }
    } finally {
      setIsTesting(false);
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
        title="De-identification Rules"
        description={`Configure PII removal for "${sourceName}"`}
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

        {/* Warning Banner */}
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Important Privacy Notice</p>
              <p className="text-sm text-yellow-700">
                De-identification helps remove personally identifiable information from your data.
                Always review processed data to ensure sensitive information is properly removed
                before using it for AI training.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Built-in Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Built-in Detection
            </CardTitle>
            <CardDescription>
              Enable automatic detection of common PII patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {BUILTIN_RULES.map((rule) => (
                <div
                  key={rule.type}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    enabledBuiltins.includes(rule.type)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleBuiltin(rule.type)}
                >
                  <div>
                    <p className="font-medium">{rule.label}</p>
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                  </div>
                  {enabledBuiltins.includes(rule.type) ? (
                    <Eye className="h-5 w-5 text-primary" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Rules</CardTitle>
            <CardDescription>
              Add custom regex patterns to detect specific data formats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom rules defined. Click "Add Rule" to create one.
              </p>
            )}
            {rules.map((rule, index) => (
              <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
                <div className="flex-1 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Pattern (Regex)</Label>
                    <Input
                      value={rule.pattern || ''}
                      onChange={(e) => updateRule(index, { pattern: e.target.value })}
                      placeholder="e.g., \b[A-Z]{2}\d{6}\b"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Replacement</Label>
                    <Input
                      value={rule.replacement}
                      onChange={(e) => updateRule(index, { replacement: e.target.value })}
                      placeholder="e.g., [ACCOUNT_ID]"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addCustomRule}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rules
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}/sources/${sourceId}`)}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>

        {/* Test Section */}
        <Card>
          <CardHeader>
            <CardTitle>Test De-identification</CardTitle>
            <CardDescription>
              Enter sample text to preview how the rules will be applied
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Input Text</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Enter text containing PII to test..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />
            </div>
            <Button onClick={handleTest} disabled={isTesting || !testInput.trim()}>
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Rules
            </Button>
            {testOutput && (
              <div className="space-y-2">
                <Label>Output</Label>
                <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap">
                  {testOutput}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectLayout>
  );
}
