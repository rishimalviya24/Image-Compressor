require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// CORS
app.use(cors({
  origin: ["https://image-compressor-uonh.onrender.com", "http://localhost:5173"],
  credentials: true,
}));

// MongoDB Connection
console.log("MongoDB: Connecting...");
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Enhanced Image Schema
const imageSchema = new mongoose.Schema({
  originalName: String,
  originalSize: Number,
  compressedSize: Number,
  compressionRatio: Number,
  originalPath: String,
  compressedPath: String,
  aiRegions: Array,
  format: String,
  quality: Number,
  aiSuggestion: String,
  promptUsed: String,
  createdAt: { type: Date, default: Date.now }
});
const Image = mongoose.model('Image', imageSchema);

// Enhanced Multer config for batch uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'original-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  }
});

// AI Region Detection
async function detectRegions(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/detr-resnet-50',
      imageBuffer,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error('AI region detection error:', error.message);
    return [];
  }
}

// AI Format Recommendation using Gemini
async function getAIFormatRecommendation(imagePath, detectedObjects = []) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const objectsList = detectedObjects.map(obj => obj.label).join(', ');
    const prompt = `Analyze this image content and recommend the best format for compression:
    
    Detected objects: ${objectsList || 'general image'}
    
    Consider these factors:
    - WebP: Good for web use, smaller file sizes, good quality
    - AVIF: Next-gen format, excellent compression but limited browser support
    - JPEG: Universal compatibility, good for photos
    - PNG: Best for images with transparency or text
    
    Respond with ONLY the recommended format (webp, avif, jpeg, or png) and a brief reason in this format:
    FORMAT: [format]
    REASON: [brief explanation]`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const formatMatch = response.match(/FORMAT:\s*(\w+)/i);
    const reasonMatch = response.match(/REASON:\s*(.+)/i);
    
    return {
      format: formatMatch ? formatMatch[1].toLowerCase() : 'webp',
      reason: reasonMatch ? reasonMatch[1].trim() : 'Optimized for web use'
    };
  } catch (error) {
    console.error('AI format recommendation error:', error);
    return { format: 'webp', reason: 'Default web optimization' };
  }
}

// AI Quality Recommendation using Gemini
async function getAIQualityRecommendation(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const aiPrompt = `Based on this user request: "${prompt}"
    
    Recommend compression settings for image optimization:
    - Quality (0-100): Higher for print/professional, lower for web/email
    - Format preference: webp, avif, jpeg, or png
    - Use case context
    
    Respond ONLY in this format:
    QUALITY: [number 0-100]
    FORMAT: [format]
    CONTEXT: [brief explanation]`;

    const result = await model.generateContent(aiPrompt);
    const response = result.response.text();
    
    const qualityMatch = response.match(/QUALITY:\s*(\d+)/i);
    const formatMatch = response.match(/FORMAT:\s*(\w+)/i);
    const contextMatch = response.match(/CONTEXT:\s*(.+)/i);
    
    return {
      quality: qualityMatch ? parseInt(qualityMatch[1]) : 80,
      format: formatMatch ? formatMatch[1].toLowerCase() : 'webp',
      context: contextMatch ? contextMatch[1].trim() : 'Balanced optimization'
    };
  } catch (error) {
    console.error('AI quality recommendation error:', error);
    return { quality: 80, format: 'webp', context: 'Default optimization' };
  }
}

// Enhanced Smart Compression
async function adaptiveCompress(imagePath, regions = [], targetFormat = 'webp', targetQuality = 80) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Adjust quality based on important regions
    const importantLabels = ['person', 'face', 'text', 'book', 'laptop', 'cell phone'];
    const hasImportantRegions = regions.some(region =>
      importantLabels.some(label =>
        region.label && region.label.toLowerCase().includes(label)
      )
    );
    
    if (hasImportantRegions && targetQuality < 90) {
      targetQuality = Math.min(targetQuality + 10, 95);
    }

    const compressedPath = imagePath.replace('original-', `compressed-${targetFormat}-`);
    let compressedBuffer;

    // Apply format-specific compression
    switch (targetFormat) {
      case 'webp':
        compressedBuffer = await image
          .webp({ quality: targetQuality, effort: 6 })
          .toBuffer();
        break;
      case 'avif':
        compressedBuffer = await image
          .avif({ quality: targetQuality, effort: 9 })
          .toBuffer();
        break;
      case 'png':
        compressedBuffer = await image
          .png({ compressionLevel: Math.floor((100 - targetQuality) / 10) })
          .toBuffer();
        break;
      default: // jpeg
        compressedBuffer = await image
          .jpeg({ quality: targetQuality, progressive: true, mozjpeg: true })
          .toBuffer();
    }

    await sharp(compressedBuffer).toFile(compressedPath);
    
    return {
      compressedPath,
      compressedSize: compressedBuffer.length,
      quality: targetQuality,
      format: targetFormat
    };
  } catch (error) {
    console.error('Compression error:', error);
    throw error;
  }
}

