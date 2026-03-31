module.exports = {
  apps: [
    {
      name: 'nightfun-deploy',
      script: 'deploy-server.mjs',
      cwd: '/home/ubuntu/night.fun',
      node_args: '--max-old-space-size=4096',
      env: {
        PORT: 3002,
        NETWORK_ID: 'mainnet',
        PROOF_SERVER_URL: 'http://127.0.0.1:6300',
      },
      max_memory_restart: '4G',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
    },
  ],
};
