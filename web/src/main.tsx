import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ProductList } from "./pages/ProductList";
import { ProductSheet } from "./pages/ProductSheet";
import { ProductDetail } from "./pages/ProductDetail";
import { ProductNew } from "./pages/ProductNew";
import { Masters } from "./pages/Masters";
import { Channels } from "./pages/Channels";
import { SyncStatus } from "./pages/SyncStatus";
import { CsvExport } from "./pages/CsvExport";
import { Users } from "./pages/Users";
import { ExcelImport } from "./pages/ExcelImport";
import "./index.css";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "products", element: <Navigate to="/products/pendant" replace /> },
      { path: "products/pendant", element: <ProductList fixedCategory="PENDANT_LIGHT" /> },
      { path: "products/fan", element: <ProductList fixedCategory="CEILING_FAN" /> },
      { path: "products/sheet", element: <ProductSheet /> },
      { path: "products/new", element: <ProductNew /> },
      { path: "products/:id", element: <ProductDetail /> },
      { path: "makers", element: <Navigate to="/masters" replace /> },
      { path: "masters", element: <Masters /> },
      { path: "channels", element: <Channels /> },
      { path: "sync", element: <SyncStatus /> },
      { path: "exports", element: <CsvExport /> },
      { path: "users", element: <Users /> },
      { path: "imports", element: <ExcelImport /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
