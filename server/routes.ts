import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConversionSchema, bulkConversionSchema } from "@shared/schema";
import ytdl from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs-extra";
import archiver from "archiver";

// Ensure downloads directory exists
const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");
fs.ensureDirSync(DOWNLOADS_DIR);

// Configure ffmpeg path if needed (for production environments)
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all conversions
  app.get("/api/conversions", async (req, res) => {
    try {
      const conversions = await storage.getAllConversions();
      res.json(conversions);
    } catch (error) {
      console.error("Error fetching conversions:", error);
      res.status(500).json({ message: "Failed to fetch conversions" });
    }
  });

  // Create single conversion
  app.post("/api/conversions", async (req, res) => {
    try {
      const validatedData = insertConversionSchema.parse(req.body);
      
      // Validate YouTube URL
      if (!ytdl.validateURL(validatedData.url)) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      const conversion = await storage.createConversion(validatedData);
      
      // Start conversion process asynchronously
      processConversion(conversion.id).catch(console.error);
      
      res.json(conversion);
    } catch (error) {
      console.error("Error creating conversion:", error);
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Create bulk conversions
  app.post("/api/conversions/bulk", async (req, res) => {
    try {
      const validatedData = bulkConversionSchema.parse(req.body);
      
      const conversions = [];
      for (const url of validatedData.urls) {
        // Validate each YouTube URL
        if (!ytdl.validateURL(url)) {
          return res.status(400).json({ message: `Invalid YouTube URL: ${url}` });
        }
        
        const conversion = await storage.createConversion({ url });
        conversions.push(conversion);
        
        // Start conversion process asynchronously
        processConversion(conversion.id).catch(console.error);
      }
      
      res.json(conversions);
    } catch (error) {
      console.error("Error creating bulk conversions:", error);
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Get single conversion
  app.get("/api/conversions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversion = await storage.getConversion(id);
      
      if (!conversion) {
        return res.status(404).json({ message: "Conversion not found" });
      }
      
      res.json(conversion);
    } catch (error) {
      console.error("Error fetching conversion:", error);
      res.status(500).json({ message: "Failed to fetch conversion" });
    }
  });

  // Download single file
  app.get("/api/download/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversion = await storage.getConversion(id);
      
      if (!conversion || conversion.status !== "completed" || !conversion.filePath) {
        return res.status(404).json({ message: "File not found or conversion not completed" });
      }
      
      const filePath = path.join(DOWNLOADS_DIR, conversion.filePath);
      
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ message: "File no longer exists" });
      }
      
      res.download(filePath, conversion.fileName || "audio.mp3");
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Download multiple files as ZIP
  app.post("/api/download/bulk", async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid file IDs" });
      }
      
      const conversions = await Promise.all(
        ids.map(id => storage.getConversion(parseInt(id)))
      );
      
      const validConversions = conversions.filter(
        (conv): conv is NonNullable<typeof conv> => conv !== undefined && conv.status === "completed" && conv.filePath !== null
      );
      
      if (validConversions.length === 0) {
        return res.status(404).json({ message: "No valid files found for download" });
      }
      
      // Create ZIP archive
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.attachment("converted_files.zip");
      archive.pipe(res);
      
      for (const conversion of validConversions) {
        if (conversion && conversion.filePath) {
          const filePath = path.join(DOWNLOADS_DIR, conversion.filePath);
          if (await fs.pathExists(filePath)) {
            archive.file(filePath, { name: conversion.fileName || "audio.mp3" });
          }
        }
      }
      
      await archive.finalize();
    } catch (error) {
      console.error("Error creating bulk download:", error);
      res.status(500).json({ message: "Failed to create download archive" });
    }
  });

  // Delete conversion
  app.delete("/api/conversions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversion = await storage.getConversion(id);
      
      if (conversion && conversion.filePath) {
        const filePath = path.join(DOWNLOADS_DIR, conversion.filePath);
        await fs.remove(filePath).catch(() => {}); // Ignore errors if file doesn't exist
      }
      
      const deleted = await storage.deleteConversion(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Conversion not found" });
      }
      
      res.json({ message: "Conversion deleted successfully" });
    } catch (error) {
      console.error("Error deleting conversion:", error);
      res.status(500).json({ message: "Failed to delete conversion" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Process conversion function
async function processConversion(conversionId: number): Promise<void> {
  let conversion = await storage.getConversion(conversionId);
  if (!conversion) return;

  try {
    // Update status to processing
    await storage.updateConversion(conversionId, { 
      status: "processing", 
      progress: 5 
    });

    // Get video info
    const info = await ytdl.getInfo(conversion.url);
    const title = info.videoDetails.title.replace(/[^\w\s-]/g, "").trim();
    
    await storage.updateConversion(conversionId, { 
      title,
      progress: 15 
    });

    // Generate file paths
    const fileName = `${title}_${conversionId}.mp3`;
    const filePath = `${conversionId}_${Date.now()}.mp3`;
    const fullPath = path.join(DOWNLOADS_DIR, filePath);

    // Download and convert
    const audioStream = ytdl(conversion.url, { 
      filter: "audioonly",
      quality: "highestaudio" 
    });

    await new Promise((resolve, reject) => {
      ffmpeg(audioStream)
        .audioBitrate(128)
        .format("mp3")
        .on("progress", async (progress) => {
          const percentage = Math.min(Math.max(Math.round(progress.percent || 0), 15), 95);
          await storage.updateConversion(conversionId, { progress: percentage });
        })
        .on("end", resolve)
        .on("error", reject)
        .save(fullPath);
    });

    // Get file size
    const stats = await fs.stat(fullPath);
    const fileSize = stats.size;

    // Update conversion as completed
    await storage.updateConversion(conversionId, {
      status: "completed",
      progress: 100,
      filePath,
      fileName,
      fileSize,
      completedAt: new Date(),
    });

  } catch (error) {
    console.error(`Conversion ${conversionId} failed:`, error);
    await storage.updateConversion(conversionId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
