import {
  mdiCertificateOutline,
  mdiCodeJson,
  mdiCogOutline,
  mdiConsoleLine,
  mdiDocker,
  mdiFileDocumentOutline,
  mdiFileImage,
  mdiFileOutline,
  mdiFilePdfBox,
  mdiFolder,
  mdiFolderOpen,
  mdiGit,
  mdiInformationOutline,
  mdiLanguageC,
  mdiLanguageCpp,
  mdiLanguageCss3,
  mdiLanguageGo,
  mdiLanguageHtml5,
  mdiLanguageJava,
  mdiLanguageJavascript,
  mdiLanguageMarkdown,
  mdiLanguagePhp,
  mdiLanguagePython,
  mdiLanguageRuby,
  mdiLanguageRust,
  mdiLanguageTypescript,
  mdiLock,
  mdiNodejs,
  mdiNpm,
  mdiSass,
} from "@mdi/js";

type IconDefinition = { path: string; color: string };

function Glyph({ path, color }: IconDefinition) {
  return (
    <svg className="tree-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill={color} />
    </svg>
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  return <Glyph path={open ? mdiFolderOpen : mdiFolder} color="#90a4ae" />;
}

const DEFAULT_FILE_ICON: IconDefinition = {
  path: mdiFileOutline,
  color: "#9aa4b3",
};

const ICONS_BY_NAME: Record<string, IconDefinition> = {
  "package.json": { path: mdiNpm, color: "#cb3837" },
  "package-lock.json": { path: mdiNpm, color: "#cb3837" },
  "tsconfig.json": { path: mdiCogOutline, color: "#3178c6" },
  dockerfile: { path: mdiDocker, color: "#2496ed" },
  makefile: { path: mdiCogOutline, color: "#6d8086" },
  ".gitignore": { path: mdiGit, color: "#e8623f" },
  ".gitattributes": { path: mdiGit, color: "#e8623f" },
  ".nvmrc": { path: mdiNodejs, color: "#8cc84b" },
  "uv.lock": { path: mdiLock, color: "#6d8086" },
};

const ICONS_BY_EXTENSION: Record<string, IconDefinition> = {
  ts: { path: mdiLanguageTypescript, color: "#3178c6" },
  tsx: { path: mdiLanguageTypescript, color: "#3178c6" },
  cts: { path: mdiLanguageTypescript, color: "#3178c6" },
  mts: { path: mdiLanguageTypescript, color: "#3178c6" },
  js: { path: mdiLanguageJavascript, color: "#e8bc4e" },
  jsx: { path: mdiLanguageJavascript, color: "#e8bc4e" },
  cjs: { path: mdiLanguageJavascript, color: "#e8bc4e" },
  mjs: { path: mdiLanguageJavascript, color: "#e8bc4e" },
  json: { path: mdiCodeJson, color: "#e8bc4e" },
  jsonc: { path: mdiCodeJson, color: "#e8bc4e" },
  md: { path: mdiLanguageMarkdown, color: "#4aa8d8" },
  markdown: { path: mdiLanguageMarkdown, color: "#4aa8d8" },
  css: { path: mdiLanguageCss3, color: "#519aba" },
  scss: { path: mdiSass, color: "#cd6799" },
  sass: { path: mdiSass, color: "#cd6799" },
  html: { path: mdiLanguageHtml5, color: "#e44d26" },
  htm: { path: mdiLanguageHtml5, color: "#e44d26" },
  py: { path: mdiLanguagePython, color: "#4b8bbe" },
  pyi: { path: mdiLanguagePython, color: "#4b8bbe" },
  c: { path: mdiLanguageC, color: "#599eff" },
  h: { path: mdiLanguageC, color: "#599eff" },
  cpp: { path: mdiLanguageCpp, color: "#599eff" },
  cc: { path: mdiLanguageCpp, color: "#599eff" },
  hpp: { path: mdiLanguageCpp, color: "#599eff" },
  go: { path: mdiLanguageGo, color: "#00add8" },
  rs: { path: mdiLanguageRust, color: "#dea584" },
  java: { path: mdiLanguageJava, color: "#cc3e44" },
  rb: { path: mdiLanguageRuby, color: "#cc342d" },
  php: { path: mdiLanguagePhp, color: "#a074c4" },
  sh: { path: mdiConsoleLine, color: "#b4b4b4" },
  bash: { path: mdiConsoleLine, color: "#b4b4b4" },
  zsh: { path: mdiConsoleLine, color: "#b4b4b4" },
  yml: { path: mdiCogOutline, color: "#cb8f36" },
  yaml: { path: mdiCogOutline, color: "#cb8f36" },
  toml: { path: mdiCogOutline, color: "#6d8086" },
  ini: { path: mdiCogOutline, color: "#6d8086" },
  cfg: { path: mdiCogOutline, color: "#6d8086" },
  conf: { path: mdiCogOutline, color: "#6d8086" },
  env: { path: mdiCogOutline, color: "#6d8086" },
  lock: { path: mdiLock, color: "#6d8086" },
  txt: { path: mdiFileDocumentOutline, color: "#b4b4b4" },
  pdf: { path: mdiFilePdfBox, color: "#e34f26" },
  png: { path: mdiFileImage, color: "#a074c4" },
  jpg: { path: mdiFileImage, color: "#a074c4" },
  jpeg: { path: mdiFileImage, color: "#a074c4" },
  gif: { path: mdiFileImage, color: "#a074c4" },
  webp: { path: mdiFileImage, color: "#a074c4" },
  svg: { path: mdiFileImage, color: "#ffb13b" },
  ico: { path: mdiFileImage, color: "#a074c4" },
};

function resolveIcon(fileName: string): IconDefinition {
  const lowerName = fileName.toLowerCase();
  const extension = lowerName.includes(".")
    ? lowerName.slice(lowerName.lastIndexOf(".") + 1)
    : "";

  const byName = ICONS_BY_NAME[lowerName];
  if (byName) return byName;

  if (lowerName.startsWith("readme")) {
    return { path: mdiInformationOutline, color: "#519aba" };
  }

  if (lowerName.startsWith("license")) {
    return { path: mdiCertificateOutline, color: "#cb8f36" };
  }

  return ICONS_BY_EXTENSION[extension] ?? DEFAULT_FILE_ICON;
}

export function FileIcon({ name }: { name: string }) {
  return <Glyph {...resolveIcon(name)} />;
}
