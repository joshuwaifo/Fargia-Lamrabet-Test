// import type { Express } from "express";
// import { createServer, type Server as HttpServer } from "http";
// import { WebSocketServer, WebSocket } from "ws";
// import multer from "multer";
// import path from "path";
// import fs from "fs/promises";
// import { storage } from "./storage";
// import {
//   insertDocumentSchema,
//   insertMessageSchema,
//   Document as DbDocumentType,
// } from "@shared/schema";
// import { ZodError } from "zod";

// const UPLOADS_DIR = "uploads";

// // Ensure uploads directory exists
// (async () => {
//   try {
//     await fs.access(UPLOADS_DIR);
//   } catch {
//     await fs.mkdir(UPLOADS_DIR, { recursive: true });
//   }
// })();

// const upload = multer({
//   dest: UPLOADS_DIR,
//   limits: {
//     fileSize: 50 * 1024 * 1024, // 50MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       "application/pdf",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
//       "application/msword",
//       "application/vnd.ms-powerpoint", // .ppt
//       "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
//       "text/plain", // .txt
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           `Unsupported file type: ${file.mimetype}. Allowed types: PDF, DOCX, PPT, TXT.`,
//         ),
//       );
//     }
//   },
// });

// export async function registerRoutes(app: Express): Promise<HttpServer> {
//   // Document upload endpoint
//   app.post(
//     "/api/documents/upload",
//     upload.array("documents", 5),
//     async (req, res) => {
//       try {
//         if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
//           return res
//             .status(400)
//             .json({ message: "No files uploaded or files array is empty." });
//         }

//         const uploadedDocs = [];

//         for (const file of req.files as Express.Multer.File[]) {
//           const documentData = {
//             filename: file.filename,
//             originalName: file.originalname,
//             size: file.size,
//             mimeType: file.mimetype,
//           };

//           const validatedData = insertDocumentSchema.parse(documentData);
//           const document = await storage.createDocument(validatedData);
//           uploadedDocs.push(document);
//         }

//         res
//           .status(201)
//           .json({
//             documents: uploadedDocs,
//             message: `${uploadedDocs.length} document(s) uploaded successfully.`,
//           });
//       } catch (error: any) {
//         console.error("Upload error:", error);
//         if (error instanceof ZodError) {
//           return res
//             .status(400)
//             .json({ message: "Invalid document data.", errors: error.errors });
//         }
//         res
//           .status(500)
//           .json({
//             message: error.message || "Upload failed due to a server error.",
//           });
//       }
//     },
//   );

//   // Get all documents
//   app.get("/api/documents", async (req, res) => {
//     try {
//       const documents = await storage.getDocuments();
//       res.json({ documents });
//     } catch (error) {
//       console.error("Get documents error:", error);
//       res.status(500).json({ message: "Failed to retrieve documents." });
//     }
//   });

//   // Delete document
//   app.delete("/api/documents/:id", async (req, res) => {
//     try {
//       const id = parseInt(req.params.id);
//       if (isNaN(id)) {
//         return res.status(400).json({ message: "Invalid document ID." });
//       }
//       const document = await storage.getDocument(id);

//       if (!document) {
//         return res.status(404).json({ message: "Document not found." });
//       }

//       try {
//         await fs.unlink(path.join(UPLOADS_DIR, document.filename));
//       } catch (fileError: any) {
//         console.warn(
//           `Failed to delete file from filesystem: ${document.filename}`,
//           fileError.message,
//         );
//       }

//       const deleted = await storage.deleteDocument(id);
//       if (deleted) {
//         // Also attempt to delete from Gemini if geminiFileId exists
//         if (document.geminiFileId) {
//           try {
//             const apiKey =
//               process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//             if (apiKey) {
//               // The geminiFileId is stored as "files/your-file-id", so we need to extract "your-file-id"
//               const fileIdOnly = document.geminiFileId.startsWith("files/")
//                 ? document.geminiFileId.substring("files/".length)
//                 : document.geminiFileId;

//               const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;
//               console.log(
//                 `[GeminiDelete] Attempting to delete Gemini file: ${deleteUrl}`,
//               );
//               const deleteResponse = await fetch(deleteUrl, {
//                 method: "DELETE",
//               });
//               if (deleteResponse.ok) {
//                 console.log(
//                   `[GeminiDelete] Successfully deleted file ${document.geminiFileId} from Gemini.`,
//                 );
//               } else {
//                 const errorText = await deleteResponse.text();
//                 console.warn(
//                   `[GeminiDelete] Failed to delete file ${document.geminiFileId} from Gemini: ${deleteResponse.status} - ${errorText}`,
//                 );
//               }
//             }
//           } catch (geminiDeleteError: any) {
//             console.error(
//               `[GeminiDelete] Error deleting file ${document.geminiFileId} from Gemini:`,
//               geminiDeleteError.message,
//             );
//           }
//         }
//         res.json({ message: "Document deleted successfully." });
//       } else {
//         res
//           .status(404)
//           .json({ message: "Document not found in storage for deletion." });
//       }
//     } catch (error: any) {
//       console.error("Delete document error:", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to delete document." });
//     }
//   });

//   // Process documents with Gemini API
//   app.post("/api/documents/process", async (req, res) => {
//     try {
//       const documents = await storage.getDocuments();
//       const unprocessedDocs = documents.filter(
//         (doc) => !doc.processed || !doc.geminiFileId,
//       );

//       if (unprocessedDocs.length === 0) {
//         return res.json({
//           message:
//             "All documents are already processed or no documents to process.",
//           count: 0,
//         });
//       }

