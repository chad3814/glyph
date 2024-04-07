import { DrawCache, FT_GlyphSlotRec } from "@/freetype";
import { useCallback, useEffect, useRef, useState } from "react";

export default function Canvas() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState<string>('');
    const glyphCache: DrawCache = new Map<string, {glyph: FT_GlyphSlotRec, bitmap?: ImageBitmap}>();

    useEffect(
        () => {
            if (!createGoogleFont) {
                return;
            }
            (async () => {
                const font = await createGoogleFont('Licorice', 2);
                console.log('font:', font);
            })();
        },
        [globalThis.createGoogleFont]
    );

    const onUpdate = useCallback(
        async (str: string) => {
            setText(str);
            console.log('str:', str);
            if (!canvas.current) {
                return;
            }
            const font = FreeType.SetFont('Licorice', 'Regular');
            console.log('font:', font);
            const size = FreeType.SetPixelSize(0, 32 * window.devicePixelRatio);
            console.log('size:', size);
            const cmap = FreeType.SetCharmap(FreeType.FT_ENCODING_UNICODE);
            console.log('cmap:', cmap);

            // if(!size || !cmap) {
            //     console.error('missing something');
            //     return;
            // }
            const lineHeight = size.height >> 6;

            const ctx = canvas.current.getContext('2d');
            if (!ctx) {
                console.error('failed to get canvas context');
                return;
            }
            canvasWrite(ctx, str, 0, lineHeight, glyphCache);
        },
        [canvas, setText, glyphCache]
    );

    return <div>
        <div>
            <canvas width={640} height={400} ref={canvas}/>
        </div>
        <input type="text" onChange={(evt) => onUpdate(evt.target.value)} value={text} autoFocus={true}/>
    </div>
}