import { Link } from 'react-router-dom';

const quickActions = [
  { name: 'View Inventory', href: '/inventory', icon: '📦', color: 'bg-blue-500' },
  { name: 'Check Expiring', href: '/expiring', icon: '⚠️', color: 'bg-orange-500' },
  { name: 'Generate Recipes', href: '/recipes', icon: '🍳', color: 'bg-green-500' },
  { name: 'View Statistics', href: '/statistics', icon: '📊', color: 'bg-purple-500' },
  { name: 'Recipe Box', href: '/recipe-box', icon: '📚', color: 'bg-pink-500' },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Smart Pantry</h1>
        <p className="text-lg text-gray-600">
          Manage your pantry inventory with AI-powered OCR and recipe generation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="card hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex items-center space-x-4">
              <div className={`${action.color} p-4 rounded-lg text-white text-3xl`}>
                {action.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{action.name}</h3>
                <p className="text-sm text-gray-500">Click to explore</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📸</span>
            <div>
              <h3 className="font-semibold">Image Processing</h3>
              <p className="text-sm text-gray-600">
                Upload images of pantry items and automatically extract product information using OCR
                and AI
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold">AI-Powered Analysis</h3>
              <p className="text-sm text-gray-600">
                Intelligent product recognition and categorization using advanced AI models
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🍳</span>
            <div>
              <h3 className="font-semibold">Recipe Generation</h3>
              <p className="text-sm text-gray-600">
                Generate recipes based on available ingredients with flavor chemistry insights
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="font-semibold">Analytics</h3>
              <p className="text-sm text-gray-600">
                Track inventory, expiration dates, and consumption patterns
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

