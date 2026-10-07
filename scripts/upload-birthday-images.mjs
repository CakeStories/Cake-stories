#!/usr/bin/env node
/**
 * One-time upload of the Birthday Cakes menu photos into Supabase Storage.
 *
 * The database rows already point at:
 *   <SUPABASE_URL>/storage/v1/object/public/product-images/birthday/<slug>.webp
 * so this script just needs to put each file at that exact path.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/upload-birthday-images.mjs ./birthday-images
 *
 * The service-role key is read from the environment and never written to disk.
 * Run this from a trusted machine (your laptop), not from the browser.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const BUCKET = "product-images";
const PREFIX = "birthday";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourceDir = process.argv[2];

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

if (!sourceDir) {
  console.error("Usage: node scripts/upload-birthday-images.mjs <folder-of-images>");
  process.exit(1);
}

const CONTENT_TYPES = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const files = (await readdir(sourceDir)).filter((file) =>
  Object.keys(CONTENT_TYPES).includes(extname(file).toLowerCase()),
);

if (files.length === 0) {
  console.error(`No images found in ${sourceDir}`);
  process.exit(1);
}

console.log(`Uploading ${files.length} images to ${BUCKET}/${PREFIX}/ …\n`);

let uploaded = 0;
let failed = 0;

for (const file of files) {
  const extension = extname(file).toLowerCase();
  const objectPath = `${PREFIX}/${basename(file)}`;
  const body = await readFile(join(sourceDir, file));

  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": CONTENT_TYPES[extension],
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000",
    },
    body,
  });

  if (response.ok) {
    uploaded += 1;
    console.log(`  ✓ ${objectPath}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${objectPath} — ${response.status} ${await response.text()}`);
  }
}

console.log(`\nDone. ${uploaded} uploaded, ${failed} failed.`);
if (failed > 0) process.exit(1);
