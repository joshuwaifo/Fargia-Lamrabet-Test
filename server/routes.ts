// import type { Express } from "express";
// import { createServer, type Server as HttpServer } from "http";
// import { WebSocketServer, WebSocket } from "ws";
// import multer from "multer";
// import path from "path";
// import fs from "fs/promises";
// import * as XLSX from 'xlsx';
// import PptxParser from 'pptx-parser'; // Import pptx-parser
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

// const appUploadAllowedTypes = [
//   "application/pdf",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//   "application/msword",
//   "application/vnd.ms-powerpoint", // .ppt
//   "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
//   "text/plain",
//   "application/vnd.ms-excel",
//   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
// ];

// const GEMINI_ANALYZABLE_MIME_TYPES = [
//   "application/pdf",
//   "text/plain", // This will be the target for Excel and PPTX conversions
//   "text/markdown",
//   "text/html",
//   "text/css",
//   "application/x-javascript",
//   "text/javascript",
//   "application/javascript",
//   "application/json",
//   "text/x-python",
// ];

// const excelMimeTypes = [
//   "application/vnd.ms-excel",
//   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
// ];

// const pptxMimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
// const pptMimeType = "application/vnd.ms-powerpoint";

// const upload = multer({
//   dest: UPLOADS_DIR,
//   limits: {
//     fileSize: 50 * 1024 * 1024,
//   },
//   fileFilter: (req, file, cb) => {
//     if (appUploadAllowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           `Unsupported file type for server upload: ${file.mimetype}. Allowed types: ${appUploadAllowedTypes.join(", ")}.`,
//         ),
//       );
//     }
//   },
// });

// export async function registerRoutes(app: Express): Promise<HttpServer> {
//   // --- Document Upload Endpoint ---
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
//         res.status(201).json({
//           documents: uploadedDocs,
//           message: `${uploadedDocs.length} document(s) uploaded successfully.`,
//         });
//       } catch (error: any) {
//         console.error("[UploadError]", error);
//         if (error instanceof ZodError)
//           return res
//             .status(400)
//             .json({ message: "Invalid document data.", errors: error.errors });
//         res.status(500).json({
//           message: error.message || "Upload failed due to a server error.",
//         });
//       }
//     },
//   );

//   // --- Get All Documents ---
//   app.get("/api/documents", async (req, res) => {
//     try {
//       const documents = await storage.getDocuments();
//       res.json({ documents });
//     } catch (error: any) {
//       console.error("[GetDocsError]", error);
//       res.status(500).json({ message: "Failed to retrieve documents." });
//     }
//   });

//   // --- Delete Document ---
//   app.delete("/api/documents/:id", async (req, res) => {
//     try {
//       const id = parseInt(req.params.id);
//       if (isNaN(id))
//         return res.status(400).json({ message: "Invalid document ID." });
//       const document = await storage.getDocument(id);
//       if (!document)
//         return res.status(404).json({ message: "Document not found." });

//       try {
//         await fs.unlink(path.join(UPLOADS_DIR, document.filename));
//       } catch (fileError: any) {
//         console.warn(
//           `[DeleteDoc] Failed to delete file from FS: ${document.filename}`,
//           fileError.message,
//         );
//       }

//       const deleted = await storage.deleteDocument(id);
//       if (deleted && document.geminiFileId) {
//         try {
//           const apiKey =
//             process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//           if (apiKey) {
//             const fileIdOnly = document.geminiFileId.startsWith("files/")
//               ? document.geminiFileId.substring("files/".length)
//               : document.geminiFileId;
//             const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;
//             console.log(
//               `[GeminiDelete] Attempting Gemini file delete: ${deleteUrl}`,
//             );
//             const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });
//             if (deleteResponse.ok)
//               console.log(`[GeminiDelete] OK: ${document.geminiFileId}`);
//             else
//               console.warn(
//                 `[GeminiDelete] FAILED ${deleteResponse.status}: ${document.geminiFileId} - ${await deleteResponse.text()}`,
//               );
//           }
//         } catch (geminiDeleteError: any) {
//           console.error(
//             `[GeminiDelete] EXCEPTION: ${document.geminiFileId}`,
//             geminiDeleteError.message,
//           );
//         }
//       }
//       if (deleted) res.json({ message: "Document deleted successfully." });
//       else
//         res
//           .status(404)
//           .json({ message: "Document not found for DB deletion." });
//     } catch (error: any) {
//       console.error("[DeleteDocError]", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to delete document." });
//     }
//   });

//   // --- Process Documents ---
//   app.post("/api/documents/process", async (req, res) => {
//     try {
//       const documents = await storage.getDocuments();
//       const unprocessedDocs = documents.filter(
//         (doc) => !doc.processed || !doc.geminiFileId || !doc.geminiFileUri,
//       );
//       if (unprocessedDocs.length === 0)
//         return res.json({
//           message: "All documents processed with valid URIs or none to process.",
//           count: 0,
//         });

//       let processedCount = 0;
//       for (const doc of unprocessedDocs) {
//         console.log(
//           `[DocProcessEndpoint] Processing: ${doc.originalName} (ID: ${doc.id}, Type: ${doc.mimeType})`,
//         );
//         const success = await processDocumentWithGemini(doc);
//         if (success) {
//           processedCount++;
//           console.log(`[DocProcessEndpoint] SUCCESS: ${doc.originalName}`);
//         } else {
//           await storage.updateDocument(doc.id, { processed: false, geminiFileId: null, geminiFileUri: null });
//           console.warn(
//             `[DocProcessEndpoint] FAILED: ${doc.originalName}. Remains unprocessed.`,
//           );
//         }
//       }
//       res.json({
//         message: `${processedCount}/${unprocessedDocs.length} docs processed/re-processed with Gemini URI.`,
//         count: processedCount,
//       });
//     } catch (error: any) {
//       console.error("[ProcessDocsError]", error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to process documents." });
//     }
//   });

