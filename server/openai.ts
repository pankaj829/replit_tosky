import OpenAI from "openai";
import { type Response, type Request } from "express";
import { getKnowledgeBase } from "./knowledge";
import dotenv from "dotenv";
import {
  createOrUpdateSession,
  getSession,
  hasSessionSentKB,
  markSessionKBSent,
  generateSessionId,
  addMessageToSession,
  getSessionMessages,
} from "./session";
import {
  generateSystemPrompt,
  generateDocumentAnalysisPrompt,
} from "./systemPrompt";

// Load environment variables from .env file
dotenv.config();

// Configuration for AI providers
type AIProvider = "openai" | "openrouter" | "sambanova";

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
  model: string;
  baseUrl?: string; // For providers that need a custom base URL
}

// Determine the provider from environment or default to OpenRouter
console.log("AI_PROVIDER from env:", process.env.AI_PROVIDER);
const provider = process.env.AI_PROVIDER as AIProvider;
console.log("Selected provider:", provider);

// Get the appropriate API key based on the provider
const getApiKey = (provider: AIProvider): string => {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY || "your-openai-api-key-here";
    case "openrouter":
      return process.env.OPENROUTER_API_KEY || "";
    case "sambanova":
      return (
        process.env.SAMBANOVA_API_KEY || "7d7c7cf4-eaf0-40c3-85e9-3d7190ee7839"
      );
    default:
      return "api-key-not-found";
  }
};

// Get the appropriate model based on the provider
const getDefaultModel = (provider: AIProvider): string => {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "openrouter":
      return "meta-llama/llama-4-maverick:free";
    case "sambanova":
      return "Meta-Llama-3.1-8B-Instruct";
    default:
      return "model-not-found";
  }
};

// Default configuration - can be overridden with environment variables
export const config: AIConfig = {
  provider,
  apiKey: getApiKey(provider),
  siteUrl: process.env.SITE_URL || "https://example.com",
  siteName:
    process.env.SITE_NAME || `${process.env.PROJECT_NAME || "AI"} Assistant`,
  model: process.env.AI_MODEL || getDefaultModel(provider),
  baseUrl: "https://api.sambanova.ai/v1", // SambaNova API base URL (static)
};

// Initialize OpenAI client with the appropriate API key
const openai = new OpenAI({
  apiKey:
    provider === "openai"
      ? config.apiKey
      : process.env.OPENAI_API_KEY || "your-openai-api-key-here",
});

// Initialize SambaNova client (using OpenAI SDK with custom base URL)
const sambanovaClient = new OpenAI({
  baseURL: config.baseUrl,
  apiKey:
    provider === "sambanova"
      ? config.apiKey
      : process.env.SAMBANOVA_API_KEY || "7d7c7cf4-eaf0-40c3-85e9-3d7190ee7839",
});

/**
 * Generate a chat response using OpenRouter API
 */
