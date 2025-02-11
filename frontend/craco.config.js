// CRACO configuration for webpack customization
module.exports = {
    webpack: {
        configure: (webpackConfig, { env, paths }) => {
            // Add TypeScript module resolution
            webpackConfig.resolve = {
                ...webpackConfig.resolve,
                extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
                modules: ['node_modules', 'src']
            };
            
            // Configure dev server with all settings in one place
            webpackConfig.devServer = {
                port: process.env.PORT || 3001,
                hot: false,
                liveReload: false,
                webSocketServer: false,
                client: {
                    overlay: false,
                    progress: false,
                    logging: 'none'
                },
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
                    'Content-Security-Policy': [
                        "default-src 'self' http://localhost:* http://127.0.0.1:*",
                        "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: blob: file:",
                        "font-src 'self' data:",
                        "media-src 'self' blob: file: mediastream: http://localhost:* http://127.0.0.1:*"
                    ].join('; ')
                },
                // Add proxy configuration for backend
                proxy: {
                    '/api': {
                        target: 'http://localhost:5001',
                        changeOrigin: true
                    },
                    '/ws': {
                        target: 'ws://localhost:5001',
                        ws: true
                    }
                }
            };
            
            // Ensure proper public path for Electron
            webpackConfig.output = {
                ...webpackConfig.output,
                publicPath: process.env.NODE_ENV === 'development' ? '/' : './',
                clean: true
            };
            
            return webpackConfig;
        }
    }
}; 