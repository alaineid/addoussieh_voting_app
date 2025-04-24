import React from 'react';

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
      <h1 className="text-4xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
      <p className="text-lg text-gray-700 mb-6">
        You do not have the necessary permissions to access this page.
      </p>
      <p className="text-md text-gray-500">
        Please contact the administrator if you believe this is an error.
      </p>
    </div>
  );
};

export default Unauthorized;