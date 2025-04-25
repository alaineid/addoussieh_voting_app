import React from 'react';

const About: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-800 border-b pb-4">About This Project</h2>
      
      <div className="space-y-6 mb-8">
        <p className="text-lg">
          This voting application is designed to streamline the electoral process, providing a secure and 
          user-friendly platform for collecting and managing voter data. Our system ensures data integrity 
          while offering comprehensive administrative tools for election management.
        </p>
        
        <p className="text-lg">
          With features like real-time statistics, secure authentication, and customized voter list management, 
          this application serves as a reliable solution for electoral needs.
        </p>
      </div>
      
      <div className="mt-12 border-t pt-8">
        <h3 className="text-2xl font-semibold mb-6 text-center text-blue-700">Developed By</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="bg-gray-50 p-6 rounded-lg shadow-md max-w-xs">
            <img 
              src="/src/assets/Algorythm.png" 
              alt="Algorythm Logo" 
              className="h-20 object-contain mx-auto mb-4"
            />
            <div className="text-center">
              <p className="font-medium text-lg mb-2">This website is developed by Algorythm</p>
              <a 
                href="https://www.linkedin.com/company/algorythmca/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                </svg>
                Visit our LinkedIn page
              </a>
            </div>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg shadow-md max-w-xs">
            <img 
              src="/src/assets/Flag_of_Lebanon.svg" 
              alt="Flag of Lebanon" 
              className="h-20 object-contain mx-auto mb-4"
            />
            <div className="text-center">
              <p className="font-medium text-lg mb-2">Proudly serving Lebanese elections</p>
              <p className="text-gray-600">Making the electoral process more transparent and accessible</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
