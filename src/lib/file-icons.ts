import {
  File, Folder, FileText, FileCode, FileJson, Image, Film, Music,
  FileSpreadsheet, FileType, Database, Settings, Lock, Terminal,
  Package, GitBranch, Globe, Braces,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const extensionIcons: Record<string, LucideIcon> = {
  // Code
  js: FileCode, jsx: FileCode, ts: FileCode, tsx: FileCode,
  mjs: FileCode, cjs: FileCode,
  py: FileCode, rb: FileCode, go: FileCode, rs: FileCode,
  java: FileCode, kt: FileCode, scala: FileCode,
  c: FileCode, cpp: FileCode, h: FileCode, hpp: FileCode,
  cs: FileCode, php: FileCode, swift: FileCode, dart: FileCode,
  lua: FileCode, r: FileCode,
  vue: FileCode, svelte: FileCode, astro: FileCode,

  // Web
  html: Globe, css: FileType, scss: FileType, sass: FileType, less: FileType,

  // Data
  json: FileJson, xml: Braces, yaml: FileJson, yml: FileJson,
  toml: FileJson, csv: FileSpreadsheet, tsv: FileSpreadsheet,

  // Images
  jpg: Image, jpeg: Image, png: Image, gif: Image,
  webp: Image, svg: Image, bmp: Image, ico: Image,

  // Video/Audio
  mp4: Film, webm: Film, ogg: Film, mov: Film, avi: Film,
  mp3: Music, wav: Music, flac: Music, aac: Music, m4a: Music,

  // Documents
  md: FileText, mdx: FileText, txt: FileText, log: FileText,
  pdf: FileText, doc: FileText, docx: FileText,

  // Config
  env: Settings, ini: Settings, cfg: Settings, conf: Settings,
  gitignore: GitBranch, gitattributes: GitBranch,

  // Database
  sql: Database, db: Database, sqlite: Database,

  // Shell
  sh: Terminal, bash: Terminal, zsh: Terminal, fish: Terminal,

  // Package
  zip: Package, tar: Package, gz: Package, rar: Package, "7z": Package,

  // Security
  pem: Lock, key: Lock, crt: Lock, cer: Lock,
};

export function getFileIcon(filename: string, isDirectory: boolean): LucideIcon {
  if (isDirectory) return Folder;

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return extensionIcons[ext] || File;
}

export function getFileIconColor(filename: string, isDirectory: boolean): string {
  if (isDirectory) return "text-blue-500";

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const colorMap: Record<string, string> = {
    js: "text-yellow-500", jsx: "text-yellow-500", mjs: "text-yellow-500",
    ts: "text-blue-600", tsx: "text-blue-600",
    py: "text-green-600", rb: "text-red-500", go: "text-cyan-500",
    rs: "text-orange-600", java: "text-red-600",
    html: "text-orange-500", css: "text-blue-500",
    json: "text-yellow-600", md: "text-gray-500",
    jpg: "text-pink-500", png: "text-pink-500", gif: "text-pink-500",
    svg: "text-orange-400",
    mp4: "text-purple-500", mp3: "text-green-500",
    pdf: "text-red-500",
    sh: "text-green-400",
    sql: "text-blue-400",
    env: "text-yellow-400",
    lock: "text-gray-400",
  };
  return colorMap[ext] || "text-gray-400";
}
