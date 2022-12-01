import { writeFile } from 'node:fs/promises'
import * as dotenv from 'dotenv'
import got from 'got'
dotenv.config()

const { GOOGLE_FONTS_API_KEY } = process.env
const FONT_LIST_FILE = './data/font-list.js'

async function run() {
    try {
        console.log('Downloading font list from Google Fonts API ...')
        const data = await got('https://www.googleapis.com/webfonts/v1/webfonts?key=' + GOOGLE_FONTS_API_KEY).json()
        const fontList = data.items.map((item) => ({
            ...item,
            id: Object.values(item.files)[0].split('/')[4],
            files: Object.entries(item.files).map(([variant, file]) => ({
                variant,
                url: file,
                downloaded: false
            }))
        }))

        await writeFile(FONT_LIST_FILE, `module.exports = ${JSON.stringify(fontList)}`)
        console.log('Font list downloaded to ' + FONT_LIST_FILE)
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    }
}
run()