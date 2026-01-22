import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, CheckCircle, XCircle, Building2 } from 'lucide-react';

interface InvitationDetails {
  email: string;
  role: string;
  organizationName: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      api.get<InvitationDetails>(`/invitations/${token}`)
        .then((response) => {
          setInvitation(response.data);
        })
        .catch((err) => {
          if (err instanceof ApiRequestError) {
            setError(err.message);
          } else {
            setError('Invalid or expired invitation');
          }
        })
        .finally(() => {
          setLoadingInvitation(false);
        });
    }
  }, [token]);

  const handleAccept = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await api.post(`/invitations/${token}/accept`);
      await refreshUser();
      setIsSuccess(true);
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

  if (loadingInvitation) {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (error && !invitation) {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-destructive/10 p-3 mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Invalid invitation</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {error}
            </p>
            <Link to="/login" className="mt-4">
              <Button variant="outline">Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-success/10 p-3 mb-4">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-lg font-semibold">You've joined {invitation?.organizationName}!</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              You're now a {invitation?.role} of this organization.
            </p>
            <Button className="mt-4" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Not logged in - redirect to register
  if (!isAuthenticated) {
    return (
      <AuthLayout>
        <Card>
          <CardHeader className="text-center">
            <div className="rounded-full bg-primary/10 p-3 mx-auto mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Join {invitation?.organizationName}</CardTitle>
            <CardDescription>
              You've been invited to join as a {invitation?.role}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Create an account or sign in to accept this invitation.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link to={`/register/${token}`} className="w-full">
              <Button className="w-full">Create account</Button>
            </Link>
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Sign in to existing account
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  // Logged in - show accept button
  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <div className="rounded-full bg-primary/10 p-3 mx-auto mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {invitation?.organizationName}</CardTitle>
          <CardDescription>
            You've been invited to join as a {invitation?.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-4">
              {error}
            </div>
          )}
          <p className="text-muted-foreground">
            Signed in as <strong>{user?.email}</strong>
          </p>
          {user?.email !== invitation?.email && (
            <p className="text-sm text-warning mt-2">
              Note: This invitation was sent to a different email address.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept Invitation
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