//   // --- Get Messages ---
//   app.get("/api/messages", async (req, res) => {
//     try {
//       const messages = await storage.getMessages();
//       res.json({ messages });
//     } catch (error: any) {
//       console.error("[GetMessagesError]", error);
//       res.status(500).json({ message: "Failed to retrieve messages." });
//     }
//   });
//   // --- Create Message (Primarily for non-WS, testing) ---
//   app.post("/api/messages", async (req, res) => {
//     try {
//       const messageData = insertMessageSchema.parse(req.body);
//       const message = await storage.createMessage(messageData);
//       res.status(201).json({ message });
//     } catch (error: any) {
//       console.error("[CreateMessageError]", error);
//       if (error instanceof ZodError)
//         return res
//           .status(400)
//           .json({ message: "Invalid message data.", errors: error.errors });
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to create message." });
//     }
//   });

//   // --- Quick Analysis Endpoint ---
//   app.post("/api/analysis/:type", async (req, res) => {
//     try {
//       const { type } = req.params;
//       const documents = await storage.getDocuments();
//       const processedDocs = documents.filter(
//         (doc) => doc.processed && doc.geminiFileId && doc.geminiFileUri,
//       );

//       const analyzableDocs = processedDocs.filter(doc => {
//         if (excelMimeTypes.includes(doc.mimeType) || doc.mimeType === pptxMimeType) {
//           return true; // These are converted to text/plain for Gemini
//         }
//         return GEMINI_ANALYZABLE_MIME_TYPES.includes(doc.mimeType);
//       });

//       if (analyzableDocs.length === 0)
//         return res
//           .status(400)
//           .json({ message: "No documents with supported MIME types (PDF, TXT, converted Excel/PPTX) found for analysis." });

//       console.log(
//         `[QuickAnalysisEndpoint] Type '${type}', Analyzable Docs: ${analyzableDocs.length} (out of ${processedDocs.length} processed)`,
//       );
//       const analysisResult = await performQuickAnalysis(type, analyzableDocs);
//       res.json({ analysis: analysisResult, analysisType: type });
//     } catch (error: any) {
//       console.error(`[QuickAnalysisError] Type ${req.params.type}:`, error);
//       res
//         .status(500)
//         .json({ message: error.message || "Failed to perform analysis." });
//     }
//   });

//   // --- ElevenLabs Voice Synthesis ---
//   app.post("/api/voice/synthesize", async (req, res) => {
//     try {
//       const { text } = req.body;
//       if (!text || typeof text !== "string" || text.trim() === "") {
//         return res.status(400).json({ message: "Text is required." });
//       }
//       const apiKey = process.env.ELEVENLABS_API_KEY;
//       if (!apiKey) {
//         console.warn("[ElevenLabs] API key not configured.");
//         return res
//           .status(503)
//           .json({ message: "Voice synthesis service not configured." });
//       }

//       const chloeVoiceId = "xNtG3W2oqJs0cJZuTyBc";
//       const voiceId = chloeVoiceId;

//       console.log(
//         `[ElevenLabs] Using Voice ID: ${voiceId} for text: "${text.substring(0, 30)}..."`,
//       );

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
//             stability: 0.5,
//             similarity_boost: 0.75,
//             style: 0.3,
//             use_speaker_boost: true,
//           },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error(
//           `[ElevenLabs] API Error ${response.status}: ${errorText}`,
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
//       console.error("[ElevenLabs] Internal Error:", error);
//       res
//         .status(500)
//         .json({ message: "Failed to synthesize voice.", error: error.message });
//     }
//   });

//   // --- WebSocket Server ---
//   const httpServer = createServer(app);
//   const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
//   wss.on("connection", (ws: WebSocket) => {
//     console.log("[WebSocket] Client connected.");
//     ws.on("message", async (data: Buffer) => {
//       let messagePayload;
//       try {
//         messagePayload = JSON.parse(data.toString());
//         console.log("[WebSocket] RX:", messagePayload);
//         if (messagePayload.type === "chat") {
//           if (!messagePayload.content?.trim()) {
//             if (ws.readyState === WebSocket.OPEN)
//               ws.send(
//                 JSON.stringify({
//                   type: "error",
//                   message: "Chat content empty.",
//                 }),
//               );
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
//             console.log("[WebSocket] TX AI Response:", aiMessage);
//             ws.send(
//               JSON.stringify({ type: "ai_response", message: aiMessage }),
//             );
//           }
//         }
//       } catch (error: any) {
//         console.error("[WebSocket] MsgProcError:", error.message, error.stack);
//         if (ws.readyState === WebSocket.OPEN)
//           ws.send(
//             JSON.stringify({
//               type: "error",
//               message: error.message || "Server error processing message.",
//             }),
//           );
//       }
//     });
//     ws.on("close", () => console.log("[WebSocket] Client disconnected."));
//     ws.on("error", (error) => console.error("[WebSocket] ConnError:", error));
//   });

//   return httpServer;
// }

// // --- Helper: Process Document with Gemini ---
// async function processDocumentWithGemini(
//   document: DbDocumentType,
// ): Promise<boolean> {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//   if (!apiKey) {
//     console.warn(
//       `[GeminiProcess] No API key. Skipping: ${document.originalName}`,
//     );
//     return false;
//   }
//   console.log(
//     `[GeminiProcess] START: ${document.originalName}. Mime: ${document.mimeType}, CurrentGeminiID: ${document.geminiFileId}, CurrentGeminiURI: ${document.geminiFileUri}`,
//   );

//   try {
//     const filePath = path.join(UPLOADS_DIR, document.filename);
//     let fileContentForGemini: Buffer;
//     let mimeTypeForGeminiUpload: string = document.mimeType;
//     let displayNameForGeminiUpload: string = document.originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");