//       let processedCount = 0;
//       for (const doc of unprocessedDocs) {
//         console.log(
//           `[DocProcessEndpoint] Processing document: ${doc.originalName} (ID: ${doc.id})`,
//         );
//         const success = await processDocumentWithGemini(doc);
//         if (success) {
//           await storage.updateDocument(doc.id, { processed: true }); // geminiFileId is updated within processDocumentWithGemini
//           processedCount++;
//           console.log(
//             `[DocProcessEndpoint] Successfully processed and marked document: ${doc.originalName}`,
//           );
//         } else {
//           console.warn(
//             `[DocProcessEndpoint] Failed to process document: ${doc.originalName}. It will remain unprocessed.`,
//           );
//         }
//       }

//       res.json({
//         message: `${processedCount} of ${unprocessedDocs.length} documents newly processed/re-processed.`,
//         count: processedCount,
//       });
//     } catch (error: any) {
//       console.error("Process documents error:", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to process documents." });
//     }
//   });

//   // Chat endpoints
//   app.get("/api/messages", async (req, res) => {
//     try {
//       const messages = await storage.getMessages();
//       res.json({ messages });
//     } catch (error) {
//       console.error("Get messages error:", error);
//       res.status(500).json({ message: "Failed to retrieve messages." });
//     }
//   });

//   app.post("/api/messages", async (req, res) => {
//     try {
//       const messageData = insertMessageSchema.parse(req.body);
//       const message = await storage.createMessage(messageData);
//       res.status(201).json({ message });
//     } catch (error: any) {
//       console.error("Create message error:", error);
//       if (error instanceof ZodError) {
//         return res
//           .status(400)
//           .json({ message: "Invalid message data.", errors: error.errors });
//       }
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to create message." });
//     }
//   });

//   // Quick analysis endpoint
//   app.post("/api/analysis/:type", async (req, res) => {
//     try {
//       const { type } = req.params;
//       const documents = await storage.getDocuments();
//       const processedDocs = documents.filter(
//         (doc) => doc.processed && doc.geminiFileId,
//       );

//       if (processedDocs.length === 0) {
//         return res
//           .status(400)
//           .json({
//             message:
//               "No processed documents available for analysis. Please upload and process documents first.",
//           });
//       }

//       console.log(
//         `[QuickAnalysisEndpoint] Performing quick analysis type '${type}' using ${processedDocs.length} documents.`,
//       );
//       const analysisResult = await performQuickAnalysis(type, processedDocs);
//       res.json({ analysis: analysisResult, analysisType: type });
//     } catch (error: any) {
//       console.error(`Analysis error for type ${req.params.type}:`, error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to perform analysis." });
//     }
//   });

//   // ElevenLabs voice synthesis endpoint
//   app.post("/api/voice/synthesize", async (req, res) => {
//     try {
//       const { text } = req.body;

//       if (!text || typeof text !== "string" || text.trim() === "") {
//         return res
//           .status(400)
//           .json({ message: "Text is required and cannot be empty." });
//       }

//       const apiKey = process.env.ELEVENLABS_API_KEY;
//       if (!apiKey) {
//         console.warn(
//           "ElevenLabs API key not configured. Voice synthesis will be skipped or fallback.",
//         );
//         return res
//           .status(503)
//           .json({ message: "Voice synthesis service not configured." });
//       }

//       const voiceId = "21m00Tcm4TlvDq8ikWAM";
//       const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=0&output_format=mp3_44100_128`;

//       const response = await fetch(elevenLabsUrl, {
//         method: "POST",
//         headers: {
//           Accept: "audio/mpeg",
//           "Content-Type": "application/json",
//           "xi-api-key": apiKey,
//         },
//         body: JSON.stringify({
//           text: text,
//           model_id: "eleven_multilingual_v2",
//           voice_settings: {
//             stability: 0.55,
//             similarity_boost: 0.75,
//             style: 0.0,
//             use_speaker_boost: true,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error(
//           `ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`,
//         );
//         return res
//           .status(response.status)
//           .json({ message: `ElevenLabs API error: ${errorText}` });
//       }

//       const audioBuffer = await response.arrayBuffer();

//       res.set({
//         "Content-Type": "audio/mpeg",
//         "Content-Length": audioBuffer.byteLength.toString(),
//         "Cache-Control": "no-cache",
//       });

//       res.send(Buffer.from(audioBuffer));
//     } catch (error: any) {
//       console.error("Voice synthesis internal error:", error);
//       res
//         .status(500)
//         .json({
//           message:
//             "Failed to synthesize voice due to an internal server error.",
//           error: error.message,
//         });
//     }
//   });

//   const httpServer = createServer(app);

//   const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

//   wss.on("connection", (ws: WebSocket) => {
//     console.log("[WebSocket] Client connected.");

//     ws.on("message", async (data: Buffer) => {
//       let messagePayload;
//       try {
//         messagePayload = JSON.parse(data.toString());
//         console.log("[WebSocket] Received message:", messagePayload);

//         if (messagePayload.type === "chat") {
//           if (
//             !messagePayload.content ||
//             typeof messagePayload.content !== "string" ||
//             messagePayload.content.trim() === ""
//           ) {
//             if (ws.readyState === WebSocket.OPEN) {
//               ws.send(
//                 JSON.stringify({
//                   type: "error",
//                   message: "Chat content cannot be empty.",
//                 }),
//               );
//             }
//             return;
//           }

//           await storage.createMessage({
//             type: "user",
//             content: messagePayload.content,
//             referencedDocuments: messagePayload.referencedDocuments || [],
//           });

//           const aiResponse = await generateAIResponse(messagePayload.content);

