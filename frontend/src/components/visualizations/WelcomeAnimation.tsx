import { Button } from "@/components/ui/button";

interface WelcomeAnimationProps {
  onStartClick: () => void;
  className?: string;
}

export function WelcomeAnimation({ onStartClick, className = "" }: WelcomeAnimationProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-10 ${className}`}>
      <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
        Welcome to MediBot
      </h1>

      <p className="text-lg text-muted-foreground mb-8 max-w-lg">
        Your AI-powered medical assistant that helps you understand your symptoms and provides guidance based on medical knowledge.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 w-full">
        {[
          { title: "Symptom Analysis", description: "Select your symptoms for AI-based disease prediction" },
          { title: "Medical Chat", description: "Discuss health concerns with our medical AI assistant" },
          { title: "Health Insights", description: "Receive personalized information about your condition" }
        ].map((feature, index) => (
          <div
            key={index}
            className="bg-card/70 backdrop-blur-sm p-4 rounded-lg border border-border/50 shadow-sm"
          >
            <h3 className="font-medium text-primary mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <div>
        <Button
          onClick={onStartClick}
          size="lg"
          className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          Get Started
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-8 max-w-lg">
        <strong>Important:</strong> MediBot provides informational guidance only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns.
      </p>
    </div>
  );
}
