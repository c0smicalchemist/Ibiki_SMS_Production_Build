module.exports = {
  apps: [{
    name: 'ibiki-sms',
    script: 'dist/index.js',
    cwd: '/opt/ibiki-sms',
    instances: 2, // 2 workers for 2 CPU cores
    exec_mode: 'cluster', // Enable cluster mode for load balancing
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      HOST: '0.0.0.0',
      // SMS Queue Configuration
      ENABLE_SMS_QUEUE: 'true',
      SMS_WORKER_CONCURRENCY: '50', // 50 concurrent SMS per worker
      SMS_RATE_LIMIT: '200', // Max 200 SMS/second per worker
      REDIS_URL: 'redis://127.0.0.1:6379',
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      HOST: '0.0.0.0',
      ENABLE_SMS_QUEUE: 'true',
      SMS_WORKER_CONCURRENCY: '50',
      SMS_RATE_LIMIT: '200',
      REDIS_URL: 'redis://127.0.0.1:6379',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