//     if (excelMimeTypes.includes(document.mimeType)) {
//         console.log(`[GeminiProcess] Converting Excel file ${document.originalName} to CSV for Gemini.`);
//         const workbook = XLSX.readFile(filePath);
//         let allSheetsCsv = "";
//         for (const sheetName of workbook.SheetNames) {
//             allSheetsCsv += `--- SHEET: ${sheetName.replace(/[^a-zA-Z0-9_.-]/g, "_")} ---\n`; // Add sheet name marker
//             const worksheet = workbook.Sheets[sheetName];
//             const sheetCsv = XLSX.utils.sheet_to_csv(worksheet);
//             allSheetsCsv += sheetCsv + "\n\n"; // Add a couple of newlines between sheets
//         }
//         fileContentForGemini = Buffer.from(allSheetsCsv, 'utf-8');
//         mimeTypeForGeminiUpload = 'text/plain';
//         displayNameForGeminiUpload = `${displayNameForGeminiUpload}.sheets.csv.txt`;
//         console.log(`[GeminiProcess] Converted ${document.originalName} (all sheets) to CSV (text/plain). Size: ${fileContentForGemini.length} bytes.`);
//     } else if (document.mimeType === pptxMimeType) {
//         console.log(`[GeminiProcess] Extracting text from PPTX file ${document.originalName} for Gemini.`);
//         try {
//             const parser = new PptxParser();
//             const textContent = await parser.extractText(filePath);
//             if (!textContent || textContent.trim() === "") {
//                 console.warn(`[GeminiProcess] No text content extracted from PPTX ${document.originalName}. Skipping Gemini upload for this file.`);
//                  await storage.updateDocument(document.id, { processed: true, geminiFileId: null, geminiFileUri: null }); // Mark as processed but no Gemini URI
//                 return true; // Return true as we "processed" it by deciding not to send empty content.
//             }
//             fileContentForGemini = Buffer.from(textContent, 'utf-8');
//             mimeTypeForGeminiUpload = 'text/plain';
//             displayNameForGeminiUpload = `${displayNameForGeminiUpload}.extracted.txt`;
//             console.log(`[GeminiProcess] Extracted text from ${document.originalName}. Size: ${fileContentForGemini.length} bytes.`);
//         } catch (pptxError: any) {
//             console.error(`[GeminiProcess] Error extracting text from PPTX ${document.originalName}:`, pptxError.message);
//             return false; // Failed to process
//         }
//     } else if (document.mimeType === pptMimeType) {
//         console.warn(`[GeminiProcess] .ppt file (${document.originalName}) direct text extraction not supported. It will be stored on Gemini but likely not analyzable for content by the current AI model.`);
//         // We will still attempt to upload it to Gemini File API with its original MIME type
//         // It might be usable by other models or if Gemini adds support.
//         fileContentForGemini = await fs.readFile(filePath);
//         // mimeTypeForGeminiUpload and displayNameForGeminiUpload remain as original
//     }
//      else {
//         fileContentForGemini = await fs.readFile(filePath);
//     }

//     console.log(`[GeminiProcess] Uploading: ${displayNameForGeminiUpload} (as ${mimeTypeForGeminiUpload})`);
//     const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&file.displayName=${encodeURIComponent(displayNameForGeminiUpload)}`;

//     const uploadResponse = await fetch(uploadUrl, {
//       method: "POST",
//       headers: {
//         "X-Goog-Upload-Protocol": "raw",
//         "Content-Type": mimeTypeForGeminiUpload,
//       },
//       body: fileContentForGemini,
//     });

//     if (!uploadResponse.ok) {
//       const errorBody = await uploadResponse.text();
//       console.error(
//         `[GeminiProcess] Upload FAILED ${uploadResponse.status} for ${displayNameForGeminiUpload} (MIME: ${mimeTypeForGeminiUpload}): ${errorBody}`,
//       );
//       if (errorBody.toLowerCase().includes("mime") && errorBody.toLowerCase().includes("unsupported")) {
//           console.warn(`[GeminiProcess] Gemini File API itself rejected MIME type ${mimeTypeForGeminiUpload} for ${displayNameForGeminiUpload}.`);
//       }
//       return false;
//     }

//     const uploadResultJson = await uploadResponse.json();
//     const uploadedFile = uploadResultJson.file;

//     if (!uploadedFile || !uploadedFile.name || !uploadedFile.uri) {
//         console.error(`[GeminiProcess] Upload response for ${displayNameForGeminiUpload} missing name or uri:`, uploadedFile);
//         return false;
//     }

//     const geminiFileName = uploadedFile.name;
//     const geminiFileUriFromApi = uploadedFile.uri;
//     let fileState = uploadedFile.state;

//     console.log(
//       `[GeminiProcess] Upload OK: ${displayNameForGeminiUpload}. GeminiName: ${geminiFileName}, GeminiURI: ${geminiFileUriFromApi}, InitialState: ${fileState}`,
//     );

//     if (fileState !== "ACTIVE") {
//       let attempts = 0;
//       const maxAttempts = 10;
//       const pollIntervalBase = 3000;
//       const fileIdOnly = geminiFileName.split("/")[1];
//       const fileDetailsUri = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;

//       console.log(`[GeminiProcess] File ${geminiFileName} is not active. Will poll for ACTIVE state using URI: ${fileDetailsUri}`);

//       while (fileState !== "ACTIVE" && attempts < maxAttempts) {
//         const delay = pollIntervalBase + (attempts * 1000);
//         console.log(
//           `[GeminiProcess] Waiting ${delay / 1000}s before next status check for ${geminiFileName}. (Attempt ${attempts + 1}/${maxAttempts})`,
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
//               `[GeminiProcess] Failed to get file status for ${geminiFileName}: ${fileStatusResponse.status} ${errorText} (Attempt ${attempts})`,
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
//             `[GeminiProcess] Error checking file status for ${geminiFileName} (Attempt ${attempts}):`,
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
//         try {
//           await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`,
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
//     // Store both name and URI, and mark as processed.
//     await storage.updateDocument(document.id, {
//         geminiFileId: geminiFileName,
//         geminiFileUri: geminiFileUriFromApi,
//         processed: true
//     });
//     console.log(
//       `[GeminiProcess] SUCCESS: ${document.originalName} (processed as ${mimeTypeForGeminiUpload}). GeminiID: ${geminiFileName}, GeminiURI: ${geminiFileUriFromApi} is ACTIVE.`,
//     );
//     return true;
//   } catch (error: any) {
//     console.error(
//       `[GeminiProcess] CRITICAL ERROR for ${document.originalName}:`,
//       error.message,
//       error.stack,
//     );
//     await storage.updateDocument(document.id, { processed: false, geminiFileId: null, geminiFileUri: null });
//     return false;
//   }
// }

// // --- Helper: Generate AI Response ---
// async function generateAIResponse(userMessage: string) {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//   if (!apiKey) {
//     console.warn("[AIResponse] No Gemini API key.");
//     return {
//       content: "AI service not configured (no API key).",
//       referencedDocuments: [],
//     };
//   }

//   try {
//     const documents = await storage.getDocuments();
//     const processedAndUriAvailableDocs = documents.filter(
//       (doc) =>
//         doc.processed &&
//         doc.geminiFileId &&
//         doc.geminiFileUri &&
//         doc.geminiFileId.startsWith("files/"),
//     );