//           const aiMessage = await storage.createMessage({
//             type: "assistant",
//             content: aiResponse.content,
//             referencedDocuments: aiResponse.referencedDocuments || [],
//           });

//           if (ws.readyState === WebSocket.OPEN) {
//             console.log(
//               "[WebSocket] Sending AI response to client:",
//               aiMessage,
//             );
//             ws.send(
//               JSON.stringify({
//                 type: "ai_response",
//                 message: aiMessage,
//               }),
//             );
//           }
//         }
//       } catch (error: any) {
//         console.error(
//           "[WebSocket] Message processing error:",
//           error.message,
//           error.stack,
//         );
//         if (ws.readyState === WebSocket.OPEN) {
//           ws.send(
//             JSON.stringify({
//               type: "error",
//               message:
//                 error.message ||
//                 "Failed to process message due to server error.",
//             }),
//           );
//         }
//       }
//     });

//     ws.on("close", () => {
//       console.log("[WebSocket] Client disconnected.");
//     });

//     ws.on("error", (error) => {
//       console.error("[WebSocket] Error on connection:", error);
//     });
//   });

//   return httpServer;
// }

// async function processDocumentWithGemini(
//   document: DbDocumentType,
// ): Promise<boolean> {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

//   if (!apiKey) {
//     console.warn(
//       "[GeminiProcess] No Gemini API key found. Document processing skipped for:",
//       document.originalName,
//     );
//     return false;
//   }
//   console.log(
//     `[GeminiProcess] Starting processing for ${document.originalName}. MimeType: ${document.mimeType}, Current GeminiFileId: ${document.geminiFileId}`,
//   );

//   try {
//     const filePath = path.join(UPLOADS_DIR, document.filename);
//     const fileContent = await fs.readFile(filePath);

//     console.log(
//       `[GeminiProcess] Uploading ${document.originalName} to Gemini File API.`,
//     );
//     const uploadResponse = await fetch(
//       `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
//       {
//         method: "POST",
//         headers: {
//           "X-Goog-Upload-Protocol": "raw",
//           "Content-Type": document.mimeType,
//         },
//         body: fileContent,
//       },
//     );

//     if (!uploadResponse.ok) {
//       const errorBody = await uploadResponse.text();
//       console.error(
//         `[GeminiProcess] Gemini file upload failed for ${document.originalName} (${uploadResponse.status}): ${errorBody}`,
//       );
//       return false;
//     }

//     const uploadResult = await uploadResponse.json();
//     const geminiFileName = uploadResult.file.name; // e.g. "files/your-file-id"
//     let fileState = uploadResult.file.state;
//     console.log(
//       `[GeminiProcess] File ${document.originalName} uploaded. Gemini Name: ${geminiFileName}, Initial State: ${fileState}`,
//     );

//     if (fileState !== "ACTIVE") {
//       let attempts = 0;
//       const maxAttempts = 8; // Increased attempts for longer processing files
//       const pollingIntervalBase = 3000; // Start with 3 seconds
//       const fileIdOnly = geminiFileName.split("/")[1];
//       const fileDetailsUri = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;

//       console.log(
//         `[GeminiProcess] File ${geminiFileName} is not active. Will poll for ACTIVE state.`,
//       );
//       while (fileState !== "ACTIVE" && attempts < maxAttempts) {
//         const delay = pollingIntervalBase * (attempts + 1); // Exponential backoff basic
//         console.log(
//           `[GeminiProcess] Waiting ${delay / 1000}s before next status check for ${geminiFileName}.`,
//         );
//         await new Promise((resolve) => setTimeout(resolve, delay));
//         attempts++;
//         try {
//           const fileStatusResponse = await fetch(fileDetailsUri);
//           if (fileStatusResponse.ok) {
//             const fileStatusResult = await fileStatusResponse.json();
//             fileState = fileStatusResult.file.state;
//             console.log(
//               `[GeminiProcess] File ${geminiFileName} status check attempt ${attempts}: ${fileState}`,
//             );
//           } else {
//             const errorText = await fileStatusResponse.text();
//             console.warn(
//               `[GeminiProcess] Failed to get file status for ${geminiFileName}: ${fileStatusResponse.status} ${errorText}`,
//             );
//             if (attempts === maxAttempts) {
//               console.error(
//                 `[GeminiProcess] File ${geminiFileName} status check failed on last attempt. Marking processing as failed.`,
//               );
//               return false;
//             }
//           }
//         } catch (statusError: any) {
//           console.warn(
//             `[GeminiProcess] Error checking file status for ${geminiFileName}:`,
//             statusError.message,
//           );
//           if (attempts === maxAttempts) {
//             console.error(
//               `[GeminiProcess] File ${geminiFileName} status check errored on last attempt. Marking processing as failed.`,
//             );
//             return false;
//           }
//         }
//       }

//       if (fileState !== "ACTIVE") {
//         console.error(
//           `[GeminiProcess] File ${geminiFileName} did not become ACTIVE after ${attempts} attempts. Last state: ${fileState}. Marking processing as failed.`,
//         );
//         // Delete the file from Gemini if it's stuck
//         try {
//           await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/files/${geminiFileName.split("/")[1]}?key=${apiKey}`,
//             { method: "DELETE" },
//           );
//           console.log(
//             `[GeminiProcess] Cleaned up stuck file ${geminiFileName} from Gemini.`,
//           );
//         } catch (cleanupError: any) {
//           console.warn(
//             `[GeminiProcess] Failed to cleanup stuck file ${geminiFileName}:`,
//             cleanupError.message,
//           );
//         }
//         return false;
//       }
//     }

