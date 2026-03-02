import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export const imageUploadService = {
  saveImage: (file: Express.Multer.File): string => {
    // Return relative URL for the uploaded file
    return `/uploads/${file.filename}`;
  },

  deleteImage: (imageUrl: string): void => {
    try {
      const filename = path.basename(imageUrl);
      const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);
      
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`Image deleted: ${filename}`);
      }
    } catch (error) {
      logger.error('Error deleting image:', error);
    }
  },

  deleteMultipleImages: (imageUrls: string[]): void => {
    imageUrls.forEach((url) => {
      imageUploadService.deleteImage(url);
    });
  },
};
