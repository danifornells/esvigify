import TextToSVG from "text-to-svg/index.js"
import { optimize } from "svgo/lib/svgo.js"
import got from "got"
import download from "download"

export default async function handler(req, res) {
    const { text, font, style } = {
        text: 'Hello world',
        font: 'roboto',
        style: 'regular',
        ...req.query
    }
    const fontDetails = await got(`https://google-webfonts-helper.herokuapp.com/api/fonts/${font}`).json()
    const fontURL = fontDetails.variants.find(v => v.id === style).ttf
    await download(fontURL, 'tmp', {filename: `${font}.ttf`})
    const textToSVG = TextToSVG.loadSync(`tmp/${font}.ttf`)
    const options = {x: 0, y: 0, fontSize: 72, anchor: 'top'}
    const svg = optimize(textToSVG.getSVG(text, options)).data
    // Cache headers and final response
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3900')
    res.status(200).end(svg)
}