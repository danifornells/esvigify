import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'os'
import * as dotenv from 'dotenv'
dotenv.config()

const { GOOGLE_FONTS_API_KEY } = process.env
const FONT_LIST_FILES = [
    'data/font-list.json',
    `${tmpdir()}/font-list.json`
]

async function run() {
    try {
        console.log('Downloading font list from Google Fonts API ...')
        const response = await fetch('https://www.googleapis.com/webfonts/v1/webfonts?key=' + GOOGLE_FONTS_API_KEY)
        const data = await response.json()
        const fontList = data.items.map((item) => ({
            ...item,
            id: Object.values(item.files)[0].split('/')[4],
            files: Object.entries(item.files).map(([variant, file]) => ({
                variant,
                url: file,
                downloaded: false
            }))
        }))
        await writeFile(FONT_LIST_FILES[0], JSON.stringify(fontList))
        await writeFile(FONT_LIST_FILES[1], JSON.stringify(fontList))
        console.log('Font list downloaded to ' + FONT_LIST_FILES[0])
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    }
}
run()