//     await storage.updateDocument(document.id, { geminiFileId: geminiFileName });
//     console.log(
//       `[GeminiProcess] Document ${document.originalName} successfully processed with Gemini. File ID: ${geminiFileName} is ACTIVE.`,
//     );
//     return true;
//   } catch (error: any) {
//     console.error(
//       `[GeminiProcess] Critical error processing document ${document.originalName} with Gemini:`,
//       error.message,
//       error.stack,
//     );
//     return false;
//   }
// }

// async function generateAIResponse(userMessage: string) {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//   if (!apiKey) {
//     console.warn("[AIResponse] Gemini API key not found.");
//     return {
//       content:
//         "I'm sorry, but I need access to the Gemini API to analyze your documents and provide responses. Please ensure the API key is configured.",
//       referencedDocuments: [],
//     };
//   }

//   try {
//     const documents = await storage.getDocuments();
//     const processedDocs = documents.filter(
//       (doc) =>
//         doc.processed &&
//         doc.geminiFileId &&
//         doc.geminiFileId.startsWith("files/"),
//     );

//     if (processedDocs.length === 0) {
//       console.log(
//         "[AIResponse] No processed documents found with valid Gemini File IDs to answer the question.",
//       );
//       return {
//         content:
//           "I don't have any processed documents to reference for your question. Please upload and process documents first.",
//         referencedDocuments: [],
//       };
//     }

//     console.log(
//       `[AIResponse] Generating response using ${processedDocs.length} documents for: "${userMessage.substring(0, 50)}..."`,
//     );
//     processedDocs.forEach((doc) =>
//       console.log(
//         `[AIResponse] - Using doc: ${doc.originalName}, Gemini File ID: ${doc.geminiFileId}`,
//       ),
//     );

//     const fileParts = processedDocs.map((doc) => ({
//       fileData: {
//         mimeType: doc.mimeType,
//         fileUri: doc.geminiFileId!, // This should be the "name" like "files/xxxx"
//       },
//     }));

//     const instructionText = `You are an AI Strategy Advisor. Your sole task is to answer the user's question strictly based on the information contained *only* within the provided documents.
//     Do not use any external knowledge or make assumptions beyond what is written in these documents.
//     If the answer cannot be found in the documents, you MUST explicitly state that the information is not available in the provided materials, or that you cannot answer based on the documents.
//     Do not attempt to answer from general knowledge if the information is not in the documents.
//     Be concise and direct in your answers.`;

//     const contents = [
//       {
//         parts: [
//           { text: instructionText },
//           ...fileParts,
//           { text: `User question: ${userMessage}` },
//         ],
//       },
//     ];
//     const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

//     const response = await fetch(geminiUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         contents: contents,
//         generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
//       }),
//     });

//     const responseBodyText = await response.text(); // Read body once
//     if (!response.ok) {
//       console.error(
//         `[AIResponse] Gemini API error (${response.status}): ${responseBodyText}`,
//       );
//       try {
//         const parsedError = JSON.parse(responseBodyText);
//         if (parsedError.error?.message) {
//           throw new Error(`Gemini API error: ${parsedError.error.message}`);
//         }
//       } catch (e) {
//         /* ignore parsing error */
//       }
//       throw new Error(
//         `Gemini API error: ${response.statusText} - ${responseBodyText}`,
//       );
//     }

//     const result = JSON.parse(responseBodyText);
//     if (
//       !result.candidates ||
//       result.candidates.length === 0 ||
//       !result.candidates[0].content?.parts?.[0]?.text
//     ) {
//       if (result.promptFeedback?.blockReason) {
//         console.warn(
//           "[AIResponse] Gemini response blocked:",
//           result.promptFeedback.blockReason,
//           result.promptFeedback.safetyRatings,
//         );
//         return {
//           content: `My response was blocked due to: ${result.promptFeedback.blockReason}. Please rephrase your question or check document content.`,
//           referencedDocuments: [],
//         };
//       }
//       console.warn(
//         "[AIResponse] No content in Gemini response:",
//         JSON.stringify(result, null, 2),
//       );
//       return {
//         content:
//           "I apologize, but I couldn't formulate a response based on the provided documents at this time.",
//         referencedDocuments: processedDocs.map((d) => d.originalName),
//       };
//     }
//     const content = result.candidates[0].content.parts[0].text;
//     console.log(`[AIResponse] Successfully generated response from Gemini.`);
//     return {
//       content,
//       referencedDocuments: processedDocs.map((d) => d.originalName),
//     };
//   } catch (error: any) {
//     console.error(
//       "[AIResponse] Internal error during AI response generation:",
//       error.message,
//       error.stack,
//     );
//     return {
//       content: `I encountered an error while processing your request with the documents: ${error.message}. Please try again.`,
//       referencedDocuments: [],
//     };
//   }
// }

// async function performQuickAnalysis(
//   type: string,
//   documentsToAnalyze: DbDocumentType[],
// ) {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//   if (!apiKey) {
//     console.warn("[QuickAnalysis] Gemini API key not found.");
//     return "Analysis requires Gemini API access. Please configure your API key.";
//   }
//   if (documentsToAnalyze.length === 0) {
//     console.log("[QuickAnalysis] No documents to analyze.");
//     return "No processed documents are available for this analysis.";
//   }

//   console.log(
//     `[QuickAnalysis] Performing '${type}' using ${documentsToAnalyze.length} documents.`,
//   );
//   documentsToAnalyze.forEach((doc) =>
//     console.log(
//       `[QuickAnalysis] - Using doc: ${doc.originalName}, Gemini File ID: ${doc.geminiFileId}`,
//     ),
//   );

