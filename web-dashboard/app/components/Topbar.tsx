import { useRouter } from 'next/router';
import { signOut } from '@/auth';
import { Bell, Sun, Moon, ChevronDown } from 'lucide-react';

export default function Topbar() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/sign-in');
  };

  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5" />
        </button>
        <div className="relative">
          <button className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
            <Sun className="h-4 w-4" />
            <Moon className="h-4 w-4" />
            <ChevronDown className="h-4 w-4" />
          </button>
          {/* Dropdown menu (simplified) */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-md shadow-lg z-50 hidden">
            <div className="py-1">
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100">Profile</a>
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100">Settings</a>
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100">Sign out</a>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <span className="hidden md:block text-sm font-medium text-gray-600 dark:text-gray-300">
          Welcome, User
        </span>
        <button onClick={handleSignOut} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}