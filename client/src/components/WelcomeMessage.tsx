import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function WelcomeMessage() {
  const [projectName, setProjectName] = useState("AI Assistant");

  // Fetch site name from the server when component mounts
  useEffect(() => {
    // This will get the site name from the server's settings endpoint
    // We'll use this approach to get environment variables on the client side
    fetch("/api/chat/settings")
      .then((response) => response.json())
      .then((data) => {
        if (data.siteName) {
          setProjectName(data.siteName);
        }
      })
      .catch((error) => {
        console.error("Error fetching site name:", error);
      });
  }, []);

  return (
    <div className="text-center mb-12">
      <motion.div
        className="w-28 h-28 mx-auto mb-8 relative" /* Increased size to 7rem (28 in Tailwind) */
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse-slow"></div>
        <div className="flex items-center justify-center w-full h-full overflow-hidden rounded-full border border-primary/30 relative shadow-lg">
          <img
            src="/main2.png"
            alt="AI Assistant"
            className="w-[95%] h-[95%] object-cover rounded-full"
          />
        </div>
      </motion.div>
      <motion.h1
        className="font-display text-4xl mb-3 text-foreground/90"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Welcome to {projectName}
      </motion.h1>
      <motion.p
        className="text-xl font-heading font-medium text-primary/80"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        How can I help you today?
      </motion.p>
    </div>
  );
}
