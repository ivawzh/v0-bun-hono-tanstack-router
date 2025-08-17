import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface CreateRepoAgentModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  name: string;
  repoPath: string;
  clientType: "claude_code" | "opencode" | "";
  config: string;
}

interface FormErrors {
  name?: string;
  repoPath?: string;
  clientType?: string;
  config?: string;
}

export function CreateRepoAgentModal({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: CreateRepoAgentModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    repoPath: "",
    clientType: "",
    config: "",
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  const createRepoAgent = useMutation(
    orpc.repoAgents.create.mutationOptions({
      onSuccess: () => {
        toast.success("Repo agent created successfully");
        // Invalidate repo agents list for this project
        queryClient.invalidateQueries({ 
          queryKey: ["repoAgents", "list", { input: { projectId } }],
          exact: true 
        });
        // Reset form and close modal
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(`Failed to create repo agent: ${error.message}`);
      },
    })
  );

  const resetForm = () => {
    setFormData({
      name: "",
      repoPath: "",
      clientType: "",
      config: "",
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.length > 255) {
      newErrors.name = "Name must be 255 characters or less";
    }

    // Repository path validation
    if (!formData.repoPath.trim()) {
      newErrors.repoPath = "Repository path is required";
    }

    // Client type validation
    if (!formData.clientType) {
      newErrors.clientType = "Client type is required";
    }

    // Config validation (if provided, must be valid JSON)
    if (formData.config.trim()) {
      try {
        JSON.parse(formData.config);
      } catch {
        newErrors.config = "Configuration must be valid JSON";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const config = formData.config.trim() ? JSON.parse(formData.config) : {};

    createRepoAgent.mutate({
      projectId,
      name: formData.name.trim(),
      repoPath: formData.repoPath.trim(),
      clientType: formData.clientType as "claude_code" | "opencode",
      config,
    });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const updateFormField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Add New Repo Agent
          </DialogTitle>
          <DialogDescription>
            Configure a new repository agent to enable AI task automation for your codebase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Main Repo, Frontend, API Server"
              value={formData.name}
              onChange={(e) => updateFormField("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Repository Path Field */}
          <div className="space-y-2">
            <Label htmlFor="repoPath">Repository Path *</Label>
            <Input
              id="repoPath"
              placeholder="/home/user/repos/my-project"
              value={formData.repoPath}
              onChange={(e) => updateFormField("repoPath", e.target.value)}
              className={errors.repoPath ? "border-red-500" : ""}
            />
            {errors.repoPath && (
              <p className="text-sm text-red-500">{errors.repoPath}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the absolute path to your repository directory
            </p>
          </div>

          {/* Client Type Field */}
          <div className="space-y-2">
            <Label htmlFor="clientType">Client Type *</Label>
            <Select
              value={formData.clientType}
              onValueChange={(value) => updateFormField("clientType", value)}
            >
              <SelectTrigger className={errors.clientType ? "border-red-500" : ""}>
                <SelectValue placeholder="Select coding client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude_code">Claude Code</SelectItem>
                <SelectItem value="opencode">OpenCode</SelectItem>
              </SelectContent>
            </Select>
            {errors.clientType && (
              <p className="text-sm text-red-500">{errors.clientType}</p>
            )}
          </div>

          {/* Configuration Field */}
          <div className="space-y-2">
            <Label htmlFor="config">Configuration (Optional)</Label>
            <Textarea
              id="config"
              placeholder='{"key": "value"}'
              value={formData.config}
              onChange={(e) => updateFormField("config", e.target.value)}
              className={errors.config ? "border-red-500" : ""}
              rows={3}
            />
            {errors.config && (
              <p className="text-sm text-red-500">{errors.config}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Optional JSON configuration for client-specific settings
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={createRepoAgent.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createRepoAgent.isPending || !formData.name.trim() || !formData.repoPath.trim() || !formData.clientType}
          >
            {createRepoAgent.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Repo Agent"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}