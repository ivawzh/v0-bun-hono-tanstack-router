import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { ProjectSettingsV2 } from "./project-settings-v2";

interface ProjectSettingsButtonProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
}

export function ProjectSettingsButton({ project }: ProjectSettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>
      
      <ProjectSettingsV2
        project={project}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          // Optionally refresh project data
        }}
      />
    </>
  );
}