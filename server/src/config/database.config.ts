import 'dotenv/config';

export const DATABASE_CONFIG = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE ?? 'children_games',
  user: process.env.MYSQL_USER ?? 'children_games_app',
  password: process.env.MYSQL_PASSWORD ?? 'children_games_dev_2026!',
  connectionLimit: 5,
};
