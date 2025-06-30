require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// MongoDB Connection
console.log("MongoDB: Connecting...");

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Image Schema
const imageSchema = new mongoose.Schema({
  originalName: String,
  originalSize: Number,
  compressedSize: Number,
  compressionRatio: Number,
  originalPath: String,
  compressedPath: String,
  aiRegions: Array,
  createdAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', imageSchema);

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'original-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// AI Region Detection using Hugging Face
async function detectRegions(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Using Hugging Face's object detection model
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

// Adaptive compression function
async function adaptiveCompress(imagePath, regions = []) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Base compression settings
    let quality = 80;
    
    // If important regions detected (faces, people, text), use higher quality
    const importantLabels = ['person', 'face', 'text', 'book', 'laptop', 'cell phone'];
    const hasImportantRegions = regions.some(region => 
      importantLabels.some(label => 
        region.label && region.label.toLowerCase().includes(label)
      )
    );
    
    if (hasImportantRegions) {
      quality = 90; // Higher quality for important content
    }
    
    // Apply smart compression
    const compressedBuffer = await image
      .jpeg({ 
        quality: quality,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
    
    const compressedPath = imagePath.replace('original-', 'compressed-');
    await sharp(compressedBuffer).toFile(compressedPath);
    
    return {
      compressedPath,
      compressedSize: compressedBuffer.length,
      quality: quality
    };
  } catch (error) {
    console.error('Compression error:', error);
    throw error;
  }
}

// Routes
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const originalPath = req.file.path;
    const originalSize = req.file.size;

    // Step 1: Detect regions using AI
    console.log('Detecting regions...');
    const regions = await detectRegions(originalPath);

    // Step 2: Apply adaptive compression
    console.log('Applying adaptive compression...');
    const { compressedPath, compressedSize, quality } = await adaptiveCompress(originalPath, regions);

    // Step 3: Calculate compression ratio
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

    // Step 4: Save to database
    const imageRecord = new Image({
      originalName: req.file.originalname,
      originalSize,
      compressedSize,
      compressionRatio: parseFloat(compressionRatio),
      originalPath,
      compressedPath,
      aiRegions: regions
    });

    await imageRecord.save();

    // Step 5: Return results
    res.json({
      success: true,
      data: {
        id: imageRecord._id,
        originalName: req.file.originalname,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(compressionRatio),
        originalUrl: `${req.protocol}://${req.get('host')}/${originalPath}`,
        compressedUrl: `${req.protocol}://${req.get('host')}/${compressedPath}`,
        regions: regions.slice(0, 5), // Return top 5 detected objects
        quality: quality
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process image',
      details: error.message 
    });
  }
});

// Get image details
app.get('/api/image/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

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

// Get recent compressions
app.get('/api/recent', async (req, res) => {
  try {
    const images = await Image.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('originalName originalSize compressedSize compressionRatio createdAt');

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent compressions' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
});