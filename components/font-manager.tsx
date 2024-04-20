import { ReactNode, createContext, useContext } from "react";
import _googleFonts from "./google_fonts.json";
import { DrawCache, FT_FaceRec, FT_GlyphSlotRec, FT_Vector, Freetype } from "@/freetype";

export type FontAxes = {
    tag: string | // shouldn't need this, but the json is so big
        "opsz" |
        "slnt" |
        "wdth" |
        "wght" |
        "ARRR" |
        "BLED" |
        "BNCE" |
        "CASL" |
        "CRSV" |
        "EDPT" |
        "EHLT" |
        "ELGR" |
        "ELSH" |
        "FILL" |
        "FLAR" |
        "GRAD" |
        "HEXP" |
        "INFM" |
        "MONO" |
        "MORF" |
        "ROND" |
        "SCAN" |
        "SHLN" |
        "SHRP" |
        "SOFT" |
        "SPAC" |
        "VOLM" |
        "WONK" |
        "XOPQ" |
        "XROT" |
        "XTRA" |
        "YEAR" |
        "YELA" |
        "YOPQ" |
        "YROT" |
        "YTAS" |
        "YTDE" |
        "YTFI" |
        "YTLC" |
        "YTUC";
    start: number;
    end: number;
}

export type FontInfo = {
    family: string;
    variants: string[];
    subsets: string[];
    version: string;
    lastModified: string;
    files: {
        [variant: string]: string | undefined;
    };
    category: string;
    kind: string;
    menu: string;
    axes?: FontAxes[];
}

const googleFonts: FontInfo[] = _googleFonts;

type FontManagerContextProps = {
    getFamilies: () => string[];
    getFontInfo: (family: string) => FontInfo | null;
    loadFont: (family: string, style?: string) => Promise<void>;
    unloadFont: (family: string, style: string) => void;
    getGlyphs: (family: string, style: string, width: number, height: number, str: string) => Promise<GlyphInfo[]>;
    getKerning: (prev: FT_GlyphSlotRec, current: FT_GlyphSlotRec) => FT_Vector;
}

function getFontInfo(family: string) {
    for (const font of googleFonts) {
        if (font.family === family) {
            return font;
        }
    }
    return null;
}

function getFamilies() {
    return googleFonts.map(f => f.family);
}

export type GlyphInfo = FT_GlyphSlotRec | null;
// character to GlyphInfo
export type GlyphCache = Map<string, GlyphInfo>;

// family-style to GlyphCache
const characterCache = new Map<string, GlyphCache>();
function characterCacheKey(family: string, style?: string) {
    return getUrlForFamilyStyle(family, style);
}

const urlFaces = new Map<string, FT_FaceRec[]>();

function getUrlForFamilyStyle(family: string, style?: string) {
    const font = getFontInfo(family);
    if (!font) {
        throw new Error('No Such Family');
    }
    if (!style) {
        style = 'regular';
    }

    if (!font.variants.includes(style)) {
        style = font.variants[0];
    }

    return font.files[style] ?? font.menu;
}

function getFaceForFamilyStyle(family: string, style?: string) {
    const url = getUrlForFamilyStyle(family, style);
    return urlFaces.get(url);
}

async function loadFont(family: string, style?: string) {
    const url = getUrlForFamilyStyle(family, style);
    const faces = urlFaces.get(url) ?? await createFontFromUrl(url);

    if (!faces || faces.length === 0) {
        throw new Error('Failed to create font');
    }
    urlFaces.set(url, faces);
    const key = characterCacheKey(family, style);
    characterCache.set(key, new Map<string, GlyphInfo>());
}

function unloadFont(family: string, style: string) {
    const key = characterCacheKey(family, style);
    characterCache.delete(key);
    FreeType.UnloadFont(family);
}

async function updateCache(str: string, cache: GlyphCache) {
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
        if (!glyph) {
            console.error('failed to load', code, String.fromCodePoint(code));
            continue;
        }
        const char = String.fromCodePoint(code);
        cache.set(char, glyph);
    }
}

async function getGlyphs(family: string, style: string, width: number, height: number, str: string): Promise<GlyphInfo[]> {
    const key = characterCacheKey(family, style);
    if (!characterCache.has(key)) {
        await loadFont(family, style);
    }
    const cache = characterCache.get(key);
    if (!cache) {
        throw new Error('No Cache');
    }
    const face = getFaceForFamilyStyle(family, style);
    if (!face || face.length === 0) {
        console.error('no face');
        return [];
    }
    console.log('face:', face);
    FreeType.SetFont(face[0].family_name, face[0].style_name);
    FreeType.SetPixelSize(width, height);
    await updateCache(str, cache);
    const glyphs = [];
    for (const char of str) {
        glyphs.push(cache.get(char) ?? null);
    }
    return glyphs;
}

function getKerning(prev: FT_GlyphSlotRec, current: FT_GlyphSlotRec) {
    return FreeType.GetKerning(prev.glyph_index, current.glyph_index, 0);
}

const FontManagerContext = createContext<FontManagerContextProps>({
    getFamilies,
    getFontInfo,
    loadFont,
    unloadFont,
    getGlyphs,
    getKerning,
});

type Props = {
    children: ReactNode;
}

export function FontMangerProvider({ children }: Props) {
    return (
        <FontManagerContext.Provider value={{
            getFamilies,
            getFontInfo,
            loadFont,
            unloadFont,
            getGlyphs,
            getKerning,
        }}>
            {children}
        </FontManagerContext.Provider>
    );
}

export function useFontManager() {
    return useContext(FontManagerContext);
}
