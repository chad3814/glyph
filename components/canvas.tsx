import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useFontManager } from "./font-manager";
import { FT_GlyphSlotRec } from "@/freetype";

export default function Canvas() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState<string>('Hello World!');
    const [fontName, setFontName] = useState<string>('Licorice');
    const [fontStyle, setFontStyle] = useState<string>('regular');
    const [availableStyles, setAvailableStyles] = useState<string[]>(['regular']);
    const fontManager = useFontManager();

    const draw = useCallback(
        async (str: string, fntName = fontName, fntStyle = fontStyle) => {
            if (!canvas.current) {
                console.error('draw, no canvas');
                return;
            }
            const font = fontManager.getFontInfo(fntName);
            if (!font) {
                console.error('draw, no font');
                return;
            }
            if (!font.variants.includes(fntStyle)) {
                console.error('draw, no variant');
                return;
            }

            const glyphs = await fontManager.getGlyphs(fntName, fntStyle, 0, 32 * window.devicePixelRatio, str);
            console.log('draw, glyphs:', glyphs);
            const lineHeight = (glyphs[0]?.metrics.height ?? 32 * 64) / 64;
            const ctx = canvas.current.getContext('2d');
            if (!ctx) {
                console.error('failed to get canvas context');
                return;
            }
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);

            let x = 20;
            let y = lineHeight * 2;
            let prev: FT_GlyphSlotRec | null = null;
            for (const glyph of glyphs) {
                if (!glyph || !glyph.bitmap.imagedata) continue;
                const image = await createImageBitmap(glyph.bitmap.imagedata);
                if (prev) {
                    const kerning = fontManager.getKerning(prev, glyph);
                    x += kerning.x / 64;
                    y += kerning.y / 64;
                }
                prev = glyph;
                console.log(`draw, (${x + glyph.bitmap_left}, ${y - glyph.bitmap_top})`, image, glyph);
                ctx.drawImage(image, x + glyph.bitmap_left, y - glyph.bitmap_top);
                x += glyph.advance.x / 64;
                y += glyph.advance.y / 64;
            }
        },
        [fontName, fontStyle, fontManager]
    );

    useEffect(
        () => {
            if (!fontManager) {
                console.error('no font manager');
                return;
            }
            (async () => {
                try {
                    await fontManager.loadFont(fontName, fontStyle);
                    draw(text);
                } catch (err) {
                    console.error('error:', err);
                    setFontName('Licorice');
                    setFontStyle('regular');
                    draw(text, 'Licorice', 'regular');
                }
            })();
        },
        [text, fontName, fontStyle, setFontName, setFontStyle, draw, fontManager, fontManager.loadFont]
    );

    const onUpdate = useCallback(
        (str: string) => {
            setText(str);
            draw(str);
        },
        [setText, draw]
    );

    const changeFont = useCallback(
        (evt: ChangeEvent<HTMLSelectElement>) => {
            fontManager.unloadFont(fontName, fontStyle);
            const family = evt.target.value;
            const fontInfo = fontManager.getFontInfo(family);

            if (!fontInfo) {
                console.error('no font');
                return;
            }
            const style = fontInfo.variants.includes(fontStyle) ? fontStyle : fontInfo.variants[0];
            setAvailableStyles(fontInfo.variants);
            setFontStyle(style);
            setFontName(family);
        },
        [setFontName, setAvailableStyles, fontManager, fontName, fontStyle],
    );

    const changeStyle = useCallback(
        (evt: ChangeEvent<HTMLSelectElement>) => {
            const style = evt.target.value;
            console.log('changeStyle', style);
            setFontStyle(style);
            draw(text, fontName, style);
        },
        [setFontStyle, fontName, text, draw]
    );

    return <div>
        <div>
            <canvas width={640} height={400} ref={canvas}/>
            <select onChange={changeFont} value={fontName}>
                {
                    fontManager.getFamilies().map(family => <option key={family}>{family}</option>)
                }
            </select>
            <select onChange={changeStyle} value={fontStyle}>
                {
                    availableStyles.map(style => <option key={style}>{style}</option>)
                }
            </select>
        </div>
        <input type="text" onChange={(evt) => onUpdate(evt.target.value)} value={text} autoFocus={true}/>
    </div>
}