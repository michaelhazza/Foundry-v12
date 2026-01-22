import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layouts/main-layout';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Loader2, Users, Plus, Mail, Trash2, AlertCircle, Clock, CheckCircle } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'member']),
});

type InviteForm = z.infer<typeof inviteSchema>;

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface PendingInvitation {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member' },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, invitationsRes] = await Promise.all([
          api.get<{ data: TeamMember[] }>('/organisations/current/members'),
          api.get<{ data: PendingInvitation[] }>('/organisations/current/invitations'),
        ]);
        setMembers(membersRes.data.data);
        setInvitations(invitationsRes.data.data);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load team data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const onSubmit = async (data: InviteForm) => {
    setError(null);
    setSuccess(null);
    setIsInviting(true);

    try {
      await api.post('/invitations', {
        email: data.email,
        role: data.role,
      });
      setSuccess(`Invitation sent to ${data.email}`);
      reset();
      setShowInviteForm(false);

      // Refresh invitations
      const response = await api.get<{ data: PendingInvitation[] }>('/organisations/current/invitations');
      setInvitations(response.data.data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to send invitation');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    setError(null);
    setRemovingId(memberId);

    try {
      await api.delete(`/organisations/current/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccess('Team member removed successfully');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to remove team member');
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    setError(null);
    setCancelingId(invitationId);

    try {
      await api.delete(`/invitations/${invitationId}`);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setSuccess('Invitation cancelled');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to cancel invitation');
      }
    } finally {
      setCancelingId(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700';
      case 'admin':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canManageTeam = user?.role === 'owner' || user?.role === 'admin';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Team Management"
        description="Manage your organization's team members"
        action={
          canManageTeam && (
            <Button onClick={() => setShowInviteForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )
        }
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

        {/* Invite Form */}
        {showInviteForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Invite Team Member
              </CardTitle>
              <CardDescription>
                Send an invitation email to add a new team member
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      {...register('role')}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    {errors.role && (
                      <p className="text-sm text-destructive">{errors.role.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-4">
                <Button type="submit" disabled={isInviting}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInviteForm(false);
                    reset();
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? 's' : ''} in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.name}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                        {member.id === user?.id && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  {canManageTeam && member.role !== 'owner' && member.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingId === member.id}
                    >
                      {removingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                Invitations awaiting acceptance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-dashed"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invitation.email}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(invitation.role)}`}>
                            {invitation.role}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {canManageTeam && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={cancelingId === invitation.id}
                      >
                        {cancelingId === invitation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
