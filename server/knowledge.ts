import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads and returns the content of the knowledge base file
 */
export function getKnowledgeBase(): string {
  try {
    const knowledgeBasePath = path.join(__dirname, "knowledge_base.md");
    if (fs.existsSync(knowledgeBasePath)) {
      return fs.readFileSync(knowledgeBasePath, "utf8");
    } else {
      console.warn("Knowledge base file not found:", knowledgeBasePath);
      return "";
    }
  } catch (error) {
    console.error("Error reading knowledge base file:", error);
    return "";
  }
}

/**
 * Updates the knowledge base with new content
 */
export function updateKnowledgeBase(content: string): boolean {
  try {
    const knowledgeBasePath = path.join(__dirname, "knowledge_base.md");
    fs.writeFileSync(knowledgeBasePath, content, "utf8");
    return true;
  } catch (error) {
    console.error("Error updating knowledge base file:", error);
    return false;
  }
}

/**
 * Appends new content to the existing knowledge base
 */
export function appendToKnowledgeBase(content: string): boolean {
  try {
    const knowledgeBasePath = path.join(__dirname, "knowledge_base.md");
    const existingContent = fs.existsSync(knowledgeBasePath)
      ? fs.readFileSync(knowledgeBasePath, "utf8")
      : "";

    fs.writeFileSync(
      knowledgeBasePath,
      existingContent + "\n\n" + content,
      "utf8"
    );
    return true;
  } catch (error) {
    console.error("Error appending to knowledge base file:", error);
    return false;
  }
}
