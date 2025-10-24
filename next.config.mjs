const nextConfig = {
    reactStrictMode: true,
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate']
        }

        return config
    }
}

export default nextConfig