//     const analyzableDocs = processedAndUriAvailableDocs.filter(doc => {
//         if (excelMimeTypes.includes(doc.mimeType) || doc.mimeType === pptxMimeType) {
//             // These were converted to text/plain for Gemini analysis
//             return true;
//         }
//         // For .ppt, it would have been uploaded with its original MIME type.
//         // We only include it if Gemini can directly analyze that (unlikely for content, but we check).
//         // If we decide .ppt is *never* analyzable for content by this model, filter it out here.
//         // For now, let's assume if it's not Excel or PPTX, its original MIME must be in GEMINI_ANALYZABLE_MIME_TYPES.
//         if (doc.mimeType === pptMimeType) {
//             console.log(`[AIResponse] .ppt file ${doc.originalName} present; its content might not be deeply analyzable by Gemini unless it supports ppt directly via URI.`);
//             // Optionally, you could filter out .ppt here explicitly if you know Gemini won't parse its content well:
//             // return false;
//         }
//         return GEMINI_ANALYZABLE_MIME_TYPES.includes(doc.mimeType);
//     });

//     if (analyzableDocs.length === 0) {
//       let message = "No documents with content types I can directly analyze (e.g., PDF, TXT, data from Excel, text from PPTX) are ready. ";
//       if(processedAndUriAvailableDocs.length > 0) {
//         message += `${processedAndUriAvailableDocs.length} document(s) are processed but may have unsupported content types (like older .ppt or images if not handled) for direct Q&A.`;
//       } else {
//         message += "Please upload and process compatible documents first.";
//       }
//       console.log("[AIResponse] No analyzable documents found (including converted Excel/PPTX).");
//       return {
//         content: message,
//         referencedDocuments: [],
//       };
//     }

//     console.log(
//       `[AIResponse] Using ${analyzableDocs.length} analyzable docs (out of ${processedAndUriAvailableDocs.length} processed with URI) for: "${userMessage.substring(0, 50)}..."`,
//     );

//     const fileParts = analyzableDocs.map((doc) => {
//       let effectiveMimeType = doc.mimeType;
//       if (excelMimeTypes.includes(doc.mimeType) || doc.mimeType === pptxMimeType) {
//           effectiveMimeType = 'text/plain'; // The content Gemini will see is text
//       }
//       // For .ppt, we'd pass its original MIME; Gemini decides if it can use it.
//       console.log(
//         `[AIResponse] - Including Doc: ${doc.originalName} (Original MIME: ${doc.mimeType}, Effective MIME for Gemini: ${effectiveMimeType}), GeminiURI: ${doc.geminiFileUri}`,
//       );
//       return {
//         fileData: { mimeType: effectiveMimeType, fileUri: doc.geminiFileUri! },
//       };
//     });

//     const instructionText = `You are an AI Strategy Advisor. Your sole task is to answer the user's question strictly based on the information contained *only* within the provided documents.
//     - For documents that were originally Excel files, the content provided to you is a CSV (Comma Separated Values) representation of all spreadsheet data, with sheets indicated by '--- SHEET: [SheetName] ---'.
//     - For documents that were originally PowerPoint (.pptx) files, the content provided is extracted text from the slides.
//     - For other document types like PDF or plain text, you are seeing their direct content.
//     Do not use any external knowledge or make assumptions beyond what is written in these documents.
//     If the answer cannot be found in the documents, you MUST explicitly state that the information is not available in the provided materials, or that you cannot answer based on the documents.
//     Do not attempt to answer from general knowledge if the information is not in the documents. Be concise and direct.`;

//     const requestPayload = {
//       contents: [
//         {
//           parts: [
//             { text: instructionText },
//             ...fileParts,
//             { text: `User question: ${userMessage}` },
//           ],
//         },
//       ],
//       generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
//     };
//     const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

//     console.log(
//         "[AIResponse] Sending to Gemini. Request includes file URIs with effective MIME types like:",
//         fileParts.map(fp => ({ mimeType: fp.fileData.mimeType, fileUri: fp.fileData.fileUri.substring(0,40) + "..."}) )
//     );

//     const response = await fetch(geminiUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(requestPayload),
//     });

//     const responseBodyText = await response.text();
//     if (!response.ok) {
//       console.error(
//         `[AIResponse] Gemini API Error ${response.status}: ${responseBodyText}`,
//       );
//       let errorMessage = `Gemini API error (${response.status})`;
//       try {
//         const parsedError = JSON.parse(responseBodyText);
//         if (parsedError.error?.message)
//           errorMessage = `Gemini API error: ${parsedError.error.message}`;
//       } catch (e) {
//         errorMessage = `Gemini API error (${response.status}): ${responseBodyText.substring(0, 200)}...`;
//       }
//       throw new Error(errorMessage);
//     }

//     const result = JSON.parse(responseBodyText);
//     if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
//       if (result.promptFeedback?.blockReason) {
//         console.warn(
//           "[AIResponse] Gemini response BLOCKED:",
//           result.promptFeedback.blockReason,
//           result.promptFeedback.safetyRatings,
//         );
//         return {
//           content: `My response was blocked: ${result.promptFeedback.blockReason}. Rephrase or check docs. Safety Ratings: ${JSON.stringify(result.promptFeedback.safetyRatings)}`,
//           referencedDocuments: analyzableDocs.map((d) => d.originalName),
//         };
//       }
//       console.warn(
//         "[AIResponse] NO CONTENT in Gemini response:",
//         JSON.stringify(result, null, 2),
//       );
//       return {
//         content: "I couldn't formulate a response from the documents.",
//         referencedDocuments: analyzableDocs.map((d) => d.originalName),
//       };
//     }
//     const content = result.candidates[0].content.parts[0].text;
//     console.log(`[AIResponse] Gemini SUCCESS.`);
//     return {
//       content,
//       referencedDocuments: analyzableDocs.map((d) => d.originalName),
//     };
//   } catch (error: any) {
//     console.error(
//       "[AIResponse] Internal EXCEPTION:",
//       error.message,
//       error.stack,
//     );
//     return {
//       content: `Error processing your request with docs: ${error.message}. Try again.`,
//       referencedDocuments: [],
//     };
//   }
// }

