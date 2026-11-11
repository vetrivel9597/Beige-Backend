const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { execFile } = require("node:child_process");

const execFileAsync = promisify(execFile);
const ffmpegPath = require("ffmpeg-static");

const isVideoFile = (file) =>
  file?.mimetype?.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(file?.originalname || "");

const isImageFile = (file) =>
  file?.mimetype?.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file?.originalname || "");

const extractVideoFrames = async (file) => {
  if (!ffmpegPath) throw new Error("Video processing is not available on this server.");

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "beige-ai-media-"));
  const inputPath = path.join(directory, "upload.bin");
  const outputPattern = path.join(directory, "frame-%02d.jpg");

  try {
    await fs.writeFile(inputPath, file.buffer);
    await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel", "error",
        "-i", inputPath,
        "-t", "12",
        "-vf", "fps=1/4,scale=1024:1024:force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-frames:v", "3",
        "-an",
        "-y", outputPattern,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    );

    const frameFiles = (await fs.readdir(directory))
      .filter((name) => /^frame-\d+\.jpg$/.test(name))
      .sort();

    if (!frameFiles.length) throw new Error("No usable frames found in the video.");

    return await Promise.all(
      frameFiles.map((name) => fs.readFile(path.join(directory, name)))
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

const getVisionImages = async (file) => {
  if (isVideoFile(file)) {
    try {
      const frames = await extractVideoFrames(file);
      return frames.map((buffer) => ({ buffer, mimeType: "image/jpeg" }));
    } catch (error) {
      const mediaError = new Error("Could not read this video. Please upload a valid video file.");
      mediaError.status = 400;
      throw mediaError;
    }
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  const inferredMimeType = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  }[extension];

  return [{ buffer: file.buffer, mimeType: file.mimetype?.startsWith("image/") ? file.mimetype : inferredMimeType || "image/jpeg" }];
};

module.exports = { getVisionImages, isImageFile, isVideoFile };
