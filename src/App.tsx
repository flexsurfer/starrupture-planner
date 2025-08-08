import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RouteWrapper from './components/RouteWrapper'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/items" replace />} />
        <Route path="/items" element={<RouteWrapper />} />
        <Route path="/recipes" element={<RouteWrapper />} />
        <Route path="/corporations" element={<RouteWrapper />} />
        <Route path="/planner" element={<RouteWrapper />} />
        <Route path="*" element={<Navigate to="/items" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
