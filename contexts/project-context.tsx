"use client";

import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import { saveProjectAsCookie } from "@/app/(chat)/actions";
import type { Project } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

type ProjectContextValue = {
  currentProjectId: string | null;
  setProjectId: (projectId: string | null) => void;
  projects: Project[];
  isLoading: boolean;
  refreshProjects: () => void;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
);

export function ProjectProvider({
  children,
  initialProjectId,
}: {
  children: ReactNode;
  initialProjectId: string | null;
}) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    initialProjectId
  );
  const currentProjectIdRef = useRef(currentProjectId);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  const {
    data: projects,
    isLoading,
    mutate: refreshProjects,
  } = useSWR<Project[]>("/api/projects", fetcher);

  // Clear selected project if it was deleted
  useEffect(() => {
    if (projects && currentProjectId) {
      const stillExists = projects.some((p) => p.id === currentProjectId);
      if (!stillExists) {
        setCurrentProjectId(null);
        startTransition(() => {
          saveProjectAsCookie(null);
        });
      }
    }
  }, [projects, currentProjectId]);

  const setProjectId = useCallback((projectId: string | null) => {
    setCurrentProjectId(projectId);
    currentProjectIdRef.current = projectId;
    startTransition(() => {
      saveProjectAsCookie(projectId);
    });
  }, []);

  const handleRefreshProjects = useCallback(() => {
    refreshProjects();
  }, [refreshProjects]);

  const value = useMemo(
    () => ({
      currentProjectId,
      setProjectId,
      projects: projects ?? [],
      isLoading,
      refreshProjects: handleRefreshProjects,
    }),
    [currentProjectId, setProjectId, projects, isLoading, handleRefreshProjects]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export function useProjectRef() {
  const { currentProjectId } = useProject();
  const projectIdRef = useRef(currentProjectId);

  useEffect(() => {
    projectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  return { projectIdRef };
}
