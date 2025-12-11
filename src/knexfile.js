require('dotenv').config({ path: '../.env' });
const { knexSnakeCaseMappers } = require('objection');

module.exports = {
  development: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    ...knexSnakeCaseMappers()
  }
};