// // --- Helper: Perform Quick Analysis ---
// async function performQuickAnalysis(
//   type: string,
//   documentsToAnalyze: DbDocumentType[],
// ) {
//   const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
//   if (!apiKey) {
//     console.warn("[QuickAnalysis] No API key.");
//     return "AI service not configured.";
//   }

//   if (documentsToAnalyze.length === 0) {
//     console.log("[QuickAnalysis] No analyzable docs with valid Gemini URIs.");
//     return "No documents with supported content types (PDF, TXT, data from Excel, text from PPTX) are available for this analysis.";
//   }

//   console.log(
//     `[QuickAnalysis] START '${type}', Analyzable Docs: ${documentsToAnalyze.length}`,
//   );

//   const fileParts = documentsToAnalyze.map((doc) => {
//     let effectiveMimeType = doc.mimeType;
//     if (excelMimeTypes.includes(doc.mimeType) || doc.mimeType === pptxMimeType) {
//         effectiveMimeType = 'text/plain';
//     }
//     console.log(
//       `[QuickAnalysis] - Including Doc: ${doc.originalName} (Original MIME: ${doc.mimeType}, Effective MIME for Gemini: ${effectiveMimeType}), GeminiURI: ${doc.geminiFileUri}`,
//     );
//     return {
//       fileData: { mimeType: effectiveMimeType, fileUri: doc.geminiFileUri! },
//     };
//   });

//   const analysisPrompts: Record<string, string> = {
//     summary:
//       "Provide a concise yet comprehensive summary of key points, main themes, and overarching strategy from the provided documents. If some documents are CSV representations of spreadsheets or extracted text from presentations, summarize the key data points, narratives or trends found within them.",
//     financial:
//       "Analyze financial data from the provided documents. If some are CSV representations of spreadsheets, focus on performance indicators, trends, key metrics, and financial health derived from that tabular data. If content is from presentations, look for financial statements or discussions. If no explicit financial data, state that.",
//     risks:
//       "Identify, list, and briefly assess potential risks, challenges, or concerns mentioned or implied in the provided strategy documents. This includes risks derivable from data in CSV representations of spreadsheets or text from presentations.",
//     recommendations:
//       "Based strictly on the information and analysis of the provided documents (including CSV data from spreadsheets and text from presentations), outline 3-5 key strategic recommendations or actionable insights. Justify each by document content.",
//   };
//   const baseInstruction =
//     analysisPrompts[type] ||
//     "Provide a general analysis of the provided documents, highlighting salient points. If some documents are CSV representations of spreadsheets or extracted text from presentations, analyze the data/text within them.";
//   const fullPrompt = `You are an AI Strategy Advisor. Strictly using content of provided documents, ${baseInstruction.toLowerCase()}
//   - For documents that were originally Excel files, the content provided to you is a CSV (Comma Separated Values) representation of all spreadsheet data, with sheets indicated by '--- SHEET: [SheetName] ---'.
//   - For documents that were originally PowerPoint (.pptx) files, the content provided is extracted text from the slides.
//   - For other document types like PDF or plain text, you are seeing their direct content.
//   Do not use external knowledge. If specific info absent, state that.`;

//   const requestPayload = {
//     contents: [{ parts: [{ text: fullPrompt }, ...fileParts] }],
//     generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
//   };
//   const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

//   console.log(
//     "[QuickAnalysis] Sending to Gemini. Request includes file URIs with effective MIME types like:",
//      fileParts.map(fp => ({ mimeType: fp.fileData.mimeType, fileUri: fp.fileData.fileUri.substring(0,40) + "..."}) )
//   );

//   try {
//     const response = await fetch(geminiUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(requestPayload),
//     });
//     const responseBodyText = await response.text();
//     if (!response.ok) {
//       console.error(
//         `[QuickAnalysis] Gemini API Error ${type}, ${response.status}: ${responseBodyText}`,
//       );
//       let errorMessage = `Gemini API error (${response.status})`;
//       try {
//         const parsedError = JSON.parse(responseBodyText);
//         if (parsedError.error?.message)
//           errorMessage = `Gemini API error: ${parsedError.error.message}`;
//       } catch (e) {
//          errorMessage = `Gemini API error (${response.status}): ${responseBodyText.substring(0, 200)}...`;
//       }
//       throw new Error(errorMessage);
//     }
//     const result = JSON.parse(responseBodyText);
//     if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
//       if (result.promptFeedback?.blockReason) {
//         console.warn(
//           `[QuickAnalysis] (${type}) BLOCKED:`,
//           result.promptFeedback.blockReason,
//           result.promptFeedback.safetyRatings,
//         );
//         return `My analysis was blocked: ${result.promptFeedback.blockReason}. Safety Ratings: ${JSON.stringify(result.promptFeedback.safetyRatings)}`;
//       }
//       console.warn(
//         `[QuickAnalysis] NO CONTENT in Gemini response (${type}):`,
//         JSON.stringify(result, null, 2),
//       );
//       return `Analysis for "${type}" couldn't be completed from docs.`;
//     }
//     console.log(`[QuickAnalysis] SUCCESS for type '${type}'.`);
//     return result.candidates[0].content.parts[0].text;
//   } catch (error: any) {
//     console.error(
//       `[QuickAnalysis] Internal EXCEPTION (${type}):`,
//       error.message,
//       error.stack,
//     );
//     return `Failed analysis for "${type}": ${error.message}. Try again.`;
//   }
// }

import type { Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as XLSX from "xlsx";
// mammoth package temporarily removed for deployment compatibility
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

const appUploadAllowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const GEMINI_ANALYZABLE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "application/x-javascript",
  "text/javascript",
  "application/javascript",
  "application/json",
  "text/x-python",
];

const excelMimeTypes = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const pptxMimeType =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const pptMimeType = "application/vnd.ms-powerpoint";

