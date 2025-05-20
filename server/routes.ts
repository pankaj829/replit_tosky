import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { generateChatResponse, streamChatResponse, config } from "./openai";
import {
  getKnowledgeBase,
  updateKnowledgeBase,
  appendToKnowledgeBase,
} from "./knowledge";
import {
  generateSessionId,
  getSessionMessages,
  addMessageToSession,
  clearSession,
} from "./session";

// Schema for chat message requests
const messageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message is too long"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API route to get conversation history
  app.get("/api/chat/history", (req, res) => {
    try {
      console.log("Received request for chat history");

      // Get session ID from cookie
      const sessionId = req.cookies?.sambanovaSession;
      console.log(`Session ID from cookie: ${sessionId || "none"}`);

      if (!sessionId) {
        // No session found, return empty history
        console.log("No session ID found, returning empty history");
        return res.json({ messages: [] });
      }

      // Get messages from session
      const sessionMessages = getSessionMessages(sessionId);
      console.log(
        `Retrieved ${sessionMessages.length} messages from session ${sessionId}`
      );

      // Convert session messages to client format
      const clientMessages = sessionMessages.map((msg, index) => {
        console.log(
          `Converting message ${index}: role=${
            msg.role
          }, content=${msg.content.substring(0, 30)}...`
        );
        return {
          id: `history-${index}`,
          text: msg.content,
          sender: msg.role === "user" ? "user" : "assistant",
          timestamp: new Date().toISOString(),
        };
      });

      console.log(
        `Returning ${clientMessages.length} formatted messages to client`
      );
      return res.json({ messages: clientMessages });
    } catch (error) {
      console.error("Error retrieving chat history:", error);
      return res.status(500).json({ error: "Failed to retrieve chat history" });
    }
  });

  // API routes

  // Get chat settings route
  app.get("/api/chat/settings", async (_req, res) => {
    try {
      // Get project name from environment variable or use a default
      const projectName = process.env.PROJECT_NAME || "BTAssetHub";
      const projectType =
        process.env.PROJECT_TYPE || "digital asset management";

      // In the future, this could fetch user-specific settings or configurations
      // For now, we'll return some basic default settings
      const settings = {
        model: config.model, // Use the model from the imported configuration
        provider: config.provider, // Include the provider for informational purposes
        maxTokens: 2048,
        siteName: process.env.SITE_NAME || `${projectName} Assistant`,
        projectName: projectName,
        projectType: projectType,
        suggestions: [
          {
            id: 1,
            text: `What services does ${projectName} offer?`,
            icon: "question-circle",
          },
          {
            id: 2,
            text: `How do I get started with ${projectType}?`,
            icon: "rocket",
          },
          { id: 3, text: "Tell me about pricing tiers", icon: "dollar-sign" },
          {
            id: 4,
            text: `What are the benefits of using ${projectName}?`,
            icon: "file-contract",
          },
          { id: 5, text: "How do I contact support?", icon: "paper-plane" },
        ],
      };

      res.json(settings);
    } catch (err) {
      console.error("Error fetching chat settings:", err);
      res.status(500).json({ message: "Failed to fetch chat settings" });
    }
  });

  // Regular (non-streaming) message route
  app.post("/api/chat/message", async (req, res) => {
    try {
      console.log("Received regular chat request");
      const startTime = Date.now();

      // Validate the request body
      const { message } = messageSchema.parse(req.body);
      console.log("Chat request message:", message.substring(0, 50) + "...");

      // Get or create session ID from cookie
      let sessionId = req.cookies?.sambanovaSession;
      if (!sessionId) {
        // No session ID found in cookies, generate a new one
        sessionId = generateSessionId();
        // Set the cookie with a 30-minute expiration
        res.cookie("sambanovaSession", sessionId, {
          maxAge: 30 * 60 * 1000, // 30 minutes
          httpOnly: true,
          sameSite: "lax", // Changed from strict to lax for better compatibility
          path: "/", // Ensure cookie is available for all paths
        });
        console.log(`Created new session ID: ${sessionId}`);
      } else {
        console.log(`Using existing session ID from cookie: ${sessionId}`);
      }

      // Integrate with OpenAI to process the message
      const answer = await generateChatResponse(message, 500, sessionId);

      const response = {
        id: Date.now().toString(),
        answer,
        timestamp: new Date().toISOString(),
      };

      // For illustration - in the future you might log this conversation
      // await storage.saveConversation(userId, message, response.answer);

      const endTime = Date.now();
      console.log(`Chat request completed in ${endTime - startTime}ms`);

      res.json(response);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Error processing message:", err);
        res.status(500).json({ message: "Failed to process your message" });
      }
    }
  });

  // Streaming message route
  app.post("/api/chat/message/stream", async (req, res) => {
    try {
      console.log("Received POST streaming request");
      const startTime = Date.now();

      // Validate the request body
      const { message } = messageSchema.parse(req.body);
      console.log(
        "POST streaming request message:",
        message.substring(0, 50) + "..."
      );

      // Get or create session ID from cookie
      let sessionId = req.cookies?.sambanovaSession;
      if (!sessionId) {
        // No session ID found in cookies, generate a new one
        sessionId = generateSessionId();
        // Set the cookie with a 30-minute expiration
        res.cookie("sambanovaSession", sessionId, {
          maxAge: 30 * 60 * 1000, // 30 minutes
          httpOnly: true,
          sameSite: "lax", // Changed from strict to lax for better compatibility
          path: "/", // Ensure cookie is available for all paths
        });
        console.log(`Created new session ID: ${sessionId}`);
      } else {
        console.log(`Using existing session ID from cookie: ${sessionId}`);
      }

      // Stream the response with the session ID
      await streamChatResponse(message, res, sessionId);

      // Note: The response is handled within the streamChatResponse function
      const endTime = Date.now();
      console.log(
        `POST streaming request completed in ${endTime - startTime}ms`
      );
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Error processing streaming message:", err);
        res
          .status(500)
          .json({ message: "Failed to process your message stream" });
      }
    }
  });

  // Also support GET for the stream with query parameters (for EventSource)
  app.get("/api/chat/message/stream", async (req, res) => {
    try {
      console.log("Received streaming request");
      const startTime = Date.now();

      // Validate the query parameter
      const message = req.query.message as string;
      if (!message) {
        return res
          .status(400)
          .json({ message: "Message parameter is required" });
      }

      // Validate with our schema
      messageSchema.parse({ message });
      console.log(
        "Streaming request message:",
        message.substring(0, 50) + "..."
      );

      // Get or create session ID from cookie
      let sessionId = req.cookies?.sambanovaSession;
      if (!sessionId) {
        // No session ID found in cookies, generate a new one
        sessionId = generateSessionId();
        // Set the cookie with a 30-minute expiration
        res.cookie("sambanovaSession", sessionId, {
          maxAge: 30 * 60 * 1000, // 30 minutes
          httpOnly: true,
          sameSite: "lax", // Changed from strict to lax for better compatibility
          path: "/", // Ensure cookie is available for all paths
        });
        console.log(`Created new session ID: ${sessionId}`);
      } else {
        console.log(`Using existing session ID from cookie: ${sessionId}`);
      }

      // Stream the response with the session ID
      await streamChatResponse(message, res, sessionId);

      const endTime = Date.now();
      console.log(`Streaming request completed in ${endTime - startTime}ms`);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Error processing streaming message:", err);
        res
          .status(500)
          .json({ message: "Failed to process your message stream" });
      }
    }
  });

  // Knowledge base routes
  // Get the current knowledge base content
  app.get("/api/knowledge", async (_req, res) => {
    try {
      const knowledge = getKnowledgeBase();
      res.json({ content: knowledge });
    } catch (err) {
      console.error("Error getting knowledge base:", err);
      res.status(500).json({ message: "Failed to get knowledge base content" });
    }
  });

  // Schema for knowledge base update requests
  const knowledgeSchema = z.object({
    content: z.string().min(1, "Content cannot be empty"),
  });

  // Update knowledge base with new content (replaces existing content)
  app.post("/api/knowledge/update", async (req, res) => {
    try {
      // Validate the request body
      const { content } = knowledgeSchema.parse(req.body);

      // Update the knowledge base
      const success = updateKnowledgeBase(content);

      if (success) {
        res.json({ message: "Knowledge base updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update knowledge base" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Error updating knowledge base:", err);
        res.status(500).json({ message: "Failed to update knowledge base" });
      }
    }
  });

  // Append to knowledge base (adds to existing content)
  app.post("/api/knowledge/append", async (req, res) => {
    try {
      // Validate the request body
      const { content } = knowledgeSchema.parse(req.body);

      // Append to the knowledge base
      const success = appendToKnowledgeBase(content);

      if (success) {
        res.json({
          message: "Content appended to knowledge base successfully",
        });
      } else {
        res.status(500).json({ message: "Failed to append to knowledge base" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Error appending to knowledge base:", err);
        res.status(500).json({ message: "Failed to append to knowledge base" });
      }
    }
  });

  // Document upload route (for future implementation)
  app.post("/api/documents/upload", async (_req, res) => {
    try {
      // This will be implemented in the future to handle document uploads
      // for the knowledge base
      res
        .status(501)
        .json({ message: "Document upload functionality coming soon" });
    } catch (err) {
      console.error("Error uploading document:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Add a message to the session without generating a response
  app.post("/api/chat/add-message", async (req, res) => {
    try {
      // Validate the request body
      const { message, role = "user" } = req.body;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get session ID from cookie
      let sessionId = req.cookies?.sambanovaSession;
      if (!sessionId) {
        // No session ID found in cookies, generate a new one
        sessionId = generateSessionId();
        // Set the cookie with a 30-minute expiration
        res.cookie("sambanovaSession", sessionId, {
          maxAge: 30 * 60 * 1000, // 30 minutes
          httpOnly: true,
          sameSite: "lax", // Changed from strict to lax for better compatibility
          path: "/", // Ensure cookie is available for all paths
        });
        console.log(`Created new session ID: ${sessionId}`);
      }

      // Add the message to the session
      addMessageToSession(sessionId, role, message);
      console.log(`Added ${role} message to session ${sessionId}`);

      res.json({ success: true, sessionId });
    } catch (err) {
      console.error("Error adding message to session:", err);
      res.status(500).json({ message: "Failed to add message to session" });
    }
  });

  // Clear the session and create a new one
  app.post("/api/chat/clear-session", async (req, res) => {
    try {
      // Get session ID from cookie
      let sessionId = req.cookies?.sambanovaSession;

      if (!sessionId) {
        // No session ID found in cookies, generate a new one
        sessionId = generateSessionId();
        console.log(
          `No session to clear, created new session ID: ${sessionId}`
        );
      } else {
        // Clear the existing session and get a new session ID
        sessionId = clearSession(sessionId);
        console.log(`Cleared session and created new session ID: ${sessionId}`);
      }

      // Set the cookie with the new session ID
      res.cookie("sambanovaSession", sessionId, {
        maxAge: 30 * 60 * 1000, // 30 minutes
        httpOnly: true,
        sameSite: "lax", // Changed from strict to lax for better compatibility
        path: "/", // Ensure cookie is available for all paths
      });

      res.json({ success: true, sessionId });
    } catch (err) {
      console.error("Error clearing session:", err);
      res.status(500).json({ message: "Failed to clear session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
