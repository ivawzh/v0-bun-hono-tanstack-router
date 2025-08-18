/**
 * V2 Multi-Select Repositories Component
 * Multi-select dropdown for choosing additional repositories
 */

import { useState } from 'react';
import { Check, ChevronsUpDown, X, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Repository {
  id: string;
  name: string;
  repoPath: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number;
}

interface MultiSelectRepositoriesProps {
  repositories: Repository[];
  selectedRepositoryIds: string[];
  mainRepositoryId?: string; // Exclude main repository from additional selection
  onSelectionChange: (repositoryIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelectRepositories({
  repositories,
  selectedRepositoryIds,
  mainRepositoryId,
  onSelectionChange,
  placeholder = "Select additional repositories...",
  className,
  disabled = false
}: MultiSelectRepositoriesProps) {
  const [open, setOpen] = useState(false);

  // Filter out main repository from available options
  const availableRepositories = repositories.filter(repo => 
    repo.id !== mainRepositoryId && repo.isAvailable !== false
  );
  
  const selectedRepositories = repositories.filter(repo => 
    selectedRepositoryIds.includes(repo.id)
  );

  const handleSelect = (repositoryId: string) => {
    const isSelected = selectedRepositoryIds.includes(repositoryId);
    if (isSelected) {
      onSelectionChange(selectedRepositoryIds.filter(id => id !== repositoryId));
    } else {
      onSelectionChange([...selectedRepositoryIds, repositoryId]);
    }
  };

  const handleRemove = (repositoryId: string) => {
    onSelectionChange(selectedRepositoryIds.filter(id => id !== repositoryId));
  };

  const getRepositoryStatusColor = (repo: Repository) => {
    if (repo.isAvailable === false) return 'bg-red-100 text-red-800';
    if (repo.activeTaskCount && repo.activeTaskCount > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getRepositoryStatusText = (repo: Repository) => {
    if (repo.isAvailable === false) return 'At capacity';
    if (repo.activeTaskCount && repo.activeTaskCount > 0) {
      return `${repo.activeTaskCount}/${repo.maxConcurrencyLimit || 1} active`;
    }
    return 'Available';
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-10"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedRepositories.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : selectedRepositories.length === 1 ? (
                <span>{selectedRepositories[0].name}</span>
              ) : (
                <span>{selectedRepositories.length} repositories selected</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search repositories..." />
            <CommandEmpty>No additional repositories available.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {availableRepositories.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={`${repo.name} ${repo.repoPath}`}
                  onSelect={() => handleSelect(repo.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRepositoryIds.includes(repo.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{repo.name}</span>
                          {repo.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {repo.repoPath}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getRepositoryStatusText(repo)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs", getRepositoryStatusColor(repo))}
                  >
                    {repo.isAvailable === false ? '⏸' : '▶'}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected repositories display */}
      {selectedRepositories.length > 0 && (
        <div className="space-y-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground">
            Additional Working Directories:
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedRepositories.map((repo) => (
              <Badge
                key={repo.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1 max-w-[200px]"
              >
                <Folder className="h-3 w-3" />
                <span className="text-xs truncate">{repo.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemove(repo.id)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground mt-2">
        {selectedRepositories.length === 0 ? (
          <p>
            Optional: Add repositories that agents can access during task execution
          </p>
        ) : (
          <p>
            Agents will have access to these directories in addition to the main repository
          </p>
        )}
      </div>
    </div>
  );
}