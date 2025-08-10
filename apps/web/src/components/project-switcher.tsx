import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { useQuery, useMutation } from "@tanstack/react-query";

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const { data: projects, isLoading, refetch } = useQuery(orpc.projects.list.queryOptions({}));
  const createProject = useMutation(
    orpc.projects.create.mutationOptions({
      onSuccess: () => {
        toast.success("Project created successfully");
        setShowNewProjectDialog(false);
        setNewProjectName("");
        setNewProjectDescription("");
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to create project: ${error.message}`);
      },
    })
  );

  const selectedProjectData = projects?.find((p: any) => p.id === selectedProject);

  return (
    <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a project"
            className="w-[200px] justify-between"
          >
            {selectedProjectData?.name ?? "Select project..."}
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search project..." />
              <CommandEmpty>No project found.</CommandEmpty>
              <CommandGroup heading="Projects">
                {projects?.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => {
                      setSelectedProject(project.id);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    {project.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedProject === project.id
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
                });
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