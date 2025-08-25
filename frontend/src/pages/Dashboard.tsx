import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SymptomSelector } from "@/components/dashboard/SymptomSelector";
import { ChatInterface } from "@/components/dashboard/ChatInterface";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { WelcomeAnimation } from "@/components/visualizations/WelcomeAnimation";

interface Prediction {
  disease: string;
  confidence: string | number;  // Can be string from API or number from chat
  confidenceStr?: string;       // String representation for display
  symptoms_count: number;
  chat_id: number;
}

interface Chat {
  chat_id: number;
  disease: string | null;
  confidence?: number | string; // Make optional and allow string or number
  confidenceStr?: string;       // String representation for display
  created_at: string;
  messages: Record<string, { query: string; response: string }> | string; // Could be string if not parsed
}

interface Message {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
}

export default function Dashboard() {
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    // Initial fetch when component mounts or token changes
    fetchChatHistory();
    
    // Set up polling for chat history updates
    const intervalId = setInterval(() => {
      fetchChatHistory();
    }, 10000); // Poll every 10 seconds
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [accessToken]);

  const fetchChatHistory = async () => {
    if (accessToken) {
      try {
        console.log("Fetching chat history...");
        // Only request full messages when needed (e.g., first load)
        const includeMessages = !chats.length;
        
        // Use pagination to limit data transfer
        const response = await axios.get(`${API_URL}/chat-history`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            page: 1,
            per_page: 20,
            include_messages: includeMessages,
            recompute_confidence: false // Don't recompute confidence on regular updates
          }
        });
        
        if (response.data && Array.isArray(response.data.chats)) {
          // Process each chat to ensure valid structure
          const processedChats = response.data.chats.map((chat: any) => {
            // Ensure messages is a valid object
            let messages = {};
            try {
              if (typeof chat.messages === 'string') {
                messages = JSON.parse(chat.messages);
              } else if (typeof chat.messages === 'object' && chat.messages !== null) {
                messages = chat.messages;
              }
            } catch (error) {
              console.warn(`Failed to parse messages for chat ${chat.chat_id}`, error);
            }
            
            // Parse confidence value consistently
            let confidence = 0;
            let confidenceStr = '0%'; // Keep the original string format for display
            
            // Debug logging
            console.log("Original chat.confidence:", chat.confidence, "type:", typeof chat.confidence);
            
            // First try to get confidence from existing value
            if (chat.confidence !== undefined && chat.confidence !== null) {
              if (typeof chat.confidence === 'string') {
                // Store the original string for display
                confidenceStr = chat.confidence;
                // Handle string format with or without % sign and extra spaces for numeric value
                confidence = parseFloat(chat.confidence.replace('%', '').trim()) || 0;
              } else if (typeof chat.confidence === 'number') {
                confidence = chat.confidence;
                // Format the number as a percentage string
                confidenceStr = `${confidence.toFixed(2)}%`;
              }
            } 
            
            // If confidence is invalid, use a minimum value
            if (confidence === 0 || isNaN(confidence)) {
              console.warn("Zero or invalid confidence for chat:", chat.chat_id);
              // Set a minimum value to avoid 0%
              confidence = 0.1;
              confidenceStr = '0.10%';
            }
            
            console.log("Processed confidence value:", confidence, "display:", confidenceStr);
            
            return {
              ...chat,
              messages,
              confidence,
              confidenceStr, // Add the string representation for display
              confidenceKey: Date.now() // Add a timestamp to force refresh of visualizations
            };
          });
          
          // Sort chats by creation date (newest first)
          const sortedChats = [...processedChats].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          setChats(sortedChats);
          console.log(`Retrieved ${sortedChats.length} chats from history`);
          
          // If we have a current chat selected, update its data from the refreshed list
          if (currentChat) {
            const updatedCurrentChat = sortedChats.find(c => c.chat_id === currentChat.chat_id);
            if (updatedCurrentChat) {
              console.log("Found current chat in updated history");
              
              // Check if there's a significant change in the messages that requires an update
              const currentMsgCount = typeof currentChat.messages === 'object' ? 
                Object.keys(currentChat.messages).length : 0;
                
              const newMsgCount = typeof updatedCurrentChat.messages === 'object' ? 
                Object.keys(updatedCurrentChat.messages).length : 0;
              
              // Update the current chat object
              setCurrentChat(updatedCurrentChat);
              
              // If the message count changed or it's been 30 seconds since the last full refresh,
              // do a complete refresh of the messages by calling handleChatSelect
              if (currentMsgCount !== newMsgCount) {
                console.log(`Message count changed (${currentMsgCount} → ${newMsgCount}), refreshing messages`);
                handleChatSelect(updatedCurrentChat);
              }
            } else {
              console.warn(`Current chat ${currentChat.chat_id} not found in history`);
            }
          }
        } else {
          console.error("Invalid chat history format:", response.data);
        }
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
        toast({
          title: "Error",
          description: "Failed to fetch chat history.",
          variant: "destructive",
        });
      }
    }
  };

  const handleNewChat = () => {
    setCurrentChat(null);
    setSelectedSymptoms([]);
    setPrediction(null);
    setCurrentMessages([]);
  };

  const handleChatSelect = (chat: Chat) => {
    console.log(`Selecting chat: ${chat.chat_id}`, chat);
    setCurrentChat(chat);
    setSelectedSymptoms([]);
    
    // Handle confidence formatting consistently - could be a string with % or a number
    let confidenceValue = 0;
    
    console.log("Chat confidence:", chat.confidence, "type:", typeof chat.confidence);
    
    if (typeof chat.confidence === 'string') {
      // Convert string like "85.5%" to number 85.5
      confidenceValue = parseFloat(chat.confidence.replace('%', '').trim());
    } else if (typeof chat.confidence === 'number') {
      confidenceValue = chat.confidence;
    }
    
    // Ensure we have a valid confidence value
    if (isNaN(confidenceValue) || confidenceValue === null || confidenceValue === undefined) {
      console.warn("Invalid confidence value from chat:", chat.confidence);
      // Don't set any default - only use the actual value from the API
      confidenceValue = 0; 
    }
    
    console.log("Using confidence value:", confidenceValue);
    
    // Only set prediction if we have a disease
    if (chat.disease) {
      setPrediction({
        disease: chat.disease || "",
        confidence: confidenceValue,
        symptoms_count: 0,
        chat_id: chat.chat_id,
      });
    } else {
      setPrediction(null);
    }

    try {
      // Ensure messages is an object we can work with
      const messagesObj = typeof chat.messages === 'string' 
        ? JSON.parse(chat.messages) 
        : (chat.messages || {});
      
      if (!messagesObj || typeof messagesObj !== 'object') {
        console.warn("Invalid messages format, resetting to empty array");
        setCurrentMessages([]);
        return;
      }
        
      // Parse the messages and sort them properly by their message number
      const parsedMessages: Message[] = Object.entries(messagesObj)
        .sort(([a], [b]) => {
          // Extract the number part from "message1", "message2", etc.
          const numA = parseInt(a.replace('message', '')) || 0;
          const numB = parseInt(b.replace('message', '')) || 0;
          return numA - numB;
        })
        .map(([key, msg]) => {
          if (typeof msg !== 'object' || msg === null) {
            console.warn(`Invalid message format for ${key}, skipping`);
            return null;
          }
          
          // Create a proper message object with a consistent timestamp
          // Using the chat's created_at as the base time and adding 1 minute per message
          const messageNumber = parseInt(key.replace('message', '')) || 0;
          const baseTime = new Date(chat.created_at).getTime();
          const messageTime = new Date(baseTime + (messageNumber * 60000)); // Add 1 minute per message
          
          return {
            id: key,
            query: (msg as any).query || "",
            response: (msg as any).response || "",
            timestamp: messageTime,
          };
        })
        .filter(Boolean) as Message[]; // Remove any null entries from invalid messages
      
      console.log(`Parsed ${parsedMessages.length} messages for chat ${chat.chat_id}`);
      setCurrentMessages(parsedMessages);
    } catch (error) {
      console.error("Error parsing chat messages:", error);
      setCurrentMessages([]); // Reset to empty array if parsing fails
    }
  };

  const handlePredict = async () => {
    if (!selectedSymptoms.length) {
      toast({
        title: "No symptoms selected",
        description: "Please select at least one symptom for prediction.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`Making prediction with ${selectedSymptoms.length} symptoms`);
      
      // Step 1: Make prediction API call
      const response = await axios.post(
        `${API_URL}/predict`,
        { symptoms: selectedSymptoms },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      const predictionData = response.data;
      console.log("Prediction result:", predictionData);
      
      // Parse the confidence value to ensure it's a valid number
      let confidenceValue = 0;
      let confidenceStr = predictionData.confidence || '0.10%'; // Keep original string format
      
      console.log("Original API confidence value:", predictionData.confidence, "type:", typeof predictionData.confidence);
      
      if (typeof predictionData.confidence === 'string') {
        confidenceValue = parseFloat(predictionData.confidence.replace('%', '').trim());
        confidenceStr = predictionData.confidence; // Keep original format
        console.log("Parsed string confidence:", confidenceValue, "original:", confidenceStr);
      } else if (typeof predictionData.confidence === 'number') {
        confidenceValue = predictionData.confidence;
        confidenceStr = `${predictionData.confidence.toFixed(2)}%`; // Format as percentage
        console.log("Using number confidence:", confidenceValue, "formatted:", confidenceStr);
      }
      
      // Force to a number if we got NaN or invalid value
      if (isNaN(confidenceValue) || confidenceValue === null || confidenceValue === undefined) {
        console.warn("Invalid confidence value from API:", predictionData.confidence);
        confidenceValue = 0.1; // Use 0.1% minimum instead of zero
        confidenceStr = '0.10%';
      } else {
        // Ensure it's within 0-100 range
        confidenceValue = Math.max(0.1, Math.min(100, confidenceValue));
        // If we changed the value, update the string too
        confidenceStr = `${confidenceValue.toFixed(2)}%`;
      }
      
      // Log for debugging
      console.log("Final processed confidence value:", confidenceValue, "display:", confidenceStr);
      
      // Create a fixed confidence value - make sure it's a number
      const finalConfidence = confidenceValue;
      
      // Update the prediction state with the processed confidence
      setPrediction({
        disease: predictionData.disease,
        confidence: finalConfidence, // Use the processed number value
        confidenceStr: confidenceStr, // Add string representation for display
        symptoms_count: predictionData.symptoms_count,
        chat_id: predictionData.chat_id
      });
      
      console.log("Setting prediction with confidence:", finalConfidence, "display:", confidenceStr);
      
      // Create a temporary chat object for immediate use
      const tempChat: Chat = {
        chat_id: predictionData.chat_id,
        disease: predictionData.disease,
        confidence: confidenceValue,
        confidenceStr: confidenceStr, // Add string version
        created_at: new Date().toISOString(),
        messages: {}
      };
      
      // Update the current chat
      setCurrentChat(tempChat);
      setCurrentMessages([]);
      
      // Step 3: Fetch updated chat history after a short delay
      // This ensures the backend has time to commit the new chat
      setTimeout(async () => {
        try {
          await fetchChatHistory();
          
          // Look for the chat in the updated history
          const updatedChats = await axios.get(`${API_URL}/chat-history`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          
          if (updatedChats.data && Array.isArray(updatedChats.data.chats)) {
            const foundChat = updatedChats.data.chats.find(
              (c: any) => c.chat_id === predictionData.chat_id
            );
            
            if (foundChat) {
              console.log(`Found chat ${predictionData.chat_id} in history, updating state`);
              handleChatSelect(foundChat);
            }
          }
        } catch (err) {
          console.error("Error fetching updated chat history:", err);
        }
      }, 1000);
    } catch (error: any) {
      console.error("Prediction failed:", error);
      toast({
        title: "Prediction failed",
        description: error.response?.data?.detail || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageSent = () => {
    // Add a short delay to ensure backend has time to save changes
    setTimeout(() => {
      fetchChatHistory();
    }, 500);
  };

  // New state for welcome screen
  const [showWelcome, setShowWelcome] = useState(!currentChat && !prediction);

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-light-blue via-background to-medical-light-blue">
      <Header />
      
      <div className="flex">
        <Sidebar
          currentChatId={currentChat?.chat_id}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          className="hidden md:flex flex-col"
        />
        
        <main className="flex-1 p-6 overflow-x-hidden">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Welcome Animation */}
            <AnimatePresence>
              {showWelcome && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <WelcomeAnimation 
                    onStartClick={() => setShowWelcome(false)} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Dashboard Content */}
            <AnimatePresence>
              {!showWelcome && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Disease Prediction Section */}
                  {!currentChat && (
                    <SymptomSelector
                      selectedSymptoms={selectedSymptoms}
                      onSymptomsChange={setSelectedSymptoms}
                      onPredict={handlePredict}
                      isLoading={isLoading}
                    />
                  )}
                  
                  {/* Symptom Visualization */}
                  {selectedSymptoms.length > 0 && !currentChat && (
                    <div className="p-4 bg-card rounded-lg">
                      <p className="text-center text-muted-foreground">Selected {selectedSymptoms.length} symptoms</p>
                    </div>
                  )}

                  {/* Prediction Result with Enhanced UI */}
                  {prediction && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="space-y-6"
                    >
                      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            {/* Show different icons based on confidence level */}
                            {(() => {
                              // Parse the confidence value
                              const confidenceValue = typeof prediction.confidence === 'string'
                                ? parseFloat(prediction.confidence.replace('%', ''))
                                : prediction.confidence;
                                
                              // Choose icon based on confidence range
                              if (!isNaN(confidenceValue) && confidenceValue >= 70) {
                                return <CheckCircle className="h-5 w-5 text-success" />;
                              } else if (!isNaN(confidenceValue) && confidenceValue > 0) {
                                return <AlertCircle className="h-5 w-5 text-warning" />;
                              } else {
                                return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
                              }
                            })()}
                            <span>Prediction Result</span>
                            
                            {/* Show badge with appropriate variant based on confidence level */}
                            {(() => {
                              // Parse the confidence value
                              const confidenceValue = typeof prediction.confidence === 'string'
                                ? parseFloat(prediction.confidence.replace('%', ''))
                                : prediction.confidence;
                                
                              // Format the display text - use confidenceStr if available
                              const displayText = (prediction as any).confidenceStr || 
                                (typeof prediction.confidence === 'string'
                                  ? prediction.confidence
                                  : `${(prediction.confidence || 0.1).toFixed(2)}%`);
                                
                              // Choose badge variant based on confidence range - ensure we have a valid number
                              const validConfidence = !isNaN(confidenceValue) ? confidenceValue : 0.1;
                              const variant = validConfidence >= 70
                                ? "secondary"
                                : validConfidence > 0
                                  ? "outline"
                                  : "secondary";
                                  
                              return (
                                <Badge variant={variant} className="ml-auto">
                                  {displayText} {!displayText.includes("confidence") && "confidence"}
                                </Badge>
                              );
                            })()}
                          </CardTitle>
                          <CardDescription>
                            AI analysis based on your selected symptoms
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-6"
                            >
                              <div className="col-span-2">
                                <h3 className="text-lg font-semibold text-primary mb-2">
                                  {prediction.disease}
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                  Based on your symptoms, our AI model has identified this potential condition. 
                                  Remember that this is not a medical diagnosis.
                                </p>
                                
                                <motion.div 
                                  whileHover={{ scale: 1.01 }} 
                                  className="bg-medical-light-blue/50 dark:bg-medical-light-blue/20 rounded-lg p-4"
                                >
                                  <p className="text-sm">
                                    <strong>⚠️ Disclaimer:</strong> This AI prediction is for informational purposes only. 
                                    Please consult a qualified healthcare professional for proper diagnosis and treatment.
                                  </p>
                                </motion.div>
                              </div>
                            </motion.div>
                            
                            {/* No toggle for detailed info */}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Chat Interface */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <ChatInterface 
                      chatId={currentChat?.chat_id || prediction?.chat_id || null}
                      disease={currentChat?.disease || prediction?.disease || null}
                      initialMessages={currentMessages}
                      onMessageSent={handleMessageSent}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}