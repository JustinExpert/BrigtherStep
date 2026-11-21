import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import { DataProvider } from "./lib/DataContext.jsx";
import { UIProvider } from "./lib/UIContext.jsx";
import "./styles.css";

// Auth reads accounts from the data store, so DataProvider wraps AuthProvider.
// Old links used "#/path" (e.g. /#/login or emailed reset links); move them to the clean "/path".
if (location.hash.startsWith("#/")) history.replaceState(null, "", location.hash.slice(1));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <DataProvider>
        <AuthProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </AuthProvider>
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>
);
