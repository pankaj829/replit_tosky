// Simple in-memory session management for SambaNova API calls
// This tracks whether a knowledge base has been sent to SambaNova for a particular session

interface Message {
  role: string;
  content: string;
}

interface Session {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  kbSentToSambaNova: boolean;
  messages: Message[]; // Store conversation history
}

// In-memory store for sessions
const sessions: Map<string, Session> = new Map();

// Session expiration time (in milliseconds) - 30 minutes
const SESSION_EXPIRATION = 30 * 60 * 1000;

/**
 * Create a new session or update an existing one
 */
export function createOrUpdateSession(
  sessionId: string,
  kbSent: boolean = false
): Session {
  const now = new Date();

  // Check if session exists
  const existingSession = sessions.get(sessionId);

  if (existingSession) {
    // Update existing session
    existingSession.lastUsedAt = now;
    if (kbSent) {
      existingSession.kbSentToSambaNova = true;
    }
    return existingSession;
  }

  // Create new session
  const newSession: Session = {
    id: sessionId,
    createdAt: now,
    lastUsedAt: now,
    kbSentToSambaNova: kbSent,
    messages: [], // Initialize empty messages array
  };

  sessions.set(sessionId, newSession);
  return newSession;
}

/**
 * Get a session by ID
 */
export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);

  if (!session) {
    return undefined;
  }

  // Check if session has expired
  const now = new Date();
  if (now.getTime() - session.lastUsedAt.getTime() > SESSION_EXPIRATION) {
    // Session expired, remove it
    sessions.delete(sessionId);
    return undefined;
  }

  // Update last used time
  session.lastUsedAt = now;
  return session;
}

/**
 * Check if a session exists and has sent KB to SambaNova
 */
export function hasSessionSentKB(sessionId: string): boolean {
  const session = getSession(sessionId);
  return session ? session.kbSentToSambaNova : false;
}

/**
 * Mark a session as having sent KB to SambaNova
 */
export function markSessionKBSent(sessionId: string): void {
  const session = getSession(sessionId);

  if (session) {
    session.kbSentToSambaNova = true;
  } else {
    // Create a new session and mark KB as sent
    createOrUpdateSession(sessionId, true);
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 15);
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export function cleanupExpiredSessions(): void {
  const now = new Date().getTime();

  for (const [id, session] of sessions.entries()) {
    if (now - session.lastUsedAt.getTime() > SESSION_EXPIRATION) {
      sessions.delete(id);
    }
  }
}

/**
 * Add a message to the session's conversation history
 */
export function addMessageToSession(
  sessionId: string,
  role: string,
  content: string
): void {
  let session = getSession(sessionId);

  if (!session) {
    // Create a new session if it doesn't exist
    console.log(`Creating new session for ID: ${sessionId}`);
    session = createOrUpdateSession(sessionId);
  }

  // Add the message to the conversation history
  session.messages.push({ role, content });
  console.log(`Added ${role} message to session ${sessionId}`);
  console.log(`Session now has ${session.messages.length} messages`);
}

/**
 * Get all messages for a session
 */
export function getSessionMessages(sessionId: string): Message[] {
  const session = getSession(sessionId);

  if (!session) {
    console.log(`No session found for ID: ${sessionId}`);
    return [];
  }

  console.log(
    `Retrieved ${session.messages.length} messages from session ${sessionId}`
  );
  console.log(
    "Session messages:",
    JSON.stringify(
      session.messages.map((m) => ({
        role: m.role,
        content: m.content.substring(0, 30) + "...",
      }))
    )
  );

  return session.messages;
}

/**
 * Clear a session by ID or create a new empty session
 */
export function clearSession(sessionId: string): string {
  // Delete the existing session if it exists
  if (sessions.has(sessionId)) {
    console.log(`Clearing session ${sessionId}`);
    sessions.delete(sessionId);
  } else {
    console.log(`No session found to clear for ID: ${sessionId}`);
  }

  // Generate a new session ID
  const newSessionId = generateSessionId();

  // Create a new empty session
  createOrUpdateSession(newSessionId);
  console.log(`Created new empty session with ID: ${newSessionId}`);

  return newSessionId;
}
