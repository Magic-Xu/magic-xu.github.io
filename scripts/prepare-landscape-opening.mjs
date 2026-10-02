import sharp from 'sharp';

// Keep the corridor's spatial resolution; compress colour detail for the opening.
for (const suffix of ['', '-mobile']) {
  await sharp(`public/landscape/alpine-detail${suffix}.webp`)
    .webp({ quality: 45, effort: 6 })
    .toFile(`public/landscape/alpine-opening${suffix}.webp`);
}
console.log('Opening atlases updated. Rebuild, then recapture the opening posters.');
