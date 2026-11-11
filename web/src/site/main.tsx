import { registerResources } from '../resources/lifecycle';
import ReactDOM from 'react-dom/client';
import { SiteApp } from './SiteApp';
import '../experiments/pinyin-garden/garden.css';
import '../experiments/pinyin-garden/adventure.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<SiteApp />);

void registerResources();