//   const fileParts = documentsToAnalyze.map((doc) => ({
//     fileData: { mimeType: doc.mimeType, fileUri: doc.geminiFileId! },
//   }));

//   const analysisPrompts: Record<string, string> = {
//     summary:
//       "Provide a concise yet comprehensive summary of the key points, main themes, and overarching strategy from the provided documents.",
//     financial:
//       "Analyze any financial data, statements, or projections present in the provided documents. Focus on performance indicators, trends, key metrics, and financial health. If no explicit financial data is present, clearly state that.",
//     risks:
//       "Identify, list,and briefly assess potential risks, challenges, or concerns mentioned or implied in the strategy documents provided.",
//     recommendations:
//       "Based strictly on the information and analysis of the provided documents, outline 3-5 key strategic recommendations or actionable insights. Each recommendation should be specific and justified by document content.",
//   };
//   const baseInstruction =
//     analysisPrompts[type] ||
//     "Provide a general analysis of the provided documents, highlighting the most salient points.";
//   const fullPrompt = `You are an AI Strategy Advisor. Strictly using the content of the provided documents, ${baseInstruction.toLowerCase()} Do not use external knowledge. If specific information is absent, state that.`;
//   const contents = [{ parts: [{ text: fullPrompt }, ...fileParts] }];

//   try {
//     const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
//     const response = await fetch(geminiUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         contents: contents,
//         generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
//       }),
//     });

//     const responseBodyText = await response.text(); // Read body once
//     if (!response.ok) {
//       console.error(
//         `[QuickAnalysis] Gemini API error for quick analysis (${type}, ${response.status}): ${responseBodyText}`,
//       );
//       throw new Error(
//         `Gemini API error: ${response.statusText} - ${responseBodyText}`,
//       );
//     }

//     const result = JSON.parse(responseBodyText);
//     if (
//       !result.candidates ||
//       result.candidates.length === 0 ||
//       !result.candidates[0].content?.parts?.[0]?.text
//     ) {
//       if (result.promptFeedback?.blockReason) {
//         console.warn(
//           `[QuickAnalysis] (${type}) blocked:`,
//           result.promptFeedback.blockReason,
//         );
//         return `My analysis was blocked due to: ${result.promptFeedback.blockReason}.`;
//       }
//       console.warn(
//         `[QuickAnalysis] No content in Gemini quick analysis response (${type}):`,
//         JSON.stringify(result, null, 2),
//       );
//       return `Analysis for "${type}" could not be completed based on the provided documents at this time.`;
//     }
//     console.log(
//       `[QuickAnalysis] Successfully generated analysis for type '${type}'.`,
//     );
//     return result.candidates[0].content.parts[0].text;
//   } catch (error: any) {
//     console.error(
//       `[QuickAnalysis] Internal error during quick analysis (${type}):`,
//       error.message,
//       error.stack,
//     );
//     return `Failed to perform analysis for "${type}" using the documents: ${error.message}. Please try again.`;
//   }
// }

