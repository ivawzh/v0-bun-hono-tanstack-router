import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="text-muted-foreground">Search across all tasks and attachments</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search tasks, attachments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 text-base"
            autoFocus
          />
        </div>

        {query && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Search results for "{query}" will appear here
            </p>
            {/* Search results will be implemented later */}
          </div>
        )}
      </div>
    </div>
  );
}