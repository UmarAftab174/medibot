import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Stethoscope, CheckCircle, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { debounce } from "lodash";
import { motion, AnimatePresence } from "framer-motion";

interface SymptomSelectorProps {
  selectedSymptoms: string[];
  onSymptomsChange: (symptoms: string[]) => void;
  onPredict: () => void;
  isLoading?: boolean;
}

export function SymptomSelector({ 
  selectedSymptoms, 
  onSymptomsChange, 
  onPredict,
  isLoading 
}: SymptomSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSymptoms, setFilteredSymptoms] = useState<string[]>([]);
  const API_URL = "http://localhost:8000";

  const fetchSymptoms = useCallback(debounce(async (query: string) => {
    try {
      const response = await axios.get(`${API_URL}/get_symptoms?query=${query}`);
      setFilteredSymptoms(response.data.symptoms.filter((s: string) => !selectedSymptoms.includes(s)));
    } catch (error) {
      console.error("Failed to fetch symptoms:", error);
    }
  }, 300), [selectedSymptoms]);

  useEffect(() => {
    fetchSymptoms(searchTerm);
  }, [searchTerm, fetchSymptoms]);

  const addSymptom = (symptom: string) => {
    if (!selectedSymptoms.includes(symptom)) {
      onSymptomsChange([...selectedSymptoms, symptom]);
    }
  };

  const removeSymptom = (symptom: string) => {
    onSymptomsChange(selectedSymptoms.filter(s => s !== symptom));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <Stethoscope className="h-5 w-5 text-primary" />
              </motion.div>
              <CardTitle>Symptom Analysis</CardTitle>
            </div>
            
            {/* Removed Lottie animation */}
          </div>
          <CardDescription>
            Select your symptoms to get an AI-powered disease prediction
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-5">
          {/* Search Bar with Animation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search symptoms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-primary/20 focus:border-primary shadow-sm"
            />
          </motion.div>

          {/* Selected Symptoms with Animation */}
          <AnimatePresence>
            {selectedSymptoms.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1.5 text-primary/70" />
                    Selected Symptoms ({selectedSymptoms.length})
                  </h4>
                  
                  {selectedSymptoms.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => onSymptomsChange([])}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="max-h-24 rounded-md border border-border/50 p-2">
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {selectedSymptoms.map((symptom) => (
                        <motion.div
                          key={symptom}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                          transition={{ duration: 0.3 }}
                          layout
                        >
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                          >
                            {symptom}
                            <motion.button
                              whileHover={{ rotate: 90 }}
                              transition={{ duration: 0.2 }}
                              onClick={() => removeSymptom(symptom)}
                              className="ml-2 hover:text-destructive focus:outline-none"
                            >
                              <X className="h-3 w-3" />
                            </motion.button>
                          </Badge>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Available Symptoms with Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center">
                <Plus className="h-4 w-4 mr-1.5 text-primary/70" />
                Available Symptoms
              </h4>
              
              <Badge variant="outline" className="font-normal">
                {filteredSymptoms.length} found
              </Badge>
            </div>
            
            <ScrollArea className="max-h-48 rounded-md border border-border/50 p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <AnimatePresence>
                  {filteredSymptoms.map((symptom, index) => (
                    <motion.div
                      key={symptom}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                      whileHover={{ scale: 1.02 }}
                      layout
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start text-xs h-8 w-full group hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-200"
                        onClick={() => addSymptom(symptom)}
                      >
                        <span className="truncate">{symptom}</span>
                        <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredSymptoms.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-muted-foreground">
                    {searchTerm ? (
                      <p className="text-sm">No symptoms match your search</p>
                    ) : (
                      <p className="text-sm">Type to search for symptoms</p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>

          {/* Predict Button with Animation */}
          <AnimatePresence>
            {selectedSymptoms.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  onClick={onPredict}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent hover:shadow-md hover:shadow-primary/20 transition-all duration-300"
                  size="lg"
                >
                  <motion.div
                    className="flex items-center"
                    initial={{ x: 0 }}
                    whileHover={{ x: 5 }}
                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.6 }}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white/20 border-r-white rounded-full" />
                        <span>Analyzing symptoms...</span>
                      </div>
                    ) : (
                      <>
                        <span>Predict Disease</span>
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </motion.div>
                </Button>
                
                {/* Info text */}
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Based on {selectedSymptoms.length} selected {selectedSymptoms.length === 1 ? 'symptom' : 'symptoms'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}