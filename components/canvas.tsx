import { DrawCache, FT_GlyphSlotRec } from "@/freetype";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

const GoogleFontMap: {[name: string]: string} = {
    'Platypi': 'Platypi:ital,wght@0,300..800;1,300..800&display=swap',
}

const GoogleFontFamilyName: {[name: string]: string} = {
    'Platypi': 'Platypi Light'
}

type GlyphInfo = {
    glyph: FT_GlyphSlotRec;
    bitmap?: ImageBitmap
}

const glyphCache: Map<string, DrawCache> = new Map<string, Map<string, GlyphInfo>>();

export default function Canvas() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState<string>('Hello World!');
    const [fontName, setFontName] = useState<string>('Licorice');
    const [fontStyle, setFontStyle] = useState<string>('Regular');
    const [availableStyles, setAvailableStyles] = useState<string[]>(['Regular']);

    const draw = useCallback(
        (str: string, fntName = fontName, fntStyle = fontStyle) => {
            if (!canvas.current) {
                return;
            }
            console.log('draw', str, fntName, fntStyle);
            fntName = GoogleFontFamilyName[fntName] ?? fntName;
            const fontFace = FreeType.SetFont(fntName, fntStyle);
            const size = FreeType.SetPixelSize(0, 32 * window.devicePixelRatio);

            if(!size || !fontFace) {
                console.error(fntName, fntStyle, 'missing something', size, fontFace);
                return;
            }
            const lineHeight = size.height >> 6;

            const ctx = canvas.current.getContext('2d');
            if (!ctx) {
                console.error('failed to get canvas context');
                return;
            }
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);
            const cacheKey = `${fntName}-${fntStyle}`;
            const cache = glyphCache.get(cacheKey) ?? new Map<string, GlyphInfo>();
            glyphCache.set(cacheKey, cache);
            canvasWrite(ctx, str, 20, 2 * lineHeight, cache);
        },
        [canvas.current, fontName, fontStyle]
    );

    useEffect(
        () => {
            if (typeof createGoogleFont === undefined) {
                return;
            }
            (async () => {
                try {
                    const fontArgs = GoogleFontMap[fontName] ?? fontName;
                    const nameStyleMap = await createGoogleFont(fontArgs);
                    console.log('nameStyleMap:', nameStyleMap);
                    const firstName = [...nameStyleMap.keys()][0];
                    const styleSet = nameStyleMap.get(firstName) ?? null;
                    if (!styleSet) {
                        throw new Error('NoStyle');
                    }
                    const style = [...styleSet][0];
                    setFontStyle(style);
                    setAvailableStyles([...styleSet.values()]);
                    draw(text, fontName, style);
                } catch (err) {
                    setFontName('Licorice');
                    setFontStyle('Regular');
                    draw(text, 'Licorice', 'Regular');
                }
            })();
        },
        [globalThis.createGoogleFont, fontName, setFontName, setFontStyle]
    );

    const onUpdate = useCallback(
        async (str: string) => {
            setText(str);
            console.log('str:', str);
            draw(str, fontName, fontStyle);
        },
        [setText, fontName, fontStyle]
    );

    const changeFont = useCallback(
        (evt: ChangeEvent<HTMLSelectElement>) => {
            setFontName(evt.target.value);
        },
        [setFontName],
    );
    const changeStyle = useCallback(
        (evt: ChangeEvent<HTMLSelectElement>) => {
            const style = evt.target.value;
            setFontStyle(style);
            draw(text, fontName, style);
        },
        [setFontStyle, fontName, text]
    );

    return <div>
        <div>
            <canvas width={640} height={400} ref={canvas}/>
            <select onChange={changeFont} value={fontName}>
                <option>Licorice</option>
                <option>Noto Sans</option>
                <option>Noto Serif</option>
                <option>Micro 5</option>
                <option>Roboto</option>
                <option>Platypi</option>
            </select>
            <select onChange={changeStyle} value={fontStyle}>
                {availableStyles.map(
                    style => <option>{style}</option>
                )}
            </select>
        </div>
        <input type="text" onChange={(evt) => onUpdate(evt.target.value)} value={text} autoFocus={true}/>
    </div>
}