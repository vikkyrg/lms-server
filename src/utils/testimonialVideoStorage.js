const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const testimonialVideoBucketName = 'testimonialVideos';

/**
 * Returns GridFS bucket for testimonial videos
 */
const getTestimonialVideoBucket = () => {
  if (!mongoose.connection.db) {
    const error = new Error('MongoDB is not ready for video storage');
    error.statusCode = 503;
    throw error;
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: testimonialVideoBucketName
  });
};

/**
 * Uploads a video file stream directly into MongoDB GridFS
 */
const uploadTestimonialVideoToGridFS = (file) =>
  new Promise((resolve, reject) => {
    const bucket = getTestimonialVideoBucket();
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size
      }
    });

    const input = fs.createReadStream(file.path);

    input.on('error', (err) => {
      uploadStream.destroy();
      reject(err);
    });

    uploadStream.on('error', reject);

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id,
        filename: uploadStream.filename,
        size: file.size,
        contentType: file.mimetype
      });
    });

    input.pipe(uploadStream);
  });

/**
 * Deletes a video file from MongoDB GridFS
 */
const deleteTestimonialVideoFromGridFS = async (fileId) => {
  if (!fileId || !mongoose.isValidObjectId(fileId)) return;
  try {
    await getTestimonialVideoBucket().delete(new mongoose.Types.ObjectId(fileId));
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 26) {
      console.error(`Error deleting GridFS testimonial video: ${error.message}`);
    }
  }
};

/**
 * Retrieves file metadata from GridFS files collection
 */
const getTestimonialVideoFile = async (fileId) => {
  if (!fileId || !mongoose.isValidObjectId(fileId)) return null;
  const files = await mongoose.connection.db
    .collection(`${testimonialVideoBucketName}.files`)
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .limit(1)
    .toArray();
  return files[0] || null;
};

/**
 * Safely removes a temporary file from disk
 */
const removeTempFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`Failed to remove temp file ${filePath}: ${err.message}`);
  }
};

module.exports = {
  testimonialVideoBucketName,
  getTestimonialVideoBucket,
  uploadTestimonialVideoToGridFS,
  deleteTestimonialVideoFromGridFS,
  getTestimonialVideoFile,
  removeTempFile
};

