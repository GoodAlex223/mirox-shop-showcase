/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 for managing the application in production.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --only dropshipping-web
 *
 * Commands:
 *   pm2 status                    - View all processes
 *   pm2 logs                      - View all logs
 *   pm2 logs dropshipping-web     - View web app logs
 *   pm2 restart all               - Restart all processes
 *   pm2 stop all                  - Stop all processes
 *   pm2 delete all                - Remove all processes
 *   pm2 save                      - Save current process list
 *   pm2 startup                   - Generate startup script
 */

module.exports = {
  apps: [
    {
      name: "dropshipping-web",
      script: "npm",
      args: "start",
      cwd: "/var/www/dropshipping",
      instances: "max", // Use all available CPUs
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/pm2/dropshipping-web-error.log",
      out_file: "/var/log/pm2/dropshipping-web-out.log",
      merge_logs: true,
      // Restart behavior
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: "10s",
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Health monitoring
      exp_backoff_restart_delay: 100,
    },
    {
      name: "dropshipping-workers",
      script: "npm",
      args: "run workers",
      cwd: "/var/www/dropshipping",
      instances: 1, // Single instance for workers
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/pm2/dropshipping-workers-error.log",
      out_file: "/var/log/pm2/dropshipping-workers-out.log",
      merge_logs: true,
      // Restart behavior
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: "30s",
      // Graceful shutdown
      kill_timeout: 10000, // Allow more time for workers to finish jobs
    },
  ],

  // Deployment configuration for VPS
  deploy: {
    production: {
      user: "deploy",
      host: ["your-server.com"],
      ref: "origin/main",
      repo: "git@github.com:your-org/dropshipping.git",
      path: "/var/www/dropshipping",
      "pre-deploy-local": "",
      "post-deploy":
        "npm ci --production && npx prisma migrate deploy && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      ssh_options: ["StrictHostKeyChecking=no", "PasswordAuthentication=no"],
    },
    staging: {
      user: "deploy",
      host: ["staging.your-server.com"],
      ref: "origin/develop",
      repo: "git@github.com:your-org/dropshipping.git",
      path: "/var/www/dropshipping-staging",
      "post-deploy":
        "npm ci && npx prisma migrate deploy && npm run build && pm2 reload ecosystem.config.js --env staging",
      env: {
        NODE_ENV: "staging",
      },
    },
  },
};
