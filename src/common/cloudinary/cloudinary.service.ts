import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

type UploadResult = { url: string; publicId: string };

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  private sanitizeFilename(name: string) {
    return (name || 'file')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async uploadRaw(opts: {
    buffer: Buffer;
    originalName: string;
    folder: string;
    filenameBase: string;
  }): Promise<UploadResult> {
    const { buffer, originalName, folder, filenameBase } = opts;

    const safeOriginal = this.sanitizeFilename(originalName);
    const safeBase = this.sanitizeFilename(filenameBase);

    try {
      const out = await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'raw',
            use_filename: true,
            unique_filename: true,
            filename_override: `${safeBase}_${Date.now()}_${safeOriginal}`,
          },
          (error: any, result: any) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result?.public_id) {
              return reject(new Error('Cloudinary: respuesta inválida'));
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        );

        uploadStream.end(buffer);
      });

      return out;
    } catch (e: any) {
      throw new InternalServerErrorException(
        e?.message ?? 'Error subiendo archivo a Cloudinary',
      );
    }
  }

  uploadClientDni(opts: {
    buffer: Buffer;
    originalName: string;
    clientId: number;
  }) {
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/client-dni',
      filenameBase: `client_${opts.clientId}_dni`,
    });
  }

  uploadVehicleDoc(opts: {
    buffer: Buffer;
    originalName: string;
    vehicleId: number;
  }) {
    return this.uploadRaw({
      buffer: opts.buffer,
      originalName: opts.originalName,
      folder: 'degrazia/vehicle-docs',
      filenameBase: `vehicle_${opts.vehicleId}_doc`,
    });
  }
}