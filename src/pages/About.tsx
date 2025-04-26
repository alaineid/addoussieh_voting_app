import React from 'react';
import algorythmLogo from '../assets/Algorythm.png';
import lebanonFlag from '../assets/Flag_of_Lebanon.svg';
import { useThemeStore } from '../store/themeStore';

const About: React.FC = () => {
  const { isDarkMode } = useThemeStore();

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg my-8 transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-800 dark:text-blue-300 border-b dark:border-gray-700 pb-4">About This Project</h2>
      
      <div className="space-y-6 mb-8">
        <p className="text-lg text-gray-800 dark:text-gray-200">
          This voting application is designed to streamline the electoral process, providing a secure and 
          user-friendly platform for collecting and managing voter data. Our system ensures data integrity 
          while offering comprehensive administrative tools for election management.
        </p>
        
        <p className="text-lg text-gray-800 dark:text-gray-200">
          With features like real-time statistics, secure authentication, and customized voter list management, 
          this application serves as a reliable solution for electoral needs.
        </p>
      </div>
      
      <div className="mt-12 border-t dark:border-gray-700 pt-8">
        <h3 className="text-2xl font-semibold mb-6 text-center text-blue-700 dark:text-blue-400">Developed By</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md max-w-xs">
            <img 
              src={algorythmLogo} 
              alt="Algorythm Logo" 
              className="h-20 object-contain mx-auto mb-4"
            />
            <div className="text-center">
              <p className="font-medium text-lg mb-2 dark:text-white">This website is developed by Algorythm</p>
              <a 
                href="https://www.linkedin.com/company/algorythmca/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <i className="fab fa-linkedin"></i>
                Visit our LinkedIn page
              </a>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md max-w-xs">
            <img 
              src={lebanonFlag} 
              alt="Flag of Lebanon" 
              className="h-20 object-contain mx-auto mb-4"
            />
            <div className="text-center">
              <p className="font-medium text-lg mb-2 dark:text-white">Proudly serving Lebanese elections</p>
              <p className="text-gray-600 dark:text-gray-300">Making the electoral process more transparent and accessible</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
