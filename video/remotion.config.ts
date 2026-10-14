// Réglages de Remotion (npm run studio, npm run rendu) : images JPEG de bonne qualité, MP4 H.264 lisible partout
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCrf(20);
Config.setPixelFormat("yuv420p");
