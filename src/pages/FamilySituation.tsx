import React from 'react';
import { useThemeStore } from '../store/themeStore';

const FamilySituation: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-4 text-blue-800 dark:text-blue-300">Family Situation Page</h2>
      <p className="text-gray-800 dark:text-gray-200">Placeholder content for the Family Situation page.</p>
    </div>
  );
};

export default FamilySituation;
