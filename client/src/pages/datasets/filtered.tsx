import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectLayout } from '@/components/layouts/project-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, ArrowLeft, Filter, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface FilteredRecord {
  id: number;
  originalData: Record<string, unknown>;
  filterReason: string;
  filterType: 'deidentification' | 'quality' | 'mapping' | 'duplicate';
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function FilteredRecordsPage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [records, setRecords] = useState<FilteredRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !datasetId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [projectRes, datasetRes, filteredRes] = await Promise.all([
          api.get<{ data: { name: string } }>(`/projects/${projectId}`),
          api.get<{ data: { name: string } }>(`/projects/${projectId}/datasets/${datasetId}`),
          api.get<{ data: FilteredRecord[]; meta: PaginationMeta }>(
            `/projects/${projectId}/datasets/${datasetId}/filtered?page=${currentPage}&limit=20`
          ),
        ]);
        setProjectName(projectRes.data.data.name);
        setDatasetName(datasetRes.data.data.name);
        setRecords(filteredRes.data.data);
        setPagination(filteredRes.data.meta);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load filtered records');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId, datasetId, currentPage]);

  const getFilterTypeColor = (type: string) => {
    switch (type) {
      case 'deidentification':
        return 'bg-yellow-100 text-yellow-700';
      case 'quality':
        return 'bg-red-100 text-red-700';
      case 'duplicate':
        return 'bg-blue-100 text-blue-700';
      case 'mapping':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getFilterTypeLabel = (type: string) => {
    switch (type) {
      case 'deidentification':
        return 'PII Detected';
      case 'quality':
        return 'Quality Issue';
      case 'duplicate':
        return 'Duplicate';
      case 'mapping':
        return 'Mapping Error';
      default:
        return type;
    }
  };

  if (isLoading && records.length === 0) {
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
        title="Filtered Records"
        description={`Records excluded from "${datasetName}"`}
        action={
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/datasets/${datasetId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dataset
          </Button>
        }
      />

      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-4">
          <Filter className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{pagination?.total.toLocaleString() || 0}</p>
            <p className="text-muted-foreground">total filtered records</p>
          </div>
        </CardContent>
      </Card>

      {/* Warning Banner */}
      <Card className="mb-6 border-yellow-500 bg-yellow-50">
        <CardContent className="flex items-start gap-4 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Privacy Notice</p>
            <p className="text-sm text-yellow-700">
              These records may contain sensitive information that failed de-identification.
              Handle with care and do not share or use in training data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      {records.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No filtered records found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <Card key={record.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Record #{record.id}</CardTitle>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getFilterTypeColor(record.filterType)}`}>
                    {getFilterTypeLabel(record.filterType)}
                  </span>
                </div>
                <CardDescription>{record.filterReason}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(record.originalData, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1 || isLoading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pagination.totalPages || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}
