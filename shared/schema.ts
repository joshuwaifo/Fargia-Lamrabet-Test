// import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
// import { createInsertSchema } from "drizzle-zod";
// import { z } from "zod";

// export const users = pgTable("users", {
//   id: serial("id").primaryKey(),
//   username: text("username").notNull().unique(),
//   password: text("password").notNull(),
// });

// export const documents = pgTable("documents", {
//   id: serial("id").primaryKey(),
//   filename: text("filename").notNull(),
//   originalName: text("original_name").notNull(),
//   size: integer("size").notNull(),
//   mimeType: text("mime_type").notNull(),
//   uploadedAt: timestamp("uploaded_at").defaultNow(),
//   processed: boolean("processed").default(false),
//   geminiFileId: text("gemini_file_id"),
// });

// export const messages = pgTable("messages", {
//   id: serial("id").primaryKey(),
//   type: text("type").notNull(), // 'user' or 'assistant'
//   content: text("content").notNull(),
//   timestamp: timestamp("timestamp").defaultNow(),
//   referencedDocuments: text("referenced_documents").array(),
// });

// export const insertUserSchema = createInsertSchema(users).pick({
//   username: true,
//   password: true,
// });

// export const insertDocumentSchema = createInsertSchema(documents).pick({
//   filename: true,
//   originalName: true,
//   size: true,
//   mimeType: true,
// });

// export const insertMessageSchema = createInsertSchema(messages).pick({
//   type: true,
//   content: true,
//   referencedDocuments: true,
// });

// export type InsertUser = z.infer<typeof insertUserSchema>;
// export type User = typeof users.$inferSelect;
// export type InsertDocument = z.infer<typeof insertDocumentSchema>;
// export type Document = typeof documents.$inferSelect;
// export type InsertMessage = z.infer<typeof insertMessageSchema>;
// export type Message = typeof messages.$inferSelect;

import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  processed: boolean("processed").default(false),
  geminiFileId: text("gemini_file_id"), // This is the "name" like "files/xyz"
  geminiFileUri: text("gemini_file_uri"), // This will be the "uri" like "gs://bucket/file-id"
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  referencedDocuments: text("referenced_documents").array(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  filename: true,
  originalName: true,
  size: true,
  mimeType: true,
  // geminiFileId and geminiFileUri are not part of initial insert; they are set after processing.
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  type: true,
  content: true,
  referencedDocuments: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
