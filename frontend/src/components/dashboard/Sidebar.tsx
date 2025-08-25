import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageCircle, Menu, X, Trash2, Calendar, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Chat {
  chat_id: number;
  disease: string | null;
  created_at: string;
  messages: Record<string, { query: string; response: string }>;
}

interface SidebarProps {
  currentChatId?: number | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  className?: string;
}

export function Sidebar({ currentChatId, onChatSelect, onNewChat, className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const { accessToken } = useAuth();
  const API_URL = "http://localhost:8000";

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (accessToken) {
        try {
          const response = await axios.get(`${API_URL}/chat-history`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          if (response.data && Array.isArray(response.data.chats)) {
            // Sort chats by creation date (newest first)
            const sortedChats = [...response.data.chats].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            
            // Process each chat to ensure valid message structure
            const processedChats = sortedChats.map(chat => {
              // Ensure messages is a valid object
              let validMessages = {};
              
              try {
                if (typeof chat.messages === 'string') {
                  // Parse JSON string if it's a string
                  validMessages = JSON.parse(chat.messages);
                } else if (typeof chat.messages === 'object' && chat.messages !== null) {
                  // Use existing object if it's already an object
                  validMessages = chat.messages;
                }
              } catch (error) {
                console.error(`Failed to parse messages for chat ${chat.chat_id}:`, error);
                // Default to empty object if parsing fails
                validMessages = {};
              }
              
              return {
                ...chat,
                messages: validMessages
              };
            });
            
            // Only update state if there are actual changes to prevent unnecessary re-renders
            const currentIds = chats.map(c => c.chat_id).sort().join(',');
            const newIds = processedChats.map(c => c.chat_id).sort().join(',');
            
            if (currentIds !== newIds || processedChats.length !== chats.length) {
              console.log("Updating chat history with new data");
              setChats(processedChats);
            } else {
              // Check for message count changes
              const hasChanges = processedChats.some((newChat, index) => {
                const oldChat = chats.find(c => c.chat_id === newChat.chat_id);
                if (!oldChat) return true;
                
                const oldMsgCount = Object.keys(oldChat.messages || {}).length;
                const newMsgCount = Object.keys(newChat.messages || {}).length;
                return oldMsgCount !== newMsgCount;
              });
              
              if (hasChanges) {
                console.log("Updating chat history with changed message content");
                setChats(processedChats);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch chat history:", error);
        }
      }
    };
    
    // Initial fetch
    fetchChatHistory();
    
    // Set up a polling interval to refresh chat history
    const intervalId = setInterval(fetchChatHistory, 5000); // Increased polling frequency
    
    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [accessToken, chats, currentChatId]); // Added dependencies to react to changes

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredChats, setFilteredChats] = useState<Chat[]>(chats);
  
  // Filter chats whenever search query or chats change
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredChats(
        chats.filter(chat => 
          (chat.disease?.toLowerCase().includes(query) || false)
        )
      );
    } else {
      setFilteredChats(chats);
    }
  }, [searchQuery, chats]);

  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-card/50 border-r border-border/50 backdrop-blur-sm h-[calc(100vh-4rem)]",
        isCollapsed ? "w-16" : "w-80",
        "transition-all duration-300 ease-in-out",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.h2
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-semibold text-lg"
              >
                Chat History
              </motion.h2>
            )}
          </AnimatePresence>
          
          <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </Button>
          </motion.div>
        </div>
        
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <Button
                onClick={onNewChat}
                className="w-full mt-3 bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search chats..."
                  className="pl-8 py-1 h-8 text-sm bg-background/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={onNewChat}
                size="icon"
                className="w-full mt-3 bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 p-2">
        <AnimatePresence>
          {filteredChats.length === 0 && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-40 text-center p-4"
            >
              <Calendar className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No chats match your search" : "No chat history yet"}
              </p>
              <Button 
                variant="link" 
                size="sm" 
                className="mt-2"
                onClick={onNewChat}
              >
                Start a new chat
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="space-y-2">
          {filteredChats.map((chat) => (
            <motion.div
              key={chat.chat_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              whileHover={{ scale: 1.02 }}
            >
              <Button
                variant={currentChatId === chat.chat_id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-auto p-3 text-left group",
                  isCollapsed && "px-2",
                  currentChatId === chat.chat_id && "bg-primary/10 border-primary/20"
                )}
                onClick={() => onChatSelect(chat)}
              >
                <div className="flex items-start space-x-3 w-full">
                  <div className={cn(
                    "rounded-full p-1",
                    currentChatId === chat.chat_id ? "bg-primary/20" : "bg-muted/50"
                  )}>
                    <MessageCircle className="h-3 w-3 text-primary" />
                  </div>
                  
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate max-w-[140px]">
                            {chat.disease || 'New Chat'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(chat.created_at)}
                          </p>
                        </div>
                        
                        {/* Show first message preview */}
                        {typeof chat.messages === 'object' && 
                          Object.keys(chat.messages).length > 0 && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {Object.values(chat.messages)[0]?.query?.substring(0, 30) || "..."}
                          </p>
                        )}
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Button>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
      
      {/* Footer with version */}
      {!isCollapsed && (
        <div className="p-3 border-t border-border/50 text-center">
          <Badge variant="outline" className="text-xs font-normal">
            MediBot v1.0
          </Badge>
        </div>
      )}
    </motion.div>
  );
}