#!/usr/bin/env -S deno run --allow-read --allow-write

import { join, basename, dirname } from "jsr:@std/path";

async function generateBinScripts() {
  const srcBinDir = "src/bin";
  const binDir = "bin";
  
  // Create bin directory if it doesn't exist
  try {
    await Deno.mkdir(binDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
  
  // Find all .ts files in src/bin
  const scripts: string[] = [];
  for await (const entry of Deno.readDir(srcBinDir)) {
    if (entry.isFile && entry.name.endsWith('.ts')) {
      scripts.push(entry.name);
    }
  }
  
  console.log(`Found ${scripts.length} scripts in ${srcBinDir}/`);
  
  for (const script of scripts) {
    const scriptName = basename(script, '.ts');
    const scriptPath = join(srcBinDir, script);
    
    // Generate PowerShell script
    const ps1Content = `#!/usr/bin/env pwsh
$scriptPath = Join-Path $PSScriptRoot ".." "${scriptPath.replace(/\\/g, '/')}"
deno run --allow-read --allow-write $scriptPath @args
`;
    
    // Generate Unix script (no extension)
    const unixContent = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
deno run --allow-read --allow-write "$SCRIPT_DIR/../${scriptPath}" "$@"
`;
    
    // Write scripts
    await Deno.writeTextFile(join(binDir, `${scriptName}.ps1`), ps1Content);
    await Deno.writeTextFile(join(binDir, scriptName), unixContent);
    
    // Make Unix script executable
    if (Deno.build.os !== "windows") {
      await Deno.chmod(join(binDir, scriptName), 0o755);
    }
    
    console.log(`Generated scripts for ${scriptName}:`);
    console.log(`  ${join(binDir, `${scriptName}.ps1`)} (Windows)`);
    console.log(`  ${join(binDir, scriptName)} (Unix/Linux/Mac)`);
  }
  
  console.log("\\nBin script generation completed!");
  console.log("\\nUsage:");
  console.log("  Windows: .\\\\bin\\\\scriptname.ps1 [args]");
  console.log("  Unix:    ./bin/scriptname [args]");
}

if (import.meta.main) {
  await generateBinScripts();
}