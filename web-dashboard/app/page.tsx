import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Expense Tracker Dashboard
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Welcome to your expense tracking dashboard. Use the sidebar to navigate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Summary Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-400">Total Income</h3>
          <p className="text-2xl font-bold text-green-500 mt-2">₹0.00</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-400">Total Expense</h3>
          <p className="text-2xl font-bold text-red-500 mt-2">₹0.00</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-400">Net Savings</h3>
          <p className="text-2xl font-bold mt-2">₹0.00</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-400">Transactions</h3>
          <p className="text-2xl font-bold text-blue-500 mt-2">0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placeholder for charts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="mb-4 text-font-medium text-gray-600 dark:text-gray-300">
            Monthly Trend
          </h3>
          <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400">Chart placeholder</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="mb-4 text-font-medium text-gray-600 dark:text-gray-300">
            Expense by Category
          </h3>
          <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400">Chart placeholder</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="mb-4 text-font-medium text-gray-600 dark:text-gray-300">
          Quick Links
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/transactions"
            className="block bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <div className="flex flex-col items-center">
              <List className="h-6 w-6 text-blue-500 mb-2" />
              <span className="font-medium">View Transactions</span>
            </div>
          </Link>
          <Link
            href="/goals"
            className="block bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <div className="flex flex-col items-center">
              <TrendingUp className="h-6 w-6 text-green-500 mb-2" />
              <span className="font-medium">Manage Goals</span>
            </div>
          </Link>
          <Link
            href="/debts"
            className="block bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <div className="flex flex-col items-center">
              <CreditCard className="h-6 w-6 text-indigo-500 mb-2" />
              <span className="font-medium">Track Debts</span>
            </div>
          </Link>
          <Link
            href="/reports"
            className="block bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <div className="flex flex-col items-center">
              <BarChart3 className="h-6 w-6 text-purple-500 mb-2" />
              <span className="font-medium">View Reports</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}