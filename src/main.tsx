import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from 'react-router-dom';
import { initializeAuthListener } from './store/authStore'; // Import the initializer

// Initialize the auth listener when the app starts
const unsubscribeAuth = initializeAuthListener();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Optional: Unsubscribe when the root component unmounts (though usually not necessary for root)
// You might handle this differently depending on your app structure
// For example, if App component unmounts and remounts, you might want to manage subscription there.
// window.addEventListener('beforeunload', () => {
//   unsubscribeAuth();
// });