// Root Route
app.get('/', (req, res) => {
  res.send("✅ Enhanced AI Image Compressor Backend is live!");
});

// AI Format Recommendation Endpoint
app.post('/api/ai-format', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const regions = await detectRegions(req.file.path);
    const recommendation = await getAIFormatRecommendation(req.file.path, regions);
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      recommendation: {
        format: recommendation.format,
        reason: recommendation.reason,
        detectedObjects: regions.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('AI format recommendation error:', error);
    res.status(500).json({ error: 'Failed to get format recommendation' });
  }
});

// AI Quality Recommendation Endpoint
app.post('/api/ai-quality', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const recommendation = await getAIQualityRecommendation(prompt);
    
    res.json({
      success: true,
      recommendation
    });
  } catch (error) {
    console.error('AI quality recommendation error:', error);
    res.status(500).json({ error: 'Failed to get quality recommendation' });
  }
});

// Enhanced Upload Route (supports single and batch)
app.post('/api/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const { format = 'webp', quality = 80, prompt } = req.body;
    const results = [];

    for (const file of req.files) {
      const originalPath = file.path;
      const originalSize = file.size;

      console.log(`Processing ${file.originalname}...`);
      
      // Detect regions
      const regions = await detectRegions(originalPath);
      
      // Get AI recommendations if prompt provided
      let aiRecommendation = null;
      let targetFormat = format;
      let targetQuality = parseInt(quality);
      
      if (prompt) {
        aiRecommendation = await getAIQualityRecommendation(prompt);
        targetFormat = aiRecommendation.format;
        targetQuality = aiRecommendation.quality;
      }

      // Compress image
      const { compressedPath, compressedSize, quality: finalQuality } = 
        await adaptiveCompress(originalPath, regions, targetFormat, targetQuality);

      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

      // Save to database
      const imageRecord = new Image({
        originalName: file.originalname,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        originalPath,
        compressedPath,
        aiRegions: regions,
        format: targetFormat,
        quality: finalQuality,
        aiSuggestion: aiRecommendation?.context,
        promptUsed: prompt
      });

      await imageRecord.save();

      results.push({
        id: imageRecord._id,
        originalName: file.originalname,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        originalUrl: `${req.protocol}://${req.get('host')}/${originalPath}`,
        compressedUrl: `${req.protocol}://${req.get('host')}/${compressedPath}`,
        regions: regions.slice(0, 5),
        quality: finalQuality,
        format: targetFormat,
        aiSuggestion: aiRecommendation?.context
      });
    }

    res.json({
      success: true,
      data: results.length === 1 ? results[0] : results,
      batch: results.length > 1
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process images',
      details: error.message 
    });
  }
});

// Batch Download (ZIP)
app.post('/api/download-batch', async (req, res) => {
  try {
    const { imageIds } = req.body;
    if (!imageIds || imageIds.length === 0) {
      return res.status(400).json({ error: 'No image IDs provided' });
    }

    const images = await Image.find({ _id: { $in: imageIds } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed-images.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Failed to create archive' });
    });

    archive.pipe(res);

    for (const image of images) {
      if (fs.existsSync(image.compressedPath)) {
        const fileName = `compressed-${image.format}-${image.originalName}`;
        archive.file(image.compressedPath, { name: fileName });
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({ error: 'Failed to create batch download' });
  }
});

// Get image by ID
app.get('/api/image/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    res.json({
      success: true,
      data: {
        ...image.toObject(),
        originalUrl: `${req.protocol}://${req.get('host')}/${image.originalPath}`,
        compressedUrl: `${req.protocol}://${req.get('host')}/${image.compressedPath}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image details' });
  }
});

// Recent compressions
app.get('/api/recent', async (req, res) => {
  try {
    const images = await Image.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('originalName originalSize compressedSize compressionRatio format quality createdAt');

    res.json({ success: true, data: images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent compressions' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    features: ['AI Format Recommendation', 'Batch Processing', 'Smart Compression']
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Features: Format Recommendation, Quality Optimization, Batch Processing`);
});