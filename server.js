// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const {Storage} = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Initialize Vision API client
const visionClient = new vision.ImageAnnotatorClient();
const storage = new Storage();
const bucket = storage.bucket('mindfulness-journal-images');

app.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload to Cloud Storage
    const blob = bucket.file(`journals/${Date.now()}-${req.file.originalname}`);
    const blobStream = blob.createWriteStream();
    
    await new Promise((resolve, reject) => {
      blobStream.on('error', reject);
      blobStream.on('finish', resolve);
      blobStream.end(req.file.buffer);
    });

    // Perform OCR
    const [result] = await visionClient.documentTextDetection({
      image: { content: req.file.buffer }
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    
    res.json({
      text: fullTextAnnotation.text,
      confidence: result.textAnnotations?.[0]?.confidence || 0,
      imageUrl: `gs://${bucket.name}/${blob.name}`
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});