async function generateOpenRouterResponse(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 500
): Promise<string> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": config.siteUrl || "",
          "X-Title": config.siteName || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: maxTokens,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorData}`
      );
    }

    const data = await response.json();
    return (
      data.choices[0].message.content ||
      "I'm sorry, I couldn't generate a response."
    );
  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    throw new Error("Failed to generate a response from the AI service.");
  }
}

/**
 * Stream a chat response using OpenRouter API
 */
export async function streamOpenRouterResponse(
  messages: Array<{ role: string; content: string }>,
  res: Response,
  maxTokens: number = 500,
  sessionId?: string
): Promise<void> {
  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Send the message ID first
    const messageId = Date.now().toString();
    res.write(`data: ${JSON.stringify({ id: messageId, type: "start" })}\n\n`);

    // Prepare the fetch request to OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": config.siteUrl || "",
          "X-Title": config.siteName || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: maxTokens,
          stream: true, // Enable streaming
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorData}`
      );
    }

    // Process the stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get reader from response");
    }

    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the data
      buffer += decoder.decode(value, { stream: true });

      // Process complete messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          // Check for the [DONE] message
          if (data === "[DONE]") {
            continue;
          }

          try {
            const parsedData = JSON.parse(data);
            const content = parsedData.choices[0]?.delta?.content || "";

            if (content) {
              fullResponse += content;
              // Send each chunk to the client
              res.write(
                `data: ${JSON.stringify({
                  id: messageId,
                  type: "chunk",
                  content,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              );

              // Force flush the response to ensure immediate delivery to client
              const expressRes = res as unknown as { flush?: () => void };
              if (expressRes.flush) {
                expressRes.flush();
              }
            }
          } catch (e) {
            console.error("Error parsing SSE data", e);
          }
        }
      }
    }

    // Save the assistant's response to the conversation history
    addMessageToSession(
      sessionId || generateSessionId(),
      "assistant",
      fullResponse
    );
    console.log(
      `Added assistant response to session history (OpenRouter streaming)`
    );

    // Send the complete response
    res.write(
      `data: ${JSON.stringify({
        id: messageId,
        type: "end",
        fullContent: fullResponse,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    res.end();
  } catch (error) {
    console.error("Error streaming from OpenRouter API:", error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to generate a streaming response",
      })}\n\n`
    );

    res.end();
  }
}

/**
 * Generate a chat response using OpenAI API
 */
async function generateOpenAIResponse(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 500
): Promise<string> {
  try {
    // Convert messages to the correct type for OpenAI SDK
    const typedMessages = messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model:
        config.provider === "openai"
          ? "gpt-4o"
          : config.model.replace("openai/", ""),
      messages: typedMessages,
      max_tokens: maxTokens,
    });

    return (
      response.choices[0].message.content ||
      "I'm sorry, I couldn't generate a response."
    );
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error("Failed to generate a response from the AI service.");
  }
}

/**
 * Generate a chat response using SambaNova API
 */
async function generateSambanovaResponse(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 500,
  sessionId?: string
): Promise<string> {
  try {
    // Generate a session ID if not provided
    const currentSessionId = sessionId || generateSessionId();

    // Check if this session has already sent KB to SambaNova
    const kbAlreadySent = hasSessionSentKB(currentSessionId);

    // Add a distinctive console log with "tosky" name for easy searching - only when KB will be sent
    if (!kbAlreadySent) {
      console.log(`[TOSKY] KB WILL BE SENT - First request for this session`);
    }

    // If KB was already sent, remove it from the system message
    let typedMessages = messages.map((msg) => {
      if (msg.role === "system" && kbAlreadySent) {
        // Extract only the first part of the system message (before the KB content)
        const systemContent = msg.content.split(
          "Use the following information about BTAssetHub when answering questions:"
        )[0];
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: systemContent.trim(),
        };
      }
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });

    // Log the prompt being sent to the model
    console.log("=== PROMPT BEING SENT TO MODEL (NON-STREAMING) ===");
    console.log(
      `Session ID: ${currentSessionId}, KB already sent: ${kbAlreadySent}`
    );
    typedMessages.forEach((msg, index) => {
      console.log(`Message ${index} - Role: ${msg.role}`);
      console.log(`Content: ${msg.content}`);
      console.log("---");
    });
    console.log("=== END OF PROMPT ===");

    const response = await sambanovaClient.chat.completions.create({
      model: config.model,
      messages: typedMessages,
      max_tokens: maxTokens,
    });

    // Mark this session as having sent KB to SambaNova
    if (!kbAlreadySent) {
      markSessionKBSent(currentSessionId);
      console.log(
        `Marked session ${currentSessionId} as having sent KB to SambaNova`
      );
      console.log(
        `[TOSKY] KB SENT SUCCESSFULLY to SambaNova for session ${currentSessionId}`
      );
    }

    return (
      response.choices[0].message.content ||
      "I'm sorry, I couldn't generate a response."
    );
  } catch (error) {
    console.error("Error calling SambaNova API:", error);
    throw new Error(
      "Failed to generate a response from the SambaNova AI service."
    );
  }
}

/**
 * Stream a chat response using OpenAI API
 */
export async function streamOpenAIResponse(
  messages: Array<{ role: string; content: string }>,
  res: Response,
  maxTokens: number = 500,
  sessionId?: string
): Promise<void> {
  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Convert messages to the correct type for OpenAI SDK
    const typedMessages = messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    }));

    // Send the message ID first
    const messageId = Date.now().toString();
    res.write(`data: ${JSON.stringify({ id: messageId, type: "start" })}\n\n`);

    // Initialize the stream
    const stream = await openai.chat.completions.create({
      model:
        config.provider === "openai"
          ? "gpt-4o"
          : config.model.replace("openai/", ""),
      messages: typedMessages,
      max_tokens: maxTokens,
      stream: true,
    });

    // Process the stream
    let fullResponse = "";

    for await (const chunk of stream) {
      // Extract the delta content
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        // Send each chunk as it arrives
        res.write(
          `data: ${JSON.stringify({
            id: messageId,
            type: "chunk",
            content,
            timestamp: new Date().toISOString(),
          })}\n\n`
        );

        // Force flush the response to ensure immediate delivery to client
        const expressRes = res as unknown as { flush?: () => void };
        if (expressRes.flush) {
          expressRes.flush();
        }
      }
    }

    // Save the assistant's response to the conversation history
    addMessageToSession(
      sessionId || generateSessionId(),
      "assistant",
      fullResponse
    );
    console.log(
      `Added assistant response to session history (OpenAI streaming)`
    );

    // Send the completed message
    res.write(
      `data: ${JSON.stringify({
        id: messageId,
        type: "end",
        fullContent: fullResponse,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // End the stream
    res.end();
  } catch (error) {
    console.error("Error streaming from OpenAI API:", error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to generate a streaming response",
      })}\n\n`
    );

    res.end();
  }
}

/**
 * Stream a chat response using SambaNova API
 */
export async function streamSambanovaResponse(
  messages: Array<{ role: string; content: string }>,
  res: Response,
  maxTokens: number = 500,
  providedSessionId?: string
): Promise<void> {
  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    console.log("Starting SambaNova streaming response");

    // Use provided session ID or generate a new one
    const sessionId = providedSessionId || generateSessionId();
    console.log(
      `Using session ID: ${sessionId} (${
        providedSessionId ? "from cookie" : "newly generated"
      })`
    );

    // Check if this session has already sent KB to SambaNova
    const kbAlreadySent = hasSessionSentKB(sessionId);

    // Add a distinctive console log with "tosky" name for easy searching - only when KB will be sent
    if (!kbAlreadySent) {
      console.log(
        `[TOSKY] KB WILL BE SENT - First streaming request for this session`
      );
    }

    // If KB was already sent, remove it from the system message
    let typedMessages = messages.map((msg) => {
      if (msg.role === "system" && kbAlreadySent) {
        // Extract only the first part of the system message (before the KB content)
        const systemContent = msg.content.split(
          "Use the following information about BTAssetHub when answering questions:"
        )[0];
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: systemContent.trim(),
        };
      }
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });

    // Log the prompt being sent to the model
    console.log("=== PROMPT BEING SENT TO MODEL ===");
    console.log(`Session ID: ${sessionId}, KB already sent: ${kbAlreadySent}`);
    typedMessages.forEach((msg, index) => {
      console.log(`Message ${index} - Role: ${msg.role}`);
      // console.log(`Content: ${msg.content}`);
      console.log("---");
    });
    console.log("=== END OF PROMPT ===");

    // Send the message ID first
    const messageId = Date.now().toString();
    res.write(`data: ${JSON.stringify({ id: messageId, type: "start" })}\n\n`);

    console.log("Creating SambaNova stream with parameters:", {
      model: config.model,
      maxTokens,
      stream: true,
    });

    // First try with streaming - using the exact format from the template
    try {
      // Initialize the stream - using the same variable name as in the template
      const completion = await sambanovaClient.chat.completions.create({
        model: config.model,
        messages: typedMessages,
        stream: true,
      });

      console.log("SambaNova stream created, beginning to process chunks");

      // Process the stream
      let fullResponse = "";
      let chunkCount = 0;

      // Using the same pattern as in the template
      for await (const chunk of completion) {
        // Log chunk information for debugging
        console.log(`Received chunk ${chunkCount++}:`, JSON.stringify(chunk));

        // Extract the delta content exactly as in the template
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          console.log(`Chunk content: "${content}"`);
          fullResponse += content;
          // Send each chunk as it arrives and flush immediately
          res.write(
            `data: ${JSON.stringify({
              id: messageId,
              type: "chunk",
              content,
              timestamp: new Date().toISOString(),
            })}\n\n`
          );

          // Force flush the response to ensure immediate delivery to client
          // Use type assertion to handle Express Response object with flush method
          const expressRes = res as unknown as { flush?: () => void };
          if (expressRes.flush) {
            expressRes.flush();
          }
        } else {
          console.log("Empty content in chunk");
        }
      }

      console.log(`Stream complete. Received ${chunkCount} chunks.`);
      console.log(`Full response length: ${fullResponse.length} characters`);

      // If we didn't get any chunks or only got one big chunk, fall back to simulated streaming
      if (chunkCount <= 1 && fullResponse.length > 0) {
        console.log(
          "Falling back to simulated streaming due to insufficient chunks"
        );
        throw new Error("Insufficient streaming chunks");
      }

      // Save the assistant's response to the conversation history
      addMessageToSession(sessionId, "assistant", fullResponse);
      console.log(`Added assistant response to session ${sessionId} history`);

      // Send the completed message
      res.write(
        `data: ${JSON.stringify({
          id: messageId,
          type: "end",
          fullContent: fullResponse,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );

      // Mark this session as having sent KB to SambaNova
      if (!kbAlreadySent) {
        markSessionKBSent(sessionId);
        console.log(
          `Marked session ${sessionId} as having sent KB to SambaNova`
        );
        console.log(
          `[TOSKY] KB SENT SUCCESSFULLY to SambaNova for streaming session ${sessionId}`
        );
      }

      // End the stream
      res.end();
      console.log("SambaNova streaming response completed");
      return;
    } catch (streamError) {
      console.log(
        "Stream approach failed, falling back to non-streaming with simulated chunks:",
        streamError
      );

      // Fall back to non-streaming approach with simulated chunks
      const response = await sambanovaClient.chat.completions.create({
        model: config.model,
        messages: typedMessages,
        max_tokens: maxTokens,
        stream: false,
        temperature: 0.7,
      });

      const fullContent = response.choices[0].message.content || "";
      console.log(
        `Got full response of length ${fullContent.length}, simulating streaming`
      );

      // Simulate streaming by breaking the response into chunks
      const simulateStreaming = async (text: string) => {
        let fullResponse = "";

        // Split by sentences or reasonable chunks
        let chunks: string[] =
          text.match(/[^.!?]+[.!?]+|\s*[.!?]+\s*|[^.!?]+$/g) || [];

        if (chunks.length <= 1) {
          // If we couldn't split by sentences, split by words in groups of 10
          const words = text.split(/\s+/);
          chunks = []; // Reset chunks as a new string array

          for (let i = 0; i < words.length; i += 10) {
            chunks.push(words.slice(i, i + 10).join(" "));
          }
        }

        console.log(`Simulating streaming with ${chunks.length} chunks`);

        for (const chunk of chunks) {
          if (chunk.trim()) {
            fullResponse += chunk;

            // Send the chunk
            res.write(
              `data: ${JSON.stringify({
                id: messageId,
                type: "chunk",
                content: chunk,
                timestamp: new Date().toISOString(),
              })}\n\n`
            );

            // Force flush the response to ensure immediate delivery to client
            const expressRes = res as unknown as { flush?: () => void };
            if (expressRes.flush) {
              expressRes.flush();
            }

            // Add a small delay to simulate streaming
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        return fullResponse;
      };

      const simulatedResponse = await simulateStreaming(fullContent);

      // Save the assistant's response to the conversation history
      addMessageToSession(sessionId, "assistant", simulatedResponse);
      console.log(
        `Added assistant response to session ${sessionId} history (fallback method)`
      );

      // Send the completed message
      res.write(
        `data: ${JSON.stringify({
          id: messageId,
          type: "end",
          fullContent: simulatedResponse,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );

      // Mark this session as having sent KB to SambaNova
      if (!kbAlreadySent) {
        markSessionKBSent(sessionId);
        console.log(
          `Marked session ${sessionId} as having sent KB to SambaNova (fallback method)`
        );
        console.log(
          `[TOSKY] KB SENT SUCCESSFULLY to SambaNova for fallback session ${sessionId}`
        );
      }

      // End the stream
      res.end();
      console.log("Simulated SambaNova streaming response completed");
    }
  } catch (error) {
    console.error("Error streaming from SambaNova API:", error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to generate a streaming response from SambaNova",
      })}\n\n`
    );

    res.end();
  }
}

/**
 * Generate a chat response using the configured AI provider
 */
export async function generateChatResponse(
  message: string,
  maxTokens: number = 500,
  sessionId?: string
): Promise<string> {
  // Get the current knowledge base content
  const knowledgeBase = getKnowledgeBase();

  // Use provided session ID or generate a new one
  const currentSessionId = sessionId || generateSessionId();

  // Get the system prompt from the systemPrompt.ts file
  const systemContent = generateSystemPrompt(knowledgeBase);

  // Start with the system message
  const messages = [
    {
      role: "system",
      content: systemContent,
    },
  ];

  // Get existing conversation history from the session
  const sessionMessages = getSessionMessages(currentSessionId);

  // If we have conversation history, add it to the messages
  if (sessionMessages.length > 0) {
    console.log(
      `Adding ${sessionMessages.length} previous messages from session history`
    );
    messages.push(...sessionMessages);
  }

  // Add the user message to the session history first
  addMessageToSession(currentSessionId, "user", message);
  console.log(
    `Added user message to session ${currentSessionId} before generating response`
  );

  // Get updated session messages after adding the user message
  const updatedSessionMessages = getSessionMessages(currentSessionId);

  // Clear the messages array and rebuild it with the system message and updated session messages
  messages.length = 0;
  messages.push({
    role: "system",
    content: systemContent,
  });

  // Add all session messages (which now includes the user message we just added)
  if (updatedSessionMessages.length > 0) {
    console.log(
      `Adding ${updatedSessionMessages.length} messages from updated session history`
    );
    messages.push(...updatedSessionMessages);
  }

  // Log the current provider for debugging
  console.log(`Using AI provider: ${config.provider}`);
  console.log(`Using model: ${config.model}`);

  try {
    console.log(
      `Using session ID: ${currentSessionId} (${
        sessionId ? "from cookie" : "newly generated"
      })`
    );

    let response: string;

    if (config.provider === "openrouter") {
      console.log("Calling OpenRouter API");
      response = await generateOpenRouterResponse(messages);
    } else if (config.provider === "sambanova") {
      console.log("Calling SambaNova API");
      response = await generateSambanovaResponse(
        messages,
        maxTokens,
        currentSessionId
      );
    } else {
      console.log("Calling OpenAI API");
      response = await generateOpenAIResponse(messages);
    }

    // Save the assistant's response to the conversation history
    addMessageToSession(currentSessionId, "assistant", response);
    console.log(
      `Added assistant response to session ${currentSessionId} history`
    );

    return response;
  } catch (error) {
    console.error(
      `Error generating chat response with ${config.provider}:`,
      error
    );
    throw new Error("Failed to generate a response from the AI service.");
  }
}

/**
 * Stream a chat response using the configured AI provider
 */
export async function streamChatResponse(
  message: string,
  res: Response,
  sessionId?: string
): Promise<void> {
  // Get the current knowledge base content
  const knowledgeBase = getKnowledgeBase();

  // Use provided session ID or generate a new one
  const currentSessionId = sessionId || generateSessionId();

  // Get the system prompt from the systemPrompt.ts file
  const systemContent = generateSystemPrompt(knowledgeBase);

  // Start with the system message
  const messages = [
    {
      role: "system",
      content: systemContent,
    },
  ];

  // Get existing conversation history from the session
  const sessionMessages = getSessionMessages(currentSessionId);

  // If we have conversation history, add it to the messages
  if (sessionMessages.length > 0) {
    console.log(
      `Adding ${sessionMessages.length} previous messages from session history`
    );
    messages.push(...sessionMessages);
  }

  // Add the user message to the session history first
  addMessageToSession(currentSessionId, "user", message);
  console.log(
    `Added user message to session ${currentSessionId} before streaming`
  );

  // Get updated session messages after adding the user message
  const updatedSessionMessages = getSessionMessages(currentSessionId);

  // Clear the messages array and rebuild it with the system message and updated session messages
  messages.length = 0;
  messages.push({
    role: "system",
    content: systemContent,
  });

  // Add all session messages (which now includes the user message we just added)
  if (updatedSessionMessages.length > 0) {
    console.log(
      `Adding ${updatedSessionMessages.length} messages from updated session history`
    );
    messages.push(...updatedSessionMessages);
  }

  // Log the current provider for debugging
  console.log(`Streaming using AI provider: ${config.provider}`);
  console.log(`Streaming using model: ${config.model}`);

  try {
    if (config.provider === "openrouter") {
      console.log("Streaming with OpenRouter API");
      await streamOpenRouterResponse(
        messages,
        res,
        undefined,
        currentSessionId
      );
    } else if (config.provider === "sambanova") {
      console.log("Streaming with SambaNova API");
      // Pass the sessionId to the SambaNova streaming function if provided
      await streamSambanovaResponse(messages, res, undefined, currentSessionId);
    } else {
      console.log("Streaming with OpenAI API");
      await streamOpenAIResponse(messages, res, undefined, currentSessionId);
    }
  } catch (error) {
    console.error(
      `Error streaming chat response with ${config.provider}:`,
      error
    );

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: "Failed to generate a streaming response from the AI service",
      })}\n\n`
    );

    res.end();
  }
}

/**
 * Analyze a document using the configured AI provider
 */
export async function analyzeDocument(documentText: string): Promise<string> {
  const messages = [
    {
      role: "system",
      content: generateDocumentAnalysisPrompt(),
    },
    {
      role: "user",
      content: documentText,
    },
  ];

  try {
    if (config.provider === "openrouter") {
      return await generateOpenRouterResponse(messages);
    } else if (config.provider === "sambanova") {
      return await generateSambanovaResponse(messages);
    } else {
      return await generateOpenAIResponse(messages);
    }
  } catch (error) {
    console.error(`Error analyzing document with ${config.provider}:`, error);
    throw new Error("Failed to analyze the document with AI service.");
  }
}
