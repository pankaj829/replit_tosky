import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [projectName, setProjectName] = useState("AI Assistant");

  // Fetch project name from the server when component mounts
  useEffect(() => {
    fetch("/api/chat/settings")
      .then((response) => response.json())
      .then((data) => {
        if (data.projectName) {
          setProjectName(data.projectName);
        }
      })
      .catch((error) => {
        console.error("Error fetching project name:", error);
      });
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If we're already on the home page, reload the page to reset the chat
    if (location === "/") {
      window.location.reload();
    } else {
      // Otherwise navigate to the home page
      setLocation("/");
    }
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center" onClick={handleLogoClick}>
            <img
              src="/main_logo.png"
              alt={projectName}
              className="h-16" /* 4rem = 16px * 4 = 64px, but h-16 is 4rem in Tailwind */
            />
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>

          {/* Support link commented out
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground mr-4 text-sm"
          >
            Support
          </a>
          */}
          {/* Docs link commented out
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground mr-4 text-sm"
          >
            Docs
          </a>
          */}

          <Button
            variant="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Button>
        </div>
      </div>
    </header>
  );
}
