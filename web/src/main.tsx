import ReactDOM from 'react-dom/client';
import LearningHome from './pages/LearningHome';

// Static preview servers may fall back to this entry for a directory URL without '/'.
if (window.location.pathname === '/experiments/pinyin-garden') {
  window.location.replace(`/experiments/pinyin-garden/${window.location.search}${window.location.hash}`);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(<LearningHome />);
}
