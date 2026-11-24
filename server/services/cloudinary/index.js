const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isConfigured = () => {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
};

const uploadResume = (file, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        asset_folder: 'hirematch/resumes',
        resource_type: 'raw',
        type: 'authenticated',
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) {
          return reject(new Error('Cloudinary did not return an upload result.'));
        }
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const deleteResume = (publicId) => cloudinary.uploader.destroy(publicId, {
  resource_type: 'raw',
  type: 'authenticated',
  invalidate: true,
});

const downloadResume = async (resume) => {
  const signedUrl = cloudinary.utils.private_download_url(
    resume.publicId,
    null,
    {
      resource_type: 'raw',
      type: 'authenticated',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 60,
    },
  );
  const response = await fetch(signedUrl);

  if (!response.ok || !response.body) {
    throw new Error(`Cloudinary resume download failed with status ${response.status}.`);
  }

  return Readable.fromWeb(response.body);
};

module.exports = {
  deleteResume,
  downloadResume,
  isConfigured,
  uploadResume,
};
