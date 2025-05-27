#!/usr/bin/env bun

import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

async function deleteReviewJsonFiles(targetDir: string): Promise<void> {
  async function processDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          // Recursively process subdirectories
          await processDirectory(fullPath);
        } else if (stats.isFile() && entry.startsWith('research') && entry.endsWith('.json')) {
          // Delete JSON files that start with "review-"
          await unlink(fullPath);
          console.log(`Deleted: ${fullPath}`);
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${dir}:`, error);
    }
  }

  await processDirectory(targetDir);
}

// Main execution
async function main() {
  const targetDir = process.argv[2];
  
  if (!targetDir) {
    console.error('Usage: bun run script.ts <directory_path>');
    process.exit(1);
  }

  try {
    await stat(targetDir);
  } catch {
    console.error(`Error: Directory '${targetDir}' does not exist`);
    process.exit(1);
  }

  console.log(`Deleting .json files starting with 'review-' in: ${targetDir}`);
  await deleteReviewJsonFiles(targetDir);
  console.log('Cleanup completed!');
}

main().catch(console.error);