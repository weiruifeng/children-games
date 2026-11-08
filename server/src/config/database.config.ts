import 'dotenv/config';

if (process.env.NODE_ENV === 'production') {
  for (const name of ['MYSQL_HOST','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD']) if (!process.env[name]) throw new Error(`Missing ${name}`);
}
export const DATABASE_CONFIG = {
  timezone: 'Z',
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE ?? 'children_games',
  user: process.env.MYSQL_USER ?? 'children_games_app',
  password: process.env.MYSQL_PASSWORD ?? 'children_games_dev_2026!',
  connectionLimit: 5,
};
