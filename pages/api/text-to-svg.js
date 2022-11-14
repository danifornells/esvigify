import { tmpdir } from "os"
import { readFile, writeFile } from 'node:fs/promises'
import TextToSVG from "text-to-svg/index.js"
import { optimize } from "svgo/lib/svgo.js"
import got from "got"
import download from "download"

const DOWNLOADED_FONTS_FILE = `${tmpdir()}/fonts.json`

export default async function handler(req, res) {
    const { text, font, style, color, size } = {
        text: 'Hello world',
        font: 'roboto',
        style: 'regular',
        size: 72,
        ...req.query
    }

    // Get downloaded fonts information it there's any
    let downloadedFonts
    try {
        downloadedFonts = await readFile(DOWNLOADED_FONTS_FILE).then(d => JSON.parse(d))
    } catch (e) {
        downloadedFonts = []
    }

    // Get matching font from a font list
    let matchingFont
    try {
        const fontList = await got('https://google-webfonts-helper.herokuapp.com/api/fonts').json()
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

    // Download font file if not downloaded yet
    let downloadedFontData = downloadedFonts.find(f => f.id === matchingFont.id && f.variant === matchingVariant)
    if (!downloadedFontData) {
        try {
            const fontDetails = await got(`https://google-webfonts-helper.herokuapp.com/api/fonts/${matchingFont.id}`).json()
            const fontURL = fontDetails.variants.find(v => v.id === matchingVariant).ttf
            const fontFilename = `${matchingFont.id}-${matchingVariant}.ttf`
            downloadedFontData = {id: matchingFont.id, variant: matchingVariant, path: `${tmpdir()}/${fontFilename}`}
            await download(fontURL, tmpdir(), {filename: fontFilename})
            downloadedFonts.push(downloadedFontData)
            await writeFile(DOWNLOADED_FONTS_FILE, JSON.stringify(downloadedFonts))
        } catch (e) {
            return res.status(400).json({ message: `Cannot download font file` })
        }
    }

    // Render and return the SVG
    try {
        const svg = renderSvg(text, downloadedFontData.path, color, {fontSize: parseInt(size)})
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