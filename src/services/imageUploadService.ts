import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getLocalUploadPath = (file: Express.Multer.File) => {
  const uploadDir = process.env.UPLOAD_PATH || './uploads';
  return path.join(uploadDir, file.filename);
};

const getPublicIdFromUrl = (imageUrl: string): string | null => {
  try {
    const url = new URL(imageUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const filename = segments[segments.length - 1];
    const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    const folder = process.env.CLOUDINARY_FOLDER;
    return folder ? `${folder}/${baseName}` : baseName;
  } catch {
    return null;
  }
};

export const imageUploadService = {
  saveImage: async (file: Express.Multer.File): Promise<string> => {
    try {
      const localPath = getLocalUploadPath(file);

      const folder = process.env.CLOUDINARY_FOLDER || 'imisioluwa-products';

      const result = await cloudinary.uploader.upload(localPath, {
        folder,
        resource_type: 'image',
      });

      // Clean up local file after successful upload
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up local image file:', cleanupError);
      }

      return result.secure_url;
    } catch (error) {
      logger.error('Error uploading image to Cloudinary:', error);
      throw error;
    }
  },

  deleteImage: async (imageUrl: string): Promise<void> => {
    try {
      const publicId = getPublicIdFromUrl(imageUrl);
      if (!publicId) {
        logger.warn(`Could not derive Cloudinary public ID from URL: ${imageUrl}`);
        return;
      }

      await cloudinary.uploader.destroy(publicId);
      logger.info(`Image deleted from Cloudinary: ${publicId}`);
    } catch (error) {
      logger.error('Error deleting image from Cloudinary:', error);
    }
  },

  deleteMultipleImages: async (imageUrls: string[]): Promise<void> => {
    await Promise.all(imageUrls.map((url) => imageUploadService.deleteImage(url)));
  },
};
