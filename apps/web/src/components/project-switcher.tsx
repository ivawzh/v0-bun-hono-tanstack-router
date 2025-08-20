import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const SELECTED_PROJECT_KEY = 'solo-unicorn-selected-project';

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem(SELECTED_PROJECT_KEY);
  });
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false });
  const urlProjectId = (params as any)?.projectId;

  // Effective selected project: prioritize URL projectId over localStorage
  const effectiveSelectedProject = urlProjectId || selectedProject;

  const { data: projects, isLoading, refetch } = useQuery(orpc.projects.list.queryOptions({ input: {} }));

  // Auto-select first project if none selected and projects exist
  useEffect(() => {
    if (projects && (projects as any).length > 0) {
      if (!selectedProject) {
        const firstProject = (projects as any)[0];
        setSelectedProject(firstProject.id);
        localStorage.setItem(SELECTED_PROJECT_KEY, firstProject.id);
      } else {
        // Verify selected project still exists
        const projectExists = (projects as any).some((p: any) => p.id === selectedProject);
        if (!projectExists && (projects as any).length > 0) {
          const firstProject = (projects as any)[0];
          setSelectedProject(firstProject.id);
          localStorage.setItem(SELECTED_PROJECT_KEY, firstProject.id);
        }
      }
    }
  }, [projects, selectedProject]);
  const createProject = useMutation(
    orpc.projects.create.mutationOptions({
      onSuccess: async (newProject) => {
        toast.success("Project created successfully");
        setShowNewProjectDialog(false);
        setNewProjectName("");
        setNewProjectDescription("");
        await refetch();
        
        // Select the new project and navigate to it
        if (newProject && (newProject as any).id) {
          setSelectedProject((newProject as any).id);
          localStorage.setItem(SELECTED_PROJECT_KEY, (newProject as any).id);
          
          // Navigate to the new project page
          navigate({ to: "/projects/$projectId", params: { projectId: (newProject as any).id } });
        }
      },
      onError: (error: any) => {
        toast.error(`Failed to create project: ${error.message}`);
      },
    })
  );

  const selectedProjectData = (projects as any)?.find((p: any) => p.id === effectiveSelectedProject);

  return (
    <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a project"
            className="w-[140px] sm:w-[200px] justify-between h-8 sm:h-9 text-sm"
          >
            <span className="truncate">
              {selectedProjectData?.name ?? "Select project..."}
            </span>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[140px] sm:w-[200px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search project..." />
              <CommandEmpty>No project found.</CommandEmpty>
              <CommandGroup heading="Projects">
                {(projects as any)?.map((project: any) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => {
                      setSelectedProject(project.id);
                      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
                      setOpen(false);
                      
                      // Navigate directly to the project page (simplified - no boards)
                      navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
                    }}
                    className="text-sm"
                  >
                    {project.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        effectiveSelectedProject === project.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <DialogTrigger asChild>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setShowNewProjectDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </CommandItem>
                </DialogTrigger>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Add a new project to manage your repositories and tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 pb-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              placeholder="My Project"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Project description (optional)"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowNewProjectDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (newProjectName) {
                createProject.mutate({
                  name: newProjectName,
                  description: newProjectDescription || undefined,
                } as any);
              }
            }}
            disabled={!newProjectName || createProject.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}