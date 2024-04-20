import FreeTypeInit from "https://cdn.jsdelivr.net/npm/freetype-wasm@0/dist/freetype.js";
const FreeType = await FreeTypeInit();

globalThis.FreeType = FreeType;

/**
 * Create from URL
 *
 * @param {*} url
 * @returns {Promise<FT_FaceRec[]>}
 */
async function createFontFromUrl(url) {
    const font = await fetch(url);
    const buffer = await font.arrayBuffer();
    const face = FreeType.LoadFontFromBytes(new Uint8Array(buffer));
    return face;
}
globalThis.createFontFromUrl = createFontFromUrl;

/**
 * Create from Google fonts
 *
 * @param {string} fontName
 * @param {number} index
 * @returns {Promise<FT_FaceRec[]>}
 */
async function createGoogleFont(fontName) {
    let targetUrl;
    try {
        console.log('getting font', fontName);
        const url = `https://fonts.googleapis.com/css?family=${fontName}`;
        const css = await fetch(url, {
        });
        const text = await css.text();
        const urls = [...text.matchAll(/url\(([^\(\)]+)\)/g)].map((m) => m[1]);
        const fonts = await Promise.all(
            urls.map(u => createFontFromUrl(u))
        );
        const nameStyleMap = new Map();
        for (const fontFamilies of fonts) {
            for (const font of fontFamilies) {
                const styles = nameStyleMap.get(font.family_name) ?? new Set();
                console.log('styles:', styles);
                styles.add(font.style_name);
                nameStyleMap.set(
                    font.family_name,
                    styles
                );
            }
        }
        return nameStyleMap;
    } catch (err) {
        console.error('Font css fetch failure', err);
        throw err;
    }
}
globalThis.createGoogleFont = createGoogleFont;

/**
 * Update glyph and bitmap caches
 *
 * @param {string} str
 * @param {DrawCache} cache
 */
async function updateCache(str, cache) {
    // Get char codes without bitmaps
    const codes = [];
    for (const char of new Set(str)) {
        const point = char.codePointAt(0);
        if (!cache.has(char) && point !== undefined) {
            codes.push(point);
        }
    }

    // Populate missing bitmaps
    const newGlyphs = FreeType.LoadGlyphs(codes, FreeType.FT_LOAD_RENDER | FreeType.FT_LOAD_MONOCHROME);
    for (const [code, glyph] of newGlyphs.entries()) {
        console.log(code, 'glyph:', glyph);
        if (!glyph) {
            console.error('failed to load', code, String.fromCodePoint(code));
            continue;
        }
        const char = String.fromCodePoint(code);
        console.log('cache update:', code, String.fromCodePoint(code), glyph);
        cache.set(char, {
            glyph,
            bitmap: glyph.bitmap.imagedata
                ? await createImageBitmap(glyph.bitmap.imagedata)
                : null,
        });
    }
}
globalThis.updateCache = updateCache;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} str
 * @param {number} offsetx
 * @param {number} offsety
 * @param {DrawCache} cache
 */
async function canvasWrite(ctx, str, offsetx, offsety, cache) {
    await updateCache(str, cache);
    let prev = null;
    for (const char of str) {
        const { glyph, bitmap } = cache.get(char) || {};
        if (glyph) {
            // Kerning
            if (prev) {
                const kerning = FreeType.GetKerning(
                    prev.glyph_index,
                    glyph.glyph_index,
                    0
                );
                offsetx += kerning.x >> 6;
            }

            if (bitmap) {
                ctx.drawImage(
                    bitmap,
                    offsetx + glyph.bitmap_left,
                    offsety - glyph.bitmap_top
                );
            }

            offsetx += glyph.advance.x >> 6;
            prev = glyph;
        }
    }
}
globalThis.canvasWrite = canvasWrite;