const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (appUploadAllowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type for server upload: ${file.mimetype}. Allowed types: ${appUploadAllowedTypes.join(", ")}.`,
        ),
      );
    }
  },
});

export async function registerRoutes(app: Express): Promise<HttpServer> {
  // Setup authentication
  const { setupAuth, isAuthenticated } = await import("./replitAuth");
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Return the authenticated user from session
      const user = req.session?.user;
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ message: "Not authenticated" });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
        (doc) => !doc.processed || !doc.geminiFileId || !doc.geminiFileUri,
      );
      if (unprocessedDocs.length === 0)
        return res.json({
          message:
            "All documents processed with valid URIs or none to process.",
          count: 0,
        });

      let processedCount = 0;
      for (const doc of unprocessedDocs) {
        console.log(
          `[DocProcessEndpoint] Processing: ${doc.originalName} (ID: ${doc.id}, Type: ${doc.mimeType})`,
        );
        const success = await processDocumentWithGemini(doc);
        if (success) {
          processedCount++;
          console.log(`[DocProcessEndpoint] SUCCESS: ${doc.originalName}`);
        } else {
          await storage.updateDocument(doc.id, {
            processed: false,
            geminiFileId: null,
            geminiFileUri: null,
          });
          console.warn(
            `[DocProcessEndpoint] FAILED: ${doc.originalName}. Remains unprocessed.`,
          );
        }
      }
      res.json({
        message: `${processedCount}/${unprocessedDocs.length} docs processed/re-processed with Gemini URI.`,
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
        (doc) => doc.processed && doc.geminiFileId && doc.geminiFileUri,
      );

      const analyzableDocs = processedDocs.filter((doc) => {
        if (
          excelMimeTypes.includes(doc.mimeType) ||
          doc.mimeType === pptxMimeType
        ) {
          return true;
        }
        return GEMINI_ANALYZABLE_MIME_TYPES.includes(doc.mimeType);
      });

      if (analyzableDocs.length === 0)
        return res
          .status(400)
          .json({
            message:
              "No documents with supported MIME types (PDF, TXT, converted Excel/PPTX) found for analysis.",
          });

      console.log(
        `[QuickAnalysisEndpoint] Type '${type}', Analyzable Docs: ${analyzableDocs.length} (out of ${processedDocs.length} processed)`,
      );
      const analysisResult = await performQuickAnalysis(type, analyzableDocs);
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

      const chloeVoiceId = "xNtG3W2oqJs0cJZuTyBc";
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
          model_id: "eleven_multilingual_v2",
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
      `[GeminiProcess] No API key. Skipping: ${document.originalName}`,
    );
    return false;
  }
  console.log(
    `[GeminiProcess] START: ${document.originalName}. Mime: ${document.mimeType}, CurrentGeminiID: ${document.geminiFileId}, CurrentGeminiURI: ${document.geminiFileUri}`,
  );

  try {
    const filePath = path.join(UPLOADS_DIR, document.filename);
    let fileContentForGemini: Buffer;
    let mimeTypeForGeminiUpload: string = document.mimeType;
    let displayNameForGeminiUpload: string = document.originalName.replace(
      /[^a-zA-Z0-9_.-]/g,
      "_",
    );

    if (excelMimeTypes.includes(document.mimeType)) {
      console.log(
        `[GeminiProcess] Converting Excel file ${document.originalName} to CSV for Gemini.`,
      );
      const workbook = XLSX.readFile(filePath);
      let allSheetsCsv = "";
      for (const sheetName of workbook.SheetNames) {
        allSheetsCsv += `--- SHEET: ${sheetName.replace(/[^a-zA-Z0-9_.-]/g, "_")} ---\n`;
        const worksheet = workbook.Sheets[sheetName];
        const sheetCsv = XLSX.utils.sheet_to_csv(worksheet);
        allSheetsCsv += sheetCsv + "\n\n";
      }
      fileContentForGemini = Buffer.from(allSheetsCsv, "utf-8");
      mimeTypeForGeminiUpload = "text/plain";
      displayNameForGeminiUpload = `${displayNameForGeminiUpload}.sheets.csv.txt`;
      console.log(
        `[GeminiProcess] Converted ${document.originalName} (all sheets) to CSV (text/plain). Size: ${fileContentForGemini.length} bytes.`,
      );
    } else if (document.mimeType === pptxMimeType) {
      console.log(
        `[GeminiProcess] Extracting text from PPTX file ${document.originalName} for Gemini.`,
      );
      try {
        // Note: PPTX text extraction temporarily disabled due to package dependency
        const textContent = "PPTX content extraction temporarily unavailable";
        if (!textContent || textContent.trim() === "") {
          console.warn(
            `[GeminiProcess] No text content extracted from PPTX ${document.originalName}. Marking as processed but not sending to Gemini.`,
          );
          await storage.updateDocument(document.id, {
            processed: true,
            geminiFileId: null,
            geminiFileUri: null,
          });
          return true;
        }
        fileContentForGemini = Buffer.from(textContent, "utf-8");
        mimeTypeForGeminiUpload = "text/plain";
        displayNameForGeminiUpload = `${displayNameForGeminiUpload}.extracted.txt`;
        console.log(
          `[GeminiProcess] Extracted text from ${document.originalName}. Size: ${fileContentForGemini.length} bytes.`,
        );
      } catch (pptxError: any) {
        console.error(
          `[GeminiProcess] Error extracting text from PPTX ${document.originalName} using Mammoth:`,
          pptxError.message,
        );
        return false;
      }
    } else if (document.mimeType === pptMimeType) {
      console.warn(
        `[GeminiProcess] .ppt file (${document.originalName}) direct text extraction not supported by Mammoth. It will be stored on Gemini as-is but likely not analyzable for content by the current AI model.`,
      );
      fileContentForGemini = await fs.readFile(filePath);
    } else {
      fileContentForGemini = await fs.readFile(filePath);
    }

    console.log(
      `[GeminiProcess] Uploading: ${displayNameForGeminiUpload} (as ${mimeTypeForGeminiUpload})`,
    );
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&file.displayName=${encodeURIComponent(displayNameForGeminiUpload)}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "raw",
        "Content-Type": mimeTypeForGeminiUpload,
      },
      body: fileContentForGemini,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text();
      console.error(
        `[GeminiProcess] Upload FAILED ${uploadResponse.status} for ${displayNameForGeminiUpload} (MIME: ${mimeTypeForGeminiUpload}): ${errorBody}`,
      );
      if (
        errorBody.toLowerCase().includes("mime") &&
        errorBody.toLowerCase().includes("unsupported")
      ) {
        console.warn(
          `[GeminiProcess] Gemini File API itself rejected MIME type ${mimeTypeForGeminiUpload} for ${displayNameForGeminiUpload}.`,
        );
      }
      return false;
    }

    const uploadResultJson = await uploadResponse.json();
    const uploadedFile = uploadResultJson.file;

    if (!uploadedFile || !uploadedFile.name || !uploadedFile.uri) {
      console.error(
        `[GeminiProcess] Upload response for ${displayNameForGeminiUpload} missing name or uri:`,
        uploadedFile,
      );
      return false;
    }

    const geminiFileName = uploadedFile.name;
    const geminiFileUriFromApi = uploadedFile.uri;
    let fileState = uploadedFile.state;

    console.log(
      `[GeminiProcess] Upload OK: ${displayNameForGeminiUpload}. GeminiName: ${geminiFileName}, GeminiURI: ${geminiFileUriFromApi}, InitialState: ${fileState}`,
    );

    if (fileState !== "ACTIVE") {
      let attempts = 0;
      const maxAttempts = 10;
      const pollIntervalBase = 3000;
      const fileIdOnly = geminiFileName.split("/")[1];
      const fileDetailsUri = `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`;

      console.log(
        `[GeminiProcess] File ${geminiFileName} is not active. Will poll for ACTIVE state using URI: ${fileDetailsUri}`,
      );

      while (fileState !== "ACTIVE" && attempts < maxAttempts) {
        const delay = pollIntervalBase + attempts * 1000;
        console.log(
          `[GeminiProcess] Waiting ${delay / 1000}s before next status check for ${geminiFileName}. (Attempt ${attempts + 1}/${maxAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempts++;
        try {
          const fileStatusResponse = await fetch(fileDetailsUri);
          if (fileStatusResponse.ok) {
            const fileStatusResult = await fileStatusResponse.json();
            fileState = fileStatusResult.file.state;
            console.log(
              `[GeminiProcess] File ${geminiFileName} status check attempt ${attempts}: ${fileState}`,
            );
          } else {
            const errorText = await fileStatusResponse.text();
            console.warn(
              `[GeminiProcess] Failed to get file status for ${geminiFileName}: ${fileStatusResponse.status} ${errorText} (Attempt ${attempts})`,
            );
            if (attempts === maxAttempts) {
              console.error(
                `[GeminiProcess] File ${geminiFileName} status check failed on last attempt. Marking processing as failed.`,
              );
              return false;
            }
          }
        } catch (statusError: any) {
          console.warn(
            `[GeminiProcess] Error checking file status for ${geminiFileName} (Attempt ${attempts}):`,
            statusError.message,
          );
          if (attempts === maxAttempts) {
            console.error(
              `[GeminiProcess] File ${geminiFileName} status check errored on last attempt. Marking processing as failed.`,
            );
            return false;
          }
        }
      }

      if (fileState !== "ACTIVE") {
        console.error(
          `[GeminiProcess] File ${geminiFileName} did not become ACTIVE after ${attempts} attempts. Last state: ${fileState}. Marking processing as failed.`,
        );
        try {
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/files/${fileIdOnly}?key=${apiKey}`,
            { method: "DELETE" },
          );
          console.log(
            `[GeminiProcess] Cleaned up stuck file ${geminiFileName} from Gemini.`,
          );
        } catch (cleanupError: any) {
          console.warn(
            `[GeminiProcess] Failed to cleanup stuck file ${geminiFileName}:`,
            cleanupError.message,
          );
        }
        return false;
      }
    }
    await storage.updateDocument(document.id, {
      geminiFileId: geminiFileName,
      geminiFileUri: geminiFileUriFromApi,
      processed: true,
    });
    console.log(
      `[GeminiProcess] SUCCESS: ${document.originalName} (processed as ${mimeTypeForGeminiUpload}). GeminiID: ${geminiFileName}, GeminiURI: ${geminiFileUriFromApi} is ACTIVE.`,
    );
    return true;
  } catch (error: any) {
    console.error(
      `[GeminiProcess] CRITICAL ERROR for ${document.originalName}:`,
      error.message,
      error.stack,
    );
    await storage.updateDocument(document.id, {
      processed: false,
      geminiFileId: null,
      geminiFileUri: null,
    });
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
    const processedAndUriAvailableDocs = documents.filter(
      (doc) =>
        doc.processed &&
        doc.geminiFileId &&
        doc.geminiFileUri &&
        doc.geminiFileId.startsWith("files/"),
    );

    const analyzableDocs = processedAndUriAvailableDocs.filter((doc) => {
      if (
        excelMimeTypes.includes(doc.mimeType) ||
        doc.mimeType === pptxMimeType
      ) {
        return true;
      }
      // Exclude .ppt from direct analysis here if we decide Mammoth won't give useful text
      // or if Gemini itself can't handle .ppt URIs for content.
      if (doc.mimeType === pptMimeType) {
        console.log(
          `[AIResponse] Excluding .ppt file ${doc.originalName} from direct Q&A context as its content is not reliably extracted to text.`,
        );
        return false;
      }
      return GEMINI_ANALYZABLE_MIME_TYPES.includes(doc.mimeType);
    });

    if (analyzableDocs.length === 0) {
      let message =
        "No documents with content types I can directly analyze (e.g., PDF, TXT, data from Excel, text from PPTX) are ready. ";
      if (processedAndUriAvailableDocs.length > 0) {
        const nonAnalyzableTypes = processedAndUriAvailableDocs
          .filter((d) => !analyzableDocs.find((ad) => ad.id === d.id))
          .map((d) => d.mimeType)
          .filter((value, index, self) => self.indexOf(value) === index); // Unique types
        if (nonAnalyzableTypes.length > 0) {
          message += `${processedAndUriAvailableDocs.length} document(s) are processed but may have unsupported content types (like ${nonAnalyzableTypes.join(", ")}) for direct Q&A.`;
        } else {
          message += `${processedAndUriAvailableDocs.length} document(s) are processed but could not be prepared for Q&A.`;
        }
      } else {
        message += "Please upload and process compatible documents first.";
      }
      console.log(
        "[AIResponse] No analyzable documents found (including converted Excel/PPTX).",
      );
      return {
        content: message,
        referencedDocuments: [],
      };
    }

    console.log(
      `[AIResponse] Using ${analyzableDocs.length} analyzable docs (out of ${processedAndUriAvailableDocs.length} processed with URI) for: "${userMessage.substring(0, 50)}..."`,
    );

    const fileParts = analyzableDocs.map((doc) => {
      let effectiveMimeType = doc.mimeType;
      if (
        excelMimeTypes.includes(doc.mimeType) ||
        doc.mimeType === pptxMimeType
      ) {
        effectiveMimeType = "text/plain";
      }
      console.log(
        `[AIResponse] - Including Doc: ${doc.originalName} (Original MIME: ${doc.mimeType}, Effective MIME for Gemini: ${effectiveMimeType}), GeminiURI: ${doc.geminiFileUri}`,
      );
      return {
        fileData: { mimeType: effectiveMimeType, fileUri: doc.geminiFileUri! },
      };
    });

    const instructionText = `You are an AI Strategy Advisor. Your sole task is to answer the user's question strictly based on the information contained *only* within the provided documents. 
    - For documents that were originally Excel files, the content provided to you is a CSV (Comma Separated Values) representation of all spreadsheet data, with sheets indicated by '--- SHEET: [SheetName] ---'.
    - For documents that were originally PowerPoint (.pptx) files, the content provided is extracted text from the slides.
    - For other document types like PDF or plain text, you are seeing their direct content.
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
      "[AIResponse] Sending to Gemini. Request includes file URIs with effective MIME types like:",
      fileParts.map((fp) => ({
        mimeType: fp.fileData.mimeType,
        fileUri: fp.fileData.fileUri.substring(0, 40) + "...",
      })),
    );

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
        errorMessage = `Gemini API error (${response.status}): ${responseBodyText.substring(0, 200)}...`;
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
          content: `My response was blocked: ${result.promptFeedback.blockReason}. Rephrase or check docs. Safety Ratings: ${JSON.stringify(result.promptFeedback.safetyRatings)}`,
          referencedDocuments: analyzableDocs.map((d) => d.originalName),
        };
      }
      console.warn(
        "[AIResponse] NO CONTENT in Gemini response:",
        JSON.stringify(result, null, 2),
      );
      return {
        content: "I couldn't formulate a response from the documents.",
        referencedDocuments: analyzableDocs.map((d) => d.originalName),
      };
    }
    const content = result.candidates[0].content.parts[0].text;
    console.log(`[AIResponse] Gemini SUCCESS.`);
    return {
      content,
      referencedDocuments: analyzableDocs.map((d) => d.originalName),
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
    console.log("[QuickAnalysis] No analyzable docs with valid Gemini URIs.");
    return "No documents with supported content types (PDF, TXT, data from Excel, text from PPTX) are available for this analysis.";
  }

  console.log(
    `[QuickAnalysis] START '${type}', Analyzable Docs: ${documentsToAnalyze.length}`,
  );

  const fileParts = documentsToAnalyze.map((doc) => {
    let effectiveMimeType = doc.mimeType;
    if (
      excelMimeTypes.includes(doc.mimeType) ||
      doc.mimeType === pptxMimeType
    ) {
      effectiveMimeType = "text/plain";
    }
    // For .ppt, we'd pass its original MIME. Let Gemini decide.
    console.log(
      `[QuickAnalysis] - Including Doc: ${doc.originalName} (Original MIME: ${doc.mimeType}, Effective MIME for Gemini: ${effectiveMimeType}), GeminiURI: ${doc.geminiFileUri}`,
    );
    return {
      fileData: { mimeType: effectiveMimeType, fileUri: doc.geminiFileUri! },
    };
  });

  const analysisPrompts: Record<string, string> = {
    summary:
      "Provide a concise yet comprehensive summary of key points, main themes, and overarching strategy from the provided documents. If some documents are CSV representations of spreadsheets or extracted text from presentations, summarize the key data points, narratives or trends found within them.",
    financial:
      "Analyze financial data from the provided documents. If some are CSV representations of spreadsheets, focus on performance indicators, trends, key metrics, and financial health derived from that tabular data. If content is from presentations, look for financial statements or discussions. If no explicit financial data, state that.",
    risks:
      "Identify, list, and briefly assess potential risks, challenges, or concerns mentioned or implied in the provided strategy documents. This includes risks derivable from data in CSV representations of spreadsheets or text from presentations.",
    recommendations:
      "Based strictly on the information and analysis of the provided documents (including CSV data from spreadsheets and text from presentations), outline 3-5 key strategic recommendations or actionable insights. Justify each by document content.",
  };
  const baseInstruction =
    analysisPrompts[type] ||
    "Provide a general analysis of the provided documents, highlighting salient points. If some documents are CSV representations of spreadsheets or extracted text from presentations, analyze the data/text within them.";
  const fullPrompt = `You are an AI Strategy Advisor. Strictly using content of provided documents, ${baseInstruction.toLowerCase()} 
  - For documents that were originally Excel files, the content provided to you is a CSV (Comma Separated Values) representation of all spreadsheet data, with sheets indicated by '--- SHEET: [SheetName] ---'.
  - For documents that were originally PowerPoint (.pptx) files, the content provided is extracted text from the slides.
  - For other document types like PDF or plain text, you are seeing their direct content.
  Do not use any external knowledge. If specific info absent, state that.`;

  const requestPayload = {
    contents: [{ parts: [{ text: fullPrompt }, ...fileParts] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  console.log(
    "[QuickAnalysis] Sending to Gemini. Request includes file URIs with effective MIME types like:",
    fileParts.map((fp) => ({
      mimeType: fp.fileData.mimeType,
      fileUri: fp.fileData.fileUri.substring(0, 40) + "...",
    })),
  );

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
      let errorMessage = `Gemini API error (${response.status})`;
      try {
        const parsedError = JSON.parse(responseBodyText);
        if (parsedError.error?.message)
          errorMessage = `Gemini API error: ${parsedError.error.message}`;
      } catch (e) {
        errorMessage = `Gemini API error (${response.status}): ${responseBodyText.substring(0, 200)}...`;
      }
      throw new Error(errorMessage);
    }
    const result = JSON.parse(responseBodyText);
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      if (result.promptFeedback?.blockReason) {
        console.warn(
          `[QuickAnalysis] (${type}) BLOCKED:`,
          result.promptFeedback.blockReason,
          result.promptFeedback.safetyRatings,
        );
        return `My analysis was blocked: ${result.promptFeedback.blockReason}. Safety Ratings: ${JSON.stringify(result.promptFeedback.safetyRatings)}`;
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
