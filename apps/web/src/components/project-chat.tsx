import { useState, useRef, useEffect } from "react";
import { 
  Send, AtSign, Paperclip, Plus, ChevronRight, 
  Bot, User, Mic, MicOff, Hash, Users, MoreVertical,
  Pin, Archive, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

interface ProjectChatProps {
  projectId: string;
}

interface ChatThread {
  id: string;
  title: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
  isPinned?: boolean;
}

interface ChatMessage {
  id: string;
  threadId: string;
  author: "human" | "agent" | "system";
  authorName?: string;
  content: string;
  mentions?: { type: "agent" | "user" | "role"; id: string; label: string }[];
  attachments?: { id: string; name: string; type: string; url: string }[];
  createdAt: Date;
  replies?: ChatMessage[];
}

// Mock data for now
const mockThreads: ChatThread[] = [
  {
    id: "1",
    title: "New business line — Mobile Agent Runner",
    lastMessage: "Next: draft scope doc and validate with 3 users",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 2,
    isPinned: true,
  },
  {
    id: "2",
    title: "Architecture options",
    lastMessage: "Considering microservices vs monolith",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    title: "Tooling & rate limits",
    lastMessage: "Need to review API quotas",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: "1",
    threadId: "1",
    author: "human",
    authorName: "You",
    content: "Explore a mobile agent runner MVP scope",
    createdAt: new Date(Date.now() - 1000 * 60 * 35),
    mentions: [],
  },
  {
    id: "2",
    threadId: "1",
    author: "agent",
    authorName: "Engineer Agent",
    content: "Constraints to consider: device APIs, offline capabilities, cost",
    createdAt: new Date(Date.now() - 1000 * 60 * 33),
    mentions: [],
    replies: [
      {
        id: "3",
        threadId: "1",
        author: "human",
        authorName: "You",
        content: "Option A: native app; Option B: PWA; Option C: SDK",
        createdAt: new Date(Date.now() - 1000 * 60 * 32),
      },
      {
        id: "4",
        threadId: "1",
        author: "agent",
        authorName: "Engineer Agent",
        content: "Suggests PWA pilot with limited toolset",
        createdAt: new Date(Date.now() - 1000 * 60 * 31),
      },
    ],
  },
  {
    id: "5",
    threadId: "1",
    author: "human",
    authorName: "You",
    content: "Feasibility? Risks? Monetization options?",
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    mentions: [{ type: "agent", id: "engineer", label: "Engineer" }],
  },
];

const quickMentions = [
  { type: "agent" as const, id: "engineer", label: "Engineer", icon: Bot },
  { type: "agent" as const, id: "pm", label: "PM", icon: Bot },
  { type: "agent" as const, id: "designer", label: "Designer", icon: Bot },
  { type: "agent" as const, id: "qa", label: "QA", icon: Bot },
  { type: "role" as const, id: "all", label: "All", icon: Users },
];

export function ProjectChat({ projectId }: ProjectChatProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>("1");
  const [newMessage, setNewMessage] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  
  const { isRecording, startRecording, stopRecording } = useMediaRecorder();

  // Filter threads based on search
  const filteredThreads = mockThreads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get messages for selected thread
  const threadMessages = mockMessages.filter(msg => msg.threadId === selectedThreadId);
  const selectedThread = mockThreads.find(t => t.id === selectedThreadId);

  // Handle @mention insertion
  const insertMention = (mention: typeof quickMentions[0]) => {
    if (messageInputRef.current) {
      const text = newMessage;
      const beforeCursor = text.slice(0, cursorPosition);
      const afterCursor = text.slice(cursorPosition);
      const lastAtIndex = beforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        const newText = 
          text.slice(0, lastAtIndex) + 
          `@${mention.label} ` + 
          afterCursor;
        setNewMessage(newText);
        setShowMentionPopover(false);
        
        // Set cursor position after mention
        setTimeout(() => {
          if (messageInputRef.current) {
            const newCursorPos = lastAtIndex + mention.label.length + 2;
            messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            messageInputRef.current.focus();
          }
        }, 0);
      }
    }
  };

  // Handle input change for @ detection
  const handleMessageInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);
    setCursorPosition(e.target.selectionStart || 0);
    
    // Check for @ symbol
    const beforeCursor = text.slice(0, e.target.selectionStart || 0);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    const hasRecentAt = lastAtIndex !== -1 && 
      (beforeCursor.length - lastAtIndex) <= 20 &&
      !beforeCursor.slice(lastAtIndex).includes(' ');
    
    setShowMentionPopover(hasRecentAt);
  };

  // Send message
  const sendMessage = () => {
    if (newMessage.trim() && selectedThreadId) {
      // TODO: Implement actual message sending
      toast.success("Message sent");
      setNewMessage("");
    }
  };

  // Create new thread
  const createThread = () => {
    if (newThreadTitle.trim()) {
      // TODO: Implement actual thread creation
      toast.success("Thread created");
      setNewThreadTitle("");
      setShowNewThread(false);
    }
  };

  // Handle voice input
  const handleVoiceInput = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        // TODO: Send to OpenAI Audio API for transcription
        toast.info("Voice transcription coming soon!");
      }
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex h-full">
      {/* Threads sidebar */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Chat</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewThread(!showNewThread)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* New thread input */}
        {showNewThread && (
          <div className="p-3 border-b bg-muted/50">
            <Input
              placeholder="Thread title..."
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') createThread();
              }}
              className="mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createThread}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => {
                setShowNewThread(false);
                setNewThreadTitle("");
              }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Thread list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Pinned threads */}
            {filteredThreads.filter(t => t.isPinned).map(thread => (
              <div
                key={thread.id}
                className={cn(
                  "p-3 rounded-md cursor-pointer hover:bg-muted/50 mb-1",
                  selectedThreadId === thread.id && "bg-muted"
                )}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Pin className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-sm truncate">
                      {thread.title}
                    </span>
                  </div>
                  {thread.unreadCount && thread.unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                {thread.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">
                    {thread.lastMessage}
                  </p>
                )}
                {thread.lastMessageAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(thread.lastMessageAt, "p")}
                  </p>
                )}
              </div>
            ))}
            
            {filteredThreads.some(t => t.isPinned) && 
             filteredThreads.some(t => !t.isPinned) && (
              <Separator className="my-2" />
            )}
            
            {/* Regular threads */}
            {filteredThreads.filter(t => !t.isPinned).map(thread => (
              <div
                key={thread.id}
                className={cn(
                  "p-3 rounded-md cursor-pointer hover:bg-muted/50 mb-1",
                  selectedThreadId === thread.id && "bg-muted"
                )}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm truncate">
                    {thread.title}
                  </span>
                  {thread.unreadCount && thread.unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                {thread.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">
                    {thread.lastMessage}
                  </p>
                )}
                {thread.lastMessageAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(thread.lastMessageAt, "p")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Mentions filter */}
        <div className="p-3 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-2">Mentions</div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="cursor-pointer text-xs">
              @ You
            </Badge>
            <Badge variant="outline" className="cursor-pointer text-xs">
              @ Engineer
            </Badge>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Thread header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selectedThread.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Last activity {selectedThread.lastMessageAt && 
                    format(selectedThread.lastMessageAt, "PPp")
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  Create Decision
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin Thread
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Thread
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      Delete Thread
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {threadMessages.map((message) => (
                  <div key={message.id}>
                    {/* Main message */}
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {message.author === "agent" ? "AI" : 
                           message.author === "human" ? "H" : "S"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {message.authorName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(message.createdAt, "p")}
                          </span>
                        </div>
                        <p className="text-sm">{message.content}</p>
                        
                        {/* Mentions */}
                        {message.mentions && message.mentions.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {message.mentions.map((mention, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                @{mention.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {message.replies && message.replies.length > 0 && (
                      <div className="ml-11 mt-3 pl-3 border-l-2 space-y-3">
                        {message.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-3">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">
                                {reply.author === "agent" ? "AI" : 
                                 reply.author === "human" ? "H" : "S"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {reply.authorName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(reply.createdAt, "p")}
                                </span>
                              </div>
                              <p className="text-sm">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t">
              {/* Quick mentions */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">Quick mention:</span>
                {quickMentions.map((mention) => (
                  <Button
                    key={mention.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      const currentText = newMessage;
                      setNewMessage(currentText + (currentText ? " " : "") + `@${mention.label} `);
                      messageInputRef.current?.focus();
                    }}
                  >
                    <mention.icon className="h-3 w-3 mr-1" />
                    @{mention.label}
                  </Button>
                ))}
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Paperclip className="h-3 w-3 mr-1" />
                  Attach
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Create Decision
                </Button>
              </div>

              {/* Input area */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    ref={messageInputRef}
                    placeholder="Type a message... (use @ to mention)"
                    value={newMessage}
                    onChange={handleMessageInput}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={2}
                    className="resize-none"
                  />
                  
                  {/* Mention popover */}
                  {showMentionPopover && (
                    <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-md shadow-md p-1 z-50">
                      {quickMentions.map((mention) => (
                        <button
                          key={mention.id}
                          className="flex items-center gap-2 w-full px-2 py-1 text-sm hover:bg-muted rounded"
                          onClick={() => insertMention(mention)}
                        >
                          <mention.icon className="h-4 w-4" />
                          {mention.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleVoiceInput}
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4 text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a thread or create a new one
          </div>
        )}
      </div>
    </div>
  );
}