#!/usr/bin/env -S deno run --allow-read --allow-write

import { parseArgs } from "node:util";
import { ZipWriter, ZipReader, BlobReader, BlobWriter } from "@zip-js/zip-js";
import { join, extname, basename } from "jsr:@std/path";

function showHelp() {
  console.log(`Usage: 1zip [OPTIONS] <PATH>

Options:
  -c <path>        Compress file/directory to ZIP (no compression)
  -d <path>        Decompress ZIP file
  -l, --list <path> List contents of ZIP file
  -h, --help       Show this help message

Examples:
  1zip -c tmp/           # Creates tmp.zip
  1zip -c README.md      # Creates README.md.zip
  1zip -d tmp.zip        # Extracts to tmp/
  1zip -l archive.zip    # Lists contents
`);
}

async function compressPath(inputPath: string): Promise<void> {
  const stat = await Deno.stat(inputPath);
  const outputPath = `${inputPath}.zip`;
  
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
  
  if (stat.isFile) {
    const data = await Deno.readFile(inputPath);
    await zipWriter.add(basename(inputPath), new BlobReader(new Blob([data])), { level: 0 });
  } else if (stat.isDirectory) {
    await addDirectoryToZip(zipWriter, inputPath, "");
  }
  
  const zipBlob = await zipWriter.close();
  const zipData = new Uint8Array(await zipBlob.arrayBuffer());
  await Deno.writeFile(outputPath, zipData);
  
  console.log(`Created: ${outputPath}`);
}

async function addDirectoryToZip(zipWriter: ZipWriter<Blob>, dirPath: string, basePath: string): Promise<void> {
  for await (const entry of Deno.readDir(dirPath)) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    if (entry.isFile) {
      const data = await Deno.readFile(fullPath);
      await zipWriter.add(relativePath, new BlobReader(new Blob([data])), { level: 0 });
    } else if (entry.isDirectory) {
      await addDirectoryToZip(zipWriter, fullPath, relativePath);
    }
  }
}

async function decompressZip(zipPath: string): Promise<void> {
  const zipData = await Deno.readFile(zipPath);
  const zipReader = new ZipReader(new BlobReader(new Blob([zipData])));
  
  const entries = await zipReader.getEntries();
  const zipDir = join(zipPath, "..");
  const outputDir = basename(zipPath, extname(zipPath));
  const fullOutputDir = join(zipDir, outputDir);
  
  for (const entry of entries) {
    if (entry.directory) {
      await Deno.mkdir(join(fullOutputDir, entry.filename), { recursive: true });
    } else {
      const data = await entry.getData!(new BlobWriter());
      const outputPath = join(fullOutputDir, entry.filename);
      
      // Ensure directory exists
      await Deno.mkdir(join(outputPath, ".."), { recursive: true });
      
      const arrayBuffer = await data.arrayBuffer();
      await Deno.writeFile(outputPath, new Uint8Array(arrayBuffer));
    }
  }
  
  await zipReader.close();
  console.log(`Extracted to: ${fullOutputDir}/`);
}

async function listZipContents(zipPath: string): Promise<void> {
  const zipData = await Deno.readFile(zipPath);
  const zipReader = new ZipReader(new BlobReader(new Blob([zipData])));
  
  const entries = await zipReader.getEntries();
  
  console.log(`Contents of ${zipPath}:`);
  for (const entry of entries) {
    const type = entry.directory ? "DIR" : "FILE";
    const size = entry.uncompressedSize || 0;
    console.log(`  ${type.padEnd(5)} ${size.toString().padStart(10)} ${entry.filename}`);
  }
  
  await zipReader.close();
}

async function main() {
  const args = Deno.args;
  
  if (args.length === 0) {
    showHelp();
    Deno.exit(0);
  }
  
  const { values } = parseArgs({
    args,
    options: {
      compress: { type: "string", short: "c" },
      decompress: { type: "string", short: "d" },
      list: { type: "string", short: "l" },
      help: { type: "boolean", short: "h" }
    }
  });
  
  try {
    if (values.help) {
      showHelp();
      Deno.exit(0);
    } else if (values.compress && typeof values.compress === "string") {
      await compressPath(values.compress);
    } else if (values.decompress && typeof values.decompress === "string") {
      await decompressZip(values.decompress);
    } else if (values.list && typeof values.list === "string") {
      await listZipContents(values.list);
    } else {
      showHelp();
      Deno.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}