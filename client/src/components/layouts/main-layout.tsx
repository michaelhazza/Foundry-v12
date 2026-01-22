import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Settings,
  Users,
  ChevronDown,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/settings/organization', label: 'Organization', icon: Settings },
  { path: '/settings/team', label: 'Team', icon: Users, adminOnly: true },
  { path: '/settings/profile', label: 'Profile', icon: User },
];

export function MainLayout({ children }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <span className="font-bold text-xl text-primary">Foundry</span>
          </Link>

          <nav className="flex items-center space-x-6 ml-8">
            {filteredNavItems.slice(0, 1).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === item.path
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {user?.organization?.name || 'Organization'}
            </span>
            <div className="relative group">
              <Button variant="ghost" size="sm" className="gap-2">
                <span>{user?.name || user?.email}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-popover border hidden group-hover:block">
                <div className="py-1">
                  <Link
                    to="/settings/profile"
                    className="block px-4 py-2 text-sm hover:bg-accent"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings/organization"
                    className="block px-4 py-2 text-sm hover:bg-accent"
                  >
                    Organization
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      to="/settings/team"
                      className="block px-4 py-2 text-sm hover:bg-accent"
                    >
                      Team
                    </Link>
                  )}
                  <hr className="my-1" />
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-accent text-destructive"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
