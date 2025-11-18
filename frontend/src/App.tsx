import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Expiring from './pages/Expiring';
import Recipes from './pages/Recipes';
import Statistics from './pages/Statistics';
import RecipeBox from './pages/RecipeBox';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/expiring" element={<Expiring />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/recipe-box" element={<RecipeBox />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