import type { Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import {
  insertDocumentSchema,
  insertMessageSchema,
  Document as DbDocumentType,
} from "@shared/schema";
import { ZodError } from "zod";

const UPLOADS_DIR = "uploads";

// Ensure uploads directory exists
(async () => {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
})();

const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed types: PDF, DOCX, PPT, TXT.`,
        ),
      );
    }
  },
});

export async function registerRoutes(app: Express): Promise<HttpServer> {
  // --- Document Upload Endpoint ---
  app.post(
    "/api/documents/upload",
    upload.array("documents", 5),
    async (req, res) => {
      try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
          return res
            .status(400)
            .json({ message: "No files uploaded or files array is empty." });
        }
        const uploadedDocs = [];
        for (const file of req.files as Express.Multer.File[]) {
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
        res.status(201).json({
          documents: uploadedDocs,
          message: `${uploadedDocs.length} document(s) uploaded successfully.`,
        });
      } catch (error: any) {
        console.error("[UploadError]", error);
        if (error instanceof ZodError)
          return res
            .status(400)
            .json({ message: "Invalid document data.", errors: error.errors });
        res.status(500).json({
          message: error.message || "Upload failed due to a server error.",
        });
      }
    },
  );

  // --- Get All Documents ---
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json({ documents });
    } catch (error: any) {
      console.error("[GetDocsError]", error);
      res.status(500).json({ message: "Failed to retrieve documents." });
    }
  });

  // --- Delete Document ---
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid document ID." });
      const document = await storage.getDocument(id);
      if (!document)
        return res.status(404).json({ message: "Document not found." });

      try {
        await fs.unlink(path.join(UPLOADS_DIR, document.filename));
      } catch (fileError: any) {
        console.warn(
          `[DeleteDoc] Failed to delete file from FS: ${document.filename}`,
          fileError.message,
        );
      }

      const deleted = await storage.deleteDocument(id);
      if (deleted && document.geminiFileId) {
        try {
          const apiKey =
            process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
          if (apiKey) {
            const fileIdOnly = document.geminiFileId.startsWith("files/")
              ? document.geminiFileId.substring("files/".length)
              : document.geminiFileId;
            const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;
            console.log(
              `[GeminiDelete] Attempting Gemini file delete: ${deleteUrl}`,
            );
            const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });
            if (deleteResponse.ok)
              console.log(`[GeminiDelete] OK: ${document.geminiFileId}`);
            else
              console.warn(
                `[GeminiDelete] FAILED ${deleteResponse.status}: ${document.geminiFileId} - ${await deleteResponse.text()}`,
              );
          }
        } catch (geminiDeleteError: any) {
          console.error(
            `[GeminiDelete] EXCEPTION: ${document.geminiFileId}`,
            geminiDeleteError.message,
          );
        }
      }
      if (deleted) res.json({ message: "Document deleted successfully." });
      else
        res
          .status(404)
          .json({ message: "Document not found for DB deletion." });
    } catch (error: any) {
      console.error("[DeleteDocError]", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to delete document." });
    }
  });

  // --- Process Documents ---
  app.post("/api/documents/process", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const unprocessedDocs = documents.filter(
        (doc) => !doc.processed || !doc.geminiFileId,
      );
      if (unprocessedDocs.length === 0)
        return res.json({
          message: "All documents processed or none to process.",
          count: 0,
        });

      let processedCount = 0;
      for (const doc of unprocessedDocs) {
        console.log(
          `[DocProcessEndpoint] Processing: ${doc.originalName} (ID: ${doc.id})`,
        );
        const success = await processDocumentWithGemini(doc);
        if (success) {
          await storage.updateDocument(doc.id, { processed: true });
          processedCount++;
          console.log(`[DocProcessEndpoint] SUCCESS: ${doc.originalName}`);
        } else {
          console.warn(
            `[DocProcessEndpoint] FAILED: ${doc.originalName}. Remains unprocessed.`,
          );
        }
      }
      res.json({
        message: `${processedCount}/${unprocessedDocs.length} docs processed/re-processed.`,
        count: processedCount,
      });
    } catch (error: any) {
      console.error("[ProcessDocsError]", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to process documents." });
    }
  });

  // --- Get Messages ---
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json({ messages });
    } catch (error: any) {
      console.error("[GetMessagesError]", error);
      res.status(500).json({ message: "Failed to retrieve messages." });
    }
  });
  // --- Create Message (Primarily for non-WS, testing) ---
  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.status(201).json({ message });
    } catch (error: any) {
      console.error("[CreateMessageError]", error);
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ message: "Invalid message data.", errors: error.errors });
      res
        .status(500)
        .json({ message: error.message || "Failed to create message." });
    }
  });

  // --- Quick Analysis Endpoint ---
  app.post("/api/analysis/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const documents = await storage.getDocuments();
      const processedDocs = documents.filter(
        (doc) => doc.processed && doc.geminiFileId,
      );
      if (processedDocs.length === 0)
        return res
          .status(400)
          .json({ message: "No processed documents for analysis." });

      console.log(
        `[QuickAnalysisEndpoint] Type '${type}', Docs: ${processedDocs.length}`,
      );
      const analysisResult = await performQuickAnalysis(type, processedDocs);
      res.json({ analysis: analysisResult, analysisType: type });
    } catch (error: any) {
      console.error(`[QuickAnalysisError] Type ${req.params.type}:`, error);
      res
        .status(500)
        .json({ message: error.message || "Failed to perform analysis." });
    }
  });

  // --- ElevenLabs Voice Synthesis ---
  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({ message: "Text is required." });
      }
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.warn("[ElevenLabs] API key not configured.");
        return res
          .status(503)
          .json({ message: "Voice synthesis service not configured." });
      }

      const chloeVoiceId = "xNtG3W2oqJs0cJZuTyBc"; // Chloé Voice ID
      const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel as fallback (just in case)

      // Prefer Chloé if ID is explicitly set, otherwise use default.
      // You could also use an env var for Chloé's ID if you prefer:
      // const voiceId = process.env.ELEVENLABS_CHLOE_VOICE_ID || defaultVoiceId;
      const voiceId = chloeVoiceId;

      console.log(
        `[ElevenLabs] Using Voice ID: ${voiceId} for text: "${text.substring(0, 30)}..."`,
      );

      const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=0&output_format=mp3_44100_128`;
      const response = await fetch(elevenLabsUrl, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2", // Good for French and English
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ElevenLabs] API Error ${response.status}: ${errorText}`,
        );
        return res
          .status(response.status)
          .json({ message: `ElevenLabs API error: ${errorText}` });
      }
      const audioBuffer = await response.arrayBuffer();
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      });
      res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      console.error("[ElevenLabs] Internal Error:", error);
      res
        .status(500)
        .json({ message: "Failed to synthesize voice.", error: error.message });
    }
  });

  // --- WebSocket Server ---
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws: WebSocket) => {
    console.log("[WebSocket] Client connected.");
    ws.on("message", async (data: Buffer) => {
      let messagePayload;
      try {
        messagePayload = JSON.parse(data.toString());
        console.log("[WebSocket] RX:", messagePayload);
        if (messagePayload.type === "chat") {
          if (!messagePayload.content?.trim()) {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Chat content empty.",
                }),
              );
            return;
          }
          await storage.createMessage({
            type: "user",
            content: messagePayload.content,
            referencedDocuments: messagePayload.referencedDocuments || [],
          });
          const aiResponse = await generateAIResponse(messagePayload.content);
          const aiMessage = await storage.createMessage({
            type: "assistant",
            content: aiResponse.content,
            referencedDocuments: aiResponse.referencedDocuments || [],
          });
          if (ws.readyState === WebSocket.OPEN) {
            console.log("[WebSocket] TX AI Response:", aiMessage);
            ws.send(
              JSON.stringify({ type: "ai_response", message: aiMessage }),
            );
          }
        }
      } catch (error: any) {
        console.error("[WebSocket] MsgProcError:", error.message, error.stack);
        if (ws.readyState === WebSocket.OPEN)
          ws.send(
            JSON.stringify({
              type: "error",
              message: error.message || "Server error processing message.",
            }),
          );
      }
    });
    ws.on("close", () => console.log("[WebSocket] Client disconnected."));
    ws.on("error", (error) => console.error("[WebSocket] ConnError:", error));
  });

  return httpServer;
}

// --- Helper: Process Document with Gemini ---
async function processDocumentWithGemini(
  document: DbDocumentType,
): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[GeminiProcess] No API key. Skipping:",
      document.originalName,
    );
    return false;
  }
  console.log(
    `[GeminiProcess] START: ${document.originalName}. Mime: ${document.mimeType}, CurrentGeminiID: ${document.geminiFileId}`,
  );

  try {
    const filePath = path.join(UPLOADS_DIR, document.filename);
    const fileContent = await fs.readFile(filePath);

    console.log(`[GeminiProcess] Uploading: ${document.originalName}`);
    // Use a display name for the file during upload if desired
    const displayName = document.originalName.replace(/[^a-zA-Z0-9_.-]/g, "_"); // Sanitize display name
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&file.displayName=${encodeURIComponent(displayName)}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "raw",
        "Content-Type": document.mimeType,
      },
      body: fileContent,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      console.error(
        `[GeminiProcess] Upload FAILED ${uploadResponse.status} for ${document.originalName}: ${errorBody}`,
      );
      return false;
    }

    const uploadResult = await uploadResponse.json();
    const geminiFileName = uploadResult.file.name; // e.g., "files/your-file-id"
    let fileState = uploadResult.file.state;
    console.log(
      `[GeminiProcess] Upload OK: ${document.originalName}. GeminiName: ${geminiFileName}, InitialState: ${fileState}`,
    );

    if (fileState !== "ACTIVE") {
      let attempts = 0;
      const maxAttempts = 8;
      const pollIntervalBase = 3000;
      const fileIdOnly = geminiFileName.split("/")[1];
      const fileDetailsUri = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;
      console.log(`[GeminiProcess] Polling for ACTIVE: ${geminiFileName}`);

      while (fileState !== "ACTIVE" && attempts < maxAttempts) {
        const delay = pollIntervalBase * (attempts + 1);
        console.log(
          `[GeminiProcess] Wait ${delay / 1000}s for ${geminiFileName} (Attempt ${attempts + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempts++;
        try {
          const fileStatusResponse = await fetch(fileDetailsUri);
          if (fileStatusResponse.ok) {
            const fileStatusResult = await fileStatusResponse.json();
            fileState = fileStatusResult.file.state;
            console.log(
              `[GeminiProcess] Poll ${attempts} for ${geminiFileName}: State=${fileState}`,
            );
          } else {
            const errorText = await fileStatusResponse.text();
            console.warn(
              `[GeminiProcess] Poll ${attempts} FAILED ${fileStatusResponse.status} for ${geminiFileName}: ${errorText}`,
            );
            if (attempts === maxAttempts) {
              console.error(
                `[GeminiProcess] Poll FAILED on last attempt: ${geminiFileName}.`,
              );
              return false;
            }
          }
        } catch (statusError: any) {
          console.warn(
            `[GeminiProcess] Poll ${attempts} EXCEPTION for ${geminiFileName}:`,
            statusError.message,
          );
          if (attempts === maxAttempts) {
            console.error(
              `[GeminiProcess] Poll EXCEPTION on last attempt: ${geminiFileName}.`,
            );
            return false;
          }
        }
      }
      if (fileState !== "ACTIVE") {
        console.error(
          `[GeminiProcess] DID NOT BECOME ACTIVE: ${geminiFileName} after ${attempts} attempts. LastState: ${fileState}.`,
        );
        try {
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`,
            { method: "DELETE" },
          );
          console.log(
            `[GeminiProcess] Cleaned up stuck file: ${geminiFileName}`,
          );
        } catch (cleanupError: any) {
          console.warn(
            `[GeminiProcess] Failed cleanup for ${geminiFileName}:`,
            cleanupError.message,
          );
        }
        return false;
      }
    }
    await storage.updateDocument(document.id, { geminiFileId: geminiFileName });
    console.log(
      `[GeminiProcess] SUCCESS: ${document.originalName}. GeminiID: ${geminiFileName} is ACTIVE.`,
    );
    return true;
  } catch (error: any) {
    console.error(
      `[GeminiProcess] CRITICAL ERROR for ${document.originalName}:`,
      error.message,
      error.stack,
    );
    return false;
  }
}

// --- Helper: Generate AI Response ---
async function generateAIResponse(userMessage: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("[AIResponse] No Gemini API key.");
    return {
      content: "AI service not configured (no API key).",
      referencedDocuments: [],
    };
  }

  try {
    const documents = await storage.getDocuments();
    const processedDocs = documents.filter(
      (doc) =>
        doc.processed &&
        doc.geminiFileId &&
        doc.geminiFileId.startsWith("files/"),
    );
    if (processedDocs.length === 0) {
      console.log("[AIResponse] No processed docs with valid GeminiFileIDs.");
      return {
        content:
          "No documents are ready for me to use. Please upload and process them.",
        referencedDocuments: [],
      };
    }

    console.log(
      `[AIResponse] Using ${processedDocs.length} docs for: "${userMessage.substring(0, 50)}..."`,
    );
    processedDocs.forEach((doc) =>
      console.log(
        `[AIResponse] - Doc: ${doc.originalName}, GeminiID: ${doc.geminiFileId}`,
      ),
    );

    const fileParts = processedDocs.map((doc) => ({
      fileData: { mimeType: doc.mimeType, fileUri: doc.geminiFileId! },
    }));

    const instructionText = `You are an AI Strategy Advisor. Your sole task is to answer the user's question strictly based on the information contained *only* within the provided documents. 
    Do not use any external knowledge or make assumptions beyond what is written in these documents. 
    If the answer cannot be found in the documents, you MUST explicitly state that the information is not available in the provided materials, or that you cannot answer based on the documents.
    Do not attempt to answer from general knowledge if the information is not in the documents. Be concise and direct.`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: instructionText },
            ...fileParts,
            { text: `User question: ${userMessage}` },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
    };
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    console.log(
      "[AIResponse] Sending to Gemini. Full Payload:",
      JSON.stringify(requestPayload, null, 2),
    ); // Log full payload for debugging

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const responseBodyText = await response.text();
    if (!response.ok) {
      console.error(
        `[AIResponse] Gemini API Error ${response.status}: ${responseBodyText}`,
      );
      let errorMessage = `Gemini API error (${response.status})`;
      try {
        const parsedError = JSON.parse(responseBodyText);
        if (parsedError.error?.message)
          errorMessage = `Gemini API error: ${parsedError.error.message}`;
      } catch (e) {
        /* ignore parsing error */
      }
      throw new Error(errorMessage);
    }

    const result = JSON.parse(responseBodyText);
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      if (result.promptFeedback?.blockReason) {
        console.warn(
          "[AIResponse] Gemini response BLOCKED:",
          result.promptFeedback.blockReason,
          result.promptFeedback.safetyRatings,
        );
        return {
          content: `My response was blocked: ${result.promptFeedback.blockReason}. Rephrase or check docs.`,
          referencedDocuments: [],
        };
      }
      console.warn(
        "[AIResponse] NO CONTENT in Gemini response:",
        JSON.stringify(result, null, 2),
      );
      return {
        content: "I couldn't formulate a response from the docs.",
        referencedDocuments: processedDocs.map((d) => d.originalName),
      };
    }
    const content = result.candidates[0].content.parts[0].text;
    console.log(`[AIResponse] Gemini SUCCESS.`);
    return {
      content,
      referencedDocuments: processedDocs.map((d) => d.originalName),
    };
  } catch (error: any) {
    console.error(
      "[AIResponse] Internal EXCEPTION:",
      error.message,
      error.stack,
    );
    return {
      content: `Error processing your request with docs: ${error.message}. Try again.`,
      referencedDocuments: [],
    };
  }
}

// --- Helper: Perform Quick Analysis ---
async function performQuickAnalysis(
  type: string,
  documentsToAnalyze: DbDocumentType[],
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("[QuickAnalysis] No API key.");
    return "AI service not configured.";
  }
  if (documentsToAnalyze.length === 0) {
    console.log("[QuickAnalysis] No docs.");
    return "No processed docs for analysis.";
  }

  console.log(
    `[QuickAnalysis] START '${type}', Docs: ${documentsToAnalyze.length}`,
  );
  documentsToAnalyze.forEach((doc) =>
    console.log(
      `[QuickAnalysis] - Doc: ${doc.originalName}, GeminiID: ${doc.geminiFileId}`,
    ),
  );

  const fileParts = documentsToAnalyze.map((doc) => ({
    fileData: { mimeType: doc.mimeType, fileUri: doc.geminiFileId! },
  }));
  const analysisPrompts: Record<string, string> = {
    summary:
      "Provide a concise yet comprehensive summary of key points, main themes, and overarching strategy from the provided documents.",
    financial:
      "Analyze financial data, statements, or projections in the provided documents. Focus on performance indicators, trends, key metrics, and financial health. If no explicit financial data, state that.",
    risks:
      "Identify, list, and briefly assess potential risks, challenges, or concerns mentioned or implied in the provided strategy documents.",
    recommendations:
      "Based strictly on the information and analysis of the provided documents, outline 3-5 key strategic recommendations or actionable insights. Justify each by document content.",
  };
  const baseInstruction =
    analysisPrompts[type] ||
    "Provide a general analysis of the provided documents, highlighting salient points.";
  const fullPrompt = `You are an AI Strategy Advisor. Strictly using content of provided documents, ${baseInstruction.toLowerCase()} Do not use external knowledge. If specific info absent, state that.`;

  const requestPayload = {
    contents: [{ parts: [{ text: fullPrompt }, ...fileParts] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  console.log(
    "[QuickAnalysis] Sending to Gemini. Full Payload:",
    JSON.stringify(requestPayload, null, 2),
  ); // Log full payload

  try {
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });
    const responseBodyText = await response.text();
    if (!response.ok) {
      console.error(
        `[QuickAnalysis] Gemini API Error ${type}, ${response.status}: ${responseBodyText}`,
      );
      throw new Error(
        `Gemini API error: ${response.statusText} - ${responseBodyText}`,
      );
    }
    const result = JSON.parse(responseBodyText);
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      if (result.promptFeedback?.blockReason) {
        console.warn(
          `[QuickAnalysis] (${type}) BLOCKED:`,
          result.promptFeedback.blockReason,
        );
        return `My analysis was blocked: ${result.promptFeedback.blockReason}.`;
      }
      console.warn(
        `[QuickAnalysis] NO CONTENT in Gemini response (${type}):`,
        JSON.stringify(result, null, 2),
      );
      return `Analysis for "${type}" couldn't be completed from docs.`;
    }
    console.log(`[QuickAnalysis] SUCCESS for type '${type}'.`);
    return result.candidates[0].content.parts[0].text;
  } catch (error: any) {
    console.error(
      `[QuickAnalysis] Internal EXCEPTION (${type}):`,
      error.message,
      error.stack,
    );
    return `Failed analysis for "${type}": ${error.message}. Try again.`;
  }
}
