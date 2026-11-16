import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import { DataProvider } from "./lib/DataContext.jsx";
import { UIProvider } from "./lib/UIContext.jsx";
import "./styles.css";

// Auth reads accounts from the data store, so DataProvider wraps AuthProvider.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <DataProvider>
        <AuthProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </AuthProvider>
      </DataProvider>
    </HashRouter>
  </React.StrictMode>
);
