const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const bucketName = 'lessonVideos';

const getBucket = () => {
  if (!mongoose.connection.db) {
    const error = new Error('MongoDB is not ready for video storage');
    error.statusCode = 503;
    throw error;
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
};

const uploadVideo = (file) => new Promise((resolve, reject) => {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(file.originalname, {
    contentType: file.mimetype,
    metadata: {
      originalName: file.originalname,
      contentType: file.mimetype
    }
  });
  const input = fs.createReadStream(file.path);

  input.on('error', reject);
  uploadStream.on('error', reject);
  uploadStream.on('finish', () => resolve({
    fileId: uploadStream.id,
    filename: uploadStream.filename,
    length: file.size,
    contentType: file.mimetype
  }));
  input.pipe(uploadStream);
});

const deleteVideo = async (fileId) => {
  if (!fileId || !mongoose.isValidObjectId(fileId)) return;
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(fileId));
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 26) throw error;
  }
};

const getVideoFile = async (fileId) => {
  if (!fileId || !mongoose.isValidObjectId(fileId)) return null;
  const files = await mongoose.connection.db
    .collection(`${bucketName}.files`)
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .limit(1)
    .toArray();
  return files[0] || null;
};

const removeTemporaryFile = (file) => {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (error) {
    console.error(`Unable to remove temporary video file ${path.basename(file.path)}: ${error.message}`);
  }
};

module.exports = {
  bucketName,
  getBucket,
  uploadVideo,
  deleteVideo,
  getVideoFile,
  removeTemporaryFile
};
