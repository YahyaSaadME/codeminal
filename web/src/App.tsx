import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DarkThemeToggle } from "flowbite-react";
import SocialMediaGenerator from './pages/SocialMediaGenerator';
import ExcelExtractorGenerator from './pages/ExcelExtractorGenerator';


// Navigation Component
function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="absolute top-4 left-4 z-10">
      <div className="flex items-center space-x-4">
        <Link
          to={location.pathname === '/excel' ? "/" : "/excel"}
          className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 shadow-sm"
        >
          <ArrowLeft size={18} />
          <span>{location.pathname === "/excel" ? "Social Media Generator" : "Excel Generator"}</span>
        </Link>
      </div>
    </nav>
  );
}

// Main App Component with Router
export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 relative overflow-x-hidden">
        {/* Background pattern */}
        <div className="fixed inset-0 size-full">
          <div className="relative h-full w-full select-none">
            <img
              className="fixed right-0 min-w-dvh opacity-60 dark:hidden"
              alt="Pattern Light"
              src="/pattern-light.svg"
            />
            <img
              className="fixed right-0 hidden min-w-dvh opacity-40 dark:block"
              alt="Pattern Dark"
              src="/pattern-dark.svg"
            />
          </div>
        </div>
        
        {/* Navigation */}
        <Navigation />
        
        {/* Theme toggle */}
        <div className="fixed top-4 right-4 z-50">
          <DarkThemeToggle className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-colors" />
        </div>
        
        {/* Main content */}
        <main className="relative w-full min-h-screen overflow-y-auto px-4 py-24">
          <Routes>
            <Route path="/excel" element={<ExcelExtractorGenerator />} />
            <Route path="*" element={<SocialMediaGenerator />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}