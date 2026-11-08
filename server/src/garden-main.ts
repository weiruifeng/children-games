import {createGardenApp} from './garden-app';
void createGardenApp().then(app=>app.listen(Number(process.env.PORT??3009),process.env.HOST??'127.0.0.1'));
