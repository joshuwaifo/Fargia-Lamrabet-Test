// import { users, documents, messages, type User, type InsertUser, type Document, type InsertDocument, type Message, type InsertMessage } from "@shared/schema";

// export interface IStorage {
//   getUser(id: number): Promise<User | undefined>;
//   getUserByUsername(username: string): Promise<User | undefined>;
//   createUser(user: InsertUser): Promise<User>;

//   createDocument(document: InsertDocument): Promise<Document>;
//   getDocuments(): Promise<Document[]>;
//   getDocument(id: number): Promise<Document | undefined>;
//   updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined>;
//   deleteDocument(id: number): Promise<boolean>;

//   createMessage(message: InsertMessage): Promise<Message>;
//   getMessages(): Promise<Message[]>;
//   clearMessages(): Promise<void>;
// }

// export class MemStorage implements IStorage {
//   private users: Map<number, User>;
//   private documents: Map<number, Document>;
//   private messages: Map<number, Message>;
//   private currentUserId: number;
//   private currentDocumentId: number;
//   private currentMessageId: number;

//   constructor() {
//     this.users = new Map();
//     this.documents = new Map();
//     this.messages = new Map();
//     this.currentUserId = 1;
//     this.currentDocumentId = 1;
//     this.currentMessageId = 1;
//   }

//   async getUser(id: number): Promise<User | undefined> {
//     return this.users.get(id);
//   }

//   async getUserByUsername(username: string): Promise<User | undefined> {
//     return Array.from(this.users.values()).find(
//       (user) => user.username === username,
//     );
//   }

//   async createUser(insertUser: InsertUser): Promise<User> {
//     const id = this.currentUserId++;
//     const user: User = { ...insertUser, id };
//     this.users.set(id, user);
//     return user;
//   }

//   async createDocument(insertDocument: InsertDocument): Promise<Document> {
//     const id = this.currentDocumentId++;
//     const document: Document = {
//       ...insertDocument,
//       id,
//       uploadedAt: new Date(),
//       processed: false,
//       geminiFileId: null,
//     };
//     this.documents.set(id, document);
//     return document;
//   }

//   async getDocuments(): Promise<Document[]> {
//     return Array.from(this.documents.values()).sort(
//       (a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0)
//     );
//   }

//   async getDocument(id: number): Promise<Document | undefined> {
//     return this.documents.get(id);
//   }

//   async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
//     const document = this.documents.get(id);
//     if (!document) return undefined;

//     const updatedDocument = { ...document, ...updates };
//     this.documents.set(id, updatedDocument);
//     return updatedDocument;
//   }

//   async deleteDocument(id: number): Promise<boolean> {
//     return this.documents.delete(id);
//   }

//   async createMessage(insertMessage: InsertMessage): Promise<Message> {
//     const id = this.currentMessageId++;
//     const message: Message = {
//       ...insertMessage,
//       id,
//       timestamp: new Date(),
//     };
//     this.messages.set(id, message);
//     return message;
//   }

//   async getMessages(): Promise<Message[]> {
//     return Array.from(this.messages.values()).sort(
//       (a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0)
//     );
//   }

//   async clearMessages(): Promise<void> {
//     this.messages.clear();
//   }
// }

// export const storage = new MemStorage();

import {
  users,
  documents,
  messages,
  type User,
  type InsertUser,
  type Document,
  type InsertDocument,
  type Message,
  type InsertMessage,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createDocument(document: InsertDocument): Promise<Document>;
  getDocuments(): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  updateDocument(
    id: number,
    updates: Partial<Document>,
  ): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(): Promise<Message[]>;
  clearMessages(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentDocumentId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentDocumentId = 1;
    this.currentMessageId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const document: Document = {
      ...insertDocument,
      id,
      uploadedAt: new Date(),
      processed: false,
      geminiFileId: null,
      geminiFileUri: null, // Initialize the new field
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0),
    );
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async updateDocument(
    id: number,
    updates: Partial<Document>,
  ): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;

    const updatedDocument = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort(
      (a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0),
    );
  }

  async clearMessages(): Promise<void> {
    this.messages.clear();
  }
}

export const storage = new MemStorage();
