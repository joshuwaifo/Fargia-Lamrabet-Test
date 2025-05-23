import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import { insertDocumentSchema, insertMessageSchema } from "@shared/schema";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Document upload endpoint
  app.post("/api/documents/upload", upload.array("documents", 5), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedDocs = [];
      
      for (const file of req.files) {
        const documentData = {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        };

        const validatedData = insertDocumentSchema.parse(documentData);
        const document = await storage.createDocument(validatedData);
        uploadedDocs.push(document);
      }

      res.json({ documents: uploadedDocs });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Get all documents
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json({ documents });
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to retrieve documents" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete file from filesystem
      try {
        await fs.unlink(path.join("uploads", document.filename));
      } catch (fileError) {
        console.warn("Failed to delete file:", fileError);
      }

      const deleted = await storage.deleteDocument(id);
      if (deleted) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(404).json({ message: "Document not found" });
      }
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Process documents with Gemini API
  app.post("/api/documents/process", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const unprocessedDocs = documents.filter(doc => !doc.processed);

      if (unprocessedDocs.length === 0) {
        return res.json({ message: "No documents to process" });
      }

      // Process each document with Gemini API
      for (const doc of unprocessedDocs) {
        await processDocumentWithGemini(doc);
        await storage.updateDocument(doc.id, { processed: true });
      }

      res.json({ message: "Documents processed successfully", count: unprocessedDocs.length });
    } catch (error) {
      console.error("Process documents error:", error);
      res.status(500).json({ message: "Failed to process documents" });
    }
  });

  // Chat endpoints
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json({ messages });
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Failed to retrieve messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.json({ message });
    } catch (error) {
      console.error("Create message error:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Quick analysis endpoint
  app.post("/api/analysis/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const documents = await storage.getDocuments();
      
      if (documents.length === 0) {
        return res.status(400).json({ message: "No documents available for analysis" });
      }

      const analysis = await performQuickAnalysis(type, documents);
      res.json({ analysis });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to perform analysis" });
    }
  });

  // ElevenLabs voice synthesis endpoint
  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "ElevenLabs API key not configured" });
      }

      // Use a professional female voice (Rachel is a popular choice)
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice ID
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      });
      
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Voice synthesis error:", error);
      res.status(500).json({ message: "Failed to synthesize voice" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'chat') {
          // Store user message
          await storage.createMessage({
            type: 'user',
            content: message.content,
            referencedDocuments: message.referencedDocuments || [],
          });

          // Generate AI response
          const aiResponse = await generateAIResponse(message.content);
          
          // Store AI message
          const aiMessage = await storage.createMessage({
            type: 'assistant',
            content: aiResponse.content,
            referencedDocuments: aiResponse.referencedDocuments || [],
          });

          // Send response to client
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ai_response',
              message: aiMessage,
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  return httpServer;
}

async function processDocumentWithGemini(document: any) {
  // Implement Gemini API integration here
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.warn("No Gemini API key found. Document processing skipped.");
    return;
  }

  try {
    // Read the file content
    const filePath = path.join("uploads", document.filename);
    const fileContent = await fs.readFile(filePath);

    // Upload to Gemini Files API
    const uploadResponse = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": document.mimeType,
      },
      body: fileContent,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Gemini upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    
    // Update document with Gemini file ID
    await storage.updateDocument(document.id, {
      geminiFileId: uploadResult.file.name,
    });

    console.log(`Document ${document.originalName} processed with Gemini`);
  } catch (error) {
    console.error(`Failed to process document ${document.originalName}:`, error);
  }
}

async function generateAIResponse(userMessage: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    return {
      content: "I'm sorry, but I need access to the Gemini API to analyze your documents and provide responses. Please ensure the GEMINI_API_KEY is configured.",
      referencedDocuments: [],
    };
  }

  try {
    const documents = await storage.getDocuments();
    const processedDocs = documents.filter(doc => doc.processed && doc.geminiFileId);

    let prompt = `You are an AI Strategy Advisor. The user has uploaded ${documents.length} documents for analysis. `;
    
    if (processedDocs.length > 0) {
      prompt += `You have access to the following processed documents: ${processedDocs.map(d => d.originalName).join(", ")}. `;
    }
    
    prompt += `User question: ${userMessage}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response at this time.";

    return {
      content,
      referencedDocuments: processedDocs.map(d => d.originalName),
    };
  } catch (error) {
    console.error("AI response generation error:", error);
    return {
      content: "I encountered an error while processing your request. Please try again.",
      referencedDocuments: [],
    };
  }
}

async function performQuickAnalysis(type: string, documents: any[]) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    return "Analysis requires Gemini API access. Please configure your API key.";
  }

  const analysisPrompts = {
    summary: "Provide a comprehensive summary of the uploaded documents, highlighting key points and main themes.",
    financial: "Analyze the financial data in the documents, focusing on performance indicators, trends, and key metrics.",
    risks: "Identify and assess potential risks mentioned or implied in the strategy documents.",
    recommendations: "Based on the document analysis, provide strategic recommendations and actionable insights.",
  };

  const prompt = analysisPrompts[type as keyof typeof analysisPrompts] || "Provide a general analysis of the documents.";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${prompt} Base your analysis on the ${documents.length} uploaded documents.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis could not be completed.";
  } catch (error) {
    console.error("Quick analysis error:", error);
    return "Failed to perform analysis. Please try again.";
  }
}
