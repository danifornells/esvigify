module.exports = {
    async rewrites() {
        return {
            beforeFiles: [
                // These rewrites are checked after headers/redirects
                // and before all files including _next/public files which
                // allows overriding page files
                { source: '/render.svg', destination: '/api/text-to-svg' }
            ],
            afterFiles: [
                // These rewrites are checked after pages/public files
                // are checked but before dynamic routes
            ],
            fallback: [],
        }
    }
}