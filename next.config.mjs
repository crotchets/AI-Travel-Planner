const nextConfig = {
    reactStrictMode: true,
    output: "standalone",
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate']
        }

        config.resolve = config.resolve || {}
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@supabase/supabase-js$': '@supabase/supabase-js/dist/module/index.js'
        }

        return config
    }
}

export default nextConfig
