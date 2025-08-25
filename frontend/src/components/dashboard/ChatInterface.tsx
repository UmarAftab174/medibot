import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, User, Bot, Paperclip, Smile, Image, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import "./ChatInterface.css";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

// The Message format used internally by this component
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

// The Message format coming from parent component
interface InitialMessage {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  chatId: number | null;
  disease: string | null;
  initialMessages: InitialMessage[];  // Using InitialMessage instead
  onMessageSent: () => void;
  className?: string;
}

const SUGGESTED_QUERIES = [
  "Explain my disease in simple words",
  "Is this curable? If yes, how long?",
  "Write prescription & health tips",
  "When should I see a doctor?",
];

export function ChatInterface({ 
  chatId, 
  disease,
  initialMessages,
  onMessageSent,
  className 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);  // Initialize with empty array
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const API_URL = "http://localhost:8000";

  // Convert initialMessages to our internal format whenever they change
  useEffect(() => {
    // Create new array to hold our transformed messages
    const formattedMessages: Message[] = [];
    
    // Process each message from initialMessages
    initialMessages.forEach(msg => {
      // If there's a query, add a user message
      if (msg.query) {
        formattedMessages.push({
          id: `user-${msg.id}`,
          content: msg.query,
          isUser: true,
          timestamp: msg.timestamp,
        });
      }
      
      // If there's a response, add a bot message
      if (msg.response) {
        formattedMessages.push({
          id: `bot-${msg.id}`,
          content: msg.response,
          isUser: false,
          timestamp: msg.timestamp,
        });
      }
    });
    
    setMessages(formattedMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || !chatId) return;

    // Generate consistent IDs based on timestamp
    const messageTimestamp = new Date();
    const messageId = messageTimestamp.getTime().toString();

    // Create a new message for the user query
    const userMessage: Message = {
      id: `user-${messageId}`,
      content: query,
      isUser: true,
      timestamp: messageTimestamp,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      console.log(`Sending message to chat ID: ${chatId}`);
      const response = await axios.post(
        `${API_URL}/chat-message`,
        {
          chat_id: chatId,
          query,
          sent_at: messageTimestamp.toISOString(),
          disease,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      // Create a separate message for the bot response
      const botMessage: Message = {
        id: `bot-${messageId}`,
        content: response.data.response,
        isUser: false,
        timestamp: new Date(), // Use the current time for the bot's response
      };
      
      // Add the bot message to the UI
      setMessages(prev => [...prev, botMessage]);
      
      // Wait a short time before notifying the parent to refetch history
      // This gives the backend time to fully commit the changes
      setTimeout(() => {
        onMessageSent();  // Notify parent to refetch history
      }, 300);
    } catch (error: any) {
      toast({
        title: "Message failed",
        description: error.response?.data?.detail || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Initialize highlight.js for code syntax highlighting
  useEffect(() => {
    hljs.highlightAll();
  }, [messages]);

  // Function to format code blocks in markdown
  const formatCodeBlock = (content: string) => {
    return content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => {
      const language = lang || 'plaintext';
      try {
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre class="code-block"><div class="code-header"><span class="code-language">${language}</span></div><code class="hljs language-${language}">${highlighted}</code></pre>`;
      } catch {
        return `<pre class="code-block"><div class="code-header"><span class="code-language">${language}</span></div><code class="hljs">${code}</code></pre>`;
      }
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="shadow-lg border-0 bg-card/90 backdrop-blur-md">
        <CardContent className="p-0">
          <ScrollArea 
            className="h-[calc(100vh-24rem)] md:h-[calc(100vh-26rem)] p-4"
            ref={scrollAreaRef}
          >
            <div className="space-y-6 pb-2">
              {/* Welcome message when no messages */}
              {messages.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center justify-center text-center p-6 space-y-3"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium text-lg">Welcome to MediBot</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    I'm here to provide medical information about your condition. 
                    Ask me anything about {disease || "your symptoms"}.
                  </p>
                </motion.div>
              )}

              {/* Message list with animations */}
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 350, 
                      damping: 25,
                      duration: 0.4
                    }}
                    className={cn(
                      "flex items-start space-x-3 mb-4",
                      message.isUser ? "justify-end flex-row-reverse space-x-reverse" : ""
                    )}
                  >
                    {!message.isUser && (
                      <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-1">
                        <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        "rounded-2xl px-5 py-3 shadow-sm max-w-[85%] transition-shadow duration-300",
                        !message.isUser
                          ? "bg-card border border-border/50 hover:shadow-md hover:bg-card/90"
                          : "bg-gradient-to-r from-primary to-accent text-white hover:shadow-md hover:shadow-primary/10"
                      )}
                    >
                      {message.isUser ? (
                        <p className="text-sm whitespace-pre-line">{message.content}</p>
                      ) : (
                        <div className="markdown-content text-sm prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            children={message.content}
                            components={{
                              code({className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !className?.includes('inline') ? (
                                  <div className="relative my-2 rounded-md overflow-hidden bg-muted/40">
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/70 text-xs">
                                      <span className="font-mono">{match && match[1] ? match[1] : 'text'}</span>
                                    </div>
                                    <pre className="p-3 overflow-x-auto">
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  </div>
                                ) : (
                                  <code className="px-1.5 py-0.5 rounded-md bg-muted/60" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              ul({children}) {
                                return <ul className="list-disc pl-4 space-y-1.5">{children}</ul>
                              },
                              ol({children}) {
                                return <ol className="list-decimal pl-4 space-y-1.5">{children}</ol>
                              },
                              li({children}) {
                                return <li className="ml-2">{children}</li>
                              }
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xs opacity-70 mt-1.5 text-right">
                        {message.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </motion.div>

                    {message.isUser && (
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Loading animation */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-start space-x-3"
                >
                  <motion.div
                    animate={{ rotate: [0, 10, 0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-1 shadow-md">
                      <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-white">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  
                  <motion.div 
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 shadow-md"
                  >
                    <div className="flex items-center space-x-2">
                      <motion.div 
                        animate={{ 
                          scale: [0.6, 1.1, 0.6],
                          opacity: [0.4, 1, 0.4]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.4,
                        }}
                        className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg" 
                      />
                      <motion.div 
                        animate={{ 
                          scale: [0.6, 1.1, 0.6],
                          opacity: [0.4, 1, 0.4]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.4,
                          delay: 0.2
                        }}
                        className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg" 
                      />
                      <motion.div 
                        animate={{ 
                          scale: [0.6, 1.1, 0.6],
                          opacity: [0.4, 1, 0.4]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.4,
                          delay: 0.4
                        }}
                        className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg" 
                      />
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.4 }}
                        className="text-xs text-muted-foreground ml-1"
                      >
                        Thinking...
                      </motion.span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Suggested Queries */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Smile className="h-4 w-4 text-primary/70" />
            <span>Suggested Questions</span>
          </h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AnimatePresence>
            {SUGGESTED_QUERIES.map((query, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                transition={{ 
                  delay: index * 0.15,
                  type: "spring",
                  stiffness: 400,
                  damping: 25
                }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-left justify-start h-auto py-2.5 text-xs bg-card/80 backdrop-blur-sm border-primary/10 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all duration-300"
                  onClick={() => sendMessage(query)}
                  disabled={isLoading || !chatId}
                >
                  <motion.span
                    initial={{ opacity: 0.7 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {query}
                  </motion.span>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Chat Input with animation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
      >
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3 flex items-center h-full">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 10 }}
                className="text-primary/70"
              >
                <Smile className="h-5 w-5" />
              </motion.div>
            </div>
            
            <Input
              placeholder={chatId ? "Type your health question..." : "Select symptoms first to start a chat..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading || !chatId}
              className="pl-12 pr-24 py-6 rounded-full bg-card/90 backdrop-blur-sm border-muted shadow-md"
            />
            
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              <AnimatePresence>
                {!inputValue.trim() && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary" 
                        disabled={isLoading || !chatId}
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, delay: 0.05 }}
                    >
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary" 
                        disabled={isLoading || !chatId}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: !inputValue.trim() || isLoading || !chatId ? 0.8 : 1, 
              opacity: !inputValue.trim() || isLoading || !chatId ? 0.7 : 1
            }}
            whileHover={{ 
              scale: !inputValue.trim() || isLoading || !chatId ? 0.8 : 1.05,
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2"
          >
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading || !chatId}
              className="h-11 w-11 rounded-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
            >
              <Send className="h-5 w-5" />
            </Button>
          </motion.div>
        </form>
        
        {/* Status message */}
        <AnimatePresence>
          {!chatId && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground mt-2 text-center"
            >
              Select symptoms to get disease prediction and start a conversation
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}