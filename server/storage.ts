import { users, conversions, type User, type InsertUser, type Conversion, type InsertConversion } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createConversion(conversion: InsertConversion): Promise<Conversion>;
  getConversion(id: number): Promise<Conversion | undefined>;
  getAllConversions(): Promise<Conversion[]>;
  updateConversion(id: number, updates: Partial<Conversion>): Promise<Conversion | undefined>;
  deleteConversion(id: number): Promise<boolean>;
  getConversionsByStatus(status: string): Promise<Conversion[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversions: Map<number, Conversion>;
  private currentUserId: number;
  private currentConversionId: number;

  constructor() {
    this.users = new Map();
    this.conversions = new Map();
    this.currentUserId = 1;
    this.currentConversionId = 1;
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

  async createConversion(insertConversion: InsertConversion): Promise<Conversion> {
    const id = this.currentConversionId++;
    const conversion: Conversion = {
      id,
      ...insertConversion,
      status: "pending",
      progress: 0,
      title: null,
      filePath: null,
      fileName: null,
      fileSize: null,
      errorMessage: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.conversions.set(id, conversion);
    return conversion;
  }

  async getConversion(id: number): Promise<Conversion | undefined> {
    return this.conversions.get(id);
  }

  async getAllConversions(): Promise<Conversion[]> {
    return Array.from(this.conversions.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateConversion(id: number, updates: Partial<Conversion>): Promise<Conversion | undefined> {
    const existing = this.conversions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.conversions.set(id, updated);
    return updated;
  }

  async deleteConversion(id: number): Promise<boolean> {
    return this.conversions.delete(id);
  }

  async getConversionsByStatus(status: string): Promise<Conversion[]> {
    return Array.from(this.conversions.values()).filter(
      (conversion) => conversion.status === status
    );
  }
}

export const storage = new MemStorage();
