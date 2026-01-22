import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MainLayout } from './main-layout';
import { cn } from '@/lib/utils';
import { ChevronRight, Database, FileText, Play, Settings } from 'lucide-react';

export interface ProjectLayoutProps {
  children: React.ReactNode;
  projectId?: string;
  projectName?: string;
}

export function ProjectLayout({ children, projectId: propProjectId, projectName }: ProjectLayoutProps) {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const id = propProjectId || paramProjectId;
  const location = useLocation();

  const navItems = [
    { path: `/projects/${id}`, label: 'Overview', icon: FileText, exact: true },
    { path: `/projects/${id}/sources`, label: 'Sources', icon: Database },
    { path: `/projects/${id}/processing`, label: 'Processing', icon: Play },
    { path: `/projects/${id}/datasets`, label: 'Datasets', icon: FileText },
    { path: `/projects/${id}/settings`, label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <MainLayout>
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
        <Link to="/dashboard" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{projectName || 'Project'}</span>
      </div>

      {/* Project Navigation */}
      <div className="border-b mb-6">
        <nav className="flex space-x-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive(item.path, item.exact)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      {children}
    </MainLayout>
  );
}
