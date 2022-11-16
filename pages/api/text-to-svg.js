import { tmpdir } from "os"
import { readFile, writeFile } from 'node:fs/promises'
import TextToSVG from "text-to-svg/index.js"
import { optimize } from "svgo/lib/svgo.js"
import download from "download"

const FONT_LIST_FILE = `${tmpdir()}/font-list.json`

export default async function handler(req, res) {
    const { text, font, style, color, size } = {
        text: 'Hello world',
        font: 'roboto',
        style: 'regular',
        size: 72,
        ...req.query
    }

    // Get font list from disk
    let fontList
    try {
        fontList = await readFile(FONT_LIST_FILE).then(d => JSON.parse(d))
    } catch (e) {
        return res.status(503).json({ message: `No font list available` })
    }

    // Get matching font from a font list
    let matchingFont
    try {
        matchingFont = fontList.find(f => f.id === font || f.family.toLowerCase() === font.toLowerCase())
        if (!matchingFont) throw new Error(`Font ${font} not found`)
    } catch (e) {
        return res.status(400).json({ message: `Font ${font} not found` })
    }

    // Get variant from matching font
    let matchingVariant
    try {
        matchingVariant = matchingFont.variants.find(v => v === style)
        if (!matchingVariant) throw new Error(`Style ${style} not found`)
    } catch (e) {
        return res.status(400).json({ message: [
                `The font '${matchingFont.family}' has no style '${style}' defined`,
                `You can choose one from: ${matchingFont.variants.map(v => `'${v}'`).join(', ')}`
            ].join('. ')
        })
    }

    // Get matching file from matching font & variant
    let matchingFile
    try {
        matchingFile = matchingFont.files.find(f => f.variant === matchingVariant)
        if (!matchingFile) throw new Error(`File for ${matchingFont.family} ${style} not found`)
    } catch (e) {
        return res.status(400).json({ message: `The font '${matchingFont.family}' in '${style}' has no file defined`})
    }

    // Download font file if not downloaded yet
    if (!matchingFile.downloaded) {
        try {
            const fontFileName = `${matchingFont.id}-${matchingVariant}.ttf`
            await download(matchingFile.url, tmpdir(), {filename: fontFileName})
            const fontFilePath = `${tmpdir()}/${fontFileName}`
            matchingFile.downloaded = true
            matchingFile.path = fontFilePath
            await writeFile(FONT_LIST_FILE, JSON.stringify(fontList))
            console.log(`Downloaded '${matchingFont.family}' in '${matchingVariant}' to ${fontFilePath}`)
        } catch (e) {
            return res.status(400).json({ message: `Cannot download font file` })
        }
    }

    // Render and return the SVG
    try {
        const svg = renderSvg(text, matchingFile.path, color, {fontSize: parseInt(size)})
        res.setHeader('Content-Type', 'image/svg+xml')
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3900')
        return res.status(200).end(svg)
    } catch (e) {
        return res.status(500).json({ message: `Cannot render this SVG, something unexpected failed` })
    }
}

const renderSvg = (text, fontFilePath, color, options = {}) => {
    const currentOptions = {
        x: 0,
        y: 0,
        fontSize: 72,
        anchor: 'top',
        ...options
    }
    const textToSVG = TextToSVG.loadSync(fontFilePath)
    const svg = optimize(textToSVG.getSVG(text, currentOptions)).data
    // Make the SVG wider to avoid clipping
    let svgString = svg.toString()
    if (color) svgString = svgString.replace('<path', `<path fill="#${color}"`)
    const originalSvgWidth = parseFloat(svgString.match(/width="([\d.]+)"/)[1])
    return svgString
        .replace(/width="([\d.]+)"/, `width="${originalSvgWidth + (currentOptions.fontSize / 4)}"`)
}