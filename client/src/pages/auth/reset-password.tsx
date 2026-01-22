import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (token) {
      api.get<{ valid: boolean; email?: string }>(`/auth/reset-password/${token}`)
        .then((response) => {
          setTokenValid(response.data.valid);
          setEmail(response.data.email || null);
        })
        .catch((err) => {
          if (err instanceof ApiRequestError) {
            setError(err.message);
          } else {
            setError('Invalid or expired token');
          }
          setTokenValid(false);
        })
        .finally(() => {
          setValidatingToken(false);
        });
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordForm) => {
    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
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

  if (validatingToken) {
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

  if (!tokenValid) {
    return (
      <AuthLayout>
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-destructive/10 p-3 mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Invalid or expired link</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {error || 'This password reset link is invalid or has expired.'}
            </p>
            <Link to="/forgot-password" className="mt-4">
              <Button variant="outline">Request new link</Button>
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
            <h3 className="text-lg font-semibold">Password reset successfully</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Your password has been changed. You can now sign in with your new password.
            </p>
            <Link to="/login" className="mt-4">
              <Button>Sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Reset your password</CardTitle>
          {email && (
            <CardDescription className="text-center">
              Enter a new password for {email}
            </CardDescription>
          )}
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Min 8 characters, 1 uppercase, 1 digit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
